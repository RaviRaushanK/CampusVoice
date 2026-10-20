const env = require("../config/env");
const error = require("../utils/authError");
// Origin allowlisting plus a mandatory non-simple header prevents browser form
// submissions and cross-origin fetches, including login CSRF. Never accept body tokens.
const csrfProtection = (req, res, next) => {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  if (req.get("Origin") !== env.frontendOrigin || req.get("X-CSRF-Protection") !== "1") {
    return next(error(403, "Request origin or CSRF protection header is invalid.", "CSRF_REJECTED"));
  }
  next();
};
module.exports = { csrfProtection };
