const User = require("../models/User");
const error = require("../utils/authError");
// The authentication middleware has already loaded and validated this user.
const getProfile = user => ({
  name: user.name,
  userCode: user.userCode,
  email: user.email ?? null,
  role: user.role,
  isActive: user.isActive,
  departmentId: user.departmentId ?? null,
  semester: user.semester ?? null,
  section: user.section ?? null,
  lastLoginAt: user.lastLoginAt ?? null,
  createdAt: user.createdAt ?? null,
});

const updateProfile = async (user, fields) => {
  const update = { $set: {} };
  if (Object.hasOwn(fields, "name")) update.$set.name = fields.name;
  if (Object.hasOwn(fields, "email")) {
    if (fields.email === null) update.$unset = { email: 1 };
    else update.$set.email = fields.email;
  }
  try {
    // Do not accept updates before the unique-email index is ready.
    await User.init();
    // Recheck security state atomically in case it changed after authentication.
    const updated = await User.findOneAndUpdate({
      _id: user._id, tokenVersion: user.tokenVersion, role: user.role, isActive: true, mustChangePassword: false,
    }, update, { new: true, runValidators: true });
    if (!updated) throw error(401, "Session invalidated. Please sign in again.");
    return getProfile(updated);
  } catch (err) {
    if (err.code === 11000 && err.keyPattern?.email) throw error(409, "This email address is already in use.");
    throw err;
  }
};

module.exports = { getProfile, updateProfile };
