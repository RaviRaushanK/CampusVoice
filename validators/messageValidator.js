const error = require("../utils/authError");
const { id } = require("./academicValidator");
const { parseQuery } = require("./feedbackSessionValidator");
const { IDENTITY_MODES, MESSAGE_LIMITS } = require("../utils/constants/messages");
const fail = message => { throw error(400, message); };
const object = (value, fields) => { if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).some(key => !fields.includes(key))) fail("Unsupported message fields."); };
const parseBody = (body, kind) => {
  object(body, kind === "feedback" ? ["facultyAssignmentId", "rating", "message", "identityMode"] : ["facultyId", "message", "identityMode", "submissionKey"]);
  if (typeof body.message !== "string" || body.message.trim().length < MESSAGE_LIMITS.min || body.message.length > MESSAGE_LIMITS.max) fail(`Message must contain ${MESSAGE_LIMITS.min}-${MESSAGE_LIMITS.max} characters.`);
  if (!Object.values(IDENTITY_MODES).includes(body.identityMode)) fail("Choose Anonymous or Named identity.");
  const result = { message: body.message.trim(), identityMode: body.identityMode };
  if (kind === "feedback") {
    result.facultyAssignmentId = id(body.facultyAssignmentId);
    if (!Number.isInteger(body.rating) || body.rating < 1 || body.rating > 5) fail("Rating must be an integer from 1 to 5.");
    result.rating = body.rating;
  } else {
    result.facultyId = id(body.facultyId);
    if (body.submissionKey !== undefined) {
      if (typeof body.submissionKey !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.submissionKey)) fail("Invalid submission key.");
      result.submissionKey = body.submissionKey.toLowerCase();
    }
  }
  return result;
};
const parseList = (query = {}, department = false) => {
  object(query, department ? ["page", "limit", "facultyId", "subjectId", "rating"] : ["page", "limit"]);
  const { page, limit } = parseQuery({ ...(query.page !== undefined ? { page: query.page } : {}), ...(query.limit !== undefined ? { limit: query.limit } : {}) });
  const result = { page, limit };
  for (const field of ["facultyId", "subjectId"]) if (query[field] !== undefined) result[field] = id(query[field]);
  if (query.rating !== undefined) { if (typeof query.rating !== "string" || !/^[1-5]$/.test(query.rating)) fail("Invalid rating filter."); result.rating = Number(query.rating); }
  return result;
};
const emptyQuery = (query = {}) => { object(query, []); };
module.exports = { parseBody, parseList, emptyQuery, id };
