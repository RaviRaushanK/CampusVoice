const express = require("express");
const env = require("./config/env");
const cookieParser = require("cookie-parser");
const healthRoutes = require("./routes/healthRoutes");
const authRoutes = require("./routes/authRoutes");
const profileRoutes = require("./routes/profileRoutes");
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
app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));
app.use(cookieParser());
app.use("/api", csrfProtection);
app.use("/api/health", healthRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/profile", profileRoutes);
app.use(notFound);
app.use(errorHandler);
module.exports = app;
