const User = require("../models/User");
const Department = require("../models/Department");
const { hashPassword } = require("./authService");
const error = require("../utils/authError");
const { assertRole, ownDepartment, safeAccount, accountFields, filters, search, page, persist, available, id } = require("./academicSupport");
const accountScope = async (user, role) => {
  if (role === "HOD") { assertRole(user, "PRINCIPAL"); return { role }; }
  return { role, departmentId: await ownDepartment(user) };
};
const list = async (user, role, query) => {
  const filter = { ...await accountScope(user, role), ...filters(query), ...search(query.search, ["name", "email", "userCode"]) };
  return page(User.find(filter).select(accountFields).populate("departmentId", "code name isActive").sort(role === "STUDENT" ? { userCode: 1, _id: 1 } : { name: 1, _id: 1 }), User.countDocuments(filter), query, safeAccount);
};
const get = async (user, role, identifier) => safeAccount(available(await User.findOne({ ...await accountScope(user, role), _id: id(identifier) }).select(accountFields).populate("departmentId", "code name isActive").lean()));
const activeDepartment = async identifier => {
  if (!await Department.exists({ _id: id(identifier), isActive: true })) throw error(400, "Choose an active department.");
  return identifier;
};
const create = async (user, role, fields) => {
  const scope = await accountScope(user, role);
  const departmentId = role === "HOD" ? await activeDepartment(fields.departmentId) : scope.departmentId;
  await User.init();
  const passwordHash = await hashPassword(fields.initialPassword);
  return persist(async () => {
    const created = await User.create({ name: fields.name, userCode: fields.userCode, email: fields.email || undefined,
      role, departmentId, passwordHash, mustChangePassword: true, isActive: fields.isActive ?? true,
      ...(role === "STUDENT" ? { semester: fields.semester, section: fields.section || null, batch: fields.batch ?? null } : {}),
    });
    return get(user, role, created._id);
  });
};
const update = async (user, role, identifier, fields) => {
  await User.init();
  const filter = { ...await accountScope(user, role), _id: id(identifier) };
  const current = available(await User.findOne(filter).select("departmentId").lean());
  const allowed = ["name", "email", "isActive", ...(role === "STUDENT" ? ["semester", "section", "batch"] : []), ...(role === "HOD" ? ["departmentId"] : [])];
  if (role === "HOD" && (fields.departmentId || fields.isActive === true)) await activeDepartment(fields.departmentId || current.departmentId);
  const changes = {};
  for (const key of allowed) if (Object.hasOwn(fields, key)) changes[key] = fields[key];
  const update = { $set: changes };
  if (changes.email === null) { delete changes.email; update.$unset = { email: 1 }; }
  return persist(async () => {
    available(await User.findOneAndUpdate(filter, update, { new: true, runValidators: true }));
    return get(user, role, identifier);
  });
};
module.exports = { list, get, create, update };
