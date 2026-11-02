const error = require("../utils/authError");
const Department = require("../models/Department");
const { id } = require("../validators/academicValidator");
const assertRole = (user, ...roles) => { if (!user || !roles.includes(user.role)) throw error(403, "You do not have permission to access this resource."); };
const ownDepartment = async user => {
  assertRole(user, "HOD");
  if (!user.departmentId) throw error(403, "No department assigned. Contact the Principal.");
  const department = await Department.findOne({ _id: user.departmentId, isActive: true }).lean();
  if (!department) throw error(403, "Your department is unavailable or inactive.");
  return department._id;
};
const safeDepartment = value => value ? { id: String(value._id), code: value.code, name: value.name, isActive: value.isActive } : null;
const resourceId = value => value?._id || value;
const safeAccount = user => ({
  id: String(user._id), name: user.name, userCode: user.userCode, email: user.email ?? null, role: user.role,
  departmentId: user.departmentId ? String(resourceId(user.departmentId)) : null,
  department: user.departmentId?.code ? safeDepartment(user.departmentId) : null,
  semester: user.semester ?? null, section: user.section ?? null, batch: user.batch ?? null,
  isActive: user.isActive, createdAt: user.createdAt,
});
const accountFields = "name userCode email role departmentId semester section batch isActive createdAt";
const search = (value, fields) => value ? { $or: fields.map(field => ({ [field]: new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") })) } : {};
const filters = query => ({ ...(query.status !== "all" ? { isActive: query.status === "active" } : {}),
  ...(query.semester ? { semester: query.semester } : {}), ...(query.section !== undefined ? { section: query.section } : {}),
  ...(query.academicYear ? { academicYear: query.academicYear } : {}) });
const page = async (find, count, query, map) => {
  const [items, total] = await Promise.all([find.skip((query.page - 1) * query.limit).limit(query.limit).lean(), count]);
  const totalPages = Math.ceil(total / query.limit);
  return { items: items.map(map), pagination: { page: query.page, limit: query.limit, total, totalPages, hasNextPage: query.page < totalPages, hasPreviousPage: query.page > 1 && total > 0 } };
};
const persist = async operation => {
  try { return await operation(); }
  catch (err) {
    if (err.code === 11000) {
      const message = err.keyPattern?.email ? "This email address is already in use." : err.keyPattern?.userCode ? "This user code / USN is already in use."
        : err.keyPattern?.departmentId && Object.keys(err.keyPattern).length === 1 ? "This department already has an active HOD." : "A record with this academic identity already exists.";
      throw error(409, message);
    }
    if (err.name === "ValidationError" || err.name === "CastError") throw error(400, "Invalid academic data.");
    throw err;
  }
};
const available = value => { if (!value) throw error(404, "Academic record unavailable."); return value; };
module.exports = { assertRole, ownDepartment, safeDepartment, safeAccount, accountFields, resourceId, search, filters, page, persist, available, id };
