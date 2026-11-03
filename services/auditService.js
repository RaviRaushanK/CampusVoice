const mongoose = require("mongoose");
const { randomUUID } = require("node:crypto");
const { AsyncLocalStorage } = require("node:async_hooks");
const AuditLog = require("../models/AuditLog");
const User = require("../models/User");
const { ACTIONS, PUBLIC_ACTIONS, PUBLIC_RESOURCES, SAFE_FIELDS } = require("../utils/constants/audit");
const { assertRole } = require("./academicSupport");
const { parse } = require("../validators/auditValidator");
const error = require("../utils/authError");
const context = new AsyncLocalStorage();
let initialization, databaseName;
const initialize = async () => {
  if (mongoose.connection.readyState !== 1) throw new Error("Audit database unavailable.");
  if (!initialization || databaseName !== mongoose.connection.name) {
    databaseName = mongoose.connection.name;
    initialization = (async () => { try { await AuditLog.createCollection(); } catch (err) { if (err.code !== 48) throw err; } await AuditLog.createIndexes(); })();
    initialization.catch(() => { initialization = undefined; });
  }
  await initialization;
};
const metadata = input => ({
  ...(Array.isArray(input?.changedFields) ? { changedFields: [...new Set(input.changedFields.filter(field => SAFE_FIELDS.includes(field)))] } : {}),
  ...(typeof input?.isActive === "boolean" ? { isActive: input.isActive } : {}),
  ...(["INVALID_CREDENTIALS", "OPERATION_REJECTED", "OPERATION_FAILED"].includes(input?.reason) ? { reason: input.reason } : {}),
});
const record = async options => {
  if (!ACTIONS.includes(options.action) || ![...PUBLIC_RESOURCES, "COMPLAINT"].includes(options.resourceType)) throw new Error("Unsupported audit action.");
  await initialize();
  return AuditLog.create({ operationId: options.operationId || randomUUID(), phase: options.phase, isRoot: options.isRoot,
    ...(options.actor?.role ? { actorRole: options.actor.role } : {}),
    ...(options.actor?._id && !(options.resourceType === "COMPLAINT" && options.actor.role === "STUDENT") ? { actorId: options.actor._id } : {}),
    action: options.action, resourceType: options.resourceType,
    ...(mongoose.isObjectIdOrHexString(options.resourceId) ? { resourceId: options.resourceId } : {}), metadata: metadata(options.metadata),
  });
};
const unavailable = () => { const response = context.getStore(); if (response && !response.headersSent) response.set("X-Audit-Status", "unconfirmed"); console.warn("Audit confirmation unavailable; review the operation before retrying."); };
const run = async (options, operation) => {
  const operationId = randomUUID(); let hasIntent = false;
  try { await record({ ...options, operationId, phase: "ATTEMPT", isRoot: true }); hasIntent = true; }
  catch { unavailable(); if (!options.allowWithoutIntent) throw error(503, "Audit storage is unavailable. The operation was not started. Please try again later.", "AUDIT_UNAVAILABLE"); }
  let result;
  try { result = await operation(); }
  catch (err) { try { await record({ ...options, operationId, phase: "FAILED", isRoot: !hasIntent, metadata: { ...options.metadata, reason: (err.statusCode || err.status || 500) < 500 ? "OPERATION_REJECTED" : "OPERATION_FAILED" } }); } catch { unavailable(); } throw err; }
  try { await record({ ...options, operationId, phase: "SUCCEEDED", isRoot: !hasIntent, resourceId: options.resourceId || result?.id || result?._id || result?.item?.id }); }
  catch { unavailable(); }
  return result;
};
const failedLogin = async () => { try { await record({ action: "AUTH_LOGIN_FAILURE", resourceType: "AUTH", phase: "FAILED", isRoot: true, metadata: { reason: "INVALID_CREDENTIALS" } }); } catch { unavailable(); } };
const academic = (resource, operation, updating = false, positions = {}) => async (...args) => {
  const fields = args[positions.fields ?? (updating ? 2 : 1)] || {}, type = typeof resource === "function" ? resource(args) : resource;
  return run({ actor: args[0], action: `${type}_${updating ? Object.hasOwn(fields, "isActive") ? "STATUS_CHANGED" : "UPDATED" : "CREATED"}`, resourceType: type, resourceId: updating ? args[positions.id ?? 1] : undefined,
    metadata: { changedFields: Object.keys(fields), ...(typeof fields.isActive === "boolean" ? { isActive: fields.isActive } : {}) } }, () => operation(...args));
};
const list = async (user, query = {}) => {
  assertRole(user, "PRINCIPAL"); const parsed = parse(query);
  const filter = { isRoot: true, resourceType: { $in: PUBLIC_RESOURCES }, action: { $in: PUBLIC_ACTIONS }, ...(parsed.action ? { action: parsed.action } : {}), ...(parsed.resourceType ? { resourceType: parsed.resourceType } : {}),
    ...(parsed.dateFrom || parsed.dateTo ? { createdAt: { ...(parsed.dateFrom ? { $gte: parsed.dateFrom } : {}), ...(parsed.dateTo ? { $lt: new Date(parsed.dateTo.getTime() + 86400000) } : {}) } } : {}) };
  // Read the result via an immutable correlated record. Complaint operations
  // never enter the public browser, including its totals and filter choices.
  const [result] = await AuditLog.aggregate([{ $match: filter }, { $facet: {
    total: [{ $count: "count" }], items: [{ $sort: { createdAt: -1, _id: -1 } }, { $skip: (parsed.page - 1) * parsed.limit }, { $limit: parsed.limit },
      { $lookup: { from: "auditlogs", let: { operation: "$operationId" }, pipeline: [{ $match: { $expr: { $eq: ["$operationId", "$$operation"] }, isRoot: false } }, { $sort: { createdAt: -1, _id: -1 } }, { $limit: 1 }], as: "completion" } },
      { $set: { result: { $ifNull: [{ $arrayElemAt: ["$completion", 0] }, "$$ROOT"] } } },
      { $project: { _id: 1, createdAt: 1, actorRole: 1, action: 1, resourceType: 1, metadata: "$result.metadata", phase: "$result.phase", completedAt: { $cond: [{ $eq: ["$result.phase", "ATTEMPT"] }, "$$REMOVE", "$result.createdAt"] },
        visibleActorId: { $cond: [{ $eq: ["$actorRole", "STUDENT"] }, "$$REMOVE", "$actorId"] },
      } },
    ],
  } }]);
  const ids = result.items.flatMap(row => row.visibleActorId ? [row.visibleActorId] : []), actors = ids.length ? await User.find({ _id: { $in: ids } }).select("name").lean() : [];
  const names = new Map(actors.map(actor => [String(actor._id), actor.name])), total = result.total[0]?.count || 0;
  return { items: result.items.map(row => ({ id: String(row._id), createdAt: row.createdAt, completedAt: row.completedAt || null, actor: row.actorRole === "STUDENT" ? "Student account" : names.get(String(row.visibleActorId)) || "Account unavailable", role: row.actorRole || "Unknown", action: row.action, resourceType: row.resourceType, outcome: row.phase === "ATTEMPT" ? "UNCONFIRMED" : row.phase, details: row.metadata || {} })),
    pagination: { page: parsed.page, limit: parsed.limit, total, totalPages: Math.ceil(total / parsed.limit), hasNextPage: parsed.page * parsed.limit < total, hasPreviousPage: parsed.page > 1 && total > 0 }, filters: { actions: PUBLIC_ACTIONS, resourceTypes: PUBLIC_RESOURCES } };
};
module.exports = { run, academic, failedLogin, list, record, metadata, context };
