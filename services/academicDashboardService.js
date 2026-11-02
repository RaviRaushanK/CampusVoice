const Department = require("../models/Department");
const User = require("../models/User");
const Subject = require("../models/Subject");
const ClassGroup = require("../models/ClassGroup");
const FacultyAssignment = require("../models/FacultyAssignment");
const { safeDepartment, assertRole } = require("./academicSupport");
const assignments = require("./assignmentService");
const getDashboard = async user => {
  assertRole(user, "PRINCIPAL", "HOD", "FACULTY", "STUDENT");
  if (user.role === "PRINCIPAL") {
    const [departments, hods, faculty, students] = await Promise.all([Department.countDocuments(), User.countDocuments({ role: "HOD", isActive: true }), User.countDocuments({ role: "FACULTY" }), User.countDocuments({ role: "STUDENT" })]);
    return { metrics: { Departments: departments, "Active HODs": hods, Faculty: faculty, Students: students } };
  }
  const department = user.departmentId ? await Department.findById(user.departmentId).lean() : null;
  if (user.role === "HOD") {
    const filter = { departmentId: user.departmentId || null };
    const values = department ? await Promise.all([User.countDocuments({ ...filter, role: "FACULTY" }), User.countDocuments({ ...filter, role: "STUDENT" }), Subject.countDocuments(filter), ClassGroup.countDocuments(filter), FacultyAssignment.countDocuments({ ...filter, isActive: true })]) : [0, 0, 0, 0, 0];
    return { department: safeDepartment(department), metrics: Object.fromEntries(["Faculty", "Students", "Subjects", "Class Groups", "Active Assignments"].map((key, i) => [key, values[i]])) };
  }
  if (user.role === "FACULTY") return { department: safeDepartment(department), assignments: await assignments.list(user, { page: 1, limit: 5, status: "active" }) };
  return { department: safeDepartment(department), semester: user.semester ?? null, section: user.section ?? null, batch: user.batch ?? null };
};
module.exports = { getDashboard };
