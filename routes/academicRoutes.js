const router = require("express").Router();
const { protect } = require("../middleware/authMiddleware");
const { requireRole } = require("../middleware/roleMiddleware");
const { validateBody, validateQuery, validateId } = require("../validators/academicValidator");
const controller = require("../controllers/academicController");
router.use((req, res, next) => { res.set("Cache-Control", "no-store"); next(); });
router.use(["/academic", "/departments", "/hods", "/faculty", "/students", "/subjects", "/classes", "/faculty-assignments"], protect);
router.get("/academic/dashboard", controller.dashboard);
router.get("/faculty-assignments/mine", requireRole("FACULTY"), validateQuery, controller.assignment.list);
router.get("/departments", requireRole("PRINCIPAL", "HOD"), validateQuery, controller.department.list);
router.get("/departments/:id", requireRole("PRINCIPAL", "HOD"), validateId, controller.department.get);
router.post("/departments", requireRole("PRINCIPAL"), validateBody("departments"), controller.department.create);
router.patch("/departments/:id", requireRole("PRINCIPAL"), validateId, validateBody("departments"), controller.department.update);
for (const [path, kind, handler, role] of [
  ["hods", "hods", controller.hods, "PRINCIPAL"], ["faculty", "faculty", controller.faculty, "HOD"],
  ["students", "students", controller.students, "HOD"], ["subjects", "subjects", controller.subjects, "HOD"],
  ["classes", "classes", controller.classes, "HOD"], ["faculty-assignments", "assignments", controller.assignment, "HOD"],
]) {
  router.get(`/${path}`, requireRole(role), validateQuery, handler.list);
  router.get(`/${path}/:id`, requireRole(role), validateId, handler.get);
  router.post(`/${path}`, requireRole(role), validateBody(kind), handler.create);
  router.patch(`/${path}/:id`, requireRole(role), validateId, validateBody(kind), handler.update);
}
module.exports = router;
