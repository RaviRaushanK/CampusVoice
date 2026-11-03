const mongoose = require("mongoose");
const FeedbackSession = require("../models/FeedbackSession");
const SessionResponse = require("../models/SessionResponse");
const User = require("../models/User");
const { assertRole } = require("./academicSupport");
const { state, recipientFilter } = require("./feedbackAvailability");
const { parseResultsQuery, id } = require("../validators/feedbackResultsValidator");
const { IDENTITY_MODES, LIMITS } = require("../utils/constants/feedback");
const error = require("../utils/authError");
const percent = (count, denominator) => denominator ? Number((count / denominator * 100).toFixed(2)) : 0;
const ownedPublished = async (user, identifier) => {
  assertRole(user, "FACULTY");
  const session = await FeedbackSession.findOne({ _id: id(identifier), facultyId: user._id }).populate("subjectId", "code name").lean();
  if (!session) throw error(404, "Feedback session unavailable.");
  if (!["OPEN", "CLOSED"].includes(session.status)) throw error(409, "Results are available only for published sessions.");
  return session;
};
const safeSession = session => ({ id: String(session._id), title: session.title, description: session.description,
  status: session.status, availability: state(session), opensAt: session.opensAt, closesAt: session.closesAt,
  publishedAt: session.publishedAt, closedAt: session.closedAt,
  subject: session.subjectId ? { code: session.subjectId.code, name: session.subjectId.name } : null,
  classGroup: session.audience ? { semester: session.audience.semester, section: session.audience.section, academicYear: session.audience.academicYear, batch: session.audience.batch } : null,
});
const validAnswer = (question, value) => {
  if (question.type === "SINGLE_CHOICE") return typeof value === "string" && question.options.includes(value);
  if (question.type === "MULTI_SELECT") return Array.isArray(value) && value.length > 0 && value.length <= LIMITS.options && new Set(value).size === value.length && value.every(option => typeof option === "string" && question.options.includes(option));
  if (question.type === "RATING") return Number.isInteger(value) && value >= 1 && value <= 5;
  return question.type === "SHORT_ANSWER" && typeof value === "string" && value.trim().length > 0 && value.length <= LIMITS.answer;
};
const getResults = async (user, identifier, query = {}) => {
  parseResultsQuery(query);
  const session = await ownedPublished(user, identifier);
  // Reuse the exact notification/participation cohort rules. This denominator
  // is current active membership; historical responses remain in the numerator.
  const eligibleStudents = session.audience ? await User.countDocuments(recipientFilter(session)) : 0;
  const counters = new Map(session.questions.map(question => [String(question._id), { question, answered: 0, sum: 0,
    options: new Map((question.options || []).map(option => [option, 0])), ratings: [0, 0, 0, 0, 0] }]));
  let totalResponses = 0, anonymousResponses = 0, namedResponses = 0;
  // One streamed, session-scoped response query. No identities, response IDs,
  // timestamps or text collections are accumulated in the analytics payload.
  for await (const response of SessionResponse.find({ sessionId: session._id, identityMode: { $in: Object.values(IDENTITY_MODES) } }).select("identityMode answers -_id").lean().cursor()) {
    totalResponses++;
    if (response.identityMode === IDENTITY_MODES.ANONYMOUS) anonymousResponses++; else namedResponses++;
    const seen = new Set();
    for (const answer of response.answers) {
      const key = String(answer.questionId), counter = counters.get(key);
      if (!counter || seen.has(key)) continue;
      seen.add(key);
      if (!validAnswer(counter.question, answer.value)) continue;
      counter.answered++;
      if (counter.question.type === "SINGLE_CHOICE") counter.options.set(answer.value, counter.options.get(answer.value) + 1);
      if (counter.question.type === "MULTI_SELECT") for (const option of answer.value) counter.options.set(option, counter.options.get(option) + 1);
      if (counter.question.type === "RATING") { counter.sum += answer.value; counter.ratings[answer.value - 1]++; }
    }
  }
  const questions = [...counters.values()].map(counter => ({ questionId: String(counter.question._id), type: counter.question.type,
    prompt: counter.question.prompt, required: counter.question.required, answeredCount: counter.answered, skippedCount: totalResponses - counter.answered,
    ...(["SINGLE_CHOICE", "MULTI_SELECT"].includes(counter.question.type) ? { options: [...counter.options].map(([option, count]) => ({ option, count, percentage: percent(count, counter.answered) })) } : {}),
    ...(counter.question.type === "RATING" ? { average: counter.answered ? Number((counter.sum / counter.answered).toFixed(2)) : null,
      distribution: counter.ratings.map((count, index) => ({ rating: index + 1, count, percentage: percent(count, counter.answered) })) } : {}),
  }));
  return { session: safeSession(session), summary: { eligibleStudents, totalResponses, responseRate: percent(totalResponses, eligibleStudents), anonymousResponses, namedResponses,
    totalQuestions: session.questions.length, requiredQuestions: session.questions.filter(question => question.required).length }, questions };
};
const getShortAnswers = async (user, identifier, questionIdentifier, query = {}) => {
  const { page, limit } = parseResultsQuery(query, true);
  const session = await ownedPublished(user, identifier);
  id(questionIdentifier);
  const question = session.questions.find(value => String(value._id) === String(questionIdentifier).toLowerCase());
  if (!question || question.type !== "SHORT_ANSWER") throw error(404, "Short-answer question unavailable.");
  const questionId = new mongoose.Types.ObjectId(String(question._id));
  const [result] = await SessionResponse.aggregate([
    { $match: { sessionId: session._id, identityMode: { $in: Object.values(IDENTITY_MODES) } } },
    { $project: { identityMode: 1, _id: 1,
      // Anonymous Student IDs are removed inside MongoDB, before application
      // mapping. Only named IDs from this page may be looked up for display.
      namedStudentId: { $cond: [{ $eq: ["$identityMode", IDENTITY_MODES.NAMED] }, "$studentId", "$$REMOVE"] },
      answer: { $arrayElemAt: [{ $filter: { input: "$answers", as: "answer", cond: { $eq: ["$$answer.questionId", questionId] } } }, 0] },
    } },
    { $match: { "answer.value": { $type: "string" } } },
    { $set: { text: { $trim: { input: "$answer.value" } } } },
    { $match: { text: { $ne: "" }, $expr: { $lte: [{ $strLenCP: "$text" }, LIMITS.answer] } } },
    // Text-based order differs by question. Internal IDs only break ties;
    // neither a stable anonymous row identifier nor timestamps leave the API.
    { $facet: { items: [{ $sort: { text: 1, _id: 1 } }, { $skip: (page - 1) * limit }, { $limit: limit }, { $project: { _id: 0, text: 1, identityMode: 1, namedStudentId: 1 } }], total: [{ $count: "count" }] } },
  ]);
  const namedIds = result.items.flatMap(item => item.identityMode === IDENTITY_MODES.NAMED && item.namedStudentId ? [item.namedStudentId] : []);
  const identities = namedIds.length ? await User.find({ _id: { $in: namedIds } }).select("name userCode").lean() : [];
  const names = new Map(identities.map(value => [String(value._id), { name: value.name, userCode: value.userCode }]));
  const total = result.total[0]?.count || 0;
  return { items: result.items.map(item => ({ text: item.text, identityMode: item.identityMode,
    ...(item.identityMode === IDENTITY_MODES.NAMED ? { identity: names.get(String(item.namedStudentId)) || null } : {}) })),
  pagination: { page, limit, total, totalPages: Math.ceil(total / limit), hasNextPage: page * limit < total, hasPreviousPage: page > 1 && total > 0 } };
};
module.exports = { getResults, getShortAnswers };
