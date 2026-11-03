const { PUBLIC_ACTIONS, PUBLIC_RESOURCES } = require("../utils/constants/audit");
const error = require("../utils/authError");
const parse = (query = {}) => {
  if (!query || typeof query !== "object" || Array.isArray(query) || Object.keys(query).some(key => !["page", "limit", "action", "resourceType", "dateFrom", "dateTo"].includes(key))) throw error(400, "Unsupported audit filters.");
  const integer = (value, fallback, max) => { if (value === undefined) return fallback; if (typeof value !== "string" || !/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) > max) throw error(400, "Invalid audit pagination."); return Number(value); };
  const result = { page: integer(query.page, 1, 1000000), limit: integer(query.limit, 20, 100) };
  for (const [key, values] of [["action", PUBLIC_ACTIONS], ["resourceType", PUBLIC_RESOURCES]]) if (query[key] !== undefined) { if (!values.includes(query[key])) throw error(400, "Invalid audit filter."); result[key] = query[key]; }
  for (const field of ["dateFrom", "dateTo"]) if (query[field] !== undefined) {
    const value = query[field]; if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw error(400, "Use a valid YYYY-MM-DD audit date.");
    const date = new Date(`${value}T00:00:00.000Z`); if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value || date.getUTCFullYear() < 2000 || date.getUTCFullYear() > 2100) throw error(400, "Invalid audit date."); result[field] = date;
  }
  if (result.dateFrom && result.dateTo && result.dateFrom > result.dateTo) throw error(400, "Date From must not follow Date To.");
  return result;
};
module.exports = { parse };
