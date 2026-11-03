const { createHash } = require("node:crypto");
const mongoose = require("mongoose");
const Suggestion = require("../models/Suggestion");
const { assertRole } = require("./academicSupport");
const recipients = require("./studentRecipientService");
const { parseBody, parseList, emptyQuery, id } = require("../validators/messageValidator");
const { validateText } = require("./contentModerationService");
const { readPage } = require("./messageReadService");
const notifications = require("./notificationService");
const error = require("../utils/authError");
const scope = (user, view) => {
  assertRole(user, view === "mine" ? "STUDENT" : "FACULTY");
  return view === "mine" ? { studentId: user._id } : { facultyId: user._id };
};
const list = async (user, view, query = {}) => readPage(Suggestion, scope(user, view), parseList(query), view === "mine", false);
const get = async (user, identifier, query = {}) => {
  emptyQuery(query); assertRole(user, "STUDENT", "FACULTY");
  const view = user.role === "STUDENT" ? "mine" : "received";
  const item = (await readPage(Suggestion, { ...scope(user, view), _id: new mongoose.Types.ObjectId(String(id(identifier))) }, { page: 1, limit: 1 }, view === "mine", false)).items[0];
  if (!item) throw error(404, "Suggestion unavailable."); return item;
};
const create = async (user, body) => {
  assertRole(user, "STUDENT"); const fields = parseBody(body, "suggestion"); validateText(fields.message);
  const fingerprint = createHash("sha256").update(JSON.stringify({ facultyId: String(fields.facultyId).toLowerCase(), message: fields.message, identityMode: fields.identityMode })).digest("hex");
  const replay = async () => {
    if (!fields.submissionKey) return null;
    const previous = await Suggestion.findOne({ studentId: user._id, submissionKey: fields.submissionKey }).select("+submissionFingerprint").lean();
    if (!previous) return null;
    if (previous.submissionFingerprint !== fingerprint) throw error(409, "This submission key was already used for a different suggestion.");
    return { item: await get(user, previous._id), replayed: true, notificationDelivery: { attempted: false } };
  };
  await Suggestion.init(); const previous = await replay(); if (previous) return previous;
  const { current, recipient } = await recipients.faculty(user, fields.facultyId);
  let created;
  try { created = await Suggestion.create({ studentId: current._id, facultyId: recipient._id, departmentId: current.departmentId, message: fields.message, identityMode: fields.identityMode,
    ...(fields.submissionKey ? { submissionKey: fields.submissionKey, submissionFingerprint: fingerprint } : {}) }); }
  catch (err) { if (err.code === 11000) { const result = await replay(); if (result) return result; } throw err; }
  let delivered = false;
  try {
    await notifications.createNotification({ recipient: recipient._id, type: "SUGGESTION", title: "New Private Suggestion", message: "You received a new private suggestion.", relatedResourceType: "SUGGESTION", relatedResourceId: created._id }); delivered = true;
  } catch { console.warn("Private suggestion saved with a notification delivery failure."); }
  return { item: await get(user, created._id), replayed: false, notificationDelivery: { attempted: true, delivered } };
};
module.exports = { create, list, get, options: recipients.facultyOptions };
