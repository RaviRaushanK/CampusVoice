const router = require("express").Router();
const { rateLimit } = require("express-rate-limit");
const controller = require("../controllers/authController");
const { authenticate } = require("../middleware/authMiddleware");
const { validateLogin, validatePasswordChange } = require("../validators/authValidator");
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: "draft-8", legacyHeaders: false,
  skipSuccessfulRequests: true, message: { success: false, message: "Too many login attempts. Please try again later." } });
const passwordLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: "draft-8", legacyHeaders: false,
  keyGenerator: req => String(req.user._id), skipSuccessfulRequests: true,
  message: { success: false, message: "Too many password change attempts. Please try again later." } });
router.use((req, res, next) => { res.set("Cache-Control", "no-store"); next(); });
router.post("/login", loginLimiter, validateLogin, controller.login);
router.get("/me", authenticate, controller.me);
router.post("/logout", authenticate, controller.logout);
router.post("/change-password", authenticate, passwordLimiter, validatePasswordChange, controller.changePassword);
module.exports = router;
