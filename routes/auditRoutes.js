const router = require("express").Router();
const { protect } = require("../middleware/authMiddleware");
const { requireRole } = require("../middleware/roleMiddleware");
router.use((req, res, next) => { res.set("Cache-Control", "no-store"); next(); }, protect, requireRole("PRINCIPAL"));
router.get("/", require("../controllers/auditController").list);
module.exports = router;
