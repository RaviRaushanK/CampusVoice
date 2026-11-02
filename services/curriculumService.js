const Subject = require("../models/Subject");
const ClassGroup = require("../models/ClassGroup");
const FacultyAssignment = require("../models/FacultyAssignment");
const error = require("../utils/authError");
const { ownDepartment, filters, search, page, persist, available, id } = require("./academicSupport");
const safeSubject = subject => ({ id: String(subject._id), departmentId: String(subject.departmentId), code: subject.code, name: subject.name, semester: subject.semester, isActive: subject.isActive, createdAt: subject.createdAt });
const safeClass = group => ({ id: String(group._id), departmentId: String(group.departmentId), semester: group.semester, section: group.section, academicYear: group.academicYear, batch: group.batch, isActive: group.isActive, createdAt: group.createdAt });
const listSubjects = async (user, query) => {
  const filter = { departmentId: await ownDepartment(user), ...filters(query), ...search(query.search, ["name", "code"]) };
  return page(Subject.find(filter).sort({ semester: 1, code: 1, _id: 1 }), Subject.countDocuments(filter), query, safeSubject);
};
const getSubject = async (user, identifier) => safeSubject(available(await Subject.findOne({ _id: id(identifier), departmentId: await ownDepartment(user) }).lean()));
const createSubject = async (user, fields) => {
  const departmentId = await ownDepartment(user); await Subject.init();
  return persist(async () => safeSubject(await Subject.create({ departmentId, name: fields.name, code: fields.code, semester: fields.semester, isActive: fields.isActive ?? true, createdBy: user._id })));
};
const updateSubject = async (user, identifier, fields) => {
  await Subject.init();
  const filter = { _id: id(identifier), departmentId: await ownDepartment(user) };
  const current = available(await Subject.findOne(filter).lean());
  if (fields.semester !== undefined && fields.semester !== current.semester && await FacultyAssignment.exists({ subjectId: current._id })) throw error(409, "A referenced subject's semester cannot change. Create a new subject instead.");
  const changes = {}; for (const key of ["name", "code", "semester", "isActive"]) if (Object.hasOwn(fields, key)) changes[key] = fields[key];
  return persist(async () => safeSubject(available(await Subject.findOneAndUpdate(filter, { $set: changes }, { new: true, runValidators: true }).lean())));
};
const listClasses = async (user, query) => {
  const filter = { departmentId: await ownDepartment(user), ...filters(query), ...search(query.search, ["section", "academicYear", "batch"]) };
  return page(ClassGroup.find(filter).sort({ academicYear: -1, semester: 1, section: 1, _id: 1 }), ClassGroup.countDocuments(filter), query, safeClass);
};
const getClass = async (user, identifier) => safeClass(available(await ClassGroup.findOne({ _id: id(identifier), departmentId: await ownDepartment(user) }).lean()));
const createClass = async (user, fields) => {
  const departmentId = await ownDepartment(user); await ClassGroup.init();
  return persist(async () => safeClass(await ClassGroup.create({ departmentId, semester: fields.semester, section: fields.section ?? "", academicYear: fields.academicYear, batch: fields.batch ?? null, isActive: fields.isActive ?? true, createdBy: user._id })));
};
const updateClass = async (user, identifier, fields) => {
  await ClassGroup.init();
  const filter = { _id: id(identifier), departmentId: await ownDepartment(user) };
  const current = available(await ClassGroup.findOne(filter).lean());
  if (["semester", "section", "academicYear", "batch"].some(key => Object.hasOwn(fields, key) && fields[key] !== current[key]) && await FacultyAssignment.exists({ classGroupId: current._id })) throw error(409, "A referenced class group's identity cannot change. Create a new class instead.");
  const changes = {}; for (const key of ["semester", "section", "academicYear", "batch", "isActive"]) if (Object.hasOwn(fields, key)) changes[key] = fields[key];
  return persist(async () => safeClass(available(await ClassGroup.findOneAndUpdate(filter, { $set: changes }, { new: true, runValidators: true }).lean())));
};
module.exports = { listSubjects, getSubject, createSubject, updateSubject, listClasses, getClass, createClass, updateClass };
