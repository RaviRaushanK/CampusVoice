const Feedback = require("../models/Feedback");
const User = require("../models/User");
const { assertRole, ownDepartment } = require("./academicSupport");
const recipients = require("./studentRecipientService");
const { parseBody, parseList, emptyQuery, id } = require("../validators/messageValidator");
const { validateText } = require("./contentModerationService");
const { readPage, summarize } = require("./messageReadService");
const error = require("../utils/authError");
const create = async (user, body) => {
  assertRole(user, "STUDENT"); const fields = parseBody(body, "feedback"); validateText(fields.message);
  const { current, value } = await recipients.assignment(user, fields.facultyAssignmentId);
  const created = await Feedback.create({ studentId: current._id, facultyId: value.facultyId._id, subjectId: value.subjectId._id, departmentId: current.departmentId, facultyAssignmentId: value._id, rating: fields.rating, message: fields.message, identityMode: fields.identityMode });
  return (await readPage(Feedback, { _id: created._id, studentId: current._id }, { page: 1, limit: 1 }, true, true)).items[0];
};
const scope = async (user, view) => {
  if (view === "mine") { assertRole(user, "STUDENT"); return { studentId: user._id }; }
  if (view === "received") { assertRole(user, "FACULTY"); return { facultyId: user._id }; }
  assertRole(user, "HOD"); const departmentId = await ownDepartment(user);
  // A transferred Faculty member's old feedback is never exposed to a new
  // department. Department reads require both historical and current context.
  const facultyIds = await User.distinct("_id", { role: "FACULTY", departmentId });
  return { departmentId, facultyId: { $in: facultyIds } };
};
const list = async (user, view, options = {}) => {
  const filter = await scope(user, view), query = parseList(options, view === "department");
  const restrictions = [];
  for (const field of ["facultyId", "subjectId", "rating"]) if (query[field] !== undefined) restrictions.push({ [field]: field === "rating" ? query[field] : new (require("mongoose").Types.ObjectId)(String(query[field])) });
  return readPage(Feedback, { ...filter, ...(restrictions.length ? { $and: restrictions } : {}) }, query, view === "mine", true);
};
const get = async (user, identifier, query = {}) => {
  emptyQuery(query);
  const view = { STUDENT: "mine", FACULTY: "received", HOD: "department" }[user?.role];
  assertRole(user, "STUDENT", "FACULTY", "HOD");
  const item = (await readPage(Feedback, { ...await scope(user, view), _id: new (require("mongoose").Types.ObjectId)(String(id(identifier))) }, { page: 1, limit: 1 }, view === "mine", true)).items[0];
  if (!item) throw error(404, "Feedback unavailable."); return item;
};
const aggregate = async (user, options = {}) => {
  assertRole(user, "PRINCIPAL"); emptyQuery(options);
  return summarize(await Feedback.aggregate([{ $group: { _id: "$rating", count: { $sum: 1 } } }]));
};
module.exports = { create, list, get, aggregate, options: recipients.assignmentOptions };
