const express = require("express");
const env = require("./config/env");
const cookieParser = require("cookie-parser");
const healthRoutes = require("./routes/healthRoutes");
const authRoutes = require("./routes/authRoutes");
const profileRoutes = require("./routes/profileRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const academicRoutes = require("./routes/academicRoutes");
const { csrfProtection } = require("./middleware/csrfMiddleware");
const notFound = require("./middleware/notFound");
const errorHandler = require("./middleware/errorHandler");
const app = express();
app.disable("x-powered-by");
app.set("trust proxy", env.trustProxy);
app.use((req, res, next) => {
  res.vary("Origin");
  if (req.get("Origin") === env.frontendOrigin) {
    res.set("Access-Control-Allow-Origin", env.frontendOrigin);
    res.set("Access-Control-Allow-Credentials", "true");
    res.set("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type, X-CSRF-Protection");
  }
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});
// Fifty maximum-size questions can serialize above 1 MB when JSON escaping is
// required. Keep this finite allowance confined to the feedback resource.
app.use("/api/feedback-sessions", express.json({ limit: "2mb" }));
app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));
app.use(cookieParser());
app.use("/api", csrfProtection);
app.use("/api/health", healthRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/feedback-sessions", require("./routes/feedbackSessionRoutes"));
app.use("/api/general-feedback", require("./routes/generalFeedbackRoutes"));
app.use("/api/suggestions", require("./routes/suggestionRoutes"));
app.use("/api", academicRoutes);
app.use(notFound);
app.use(errorHandler);
module.exports = app;
