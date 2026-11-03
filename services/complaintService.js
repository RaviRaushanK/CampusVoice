const mongoose = require("mongoose");
const Complaint = require("../models/Complaint");
const User = require("../models/User");
const Department = require("../models/Department");
const recipients = require("./studentRecipientService");
const { assertRole } = require("./academicSupport");
const validator = require("../validators/complaintValidator");
const files = require("../utils/complaintFiles");
const notifications = require("./notificationService");
const { TYPES, ROUTING, NEXT_ROLE, TRANSITIONS, PRIORITIES, FILES } = require("../utils/constants/complaints");
const error = require("../utils/authError");
const objectId = value => new mongoose.Types.ObjectId(String(validator.id(value)));
const unresolved = value => !["RESOLVED", "CLOSED"].includes(value.status);
const scope = user => {
  assertRole(user, "STUDENT", "FACULTY", "HOD", "PRINCIPAL");
  if (user.role === "STUDENT") return { studentId: user._id };
  return { ...(user.role !== "PRINCIPAL" ? { departmentId: user.departmentId || null } : {}),
    $or: [{ currentHandlerId: user._id, currentHandlerRole: user.role }, { priorHandlers: { $elemMatch: { userId: user._id, role: user.role } } }],
    $nor: [{ type: TYPES.AGAINST_FACULTY, targetFacultyId: user._id }, { type: TYPES.AGAINST_HOD, targetHodId: user._id }],
  };
};
const authority = async (role, departmentId) => {
  if (role === "HOD" && !await Department.exists({ _id: departmentId, isActive: true })) throw error(409, "The responsible department is unavailable. Contact college administration.");
  const matches = await User.find({ role, isActive: true, ...(role === "HOD" ? { departmentId } : {}) }).select("_id").limit(2).lean();
  if (matches.length !== 1) throw error(409, `An active responsible ${role} is not configured. Contact college administration.`);
  return matches[0]._id;
};
const facultyOptions = async (user, query = {}) => {
  const { items, pagination } = await recipients.assignmentOptions(user, query);
  // Assignment IDs remain opaque option values; submission resolves the real
  // Faculty relationship again instead of trusting a client handler identity.
  return { items: items.map(item => ({ id: item.id, name: `${item.faculty.name} / ${item.subject.code} — ${item.subject.name}` })), pagination };
};
const options = async (user, query = {}) => ({ ...await facultyOptions(user, query), types: Object.values(TYPES), identityModes: ["ANONYMOUS", "NAMED"], attachments: { maxCount: FILES.maxCount, maxSize: FILES.maxSize, mimeTypes: [...new Set(Object.values(FILES.types))] } });
const notify = async (complaint, recipientsAndTitles) => {
  const results = await Promise.all(recipientsAndTitles.map(async ([recipient, title, message]) => {
    try { await notifications.createNotification({ recipient, type: "COMPLAINT", title, message, relatedResourceType: "COMPLAINT", relatedResourceId: complaint._id }); return true; }
    catch { console.warn("Complaint saved with a notification delivery failure."); return false; }
  }));
  return { attempted: results.length, delivered: results.filter(Boolean).length };
};
const event = (user, kind, value, changes = {}, note = "") => ({ _id: new mongoose.Types.ObjectId(), eventType: kind, actorId: user._id, actorRole: user.role,
  ...(value.status ? { fromStatus: value.status } : {}), toStatus: changes.status || value.status || "SUBMITTED", fromHandlerRole: value.currentHandlerRole, toHandlerRole: changes.currentHandlerRole || value.currentHandlerRole, note, createdAt: new Date() });
