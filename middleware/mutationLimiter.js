module.exports = require("express-rate-limit").rateLimit({ windowMs: 15 * 60 * 1000, limit: 120, standardHeaders: "draft-8", legacyHeaders: false,
  skip: req => ["GET", "HEAD", "OPTIONS"].includes(req.method), keyGenerator: req => String(req.user._id), message: { success: false, message: "Too many changes from this account. Please try again later." } });
