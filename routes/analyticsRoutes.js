const router = require("express").Router();
const { protect } = require("../middleware/authMiddleware");
const { requireRole } = require("../middleware/roleMiddleware");
const controller = require("../controllers/analyticsController");
router.use((req, res, next) => { res.set("Cache-Control", "no-store"); next(); }, protect);
router.get("/summary", requireRole("STUDENT"), controller.get("summary"));
for (const kind of ["overview", "feedback", "sessions", "complaints", "complaint-processing"]) router.get(`/${kind}`, requireRole("PRINCIPAL", "HOD", "FACULTY"), controller.get(kind));
module.exports = router;
