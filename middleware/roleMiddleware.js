const error = require("../utils/authError");
const { ROLES } = require("../utils/constants/roles");
const { requirePasswordChanged } = require("./authMiddleware");
const requireRole = (...roles) => {
  if (!roles.length || roles.some(role => !Object.values(ROLES).includes(role))) throw new Error("Invalid allowed roles");
  return (req, res, next) => requirePasswordChanged(req, res, (err) => {
    if (err) return next(err);
    if (!roles.includes(req.user.role)) return next(error(403, "You do not have permission to access this resource."));
    next();
  });
};
module.exports = { requireRole };
