const mongoose = require("mongoose");
const FeedbackSession = require("../models/FeedbackSession");
const assignments = require("./assignmentService");
const { assertRole, page, safeDepartment, id } = require("./academicSupport");
const { parseBody, parseQuery, validateDates } = require("../validators/feedbackSessionValidator");
const error = require("../utils/authError");
const { SESSION_STATUSES } = require("../utils/constants/feedback");
const scope = user => { assertRole(user, "FACULTY"); return { facultyId: user._id }; };
const available = value => { if (!value) throw error(404, "Feedback session unavailable."); return value; };
const populate = query => query.populate("departmentId", "code name isActive").populate("subjectId", "code name semester").populate("classGroupId", "semester section academicYear");
const safe = (value, detail = true) => ({
  id: String(value._id), facultyAssignmentId: String(value.facultyAssignmentId),
  department: safeDepartment(value.departmentId),
  subject: value.subjectId ? { id: String(value.subjectId._id), code: value.subjectId.code, name: value.subjectId.name, semester: value.subjectId.semester } : null,
  classGroup: value.classGroupId ? { id: String(value.classGroupId._id), semester: value.classGroupId.semester, section: value.classGroupId.section, academicYear: value.classGroupId.academicYear } : null,
  title: value.title, description: value.description, allowAnonymous: value.allowAnonymous, status: value.status,
  opensAt: value.opensAt, closesAt: value.closesAt, createdAt: value.createdAt, updatedAt: value.updatedAt,
  questionCount: value.questions.length,
  ...(detail ? { questions: value.questions.map(question => ({ id: String(question._id), type: question.type, prompt: question.prompt, required: question.required,
    ...(question.options ? { options: question.options } : {}), ...(question.type === "RATING" ? { ratingMin: question.ratingMin, ratingMax: question.ratingMax } : {}) })) } : {}),
});
const get = async (user, identifier) => safe(available(await populate(FeedbackSession.findOne({ ...scope(user), _id: id(identifier) })).lean()));
const list = async (user, query) => {
  const parsed = parseQuery(query);
  const filter = { ...scope(user), ...(parsed.status === "all" ? {} : { status: parsed.status }) };
  return page(populate(FeedbackSession.find(filter)).sort({ createdAt: -1, _id: -1 }), FeedbackSession.countDocuments(filter), parsed, value => safe(value, false));
};
const questionsForSave = (questions, current = []) => {
  const owned = new Set(current.map(question => String(question._id)));
  return questions.map(({ id: identifier, ...fields }) => {
    if (identifier && !owned.has(identifier)) throw error(400, "Question identifier does not belong to this draft.");
    return { ...fields, _id: identifier || new mongoose.Types.ObjectId() };
  });
};
const create = async (user, body) => {
  scope(user); const { facultyAssignmentId, questions = [], ...fields } = parseBody(body);
  const assignment = await assignments.get(user, facultyAssignmentId);
  if (!assignment.isUsable || assignment.departmentId !== String(user.departmentId)) throw error(400, "Choose your own active teaching assignment with active academic sources.");
  const created = await FeedbackSession.create({ ...fields, facultyAssignmentId, facultyId: user._id, createdBy: user._id,
    departmentId: assignment.departmentId, subjectId: assignment.subject.id, classGroupId: assignment.classGroup.id,
    questions: questionsForSave(questions), status: SESSION_STATUSES.DRAFT });
  return get(user, created._id);
};
const update = async (user, identifier, body) => {
  const filter = { ...scope(user), _id: id(identifier) };
  const fields = parseBody(body, true);
  const current = available(await FeedbackSession.findOne(filter));
  if (current.status !== SESSION_STATUSES.DRAFT) throw error(409, "Only draft sessions can be edited.");
  validateDates({ opensAt: current.opensAt, closesAt: current.closesAt, ...fields });
  if (fields.questions) fields.questions = questionsForSave(fields.questions, current.questions);
  // Validate the complete merged document before a conditional write. The version
  // and DRAFT predicate prevent lost updates or writes racing future publishing.
  current.set(fields); await current.validate();
  const result = await FeedbackSession.updateOne({ ...filter, status: SESSION_STATUSES.DRAFT, __v: current.__v }, { $set: fields, $inc: { __v: 1 } });
  if (!result.matchedCount) throw error(409, "The draft changed. Reload before saving again.");
  return get(user, identifier);
};
const remove = async (user, identifier) => {
  const filter = { ...scope(user), _id: id(identifier) };
  const result = await FeedbackSession.deleteOne({ ...filter, status: SESSION_STATUSES.DRAFT });
  if (!result.deletedCount) {
    available(await FeedbackSession.exists(filter)); throw error(409, "Only draft sessions can be deleted.");
  }
  return { deleted: true };
};
module.exports = { list, get, create, update, remove };
