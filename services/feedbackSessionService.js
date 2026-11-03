const mongoose = require("mongoose");
const FeedbackSession = require("../models/FeedbackSession");
const assignments = require("./assignmentService");
const { assertRole, page, safeDepartment, id } = require("./academicSupport");
const { parseBody, parseQuery, validateDates } = require("../validators/feedbackSessionValidator");
const error = require("../utils/authError");
const { SESSION_STATUSES } = require("../utils/constants/feedback");
const { state, recipientFilter } = require("./feedbackAvailability");
const User = require("../models/User");
const notificationService = require("./notificationService");
const scope = user => { assertRole(user, "FACULTY"); return { facultyId: user._id }; };
const available = value => { if (!value) throw error(404, "Feedback session unavailable."); return value; };
const populate = query => query.populate("departmentId", "code name isActive").populate("subjectId", "code name semester").populate("classGroupId", "semester section academicYear");
const safe = (value, detail = true) => ({
  id: String(value._id), facultyAssignmentId: String(value.facultyAssignmentId),
  department: safeDepartment(value.departmentId),
  subject: value.subjectId ? { id: String(value.subjectId._id), code: value.subjectId.code, name: value.subjectId.name, semester: value.subjectId.semester } : null,
  classGroup: value.classGroupId ? { id: String(value.classGroupId._id), semester: value.classGroupId.semester, section: value.classGroupId.section, academicYear: value.classGroupId.academicYear } : null,
  title: value.title, description: value.description, allowAnonymous: value.allowAnonymous, status: value.status,
  availability: state(value), publishedAt: value.publishedAt, closedAt: value.closedAt,
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
const publish = async (user, identifier) => {
  const filter = { ...scope(user), _id: id(identifier) };
  const current = available(await FeedbackSession.findOne(filter));
  if (current.status !== "DRAFT") throw error(409, "Only an unpublished draft can be published.");
  if (!current.questions.length) throw error(400, "Add at least one question before publishing.");
  try { await current.validate(); } catch (err) {
    if (err.name === "ValidationError") throw error(400, "Review the draft questionnaire and date configuration before publishing.");
    throw err;
  }
  const assignment = await assignments.get(user, current.facultyAssignmentId);
  if (!assignment.isUsable || assignment.departmentId !== String(user.departmentId)
    || assignment.departmentId !== String(current.departmentId) || assignment.subject.id !== String(current.subjectId) || assignment.classGroup.id !== String(current.classGroupId)) throw error(400, "The draft requires its original active teaching assignment and academic sources.");
  const now = new Date();
  if (current.closesAt && current.closesAt <= now) throw error(400, "The closing time has already passed. Update this draft before publishing.");
  const audience = { semester: assignment.classGroup.semester, section: assignment.classGroup.section || "", batch: assignment.classGroup.batch || null, academicYear: assignment.classGroup.academicYear };
  const published = await FeedbackSession.findOneAndUpdate({ ...filter, status: "DRAFT", __v: current.__v }, {
    $set: { status: "OPEN", publishedAt: now, audience }, $inc: { __v: 1 },
  }, { new: true, runValidators: true });
  if (!published) throw error(409, "The draft changed. Reload before publishing again.");
  let sent = 0, failed = 0;
  // The publication winner alone notifies. Secondary delivery failure never
  // rolls back or misreports the authoritative publication.
  try {
    for await (const recipient of User.find(recipientFilter(published)).select("_id").lean().cursor()) {
      try {
        const scheduled = state(published, now) === "SCHEDULED";
        await notificationService.createNotification({ recipient: recipient._id, type: "SESSION", title: scheduled ? "Feedback session scheduled" : "New feedback session",
          message: scheduled ? `A feedback session for ${assignment.subject.code} is scheduled to open at ${published.opensAt.toISOString()}.` : `A feedback session for ${assignment.subject.code} is available in Feedback Sessions.`,
          relatedResourceType: "SESSION", relatedResourceId: published._id });
        sent++;
      } catch { failed++; }
    }
  } catch { failed++; }
  if (failed) console.warn("Feedback publication completed with notification delivery failures.");
  return { ...await get(user, identifier), notificationDelivery: { sent, failed } };
};
const close = async (user, identifier) => {
  const filter = { ...scope(user), _id: id(identifier) };
  const current = available(await FeedbackSession.findOne(filter).lean());
  if (current.status === "DRAFT") throw error(409, "Only a published session can be closed.");
  if (state(current) === "CLOSED") return get(user, identifier);
  await FeedbackSession.updateOne({ ...filter, status: "OPEN" }, { $set: { status: "CLOSED", closedAt: new Date() }, $inc: { __v: 1 } });
  return get(user, identifier);
};
module.exports = { list, get, create, update, remove, publish, close };
