const mongoose = require("mongoose");
const env = require("../config/env");
const User = require("../models/User");
const { hashPassword } = require("../services/authService");
const { normalizeUserCode, validateNewPassword, userCodePattern } = require("../validators/authValidator");
const seedPrincipal = async (settings = process.env) => {
  // A fixed bootstrap lock prevents simultaneous seed runs creating different principals.
  const lock = mongoose.connection.collection("bootstrap_locks");
  try { await lock.insertOne({ _id: "initial-principal" }); }
  catch (err) { if (err.code === 11000) throw new Error("Principal bootstrap is already running; retry after it finishes."); throw err; }
  try {
    if (await User.exists({ role: "PRINCIPAL" })) return { created: false };
    const userCode = normalizeUserCode(settings.PRINCIPAL_USER_CODE || settings.PRINCIPAL_USERNAME);
    if (!settings.PRINCIPAL_NAME || !userCodePattern.test(userCode)) throw new Error("Set PRINCIPAL_NAME and a valid PRINCIPAL_USER_CODE.");
    validateNewPassword(settings.PRINCIPAL_PASSWORD);
    await User.init();
    await User.create({ name: settings.PRINCIPAL_NAME, userCode, email: settings.PRINCIPAL_EMAIL || undefined,
      passwordHash: await hashPassword(settings.PRINCIPAL_PASSWORD), role: "PRINCIPAL", isActive: true, mustChangePassword: true });
    return { created: true };
  } finally { await lock.deleteOne({ _id: "initial-principal" }); }
};
if (require.main === module) {
  (async () => {
    try {
      await mongoose.connect(env.mongoUri, { serverSelectionTimeoutMS: 5000 });
      const result = await seedPrincipal();
      console.log(result.created ? "Principal created. Password change required on first login." : "Principal already exists. No credentials changed.");
    } catch (err) { console.error("Principal bootstrap failed:", err.message); process.exitCode = 1; }
    finally { await mongoose.disconnect(); }
  })();
}
module.exports = { seedPrincipal };
