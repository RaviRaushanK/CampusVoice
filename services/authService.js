const bcrypt = require("bcryptjs");
const User = require("../models/User");
const error = require("../utils/authError");
// A real bcrypt hash keeps unknown-account comparisons on the same costly path.
const dummyHash = bcrypt.hashSync("unused-account-comparison", 12);
const hashPassword = (password) => bcrypt.hash(password, 12);
const login = async ({ userCode, password }) => {
  const user = await User.findOne({ userCode }).select("+passwordHash +tokenVersion");
  const matches = await bcrypt.compare(password, user?.passwordHash || dummyHash);
  if (!user || !matches) throw error(401, "Invalid user code or password.");
  if (!user.isActive) throw error(401, "This account is inactive. Contact the administrator.");
  await User.updateOne({ _id: user._id }, { $set: { lastLoginAt: new Date() } });
  return user;
};
const changePassword = async (authenticatedUser, { currentPassword, newPassword }) => {
  const user = await User.findById(authenticatedUser._id).select("+passwordHash +tokenVersion");
  if (!user?.isActive || user.tokenVersion !== authenticatedUser.tokenVersion) throw error(401, "Session invalidated. Please sign in again.");
  if (!await bcrypt.compare(currentPassword, user.passwordHash)) throw error(400, "Current password is incorrect.");
  if (await bcrypt.compare(newPassword, user.passwordHash)) throw error(400, "New password must be different from the current password.");
  const passwordHash = await hashPassword(newPassword);
  // Compare-and-swap prevents concurrent password changes from reusing a session.
  const updated = await User.findOneAndUpdate({ _id: user._id, tokenVersion: user.tokenVersion, isActive: true }, {
    $set: { passwordHash, passwordChangedAt: new Date(), mustChangePassword: false }, $inc: { tokenVersion: 1 },
  }, { new: true, runValidators: true }).select("+tokenVersion");
  if (!updated) throw error(401, "Session invalidated. Please sign in again.");
  return updated;
};
const logout = async (user) => {
  await User.updateOne({ _id: user._id, tokenVersion: user.tokenVersion }, { $inc: { tokenVersion: 1 } });
};
module.exports = { login, changePassword, logout, hashPassword };
