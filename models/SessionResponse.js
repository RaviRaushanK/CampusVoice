const mongoose = require("mongoose");
const { IDENTITY_MODES, LIMITS } = require("../utils/constants/feedback");
const answerSchema = new mongoose.Schema({
  questionId: { type: mongoose.Schema.Types.ObjectId, required: true },
  // Validated against the immutable published question in the response service.
  value: { type: mongoose.Schema.Types.Mixed, required: true },
}, { _id: false });
const schema = new mongoose.Schema({
  sessionId: { type: mongoose.Schema.Types.ObjectId, ref: "FeedbackSession", required: true, immutable: true },
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, immutable: true, select: false },
  identityMode: { type: String, enum: Object.values(IDENTITY_MODES), required: true, immutable: true },
  answers: { type: [answerSchema], required: true, immutable: true, validate: value => value.length <= LIMITS.questions && new Set(value.map(answer => String(answer.questionId))).size === value.length },
  submittedAt: { type: Date, required: true, default: Date.now, immutable: true },
}, { timestamps: true });
schema.index({ sessionId: 1, studentId: 1 }, { unique: true });
schema.index({ studentId: 1, submittedAt: -1, _id: -1 });
schema.set("toJSON", { transform(doc, value) { delete value.studentId; return value; } });
module.exports = mongoose.model("SessionResponse", schema);
