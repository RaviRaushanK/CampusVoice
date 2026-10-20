const error = require("../utils/authError");
const normalizeUserCode = (value) => typeof value === "string" ? value.trim().toLowerCase() : "";
const userCodePattern = /^[a-z0-9][a-z0-9._-]{2,49}$/;
const validPasswordInput = (value) => typeof value === "string" && value.length > 0 && Buffer.byteLength(value, "utf8") <= 72;
const validateNewPassword = (password) => {
  if (!validPasswordInput(password) || password.length < 8 || !/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9])/.test(password)) {
    throw error(400, "Password must be at least 8 characters, at most 72 UTF-8 bytes, and include uppercase, lowercase, a number and a special character.");
  }
};
const validateLogin = (req, res, next) => {
  const { userCode, password } = req.body || {};
  if (!userCodePattern.test(normalizeUserCode(userCode)) || !validPasswordInput(password)) return next(error(400, "Enter a valid user code (3-50 letters, numbers, dots, underscores or hyphens) and password."));
  req.body.userCode = normalizeUserCode(userCode);
  next();
};
const validatePasswordChange = (req, res, next) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body || {};
    if (!validPasswordInput(currentPassword)) throw error(400, "Current password is required and must be at most 72 UTF-8 bytes.");
    validateNewPassword(newPassword);
    if (newPassword !== confirmPassword) throw error(400, "New password and confirmation do not match.");
    next();
  } catch (err) { next(err); }
};
module.exports = { normalizeUserCode, userCodePattern, validateNewPassword, validateLogin, validatePasswordChange };
