const mongoose = require("mongoose");
const { ROLES } = require("../utils/constants/roles");
const { userCodePattern } = require("../validators/authValidator");
const schema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 120 },
  userCode: { type: String, required: true, unique: true, trim: true, lowercase: true, match: userCodePattern },
  email: { type: String, trim: true, lowercase: true, match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
  passwordHash: { type: String, required: true, select: false, match: /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/ },
  role: { type: String, required: true, enum: Object.values(ROLES) },
  departmentId: { type: mongoose.Schema.Types.ObjectId, ref: "Department", default: null },
  semester: { type: Number, min: 1, max: 8, default: null },
  section: { type: String, trim: true, maxlength: 20, default: null },
  isActive: { type: Boolean, default: true },
  mustChangePassword: { type: Boolean, default: true },
  passwordChangedAt: { type: Date, default: null },
  lastLoginAt: { type: Date, default: null },
  tokenVersion: { type: Number, default: 0, min: 0, select: false },
}, { timestamps: true });
// Missing, null and empty optional emails do not reserve an address.
schema.index({ email: 1 }, { unique: true, partialFilterExpression: { email: { $type: "string", $gt: "" } } });
// Security changes revoke existing cookies even if the account is later reactivated.
schema.pre("save", function (next) {
  if (!this.isNew && ["passwordHash", "role", "isActive"].some(field => this.isModified(field))) this.$inc("tokenVersion", 1);
  next();
});
for (const operation of ["updateOne", "updateMany", "findOneAndUpdate"]) {
  schema.pre(operation, function (next) {
    const update = this.getUpdate();
    if (Array.isArray(update)) return next(new Error("User security updates must use update operators."));
    if (["passwordHash", "role", "isActive"].some(field => Object.hasOwn(update, field) || Object.hasOwn(update.$set || {}, field) || Object.hasOwn(update.$unset || {}, field))) {
      update.$inc = { ...update.$inc, tokenVersion: 1 };
    }
    next();
  });
}
schema.methods.toSafeProfile = function () {
  return { id: this._id, name: this.name, userCode: this.userCode, email: this.email,
    role: this.role, departmentId: this.departmentId, semester: this.semester,
    section: this.section, mustChangePassword: this.mustChangePassword };
};
schema.set("toJSON", { transform(doc, ret) { delete ret.passwordHash; delete ret.tokenVersion; return ret; } });
module.exports = mongoose.model("User", schema);
