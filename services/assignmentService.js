const FacultyAssignment = require("../models/FacultyAssignment");
const User = require("../models/User");
const Subject = require("../models/Subject");
const ClassGroup = require("../models/ClassGroup");
const Department = require("../models/Department");
const error = require("../utils/authError");
const { ownDepartment, assertRole, page, persist, available, id } = require("./academicSupport");
const populate = query => query.populate("facultyId", "name userCode role departmentId isActive").populate("subjectId", "code name semester departmentId isActive").populate("classGroupId", "semester section academicYear batch departmentId isActive").populate("departmentId", "name code isActive");
const safe = value => ({ id: String(value._id), departmentId: String(value.departmentId?._id || value.departmentId),
  department: value.departmentId?.code ? { id: String(value.departmentId._id), code: value.departmentId.code, name: value.departmentId.name } : null,
  faculty: value.facultyId ? { id: String(value.facultyId._id), name: value.facultyId.name, userCode: value.facultyId.userCode, isActive: value.facultyId.isActive } : null,
  subject: value.subjectId ? { id: String(value.subjectId._id), code: value.subjectId.code, name: value.subjectId.name, semester: value.subjectId.semester, isActive: value.subjectId.isActive } : null,
  classGroup: value.classGroupId ? { id: String(value.classGroupId._id), semester: value.classGroupId.semester, section: value.classGroupId.section, academicYear: value.classGroupId.academicYear, batch: value.classGroupId.batch, isActive: value.classGroupId.isActive } : null,
  academicYear: value.academicYear, isActive: value.isActive,
  isUsable: Boolean(value.isActive && value.departmentId?.isActive && value.facultyId?.isActive && value.facultyId?.role === "FACULTY" && value.subjectId?.isActive && value.classGroupId?.isActive
    && [value.facultyId?.departmentId, value.subjectId?.departmentId, value.classGroupId?.departmentId].every(departmentId => String(departmentId) === String(value.departmentId?._id))
    && value.subjectId?.semester === value.classGroupId?.semester && value.academicYear === value.classGroupId?.academicYear), createdAt: value.createdAt,
});
const scope = async user => {
  assertRole(user, "HOD", "FACULTY");
  return user.role === "HOD" ? { departmentId: await ownDepartment(user) } : { facultyId: user._id };
};
const list = async (user, query) => {
  const filter = { ...await scope(user), ...(query.status !== "all" ? { isActive: query.status === "active" } : {}), ...(query.academicYear ? { academicYear: query.academicYear } : {}) };
  return page(populate(FacultyAssignment.find(filter).sort({ createdAt: -1, _id: -1 })), FacultyAssignment.countDocuments(filter), query, safe);
};
const get = async (user, identifier) => safe(available(await populate(FacultyAssignment.findOne({ ...await scope(user), _id: id(identifier) })).lean()));
const verify = async (departmentId, fields) => {
  const [faculty, subject, group, department] = await Promise.all([
    User.findOne({ _id: fields.facultyId, role: "FACULTY", departmentId, isActive: true }).lean(),
    Subject.findOne({ _id: fields.subjectId, departmentId, isActive: true }).lean(),
    ClassGroup.findOne({ _id: fields.classGroupId, departmentId, isActive: true }).lean(),
    Department.exists({ _id: departmentId, isActive: true }),
  ]);
  if (!faculty || !subject || !group || !department) throw error(400, "Choose active Faculty, Subject and Class from your own department.");
  if (subject.semester !== group.semester || fields.academicYear !== group.academicYear) throw error(400, "Subject semester and academic year must match the selected class.");
};
const create = async (user, fields) => {
  const departmentId = await ownDepartment(user);
  await verify(departmentId, fields); await FacultyAssignment.init();
  return persist(async () => {
    const created = await FacultyAssignment.create({ departmentId, facultyId: fields.facultyId, subjectId: fields.subjectId, classGroupId: fields.classGroupId, academicYear: fields.academicYear, isActive: fields.isActive ?? true, createdBy: user._id });
    return get(user, created._id);
  });
};
const update = async (user, identifier, fields) => {
  await FacultyAssignment.init();
  const filter = { _id: id(identifier), departmentId: await ownDepartment(user) };
  const current = available(await FacultyAssignment.findOne(filter).lean());
  if (fields.isActive) await verify(filter.departmentId, current);
  return persist(async () => { available(await FacultyAssignment.findOneAndUpdate(filter, { $set: { isActive: fields.isActive } }, { new: true, runValidators: true })); return get(user, identifier); });
};
module.exports = { list, get, create, update, toSafeAssignment: safe };
