const User = require("../models/User");
const Department = require("../models/Department");
const FacultyAssignment = require("../models/FacultyAssignment");
const { assertRole, id } = require("./academicSupport");
const { toSafeAssignment } = require("./assignmentService");
const { recipientFilter } = require("./feedbackAvailability");
const { parseList } = require("../validators/messageValidator");
const error = require("../utils/authError");
const student = async user => {
  assertRole(user, "STUDENT");
  const current = await User.findOne({ _id: user._id, role: "STUDENT", isActive: true, mustChangePassword: false }).select("departmentId semester section batch").lean();
  if (!current || !current.departmentId || !await Department.exists({ _id: current.departmentId, isActive: true })) throw error(403, "Your active academic department is required.");
  return current;
};
const populateAssignment = query => query.populate("facultyId", "name userCode role departmentId isActive").populate("subjectId", "code name semester departmentId isActive").populate("classGroupId", "semester section academicYear batch departmentId isActive").populate("departmentId", "name code isActive");
const forStudent = (current, assignment) => {
  const value = toSafeAssignment(assignment);
  const group = assignment.classGroupId;
  return value.isUsable && String(assignment.departmentId?._id) === String(current.departmentId)
    && group.semester === current.semester && group.section === (current.section || "").trim().toUpperCase() && (!group.batch || group.batch === current.batch);
};
const assignment = async (user, identifier) => {
  const current = await student(user);
  const value = await populateAssignment(FacultyAssignment.findOne({ _id: id(identifier), departmentId: current.departmentId, isActive: true })).lean();
  if (!value || !forStudent(current, value)) throw error(404, "Teaching assignment unavailable for your class.");
  // Reuse the publication cohort filter for an authoritative account match.
  if (!await User.exists({ _id: current._id, ...recipientFilter({ departmentId: current.departmentId, audience: value.classGroupId }) })) throw error(404, "Teaching assignment unavailable for your class.");
  return { current, value };
};
const pageInfo = (query, total) => ({ page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit), hasNextPage: query.page * query.limit < total, hasPreviousPage: query.page > 1 && total > 0 });
const assignmentOptions = async (user, options = {}) => {
  const current = await student(user), query = parseList(options), items = [];
  let total = 0;
  // Stream and page after source validation, so unavailable sources do not
  // occupy option slots or require a separate enrollment hierarchy.
  const joins = [["facultyId", "users", { name: 1, userCode: 1, role: 1, departmentId: 1, isActive: 1 }], ["subjectId", "subjects", { code: 1, name: 1, semester: 1, departmentId: 1, isActive: 1 }], ["classGroupId", "classgroups", { semester: 1, section: 1, academicYear: 1, batch: 1, departmentId: 1, isActive: 1 }], ["departmentId", "departments", { code: 1, name: 1, isActive: 1 }]];
  const pipeline = [{ $match: { departmentId: current.departmentId, isActive: true } }, { $sort: { createdAt: -1, _id: -1 } }, ...joins.flatMap(([field, from, projection]) => [
    { $lookup: { from, localField: field, foreignField: "_id", pipeline: [{ $project: projection }], as: field } }, { $unwind: `$${field}` },
  ])];
  for await (const value of FacultyAssignment.aggregate(pipeline).cursor()) {
    if (!forStudent(current, value)) continue;
    if (total >= (query.page - 1) * query.limit && items.length < query.limit) items.push({ id: String(value._id), faculty: { name: value.facultyId.name }, subject: { code: value.subjectId.code, name: value.subjectId.name }, academicYear: value.academicYear });
    total++;
  }
  return { items, pagination: pageInfo(query, total) };
};
const faculty = async (user, identifier) => {
  const current = await student(user);
  const recipient = await User.findOne({ _id: id(identifier), role: "FACULTY", departmentId: current.departmentId, isActive: true }).select("name").lean();
  if (!recipient) throw error(404, "Faculty recipient unavailable in your department.");
  return { current, recipient };
};
const facultyOptions = async (user, options = {}) => {
  const current = await student(user), query = parseList(options);
  const filter = { role: "FACULTY", departmentId: current.departmentId, isActive: true };
  const [items, total] = await Promise.all([User.find(filter).select("name").sort({ name: 1, _id: 1 }).skip((query.page - 1) * query.limit).limit(query.limit).lean(), User.countDocuments(filter)]);
  return { items: items.map(value => ({ id: String(value._id), name: value.name })), pagination: pageInfo(query, total) };
};
module.exports = { student, assignment, assignmentOptions, faculty, facultyOptions };
