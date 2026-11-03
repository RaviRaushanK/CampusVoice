const Department = require("../models/Department");
const User = require("../models/User");
const Subject = require("../models/Subject");
const ClassGroup = require("../models/ClassGroup");
const FacultyAssignment = require("../models/FacultyAssignment");
const FeedbackSession = require("../models/FeedbackSession");
const { safeDepartment, assertRole } = require("./academicSupport");
const assignments = require("./assignmentService");
const { state } = require("./feedbackAvailability");
const Feedback = require("../models/Feedback");
const Suggestion = require("../models/Suggestion");
const getDashboard = async user => {
  assertRole(user, "PRINCIPAL", "HOD", "FACULTY", "STUDENT");
  const complaintMetrics = await require("./complaintService").counts(user);
  if (user.role === "PRINCIPAL") {
    const [departments, hods, faculty, students] = await Promise.all([Department.countDocuments(), User.countDocuments({ role: "HOD", isActive: true }), User.countDocuments({ role: "FACULTY" }), User.countDocuments({ role: "STUDENT" })]);
    return { metrics: { Departments: departments, "Active HODs": hods, Faculty: faculty, Students: students, ...complaintMetrics } };
  }
  const department = user.departmentId ? await Department.findById(user.departmentId).lean() : null;
  if (user.role === "HOD") {
    const filter = { departmentId: user.departmentId || null };
    const values = department ? await Promise.all([User.countDocuments({ ...filter, role: "FACULTY" }), User.countDocuments({ ...filter, role: "STUDENT" }), Subject.countDocuments(filter), ClassGroup.countDocuments(filter), FacultyAssignment.countDocuments({ ...filter, isActive: true })]) : [0, 0, 0, 0, 0];
    return { department: safeDepartment(department), metrics: { ...Object.fromEntries(["Faculty", "Students", "Subjects", "Class Groups", "Active Assignments"].map((key, i) => [key, values[i]])), ...complaintMetrics } };
  }
  if (user.role === "FACULTY") {
    const metrics = { "My Sessions": 0, "Draft Sessions": 0, "Open Sessions": 0, "Scheduled Sessions": 0, "Closed Sessions": 0 };
    const now = new Date();
    for await (const session of FeedbackSession.find({ facultyId: user._id }).select("status opensAt closesAt -_id").lean().cursor()) {
      metrics["My Sessions"]++;
      const key = { DRAFT: "Draft Sessions", OPEN: "Open Sessions", SCHEDULED: "Scheduled Sessions", CLOSED: "Closed Sessions" }[state(session, now)];
      metrics[key]++;
    }
    const [feedback, suggestions] = await Promise.all([Feedback.countDocuments({ facultyId: user._id }), Suggestion.countDocuments({ facultyId: user._id })]);
    return { department: safeDepartment(department), assignments: await assignments.list(user, { page: 1, limit: 5, status: "active" }), metrics: { ...metrics, "General Feedback Received": feedback, "Private Suggestions": suggestions, ...complaintMetrics } };
  }
  const [sessions, feedback, suggestions] = await Promise.all([require("./studentFeedbackService").counts(user), Feedback.countDocuments({ studentId: user._id }), Suggestion.countDocuments({ studentId: user._id })]);
  return { department: safeDepartment(department), semester: user.semester ?? null, section: user.section ?? null, batch: user.batch ?? null,
    metrics: { ...sessions, "Feedback Submitted": feedback, "Suggestions Sent": suggestions, ...complaintMetrics } };
};
module.exports = { getDashboard };
