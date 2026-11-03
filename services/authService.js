const bcrypt = require("bcryptjs");
const User = require("../models/User");
const error = require("../utils/authError");
// A real bcrypt hash keeps unknown-account comparisons on the same costly path.
const dummyHash = bcrypt.hashSync("unused-account-comparison", 12);
const hashPassword = (password) => bcrypt.hash(password, 12);
const login = async ({ userCode, password }) => {
  const user = await User.findOne({ userCode }).select("+passwordHash +tokenVersion");
  const matches = await bcrypt.compare(password, user?.passwordHash || dummyHash);
  if (!user || !matches || !user.isActive) { await require("./auditService").failedLogin(); throw error(401, "Invalid user code or password."); }
  await require("./auditService").run({ actor: user, action: "AUTH_LOGIN_SUCCESS", resourceType: "AUTH", resourceId: user._id }, async () => {
    const result = await User.updateOne({ _id: user._id, tokenVersion: user.tokenVersion, role: user.role, isActive: true }, { $set: { lastLoginAt: new Date() } });
    if (!result.matchedCount) throw error(401, "Invalid user code or password.");
  });
  return user;
};
const changePassword = async (authenticatedUser, { currentPassword, newPassword }) => {
  const user = await User.findById(authenticatedUser._id).select("+passwordHash +tokenVersion");
  if (!user?.isActive || user.tokenVersion !== authenticatedUser.tokenVersion) throw error(401, "Session invalidated. Please sign in again.");
  if (!await bcrypt.compare(currentPassword, user.passwordHash)) throw error(400, "Current password is incorrect.");
  if (await bcrypt.compare(newPassword, user.passwordHash)) throw error(400, "New password must be different from the current password.");
  const passwordHash = await hashPassword(newPassword);
  // Compare-and-swap prevents concurrent password changes from reusing a session.
  const updated = await require("./auditService").run({ actor: user, action: "PASSWORD_CHANGED", resourceType: "AUTH", resourceId: user._id }, () => User.findOneAndUpdate({ _id: user._id, tokenVersion: user.tokenVersion, isActive: true }, {
    $set: { passwordHash, passwordChangedAt: new Date(), mustChangePassword: false }, $inc: { tokenVersion: 1 },
  }, { new: true, runValidators: true }).select("+tokenVersion").then(value => { if (!value) throw error(401, "Session invalidated. Please sign in again."); return value; }));
  return updated;
};
const logout = async (user) => {
  await require("./auditService").run({ actor: user, action: "AUTH_LOGOUT", resourceType: "AUTH", resourceId: user._id, allowWithoutIntent: true }, () => User.updateOne({ _id: user._id, tokenVersion: user.tokenVersion }, { $inc: { tokenVersion: 1 } }));
};
module.exports = { login, changePassword, logout, hashPassword };
