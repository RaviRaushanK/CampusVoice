const error = require("../utils/authError");

const validateProfileUpdate = (req, res, next) => {
  const body = req.body;
  if (!body || typeof body !== "object" || Array.isArray(body) || !Object.keys(body).length ||
    Object.keys(body).some(key => !["name", "email"].includes(key))) {
    return next(error(400, "Only name and email may be updated. Provide at least one field."));
  }
  const update = {};
  if (Object.hasOwn(body, "name")) {
    if (typeof body.name !== "string" || body.name.trim().length < 2 || body.name.trim().length > 120) {
      return next(error(400, "Name must contain between 2 and 120 characters."));
    }
    update.name = body.name.trim();
  }
  if (Object.hasOwn(body, "email")) {
    if (body.email !== null && typeof body.email !== "string") return next(error(400, "Enter a valid email address."));
    update.email = body.email?.trim().toLowerCase() || null;
    if (update.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(update.email)) return next(error(400, "Enter a valid email address."));
  }
  req.profileUpdate = update;
  next();
};

module.exports = { validateProfileUpdate };
