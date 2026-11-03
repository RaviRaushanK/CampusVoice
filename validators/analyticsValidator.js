const { id } = require("./messageValidator");
const { STATUSES, PRIORITIES, TYPES } = require("../utils/constants/complaints");
const { MAX_MONTHS, DEFAULT_MONTHS } = require("../utils/constants/analytics");
const error = require("../utils/authError");
const fail = message => { throw error(400, message); };
const parseDate = value => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) fail("Use a valid YYYY-MM-DD date.");
  const date = new Date(`${value}T00:00:00.000Z`); if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value || date.getUTCFullYear() < 2000 || date.getUTCFullYear() > 2100) fail("Use a valid date between 2000 and 2100."); return date;
};
const parse = (query = {}, kind = "overview", now = new Date()) => {
  const allowed = ["dateFrom", "dateTo", ...(["feedback", "sessions"].includes(kind) ? ["subjectId"] : []), ...(["complaints", "complaint-processing"].includes(kind) ? ["type", "status", "priority"] : []), ...(kind === "complaint-processing" ? ["mode", "search"] : [])];
  if (!query || typeof query !== "object" || Array.isArray(query) || Object.keys(query).some(key => !allowed.includes(key))) fail("Unsupported analytics filters.");
  const dateTo = query.dateTo !== undefined ? parseDate(query.dateTo) : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const dateFrom = query.dateFrom !== undefined ? parseDate(query.dateFrom) : new Date(Date.UTC(dateTo.getUTCFullYear(), dateTo.getUTCMonth() - DEFAULT_MONTHS + 1, 1));
  if (dateFrom > dateTo) fail("Date From must not follow Date To.");
  const months = (dateTo.getUTCFullYear() - dateFrom.getUTCFullYear()) * 12 + dateTo.getUTCMonth() - dateFrom.getUTCMonth() + 1;
  if (months > MAX_MONTHS) fail(`Choose at most ${MAX_MONTHS} calendar months.`);
  const output = { dateFrom, dateTo, endExclusive: new Date(dateTo.getTime() + 86400000), months };
  if (query.subjectId !== undefined) output.subjectId = id(query.subjectId);
  for (const [key, choices] of [["type", Object.values(TYPES)], ["status", STATUSES], ["priority", PRIORITIES], ["mode", ["fifo", "priority"]]]) if (query[key] !== undefined) { if (!choices.includes(query[key])) fail(`Invalid ${key} filter.`); output[key] = query[key]; }
  if (kind === "complaint-processing") { output.mode ||= "fifo"; if (query.search !== undefined) { if (typeof query.search !== "string" || query.search.trim().length > 100) fail("Search must contain at most 100 characters."); output.search = query.search.trim().toLocaleLowerCase("en"); } }
  return output;
};
module.exports = { parse };
