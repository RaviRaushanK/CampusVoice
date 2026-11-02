const mongoose = require("mongoose");
const error = require("../utils/authError");
const { normalizeUserCode, userCodePattern, validateNewPassword } = require("./authValidator");
const id = value => {
  if (!mongoose.isObjectIdOrHexString(value)) throw error(400, "Invalid resource identifier.");
  return value;
};
const text = (value, label, min, max) => {
  if (typeof value !== "string" || value.trim().length < min || value.trim().length > max) throw error(400, `${label} must contain ${min}-${max} characters.`);
  return value.trim();
};
const year = (value, span = 1) => {
  const normalized = text(value, span === 1 ? "Academic year" : "Batch", 9, 9);
  const match = /^(20\d{2})-(20\d{2})$/.exec(normalized);
  if (!match || Number(match[2]) !== Number(match[1]) + span) throw error(400, `Use YYYY-YYYY with a ${span}-year span.`);
  return normalized;
};
const semester = value => {
  if (!Number.isInteger(value) || value < 1 || value > 4) throw error(400, "Semester must be an integer from 1 to 4.");
  return value;
};
const section = value => {
  const result = text(value ?? "", "Section", 0, 10).toUpperCase();
  if (!/^[A-Z0-9-]*$/.test(result)) throw error(400, "Section may contain letters, numbers and hyphens.");
  return result;
};
const fieldsByKind = {
  departments: ["name", "code", "description", "isActive"],
  hods: ["name", "email", "userCode", "departmentId", "initialPassword", "isActive"],
  faculty: ["name", "email", "userCode", "initialPassword", "isActive"],
  students: ["name", "email", "userCode", "initialPassword", "semester", "section", "batch", "isActive"],
  subjects: ["name", "code", "semester", "isActive"],
  classes: ["semester", "section", "academicYear", "batch", "isActive"],
  assignments: ["facultyId", "subjectId", "classGroupId", "academicYear", "isActive"],
};
const parseBody = (kind, body, updating = false) => {
  const allowed = fieldsByKind[kind].filter(field => !updating || !["initialPassword", "userCode"].includes(field));
  const permitted = updating && kind === "assignments" ? ["isActive"] : allowed;
  if (!body || typeof body !== "object" || Array.isArray(body) || !Object.keys(body).length || Object.keys(body).some(key => !permitted.includes(key))) throw error(400, "Unsupported or missing academic fields.");
  const required = { departments: ["name", "code"], hods: ["name", "userCode", "initialPassword", "departmentId"], faculty: ["name", "userCode", "initialPassword"], students: ["name", "userCode", "initialPassword", "semester"], subjects: ["name", "code", "semester"], classes: ["semester", "academicYear"], assignments: ["facultyId", "subjectId", "classGroupId", "academicYear"] };
  if (!updating && required[kind].some(key => !Object.hasOwn(body, key))) throw error(400, "Required academic fields are missing.");
  const output = {};
  for (const [key, value] of Object.entries(body)) {
    if (key === "name") output.name = text(value, "Name", 2, kind === "subjects" ? 200 : 120);
    else if (key === "code") {
      output.code = text(value, "Code", 1, kind === "departments" ? 20 : 30).toUpperCase();
      if (!/^[A-Z0-9][A-Z0-9_-]*$/.test(output.code)) throw error(400, "Invalid code format.");
    } else if (key === "description") output.description = text(value, "Description", 0, 1000);
    else if (key === "email") {
      if (value !== null && typeof value !== "string") throw error(400, "Enter a valid email address.");
      output.email = value?.trim().toLowerCase() || null;
      if (output.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(output.email)) throw error(400, "Enter a valid email address.");
    } else if (key === "userCode") {
      output.userCode = normalizeUserCode(value);
      if (!userCodePattern.test(output.userCode)) throw error(400, "Enter a valid user code / USN (3-50 letters, numbers, dots, underscores or hyphens).");
    } else if (key === "initialPassword") { validateNewPassword(value); output.initialPassword = value; }
    else if (key.endsWith("Id")) output[key] = id(value);
    else if (key === "semester") output.semester = semester(value);
    else if (key === "section") output.section = section(value);
    else if (key === "academicYear") output.academicYear = year(value);
    else if (key === "batch") output.batch = value === null || value === "" ? null : year(value, 2);
    else if (key === "isActive") {
      if (typeof value !== "boolean") throw error(400, "Account/resource status must be true or false.");
      output.isActive = value;
    }
  }
  return output;
};
const parseQuery = (query = {}) => {
  const allowed = ["page", "limit", "search", "semester", "section", "academicYear", "status"];
  if (Object.keys(query).some(key => !allowed.includes(key))) throw error(400, "Unsupported academic query.");
  const integer = (value, fallback, max) => {
    if (value === undefined) return fallback;
    if (typeof value !== "string" || !/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) > max) throw error(400, "Invalid pagination.");
    return Number(value);
  };
  const result = { page: integer(query.page, 1, 1000000), limit: integer(query.limit, 20, 100), status: query.status ?? "all" };
  if (!["all", "active", "inactive"].includes(result.status)) throw error(400, "Invalid status filter.");
  if (query.search !== undefined) result.search = text(query.search, "Search", 0, 100);
  if (query.semester !== undefined) {
    if (typeof query.semester !== "string" || !/^[1-4]$/.test(query.semester)) throw error(400, "Invalid semester filter.");
    result.semester = Number(query.semester);
  }
  if (query.section !== undefined) result.section = section(query.section);
  if (query.academicYear !== undefined) result.academicYear = year(query.academicYear);
  return result;
};
const validateBody = kind => (req, res, next) => {
  try { req.academicInput = parseBody(kind, req.body, req.method === "PATCH"); next(); } catch (err) { next(err); }
};
const validateQuery = (req, res, next) => {
  try { req.academicQuery = parseQuery(req.query); next(); } catch (err) { next(err); }
};
const validateId = (req, res, next) => {
  try { id(req.params.id); next(); } catch (err) { next(err); }
};
module.exports = { parseBody, parseQuery, validateBody, validateQuery, validateId, id, year };
