const mongoose = require("mongoose");
const { IDENTITY_MODES, MESSAGE_LIMITS } = require("../utils/constants/messages");
const reference = ref => ({ type: mongoose.Schema.Types.ObjectId, ref, required: true, immutable: true });
const schema = new mongoose.Schema({
  studentId: { ...reference("User"), select: false }, facultyId: reference("User"), subjectId: reference("Subject"),
  departmentId: reference("Department"), facultyAssignmentId: reference("FacultyAssignment"),
  rating: { type: Number, required: true, enum: [1, 2, 3, 4, 5], immutable: true },
  message: { type: String, required: true, trim: true, minlength: MESSAGE_LIMITS.min, maxlength: MESSAGE_LIMITS.max, immutable: true },
  identityMode: { type: String, enum: Object.values(IDENTITY_MODES), required: true, immutable: true },
  submittedAt: { type: Date, default: Date.now, immutable: true },
}, { timestamps: true });
for (const key of ["studentId", "facultyId", "departmentId"]) schema.index({ [key]: 1, createdAt: -1, _id: -1 });
schema.set("toJSON", { transform(doc, value) { delete value.studentId; return value; } });
module.exports = mongoose.model("Feedback", schema);