const create = async (user, body, uploaded = []) => {
  assertRole(user, "STUDENT"); const fields = validator.create(body); const evidence = files.validate(uploaded);
  const current = await recipients.student(user);
  let targetFacultyId, targetHodId;
  if (fields.facultyAssignmentId) {
    // The Faculty selector uses a real, usable teaching assignment. Its ID is
    // a target option, never a client-selected handling authority.
    const { value } = await recipients.assignment(user, fields.facultyAssignmentId); targetFacultyId = value.facultyId._id;
  }
  const role = ROUTING[fields.type];
  if (fields.type === TYPES.AGAINST_HOD) targetHodId = await authority("HOD", current.departmentId);
  const handler = role === "FACULTY" ? targetFacultyId : await authority(role, current.departmentId);
  const value = { studentId: current._id, departmentId: current.departmentId, type: fields.type, title: fields.title, description: fields.description, identityMode: fields.identityMode,
    targetFacultyId, targetHodId, initialHandlerId: handler, initialHandlerRole: role, currentHandlerId: handler, currentHandlerRole: role, priority: fields.type === TYPES.SAFETY_URGENT ? "URGENT" : "NORMAL" };
  let savedFiles = [], created;
  try { savedFiles = await files.save(evidence); created = await Complaint.create({ ...value, attachments: savedFiles, events: [event(user, "SUBMITTED", value)] }); }
  catch (err) { await files.cleanup(savedFiles); throw err; }
  const notificationDelivery = await notify(created, [[handler, "New Complaint Assigned", "A complaint has been assigned to you."]]);
  return { item: await get(user, created._id), notificationDelivery };
};
const actionsFor = (user, item) => {
  if (user.role === "STUDENT") return [...(item.status === "RESOLVED" ? ["close"] : []), ...(unresolved(item) && NEXT_ROLE[item.currentHandlerRole] && !item.escalationRequestedAt ? ["escalation-request"] : [])];
  if (String(item.currentHandlerId) !== String(user._id) || item.currentHandlerRole !== user.role) return [];
  return [...Object.entries(TRANSITIONS).filter(([kind, rule]) => kind !== "close" && rule.from.includes(item.status)).map(([kind]) => kind),
    ...(unresolved(item) && NEXT_ROLE[item.currentHandlerRole] ? ["escalate"] : []), ...(unresolved(item) && item.priority !== "URGENT" ? ["priority"] : [])];
};
const read = async (user, filter, { page = 1, limit = 20 } = {}, detail = false) => {
  const own = user.role === "STUDENT";
  const projection = { title: 1, type: 1, identityMode: 1, status: 1, priority: 1, createdAt: 1, currentHandlerRole: 1,
    currentHandlerId: 1, escalationRequestedAt: 1, escalationLevel: 1,
    namedStudentId: own ? "$$REMOVE" : { $cond: [{ $eq: ["$identityMode", "NAMED"] }, "$studentId", "$$REMOVE"] },
    ...(detail ? { description: 1, resolutionSummary: 1, resolvedAt: 1, closedAt: 1, attachments: { $map: { input: "$attachments", as: "file", in: { _id: "$$file._id", mimeType: "$$file.mimeType", size: "$$file.size", ...(own ? { originalName: "$$file.originalName" } : {}) } } },
      events: { $map: { input: "$events", as: "entry", in: { eventType: "$$entry.eventType", actorRole: "$$entry.actorRole", fromStatus: "$$entry.fromStatus", toStatus: "$$entry.toStatus", toHandlerRole: "$$entry.toHandlerRole", note: "$$entry.note", createdAt: "$$entry.createdAt" } } } } : {}) };
  const [result] = await Complaint.aggregate([{ $match: filter }, { $facet: { items: [{ $sort: { createdAt: -1, _id: -1 } }, { $skip: (page - 1) * limit }, { $limit: limit }, { $project: projection }], total: [{ $count: "value" }] } }]);
  const namedIds = result.items.flatMap(item => item.namedStudentId ? [item.namedStudentId] : []);
  const names = namedIds.length ? await User.find({ _id: { $in: namedIds } }).select("name userCode").lean() : [];
  const identities = new Map(names.map(person => [String(person._id), { name: person.name, userCode: person.userCode }]));
  const total = result.total[0]?.value || 0;
  return { items: result.items.map(item => ({ id: String(item._id), title: item.title, type: item.type, status: item.status, priority: item.priority, identityMode: item.identityMode, createdAt: item.createdAt,
    currentHandlerRole: item.currentHandlerRole, escalationLevel: item.escalationLevel, escalationRequestedAt: item.escalationRequestedAt,
    ...(!own ? { identity: item.identityMode === "NAMED" ? identities.get(String(item.namedStudentId)) || null : null } : {}),
    ...(detail ? { description: item.description, resolutionSummary: item.resolutionSummary, resolvedAt: item.resolvedAt, closedAt: item.closedAt,
      attachments: item.attachments.map((file, index) => ({ id: String(file._id), displayName: own ? file.originalName : `Attachment ${index + 1}`, mimeType: file.mimeType, size: file.size })),
      timeline: new (require("../utils/dsa/LinkedList"))(item.events.map(entry => ({ ...entry, actor: entry.actorRole === "STUDENT" ? own ? "You" : item.identityMode === "ANONYMOUS" ? "Anonymous Student" : "Student" : entry.actorRole }))).toArray(),
      availableActions: actionsFor(user, item), readOnly: !own && String(item.currentHandlerId) !== String(user._id) } : {}) })), pagination: { page, limit, total, totalPages: Math.ceil(total / limit), hasNextPage: page * limit < total, hasPreviousPage: page > 1 && total > 0 } };
};
const list = async (user, view, query = {}) => {
  assertRole(user, ...(view === "mine" ? ["STUDENT"] : ["FACULTY", "HOD", "PRINCIPAL"]));
  const parsed = validator.list(query); const restrictions = Object.fromEntries(["status", "type", "priority"].filter(field => parsed[field]).map(field => [field, parsed[field]]));
  return read(user, { ...scope(user), ...restrictions }, parsed);
};
const get = async (user, identifier, query = {}) => {
  validator.emptyQuery(query); const value = (await read(user, { ...scope(user), _id: objectId(identifier) }, { limit: 1 }, true)).items[0];
  if (!value) throw error(404, "Complaint unavailable."); return value;
};
const act = async (user, identifier, kind, body = {}, query = {}) => {
  validator.emptyQuery(query); const fields = validator.action(kind, body);
  const filter = { ...scope(user), _id: objectId(identifier) };
  const value = await Complaint.findOne(filter).select("+studentId").lean(); if (!value) throw error(404, "Complaint unavailable.");
  if (!actionsFor(user, value).includes(kind)) throw error(409, "This action is unavailable for the current complaint state or handler.");
  const changes = {}; let eventType, note = "", notices = [];
  if (TRANSITIONS[kind]) {
    const to = TRANSITIONS[kind].to; changes.status = to; eventType = to;
    if (kind === "resolve") { changes.resolutionSummary = fields.resolutionSummary; changes.resolvedAt = new Date(); changes.escalationRequestedAt = null; note = fields.resolutionSummary; }
    if (kind === "close") changes.closedAt = new Date();
    else notices = [[value.studentId, `Complaint ${to === "IN_PROGRESS" ? "In Progress" : to === "ACKNOWLEDGED" ? "Acknowledged" : "Resolved"}`, "Your complaint has been updated. Open the complaint for details."]];
  } else if (kind === "escalation-request") {
    changes.escalationRequestedAt = new Date(); eventType = "ESCALATION_REQUESTED"; note = fields.reason;
    notices = [[value.currentHandlerId, "Complaint Escalation Requested", "A complaint escalation has been requested."]];
  } else if (kind === "escalate") {
    const role = NEXT_ROLE[value.currentHandlerRole], next = await authority(role, value.departmentId);
    if ([value.targetFacultyId, value.targetHodId].filter(Boolean).some(target => String(target) === String(next)) && [TYPES.AGAINST_FACULTY, TYPES.AGAINST_HOD].includes(value.type)) throw error(409, "A responsible authority is unavailable.");
    Object.assign(changes, { currentHandlerId: next, currentHandlerRole: role, escalationLevel: value.escalationLevel + 1, escalationRequestedAt: null, status: "ESCALATED" }); eventType = "ESCALATED";
    notices = [[value.studentId, "Complaint Escalated", "Your complaint has been escalated to the next authority."], [next, "Complaint Assigned After Escalation", "An escalated complaint has been assigned to you."]];
  } else if (kind === "priority") {
    if (PRIORITIES.indexOf(fields.priority) <= PRIORITIES.indexOf(value.priority)) throw error(409, "Priority may only be raised.");
    changes.priority = fields.priority; eventType = "PRIORITY_CHANGED"; note = `Priority changed to ${fields.priority}.`;
  }
  const updated = await Complaint.findOneAndUpdate({ ...filter, __v: value.__v, currentHandlerId: value.currentHandlerId, currentHandlerRole: value.currentHandlerRole, status: value.status }, {
    $set: changes, $inc: { __v: 1 }, $push: { events: event(user, eventType, value, changes, note), ...(kind === "escalate" ? { priorHandlers: { userId: value.currentHandlerId, role: value.currentHandlerRole } } : {}) },
  }, { new: true, runValidators: true });
  if (!updated) throw error(409, "The complaint changed. Refresh it before trying again.");
  return { item: await get(user, updated._id), notificationDelivery: await notify(updated, notices) };
};
const attachment = async (user, identifier, attachmentId, query = {}) => {
  validator.emptyQuery(query); const value = await Complaint.findOne({ ...scope(user), _id: objectId(identifier) }).select("attachments").lean();
  const index = value?.attachments.findIndex(file => String(file._id) === String(validator.id(attachmentId))) ?? -1;
  if (index < 0) throw error(404, "Attachment unavailable.");
  const file = value.attachments[index]; return { path: files.pathFor(file.storageName), mimeType: file.mimeType, filename: `Attachment-${index + 1}${file.mimeType === "application/pdf" ? ".pdf" : file.mimeType === "image/png" ? ".png" : file.mimeType === "video/mp4" ? ".mp4" : file.mimeType === "video/webm" ? ".webm" : ".jpg"}` };
};
const counts = async user => {
  const [result] = await Complaint.aggregate([{ $match: scope(user) }, { $group: { _id: null, total: { $sum: 1 }, open: { $sum: { $cond: [{ $in: ["$status", ["RESOLVED", "CLOSED"]] }, 0, 1] } }, resolved: { $sum: { $cond: [{ $eq: ["$status", "RESOLVED"] }, 1, 0] } }, urgent: { $sum: { $cond: [{ $eq: ["$priority", "URGENT"] }, 1, 0] } }, escalated: { $sum: { $cond: [{ $gt: ["$escalationLevel", 0] }, 1, 0] } }, requests: { $sum: { $cond: ["$escalationRequestedAt", 1, 0] } } } }]);
  const value = result || { total: 0, open: 0, resolved: 0, urgent: 0, escalated: 0, requests: 0 };
  return user.role === "STUDENT" ? { "Total Complaints": value.total, "Open Complaints": value.open, "Resolved Complaints": value.resolved } : user.role === "FACULTY" ? { "Assigned Issues": value.total, "Pending Issues": value.open } : user.role === "HOD" ? { "Department Complaints": value.total, "Pending Complaints": value.open, "Escalation Requests": value.requests } : { "Assigned Complaints": value.total, "Urgent Complaints": value.urgent, "Escalated Complaints": value.escalated };
};
module.exports = { options, create: (user, ...args) => require("./auditService").run({ actor: user, action: "COMPLAINT_CREATED", resourceType: "COMPLAINT" }, () => create(user, ...args)), list, get, act: (user, identifier, kind, ...args) => require("./auditService").run({ actor: user, action: require("../utils/constants/audit").COMPLAINT_ACTIONS[kind] || "COMPLAINT_STATUS_CHANGED", resourceType: "COMPLAINT", resourceId: identifier }, () => act(user, identifier, kind, ...args)), attachment, counts, scope };
