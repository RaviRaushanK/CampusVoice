const mongoose = require("mongoose");
const { IDENTITY_MODES, MESSAGE_LIMITS } = require("../utils/constants/messages");
const reference = ref => ({ type: mongoose.Schema.Types.ObjectId, ref, required: true, immutable: true });
const schema = new mongoose.Schema({
  studentId: { ...reference("User"), select: false }, facultyId: reference("User"), departmentId: reference("Department"),
  message: { type: String, required: true, trim: true, minlength: MESSAGE_LIMITS.min, maxlength: MESSAGE_LIMITS.max, immutable: true },
  identityMode: { type: String, enum: Object.values(IDENTITY_MODES), required: true, immutable: true },
  submittedAt: { type: Date, default: Date.now, immutable: true },
  submissionKey: { type: String, maxlength: 36, immutable: true, select: false }, submissionFingerprint: { type: String, maxlength: 64, immutable: true, select: false },
}, { timestamps: true });
for (const key of ["studentId", "facultyId"]) schema.index({ [key]: 1, createdAt: -1, _id: -1 });
schema.index({ studentId: 1, submissionKey: 1 }, { unique: true, partialFilterExpression: { submissionKey: { $type: "string" } } });
schema.set("toJSON", { transform(doc, value) { for (const key of ["studentId", "submissionKey", "submissionFingerprint"]) delete value[key]; return value; } });
module.exports = mongoose.model("Suggestion", schema);
