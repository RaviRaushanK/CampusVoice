const mongoose = require("mongoose");
const { SESSION_STATUSES, QUESTION_TYPES, LIMITS } = require("../utils/constants/feedback");
const { parseQuestions, validateDates } = require("../validators/feedbackSessionValidator");
const questionSchema = new mongoose.Schema({
  type: { type: String, enum: Object.values(QUESTION_TYPES), required: true },
  prompt: { type: String, required: true, trim: true, maxlength: LIMITS.prompt },
  required: { type: Boolean, default: true },
  options: { type: [{ type: String, trim: true, maxlength: LIMITS.option }], default: undefined },
  ratingMin: { type: Number, default() { return this.type === QUESTION_TYPES.RATING ? 1 : undefined; } },
  ratingMax: { type: Number, default() { return this.type === QUESTION_TYPES.RATING ? 5 : undefined; } },
});
const reference = ref => ({ type: mongoose.Schema.Types.ObjectId, ref, required: true, immutable: true });
const schema = new mongoose.Schema({
  facultyId: reference("User"), departmentId: reference("Department"), facultyAssignmentId: reference("FacultyAssignment"),
  subjectId: reference("Subject"), classGroupId: reference("ClassGroup"), createdBy: reference("User"),
  title: { type: String, required: true, trim: true, maxlength: LIMITS.title },
  description: { type: String, trim: true, maxlength: LIMITS.description, default: "" },
  questions: { type: [questionSchema], default: [] },
  allowAnonymous: { type: Boolean, default: true }, opensAt: { type: Date, default: null }, closesAt: { type: Date, default: null },
  status: { type: String, enum: Object.values(SESSION_STATUSES), default: SESSION_STATUSES.DRAFT },
  publishedAt: { type: Date, default: null }, closedAt: { type: Date, default: null },
  // Freeze the real class criteria at publication, including optional batch.
  audience: { type: new mongoose.Schema({ semester: { type: Number, enum: [1, 2, 3, 4], required: true }, section: { type: String, default: "" }, batch: { type: String, default: null }, academicYear: { type: String, required: true } }, { _id: false }), default: undefined },
}, { timestamps: true, optimisticConcurrency: true });
schema.pre("validate", function (next) {
  try {
    parseQuestions(this.questions.map(question => {
      const { _id, ...fields } = question.toObject(); return { ...fields, id: String(_id) };
    }), true);
  } catch (err) { this.invalidate("questions", err.message); }
  try { validateDates(this); } catch (err) { this.invalidate("closesAt", err.message); }
  next();
});
// Array position is the canonical question order; subdocument IDs survive moves.
schema.index({ facultyId: 1, createdAt: -1, _id: -1 });
schema.index({ facultyId: 1, status: 1, createdAt: -1, _id: -1 });
schema.index({ departmentId: 1, "audience.semester": 1, "audience.section": 1, status: 1, createdAt: -1, _id: -1 });
module.exports = mongoose.model("FeedbackSession", schema);
