const FeedbackSession = require("../models/FeedbackSession");
const SessionResponse = require("../models/SessionResponse");
const User = require("../models/User");
const { assertRole, id } = require("./academicSupport");
const { eligibleFilter, openFilter, state } = require("./feedbackAvailability");
const { parseResponse, parseStudentQuery } = require("../validators/sessionResponseValidator");
const error = require("../utils/authError");
const duplicate = () => error(409, "You have already submitted this feedback session.", "ALREADY_SUBMITTED");
const unavailable = () => error(409, "This feedback session is not currently available.", "SESSION_UNAVAILABLE");
const student = async user => {
  assertRole(user, "STUDENT");
  const current = await User.findOne({ _id: user._id, role: "STUDENT", isActive: true, mustChangePassword: false }).select("departmentId semester section batch").lean();
  if (!current) throw error(403, "Student account unavailable.");
  return current;
};
const populate = query => query.populate("subjectId", "code name").populate("classGroupId", "semester section academicYear").populate("facultyId", "name");
const safe = (session, detail = false) => ({ id: String(session._id), title: session.title, description: session.description,
  subject: session.subjectId ? { code: session.subjectId.code, name: session.subjectId.name } : null,
  faculty: session.facultyId ? { name: session.facultyId.name } : null,
  classGroup: session.audience ? { semester: session.audience.semester, section: session.audience.section, academicYear: session.audience.academicYear } : null,
  allowAnonymous: session.allowAnonymous, opensAt: session.opensAt, closesAt: session.closesAt, availability: state(session),
  ...(detail ? { questions: session.questions.map(question => ({ id: String(question._id), type: question.type, prompt: question.prompt, required: question.required,
    ...(question.options ? { options: question.options } : {}), ...(question.type === "RATING" ? { ratingMin: 1, ratingMax: 5 } : {}) })) } : {}),
});
const completion = response => ({ submittedAt: response.submittedAt, identityMode: response.identityMode });
const pagination = (query, total) => ({ page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit), hasNextPage: query.page * query.limit < total, hasPreviousPage: query.page > 1 && total > 0 });
const pendingPipeline = (current, now) => [
  { $match: { ...eligibleFilter(current), ...openFilter(now) } },
  { $lookup: { from: SessionResponse.collection.name, let: { session: "$_id" }, pipeline: [
    { $match: { $expr: { $and: [{ $eq: ["$sessionId", "$$session"] }, { $eq: ["$studentId", current._id] }] } } }, { $project: { _id: 1 } }, { $limit: 1 },
  ], as: "completion" } }, { $match: { "completion.0": { $exists: false } } },
];
const list = async (user, options = {}) => {
  const current = await student(user), query = parseStudentQuery(options);
  if (query.category === "completed") {
    const filter = { studentId: current._id };
    const [responses, total] = await Promise.all([SessionResponse.find(filter).select("sessionId submittedAt identityMode").sort({ submittedAt: -1, _id: -1 }).skip((query.page - 1) * query.limit).limit(query.limit).populate({ path: "sessionId", populate: [{ path: "subjectId", select: "code name" }, { path: "facultyId", select: "name" }] }).lean(), SessionResponse.countDocuments(filter)]);
    return { items: responses.map(response => ({ ...(response.sessionId ? safe(response.sessionId) : { id: null, title: "Unavailable session" }), completion: completion(response) })), pagination: pagination(query, total) };
  }
  const [result] = await FeedbackSession.aggregate([...pendingPipeline(current, new Date()), { $facet: {
    items: [{ $sort: { createdAt: -1, _id: -1 } }, { $skip: (query.page - 1) * query.limit }, { $limit: query.limit }], total: [{ $count: "count" }],
  } }]);
  const items = await populate(FeedbackSession.find({ _id: { $in: result.items.map(value => value._id) }, ...eligibleFilter(current), ...openFilter(new Date()) })).sort({ createdAt: -1, _id: -1 }).lean();
  return { items: items.map(value => safe(value)), pagination: pagination(query, result.total[0]?.count || 0) };
};
const getEligible = async (user, identifier) => {
  const current = await student(user);
  const session = await FeedbackSession.findOne({ _id: id(identifier), ...eligibleFilter(current), status: { $in: ["OPEN", "CLOSED"] } });
  if (!session) throw error(404, "Feedback session unavailable.");
  if (await SessionResponse.exists({ sessionId: session._id, studentId: current._id })) throw duplicate();
  if (state(session) !== "OPEN") throw unavailable();
  return { current, session };
};
const get = async (user, identifier) => {
  const { session } = await getEligible(user, identifier);
  await session.populate([{ path: "subjectId", select: "code name" }, { path: "facultyId", select: "name" }]);
  return safe(session, true);
};
const submit = async (user, identifier, body) => {
  const { current, session } = await getEligible(user, identifier);
  const fields = parseResponse(body, session);
  const freeTextIds = new Set(session.questions.filter(question => question.type === "SHORT_ANSWER").map(question => String(question._id)));
  for (const answer of fields.answers) if (freeTextIds.has(String(answer.questionId))) require("./contentModerationService").validateText(answer.value);
  await SessionResponse.init();
  // This conditional session write is the admission point, ordered atomically
  // against manual Close. Already-admitted requests may finish after Close.
  // Recheck dates here, after validation/index initialization, using server time.
  const submittedAt = new Date();
  const admitted = await FeedbackSession.updateOne({ _id: session._id, ...eligibleFilter(current), ...openFilter(submittedAt) }, { $inc: { __v: 1 } });
  if (!admitted.matchedCount) throw unavailable();
  try {
    const response = await SessionResponse.create({ sessionId: session._id, studentId: current._id, ...fields, submittedAt });
    return { sessionId: String(session._id), ...completion(response) };
  } catch (err) { if (err.code === 11000) throw duplicate(); throw err; }
};
const counts = async user => {
  const current = await student(user);
  const [pending, completed] = await Promise.all([FeedbackSession.aggregate([...pendingPipeline(current, new Date()), { $count: "count" }]), SessionResponse.countDocuments({ studentId: current._id })]);
  return { "Pending Feedback Sessions": pending[0]?.count || 0, "Completed Feedback Sessions": completed };
};
module.exports = { list, get, submit, counts };
