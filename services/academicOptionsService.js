const ClassGroup = require("../models/ClassGroup");
const User = require("../models/User");
const Assignment = require("../models/FacultyAssignment");
const { ownDepartment, assertRole } = require("./academicSupport");
const error = require("../utils/authError");
const clean = values => values.filter(value => typeof value === "string" && value.length).sort((a, b) => a.localeCompare(b, "en", { numeric: true }));
const get = async (user, query = {}) => {
  assertRole(user, "HOD", "FACULTY");
  const { resource, status = "all" } = query;
  if (Object.keys(query).some(key => !["resource", "status"].includes(key)) || typeof resource !== "string" || !["active", "inactive", "all"].includes(status)) throw error(400, "Invalid academic options query.");
  let Model, filter, fields;
  if (resource === "faculty-assignments/mine") {
    assertRole(user, "FACULTY"); Model = Assignment; filter = { facultyId: user._id }; fields = ["academicYear"];
  } else {
    assertRole(user, "HOD");
    if (!["classes", "students", "faculty-assignments"].includes(resource)) throw error(400, "Invalid academic options resource.");
    filter = { departmentId: await ownDepartment(user) };
    if (resource === "classes") { Model = ClassGroup; fields = ["academicYear", "section"]; }
    else if (resource === "students") { Model = User; filter.role = "STUDENT"; fields = ["section"]; }
    else { Model = Assignment; fields = ["academicYear"]; }
  }
  if (status !== "all") filter.isActive = status === "active";
  const values = await Promise.all(fields.map(field => Model.distinct(field, filter)));
  return { academicYears: fields.includes("academicYear") ? clean(values[fields.indexOf("academicYear")]) : [], sections: fields.includes("section") ? clean(values[fields.indexOf("section")]) : [] };
};
module.exports = { get };
