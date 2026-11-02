const Department = require("../models/Department");
const { assertRole, safeDepartment, search, filters, page, persist, available, id } = require("./academicSupport");
const safe = department => ({ ...safeDepartment(department), description: department.description, createdAt: department.createdAt });
const scope = user => {
  assertRole(user, "PRINCIPAL", "HOD");
  return user.role === "HOD" ? { _id: user.departmentId || null } : {};
};
const list = async (user, query) => {
  const filter = { ...scope(user), ...filters(query), ...search(query.search, ["name", "code"]) };
  return page(Department.find(filter).sort({ code: 1, _id: 1 }), Department.countDocuments(filter), query, safe);
};
const get = async (user, identifier) => safe(available(await Department.findOne({ ...scope(user), _id: user.role === "HOD" && String(user.departmentId) !== String(id(identifier)) ? null : id(identifier) }).lean()));
const create = async (user, fields) => {
  assertRole(user, "PRINCIPAL"); await Department.init();
  return persist(async () => safe(await Department.create({ name: fields.name, code: fields.code, description: fields.description, isActive: fields.isActive ?? true, createdBy: user._id })));
};
const update = async (user, identifier, fields) => {
  assertRole(user, "PRINCIPAL"); await Department.init();
  const updateFields = {};
  for (const key of ["name", "code", "description", "isActive"]) if (Object.hasOwn(fields, key)) updateFields[key] = fields[key];
  return persist(async () => safe(available(await Department.findOneAndUpdate({ _id: id(identifier) }, { $set: updateFields }, { new: true, runValidators: true }).lean())));
};
module.exports = { list, get, create, update };
