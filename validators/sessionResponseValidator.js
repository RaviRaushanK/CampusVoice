const error = require("../utils/authError");
const { id } = require("./academicValidator");
const { LIMITS, IDENTITY_MODES } = require("../utils/constants/feedback");
const fail = message => { throw error(400, message); };
const object = (value, fields) => { if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).some(key => !fields.includes(key))) fail("Unsupported response fields."); };
const parseResponse = (body, session) => {
  object(body, ["identityMode", "answers"]);
  if (!Object.values(IDENTITY_MODES).includes(body.identityMode)) fail("Choose Anonymous or Named identity.");
  if (!session.allowAnonymous && body.identityMode !== IDENTITY_MODES.NAMED) fail("This session uses named responses.");
  if (!Array.isArray(body.answers) || body.answers.length > LIMITS.questions) fail("Invalid answer list.");
  const questions = new Map(session.questions.map(question => [String(question._id), question]));
  const seen = new Set(), answers = [];
  for (const answer of body.answers) {
    object(answer, ["questionId", "value"]); id(answer.questionId);
    const questionId = String(answer.questionId).toLowerCase();
    const question = questions.get(questionId);
    if (!question) fail("Question does not belong to this questionnaire.");
    if (seen.has(questionId)) fail("Only one answer per question is allowed.");
    seen.add(questionId);
    let value = answer.value;
    if (question.type === "SINGLE_CHOICE") {
      if (typeof value !== "string" || !question.options.includes(value)) fail("Choose one of the listed options.");
    } else if (question.type === "MULTI_SELECT") {
      if (!Array.isArray(value) || value.length > LIMITS.options || new Set(value).size !== value.length || value.some(option => typeof option !== "string" || !question.options.includes(option))) fail("Choose unique options from the list.");
      if (!value.length) { if (question.required) fail("Answer every required question."); continue; }
    } else if (question.type === "RATING") {
      if (!Number.isInteger(value) || value < 1 || value > 5) fail("Rating must be a number from 1 to 5.");
    } else if (question.type === "SHORT_ANSWER") {
      if (typeof value !== "string" || value.length > LIMITS.answer) fail(`Short answers must contain at most ${LIMITS.answer} characters.`);
      value = value.trim();
      if (!value) { if (question.required) fail("Answer every required question."); continue; }
    } else fail("Unsupported question type.");
    answers.push({ questionId, value });
  }
  const answered = new Set(answers.map(answer => answer.questionId));
  if (session.questions.some(question => question.required && !answered.has(String(question._id)))) fail("Answer every required question.");
  return { identityMode: body.identityMode, answers };
};
const parseStudentQuery = (query = {}) => {
  object(query, ["page", "limit", "category"]);
  const { parseQuery } = require("./feedbackSessionValidator");
  const { page, limit } = parseQuery({ ...(query.page !== undefined ? { page: query.page } : {}), ...(query.limit !== undefined ? { limit: query.limit } : {}) });
  const category = query.category ?? "pending";
  if (!["pending", "completed"].includes(category)) fail("Choose Pending or Completed sessions.");
  return { page, limit, category };
};
module.exports = { parseResponse, parseStudentQuery };
