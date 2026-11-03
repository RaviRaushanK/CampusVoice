const mongoose = require("mongoose");
const User = require("../models/User"), Department = require("../models/Department"), Subject = require("../models/Subject"), ClassGroup = require("../models/ClassGroup"), Assignment = require("../models/FacultyAssignment");
const Feedback = require("../models/Feedback"), Session = require("../models/FeedbackSession"), Response = require("../models/SessionResponse"), Suggestion = require("../models/Suggestion"), Complaint = require("../models/Complaint");
const { assertRole, ownDepartment } = require("./academicSupport");
const { stateExpression, recipientExpression } = require("./feedbackAvailability");
const complaints = require("./complaintService"), feedback = require("./generalFeedbackService");
const { parse } = require("../validators/analyticsValidator");
const { TYPES, STATUSES, PRIORITIES } = require("../utils/constants/complaints");
const { GROUP_LIMIT, PROCESSING_LIMIT } = require("../utils/constants/analytics");
const { mergeSort } = require("../utils/dsa/sort"), { binarySearch, linearSearchAll } = require("../utils/dsa/search");
const Queue = require("../utils/dsa/Queue"), PriorityQueue = require("../utils/dsa/PriorityQueue");
const staff = user => assertRole(user, "PRINCIPAL", "HOD", "FACULTY");
const dateFilter = (range, field = "createdAt") => ({ [field]: { $gte: range.dateFrom, $lt: range.endExclusive } });
const meta = range => ({ dateFrom: range.dateFrom.toISOString().slice(0, 10), dateTo: range.dateTo.toISOString().slice(0, 10), timezone: "UTC", bucket: "month" });
const percent = (count, denominator) => denominator ? Number((count / denominator * 100).toFixed(2)) : 0;
const distribution = (values, rows) => { const counts = new Map(rows.map(row => [row._id, row.count])); return values.map(label => ({ label: String(label), count: counts.get(label) || 0 })); };
const trendStage = field => [{ $group: { _id: { $dateToString: { format: "%Y-%m", date: `$${field}`, timezone: "UTC" } }, count: { $sum: 1 } } }];
const trend = (range, rows) => {
  const sorted = mergeSort(rows, (a, b) => a._id.localeCompare(b._id)), output = [];
  for (let index = 0; index < range.months; index++) {
    const key = new Date(Date.UTC(range.dateFrom.getUTCFullYear(), range.dateFrom.getUTCMonth() + index, 1)).toISOString().slice(0, 7);
    const found = binarySearch(sorted, key, (row, value) => row._id.localeCompare(value)); output.push({ label: key, count: found < 0 ? 0 : sorted[found].count });
  }
  return output;
};
const academic = async user => {
  staff(user); const departmentId = user.role === "HOD" ? await ownDepartment(user) : user.departmentId;
  if (user.role === "FACULTY") return {};
  const filter = user.role === "HOD" ? { departmentId } : {};
  const values = await Promise.all([User.countDocuments({ ...filter, role: "FACULTY", isActive: true }), User.countDocuments({ ...filter, role: "STUDENT", isActive: true }),
    ...(user.role === "PRINCIPAL" ? [Department.countDocuments(), User.countDocuments({ role: "HOD", isActive: true })] : [Subject.countDocuments(filter), ClassGroup.countDocuments(filter), Assignment.countDocuments({ ...filter, isActive: true })])]);
  const keys = user.role === "PRINCIPAL" ? ["Active Faculty", "Active Students", "Departments", "Active HODs"] : ["Active Faculty", "Active Students", "Subjects", "Classes", "Active Assignments"];
  return Object.fromEntries(keys.map((key, index) => [key, values[index]]));
};
const facultyScope = async user => {
  if (user.role === "FACULTY") return { facultyId: user._id };
  if (user.role === "HOD") return feedback.scope(user, "department");
  staff(user); return {};
};
const scopeWithSubject = async (user, range) => ({ ...await facultyScope(user), ...(range.subjectId ? { subjectId: new mongoose.Types.ObjectId(String(range.subjectId)) } : {}) });
const feedbackStats = async (user, range) => {
  const filter = { ...await scopeWithSubject(user, range), ...dateFilter(range) };
  const groupField = user.role === "PRINCIPAL" ? "departmentId" : "subjectId", collection = user.role === "PRINCIPAL" ? "departments" : "subjects";
  const [result] = await Feedback.aggregate([{ $match: filter }, { $facet: {
    ratings: [{ $group: { _id: "$rating", count: { $sum: 1 } } }], trend: trendStage("createdAt"),
    groups: [{ $group: { _id: `$${groupField}`, count: { $sum: 1 }, averageRating: { $avg: "$rating" } } }, { $sort: { _id: 1 } }, { $limit: GROUP_LIMIT + 1 }, { $lookup: { from: collection, localField: "_id", foreignField: "_id", pipeline: [{ $project: { _id: 0, code: 1, name: 1 } }], as: "context" } }],
  } }]);
  const total = result.ratings.reduce((sum, row) => sum + row.count, 0), ratingSum = result.ratings.reduce((sum, row) => sum + row.count * row._id, 0);
  return { total, averageRating: total ? Number((ratingSum / total).toFixed(2)) : null, distribution: distribution([1, 2, 3, 4, 5], result.ratings), trend: trend(range, result.trend), groupBy: user.role === "PRINCIPAL" ? "Department" : "Subject",
    groups: result.groups.slice(0, GROUP_LIMIT).map(row => ({ label: row.context[0] ? `${row.context[0].code} — ${row.context[0].name}` : "Unavailable academic context", count: row.count, averageRating: Number(row.averageRating.toFixed(2)) })), groupsTruncated: result.groups.length > GROUP_LIMIT };
};
const sessionStats = async (user, range) => {
  const filter = { ...await scopeWithSubject(user, range), ...dateFilter(range) };
  if (user.role !== "FACULTY") filter.status = { $in: ["OPEN", "CLOSED"] };
  const publishedFilter = { ...filter, status: { $in: ["OPEN", "CLOSED"] } };
  const [result] = await Session.aggregate([{ $match: filter }, { $facet: {
    states: [{ $group: { _id: stateExpression(), count: { $sum: 1 } } }],
    questions: [{ $unwind: "$questions" }, { $group: { _id: "$questions.type", count: { $sum: 1 } } }],
    published: [{ $match: { status: { $in: ["OPEN", "CLOSED"] } } }, { $count: "count" }],
  } }]);
  const stateMap = new Map(["DRAFT", "SCHEDULED", "OPEN", "CLOSED"].map(key => [key, 0]));
  for (const row of result.states) stateMap.set(row._id, row.count);
  // MongoDB counts current cohort membership per published session using the
  // same predicate as Phase 6; only scalar totals leave the aggregation.
  const [participation] = await Session.aggregate([{ $match: publishedFilter },
    { $lookup: { from: "users", let: { department: "$departmentId", semester: "$audience.semester", section: "$audience.section", batch: "$audience.batch" }, pipeline: [{ $match: { role: "STUDENT", isActive: true, $expr: recipientExpression({ departmentId: "$$department", semester: "$$semester", section: "$$section", batch: "$$batch" }) } }, { $count: "count" }], as: "eligible" } },
    { $lookup: { from: "sessionresponses", localField: "_id", foreignField: "sessionId", pipeline: [{ $match: { identityMode: { $in: ["ANONYMOUS", "NAMED"] }, ...dateFilter(range, "submittedAt") } }, { $group: { _id: "$identityMode", count: { $sum: 1 } } }], as: "responses" } },
    { $project: { eligible: { $ifNull: [{ $arrayElemAt: ["$eligible.count", 0] }, 0] }, responses: 1 } },
    { $group: { _id: null, eligibleOpportunities: { $sum: "$eligible" }, responses: { $sum: { $sum: "$responses.count" } }, anonymous: { $sum: { $sum: { $map: { input: { $filter: { input: "$responses", as: "r", cond: { $eq: ["$$r._id", "ANONYMOUS"] } } }, as: "r", in: "$$r.count" } } } }, named: { $sum: { $sum: { $map: { input: { $filter: { input: "$responses", as: "r", cond: { $eq: ["$$r._id", "NAMED"] } } }, as: "r", in: "$$r.count" } } } } } },
  ]);
  const responseTrend = await Response.aggregate([{ $match: { identityMode: { $in: ["ANONYMOUS", "NAMED"] }, ...dateFilter(range, "submittedAt") } }, { $lookup: { from: "feedbacksessions", localField: "sessionId", foreignField: "_id", pipeline: [{ $match: publishedFilter }, { $project: { _id: 1 } }], as: "session" } }, { $match: { "session.0": { $exists: true } } }, ...trendStage("submittedAt")]);
  const total = [...stateMap.values()].reduce((sum, value) => sum + value, 0), responses = participation?.responses || 0, eligibleOpportunities = participation?.eligibleOpportunities || 0;
  return { total, published: result.published[0]?.count || 0, distribution: [...stateMap].map(([label, count]) => ({ label, count })), totalResponses: responses, eligibleOpportunities, participationRate: percent(responses, eligibleOpportunities), anonymous: participation?.anonymous || 0, named: participation?.named || 0,
    questionTypes: distribution(["SINGLE_CHOICE", "MULTI_SELECT", "RATING", "SHORT_ANSWER"], result.questions), trend: trend(range, responseTrend) };
};
const complaintStats = async (user, range) => {
  const filter = { ...complaints.scope(user), ...dateFilter(range), ...Object.fromEntries(["type", "status", "priority"].filter(key => range[key]).map(key => [key, range[key]])) };
  const [result] = await Complaint.aggregate([{ $match: filter }, { $facet: {
    status: [{ $group: { _id: "$status", count: { $sum: 1 } } }], type: [{ $group: { _id: "$type", count: { $sum: 1 } } }], priority: [{ $group: { _id: "$priority", count: { $sum: 1 } } }], trend: trendStage("createdAt"),
    flags: [{ $group: { _id: null, escalated: { $sum: { $cond: [{ $gt: ["$escalationLevel", 0] }, 1, 0] } }, escalationRequests: { $sum: { $cond: ["$escalationRequestedAt", 1, 0] } }, escalatedToPrincipal: { $sum: { $cond: [{ $and: [{ $gt: ["$escalationLevel", 0] }, { $eq: ["$currentHandlerRole", "PRINCIPAL"] }] }, 1, 0] } } } }],
  } }]);
  const status = distribution(STATUSES, result.status), counts = new Map(status.map(row => [row.label, row.count]));
  // Excluded categories are omitted as well as excluded records, so the chart
  // never presents a target's forbidden complaint category as their metric.
  const types = user.role === "FACULTY" ? [TYPES.FACULTY_ISSUE] : user.role === "HOD" ? [TYPES.FACULTY_ISSUE, TYPES.AGAINST_FACULTY, TYPES.DEPARTMENT_ISSUE] : Object.values(TYPES);
  return { total: result.status.reduce((sum, row) => sum + row.count, 0), pending: status.filter(row => !["RESOLVED", "CLOSED"].includes(row.label)).reduce((sum, row) => sum + row.count, 0), resolved: counts.get("RESOLVED"), closed: counts.get("CLOSED"), escalated: result.flags[0]?.escalated || 0, escalationRequests: result.flags[0]?.escalationRequests || 0, escalatedToPrincipal: result.flags[0]?.escalatedToPrincipal || 0, urgent: result.priority.find(row => row._id === "URGENT")?.count || 0,
    status, types: distribution(types, result.type), priorities: distribution(PRIORITIES, result.priority), trend: trend(range, result.trend) };
};
const suggestionStats = async (user, range) => {
  assertRole(user, "FACULTY"); const [result] = await Suggestion.aggregate([{ $match: { facultyId: user._id, ...dateFilter(range) } }, { $facet: { identity: [{ $group: { _id: "$identityMode", count: { $sum: 1 } } }], trend: trendStage("createdAt") } }]);
  const identity = distribution(["ANONYMOUS", "NAMED"], result.identity); return { total: identity.reduce((sum, row) => sum + row.count, 0), identity, trend: trend(range, result.trend) };
};
const summary = async (user, range) => {
  assertRole(user, "STUDENT"); const filter = { studentId: user._id, ...dateFilter(range) };
  const [completed, feedbackCount, suggestionCount, complaint] = await Promise.all([Response.countDocuments({ studentId: user._id, ...dateFilter(range, "submittedAt") }), Feedback.countDocuments(filter), Suggestion.countDocuments(filter), complaintStats(user, range)]);
  return { "Sessions Completed": completed, "Feedback Submitted": feedbackCount, "Suggestions Sent": suggestionCount, "Complaints Submitted": complaint.total, "Open Complaints": complaint.pending, "Resolved Complaints": complaint.resolved };
};
const get = async (user, kind, query = {}) => {
  const range = parse(query, kind);
  if (user.role === "STUDENT") { assertRole(user, ...(kind === "summary" ? ["STUDENT"] : [])); return { period: meta(range), summary: await summary(user, range) }; }
  staff(user);
  if (kind === "feedback") return { period: meta(range), feedback: await feedbackStats(user, range) };
  if (kind === "sessions") return { period: meta(range), sessions: await sessionStats(user, range) };
  if (kind === "complaints") return { period: meta(range), complaints: await complaintStats(user, range) };
  if (kind === "overview") {
    const [overview, feedbackResult, sessions, complaintResult, suggestions] = await Promise.all([academic(user), feedbackStats(user, range), sessionStats(user, range), complaintStats(user, range), ...(user.role === "FACULTY" ? [suggestionStats(user, range)] : [])]);
    return { period: meta(range), overview, feedback: feedbackResult, sessions, complaints: complaintResult, ...(user.role === "FACULTY" ? { suggestions } : {}) };
  }
  throw require("../utils/authError")(403, "Analytics unavailable for this role.");
};
const processing = async (user, query = {}) => {
  staff(user); const range = parse(query, "complaint-processing"), hasDateFilter = query.dateFrom !== undefined || query.dateTo !== undefined;
  const filter = { ...complaints.scope(user), currentHandlerId: user._id, currentHandlerRole: user.role, ...(hasDateFilter ? dateFilter(range) : {}), status: { $nin: ["RESOLVED", "CLOSED"] }, ...Object.fromEntries(["type", "priority"].filter(key => range[key]).map(key => [key, range[key]])) };
  if (range.status) filter.$and = [{ status: range.status }, { status: { $nin: ["RESOLVED", "CLOSED"] } }];
  const rows = await Complaint.aggregate([{ $match: filter }, ...(range.mode === "priority" ? [{ $set: { weight: { $switch: { branches: [{ case: { $eq: ["$priority", "URGENT"] }, then: 0 }, { case: { $eq: ["$priority", "HIGH"] }, then: 1 }], default: 2 } } } }] : []),
    { $sort: { ...(range.mode === "priority" ? { weight: 1 } : {}), createdAt: 1, _id: 1 } }, { $limit: PROCESSING_LIMIT + 1 }, { $project: { title: 1, type: 1, status: 1, priority: 1, createdAt: 1 } }]);
  const compareTime = (a, b) => new Date(a.createdAt) - new Date(b.createdAt) || String(a._id).localeCompare(String(b._id));
  const weights = new Map([["URGENT", 0], ["HIGH", 1], ["NORMAL", 2]]), queue = range.mode === "fifo" ? new Queue() : new PriorityQueue((a, b) => weights.get(a.priority) - weights.get(b.priority) || compareTime(a, b));
  const window = rows.slice(0, PROCESSING_LIMIT), selected = range.search ? linearSearchAll(window, row => row.title.toLocaleLowerCase("en").includes(range.search) || String(row._id) === range.search) : window;
  for (const row of selected) queue.enqueue(row);
  const items = []; while (!queue.isEmpty()) { const value = queue.dequeue(); items.push({ id: String(value._id), title: value.title, type: value.type, status: value.status, priority: value.priority, createdAt: value.createdAt }); }
  return { period: hasDateFilter ? meta(range) : null, mode: range.mode, limit: PROCESSING_LIMIT, truncated: rows.length > PROCESSING_LIMIT, searchedWithin: window.length, items };
};
module.exports = { get, processing };
