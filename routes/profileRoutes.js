const router = require("express").Router();
const { protect } = require("../middleware/authMiddleware");
const controller = require("../controllers/profileController");
const { validateProfileUpdate } = require("../validators/profileValidator");

router.use((req, res, next) => { res.set("Cache-Control", "no-store"); next(); });
router.get("/", protect, controller.getProfile);
router.patch("/", protect, validateProfileUpdate, controller.updateProfile);

module.exports = router;
