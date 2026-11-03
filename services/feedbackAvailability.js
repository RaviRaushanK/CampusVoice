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
const recipientFilter = session => ({ role: "STUDENT", isActive: true, departmentId: session.departmentId,
  semester: session.audience.semester,
  // Match legacy section casing/nulls exactly as Student eligibility does.
  $expr: { $eq: [{ $toUpper: { $trim: { input: { $ifNull: ["$section", ""] } } } }, session.audience.section] },
  ...(session.audience.batch ? { batch: session.audience.batch } : {}),
});
module.exports = { state, openFilter, eligibleFilter, recipientFilter };
