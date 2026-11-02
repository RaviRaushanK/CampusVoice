const departments = require("../services/departmentService");
const users = require("../services/academicUserService");
const curriculum = require("../services/curriculumService");
const assignments = require("../services/assignmentService");
const dashboard = require("../services/academicDashboardService");
const respond = (operation, status = 200) => async (req, res, next) => {
  try { res.status(status).json({ success: true, data: await operation(req) }); } catch (err) { next(err); }
};
const department = {
  list: respond(req => departments.list(req.user, req.academicQuery)), get: respond(req => departments.get(req.user, req.params.id)),
  create: respond(req => departments.create(req.user, req.academicInput), 201), update: respond(req => departments.update(req.user, req.params.id, req.academicInput)),
};
const accounts = role => ({
  list: respond(req => users.list(req.user, role, req.academicQuery)), get: respond(req => users.get(req.user, role, req.params.id)),
  create: respond(req => users.create(req.user, role, req.academicInput), 201), update: respond(req => users.update(req.user, role, req.params.id, req.academicInput)),
});
const subjects = {
  list: respond(req => curriculum.listSubjects(req.user, req.academicQuery)), get: respond(req => curriculum.getSubject(req.user, req.params.id)),
  create: respond(req => curriculum.createSubject(req.user, req.academicInput), 201), update: respond(req => curriculum.updateSubject(req.user, req.params.id, req.academicInput)),
};
const classes = {
  list: respond(req => curriculum.listClasses(req.user, req.academicQuery)), get: respond(req => curriculum.getClass(req.user, req.params.id)),
  create: respond(req => curriculum.createClass(req.user, req.academicInput), 201), update: respond(req => curriculum.updateClass(req.user, req.params.id, req.academicInput)),
};
const assignment = {
  list: respond(req => assignments.list(req.user, req.academicQuery)), get: respond(req => assignments.get(req.user, req.params.id)),
  create: respond(req => assignments.create(req.user, req.academicInput), 201), update: respond(req => assignments.update(req.user, req.params.id, req.academicInput)),
};
module.exports = { department, hods: accounts("HOD"), faculty: accounts("FACULTY"), students: accounts("STUDENT"), subjects, classes, assignment, dashboard: respond(req => dashboard.getDashboard(req.user)) };
