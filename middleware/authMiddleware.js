const mongoose = require("mongoose");
const { verifyToken } = require("./jwt");
const { clearAuthCookie } = require("./cookieOptions");
const env = require("../config/env");
const User = require("../models/User");
const error = require("../utils/authError");
const authenticate = async (req, res, next) => {
  let decoded;
  try {
    decoded = verifyToken(req.cookies?.[env.cookieName]);
    if (!mongoose.isObjectIdOrHexString(decoded.sub) || !Number.isInteger(decoded.tokenVersion)) throw new Error("Invalid claims");
  } catch {
    clearAuthCookie(res);
    return next(error(401, "Session missing, invalid or expired. Please sign in again."));
  }
  try {
    const user = await User.findById(decoded.sub).select("+tokenVersion");
    if (!user || !user.isActive || user.tokenVersion !== decoded.tokenVersion || user.role !== decoded.role) {
      clearAuthCookie(res);
      return next(error(401, "Session invalidated. Please sign in again."));
    }
    req.user = user;
    next();
  } catch (err) { next(err); }
};
const requirePasswordChanged = (req, res, next) => {
  if (!req.user) return next(error(401, "Please sign in."));
  if (req.user.mustChangePassword) return next(error(403, "Change your temporary password before continuing.", "PASSWORD_CHANGE_REQUIRED"));
  next();
};
// Future business routes should use protect; auth recovery endpoints use authenticate.
module.exports = { authenticate, requirePasswordChanged, protect: [authenticate, requirePasswordChanged] };
