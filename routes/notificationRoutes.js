const router = require("express").Router();
const { protect } = require("../middleware/authMiddleware");
const controller = require("../controllers/notificationController");
const { validateList, validateReadId, validateNoInput } = require("../validators/notificationValidator");

router.use((req, res, next) => { res.set("Cache-Control", "no-store"); next(); });
router.use(protect);
router.get("/", validateList, controller.list);
router.get("/unread-count", validateNoInput, controller.unreadCount);
router.patch("/read-all", validateNoInput, controller.markAllRead);
router.patch("/:notificationId/read", validateNoInput, validateReadId, controller.markRead);

module.exports = router;
