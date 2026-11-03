const { TYPES, STATUSES, PRIORITIES } = require("../utils/constants/complaints");
const { id, emptyQuery } = require("./messageValidator");
const { parseQuery } = require("./academicValidator");
const { validateText } = require("../services/contentModerationService");
const error = require("../utils/authError");
const fail = message => { throw error(400, message); };
const object = (value, fields) => { if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).some(key => !fields.includes(key))) fail("Unsupported complaint fields."); };
const choice = (value, choices, label) => { if (typeof value !== "string" || !choices.includes(value)) fail(`Invalid ${label}.`); return value; };
const text = (value, min, max, label) => { if (typeof value !== "string" || value.trim().length < min || value.trim().length > max) fail(`${label} must contain ${min}–${max} characters.`); const result = value.trim(); validateText(result); return result; };
const create = body => {
  object(body, ["type", "facultyAssignmentId", "title", "description", "identityMode"]);
  const type = choice(body.type, Object.values(TYPES), "complaint type");
  const facultyType = [TYPES.FACULTY_ISSUE, TYPES.AGAINST_FACULTY].includes(type);
  if (!facultyType && body.facultyAssignmentId !== undefined) fail("Faculty selection is not available for this complaint type.");
  return { type, title: text(body.title, 5, 150, "Title"), description: text(body.description, 20, 5000, "Description"), identityMode: choice(body.identityMode ?? "ANONYMOUS", ["ANONYMOUS", "NAMED"], "identity mode"), ...(facultyType ? { facultyAssignmentId: id(body.facultyAssignmentId) } : {}) };
};
const list = query => {
  object(query, ["page", "limit", "status", "type", "priority"]);
  const { page, limit } = parseQuery({ ...(query.page !== undefined ? { page: query.page } : {}), ...(query.limit !== undefined ? { limit: query.limit } : {}) });
  return { page, limit, ...Object.fromEntries([["status", STATUSES], ["type", Object.values(TYPES)], ["priority", PRIORITIES]].filter(([field]) => query[field] !== undefined).map(([field, values]) => [field, choice(query[field], values, `${field} filter`)])) };
};
const action = (kind, body) => {
  object(body, kind === "resolve" ? ["resolutionSummary"] : kind === "escalation-request" ? ["reason"] : kind === "priority" ? ["priority"] : []);
  return kind === "resolve" ? { resolutionSummary: text(body.resolutionSummary, 10, 2000, "Resolution summary") } : kind === "escalation-request" ? { reason: text(body.reason, 10, 1000, "Escalation reason") } : kind === "priority" ? { priority: choice(body.priority, PRIORITIES, "priority") } : {};
};
module.exports = { create, list, action, id, emptyQuery };
