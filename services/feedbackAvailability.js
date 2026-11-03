const state = (session, now = new Date()) => {
  if (session.status === "DRAFT") return "DRAFT";
  if (session.status === "CLOSED" || (session.closesAt && new Date(session.closesAt) <= now)) return "CLOSED";
  if (session.opensAt && new Date(session.opensAt) > now) return "SCHEDULED";
  return "OPEN";
};
const openFilter = (now = new Date()) => ({ status: "OPEN", $and: [
  { $or: [{ opensAt: null }, { opensAt: { $lte: now } }] },
  { $or: [{ closesAt: null }, { closesAt: { $gt: now } }] },
] });
const normalizeSection = value => (value || "").trim().toUpperCase();
const eligibleFilter = student => ({ departmentId: student.departmentId || null, "audience.semester": student.semester || -1,
  "audience.section": normalizeSection(student.section), $or: [{ "audience.batch": null }, { "audience.batch": student.batch || null }] });
const recipientExpression = ({ departmentId, semester, section, batch }) => ({ $and: [
  { $eq: ["$departmentId", departmentId] }, { $eq: ["$semester", semester] },
  { $eq: [{ $toUpper: { $trim: { input: { $ifNull: ["$section", ""] } } } }, section] },
  { $or: [{ $in: [{ $ifNull: [batch ?? null, null] }, [null, ""]] }, { $eq: ["$batch", batch ?? null] }] },
] });
const recipientFilter = session => ({ role: "STUDENT", isActive: true, $expr: recipientExpression({ departmentId: session.departmentId, semester: session.audience.semester, section: session.audience.section, batch: session.audience.batch }) });
const stateExpression = (now = new Date()) => ({ $switch: { branches: [
  { case: { $eq: ["$status", "DRAFT"] }, then: "DRAFT" },
  { case: { $or: [{ $eq: ["$status", "CLOSED"] }, { $and: [{ $ne: [{ $ifNull: ["$closesAt", null] }, null] }, { $lte: ["$closesAt", now] }] }] }, then: "CLOSED" },
  { case: { $and: [{ $ne: [{ $ifNull: ["$opensAt", null] }, null] }, { $gt: ["$opensAt", now] }] }, then: "SCHEDULED" },
], default: "OPEN" } });
module.exports = { state, openFilter, eligibleFilter, recipientFilter, recipientExpression, stateExpression };
