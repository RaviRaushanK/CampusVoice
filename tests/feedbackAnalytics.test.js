process.env.NODE_ENV = "test";
process.env.JWT_SECRET = require("crypto").randomBytes(48).toString("hex");
process.env.FRONTEND_ORIGIN = "http://localhost:5173";
process.env.COOKIE_SECURE = "false";
process.env.COOKIE_SAME_SITE = "lax";
const mongoose = require("mongoose");
const request = require("supertest");
const app = require("../app");
const User = require("../models/User");
const Department = require("../models/Department");
const Subject = require("../models/Subject");
const ClassGroup = require("../models/ClassGroup");
const Assignment = require("../models/FacultyAssignment");
const Session = require("../models/FeedbackSession");
const Response = require("../models/SessionResponse");
const Notification = require("../models/Notification");
const { signToken } = require("../middleware/jwt");
const { hashPassword } = require("../services/authService");
const { createTestDatabase } = require("./helpers/testDatabase");
const database = createTestDatabase("results");
let hash, faculty, other, department, group, students, draft;
const oid = () => String(new mongoose.Types.ObjectId());
const call = (method, path, actor = faculty, fields) => {
  let req = request(app)[method](`/api/feedback-sessions${path}`).set("Origin", process.env.FRONTEND_ORIGIN).set("X-CSRF-Protection", "1");
  if (actor) req = req.set("Cookie", `cv_auth=${signToken(actor)}`);
  return fields === undefined ? req : req.send(fields);
};
const get = (suffix = "", actor = faculty) => call("get", `/${draft.id}/results${suffix}`, actor);
const details = (query = "", actor = faculty, questionId = draft.questions[3].id) => get(`/questions/${questionId}/responses${query}`, actor);
const account = overrides => User.create({ name: "Eligible Student", userCode: `student.${oid()}`, passwordHash: hash, role: "STUDENT", departmentId: department._id, semester: 2, section: "A", batch: "2025-2027", mustChangePassword: false, ...overrides });
const publish = async fields => {
  if (fields) await call("patch", `/${draft.id}`, faculty, fields).expect(200);
  await call("post", `/${draft.id}/publish`).expect(200);
};
const knownResponses = async (lastRating = 3) => {
  await publish();
  const values = [["Clear", ["Stacks", "Queues"], 4, "Alpha: more examples"], ["Unclear", ["Stacks"], 5, "Beta: slower explanation"], [undefined, undefined, lastRating, undefined]];
  for (const [index, actor] of students.entries()) await call("post", `/${draft.id}/responses`, actor, { identityMode: index === 1 ? "NAMED" : "ANONYMOUS", answers: values[index].flatMap((value, q) => value === undefined ? [] : [{ questionId: draft.questions[q].id, value }]) }).expect(201);
};
beforeAll(async () => {
  await mongoose.connect(database.uri, { serverSelectionTimeoutMS: 5000 }); database.assertConnection(mongoose.connection);
  await Promise.all([User.init(), Department.init(), Subject.init(), ClassGroup.init(), Assignment.init(), Session.init(), Response.init(), Notification.init()]);
  hash = await hashPassword("Temporary_123!");
});
beforeEach(async () => {
  database.assertConnection(mongoose.connection);
  for (const model of [Response, Session, Notification, Assignment, Subject, ClassGroup, Department, User]) await model.deleteMany({});
  faculty = await User.create({ name: "Owner Faculty", userCode: "owner.faculty", role: "FACULTY", passwordHash: hash, mustChangePassword: false });
  department = await Department.create({ name: "Applications", code: "MCA", createdBy: faculty._id });
  await User.updateOne({ _id: faculty._id }, { departmentId: department._id }); faculty = await User.findById(faculty._id).select("+tokenVersion");
  other = await account({ role: "FACULTY", name: "Other Faculty" });
  students = await Promise.all([
    account({ name: "Private Anonymous Person", userCode: "private.usn.001", email: "private001@test.example" }),
    account({ name: "Named Student Person", userCode: "named.usn.002", email: "named002@test.example" }),
    account({ name: "Another Private Student", userCode: "private.usn.003", email: "private003@test.example" }),
  ]);
  const subject = await Subject.create({ name: "Data Structures", code: "MMC201", semester: 2, departmentId: department._id, createdBy: faculty._id });
  group = await ClassGroup.create({ departmentId: department._id, semester: 2, section: "A", academicYear: "2026-2027", batch: "2025-2027", createdBy: faculty._id });
  const assignment = await Assignment.create({ facultyId: faculty._id, departmentId: department._id, subjectId: subject._id, classGroupId: group._id, academicYear: group.academicYear, createdBy: faculty._id });
  const res = await call("post", "", faculty, { title: "Unit feedback results", facultyAssignmentId: String(assignment._id), questions: [
    { type: "SINGLE_CHOICE", prompt: "How clear?", options: ["Clear", "Unclear", "Not selected"], required: false },
    { type: "MULTI_SELECT", prompt: "Which topics?", options: ["Stacks", "Queues", "Trees"], required: false },
    { type: "RATING", prompt: "Rate the lecture", required: true },
    { type: "SHORT_ANSWER", prompt: "How could it improve?", required: false },
    { type: "RATING", prompt: "Optional rating", required: false },
  ] }); expect(res.status).toBe(201); draft = res.body.data;
});
afterEach(() => vi.restoreAllMocks());
afterAll(async () => { try { if (mongoose.connection.readyState !== 0) await database.drop(mongoose.connection); } finally { await mongoose.disconnect(); } });

test("known summary and every question conserve response counts", async () => {
  await knownResponses(); const response = await get(); expect(response.status).toBe(200);
  const { summary, session, questions } = response.body.data;
  expect(session).toMatchObject({ title: draft.title, availability: "OPEN", subject: { code: "MMC201" }, classGroup: { semester: 2, section: "A", academicYear: "2026-2027" } });
  expect(summary).toEqual({ eligibleStudents: 3, totalResponses: 3, responseRate: 100, anonymousResponses: 2, namedResponses: 1, totalQuestions: 5, requiredQuestions: 1 });
  expect(summary.anonymousResponses + summary.namedResponses).toBe(summary.totalResponses);
  for (const question of questions) expect(question.answeredCount + question.skippedCount).toBe(summary.totalResponses);
  expect(questions.map(question => question.questionId)).toEqual(draft.questions.map(question => question.id));
});
test("single-choice counts/percentages use valid answers, retain zero options and optional skips", async () => {
  await knownResponses(); const question = (await get()).body.data.questions[0];
  expect(question).toMatchObject({ answeredCount: 2, skippedCount: 1, required: false, options: [{ option: "Clear", count: 1, percentage: 50 }, { option: "Unclear", count: 1, percentage: 50 }, { option: "Not selected", count: 0, percentage: 0 }] });
});
test("multi-select counts respondents independently; percentages can sum above 100", async () => {
  await knownResponses(); const question = (await get()).body.data.questions[1];
  expect(question).toMatchObject({ answeredCount: 2, skippedCount: 1, options: [{ option: "Stacks", count: 2, percentage: 100 }, { option: "Queues", count: 1, percentage: 50 }, { option: "Trees", count: 0, percentage: 0 }] });
  expect(question.options.reduce((sum, option) => sum + option.percentage, 0)).toBe(150);
});
test("rating is numeric with a complete 1–5 distribution and null when unanswered", async () => {
  await knownResponses(); const questions = (await get()).body.data.questions;
  expect(questions[2]).toMatchObject({ answeredCount: 3, skippedCount: 0, average: 4 });
  expect(questions[2].distribution.map(row => row.count)).toEqual([0, 0, 1, 1, 1]); expect(questions[2].distribution.map(row => row.rating)).toEqual([1, 2, 3, 4, 5]);
  expect(questions[4]).toMatchObject({ average: null, answeredCount: 0, skippedCount: 3 });
});
test("rating average rounds consistently to two decimal places without becoming a string", async () => {
  await knownResponses(4); const question = (await get()).body.data.questions[2]; expect(question.average).toBe(4.33); expect(typeof question.average).toBe("number");
});
test("zero responses and zero eligible students produce finite zero rates and empty charts", async () => {
  await publish(); await User.updateMany({ role: "STUDENT" }, { isActive: false });
  const result = await get(); expect(result.status).toBe(200); expect(result.body.data.summary).toMatchObject({ eligibleStudents: 0, totalResponses: 0, responseRate: 0, anonymousResponses: 0, namedResponses: 0 });
  for (const question of result.body.data.questions) { expect(question.answeredCount).toBe(0); expect(question.skippedCount).toBe(0); if (question.options) expect(question.options.every(option => option.count === 0 && option.percentage === 0)).toBe(true); if (question.type === "RATING") expect(question.average).toBeNull(); }
  expect((await details()).body.data).toMatchObject({ items: [], pagination: { total: 0, totalPages: 0 } }); expect(result.text).not.toMatch(/NaN|Infinity/);
});
test("short answers paginate; skipped optional entries produce no empty rows", async () => {
  await knownResponses(); const first = await details("?page=1&limit=1"); expect(first.status).toBe(200);
  expect(first.body.data).toEqual({ items: [{ text: "Alpha: more examples", identityMode: "ANONYMOUS" }], pagination: { page: 1, limit: 1, total: 2, totalPages: 2, hasNextPage: true, hasPreviousPage: false } });
  const second = await details("?page=2&limit=1"); expect(second.body.data.items).toEqual([{ text: "Beta: slower explanation", identityMode: "NAMED", identity: { name: students[1].name, userCode: students[1].userCode } }]); expect(second.body.data.pagination.hasNextPage).toBe(false);
  expect((await details("?page=99&limit=1")).body.data.items).toEqual([]);
});
test("complete Faculty HTTP responses never disclose anonymous identity or correlating IDs", async () => {
  await knownResponses(); const stored = await Response.find({ sessionId: draft.id }).select("+studentId").lean();
  for (const response of [await get(), await details(), await details("?page=1&limit=1"), await details("?page=2&limit=1")]) {
    expect(response.status).toBe(200); const json = JSON.stringify(response.body);
    for (const student of [students[0], students[2]]) for (const secret of [String(student._id), student.name, student.userCode, student.email]) expect(json).not.toContain(secret);
    for (const record of stored) expect(json).not.toContain(String(record._id));
    for (const forbidden of ["studentId", "namedStudentId", "email", "passwordHash", "tokenVersion", "mustChangePassword", "submittedAt", "_id"]) expect(json).not.toContain(`"${forbidden}"`);
    expect(json).not.toContain(students[1].email); expect(json).not.toContain(String(students[1]._id));
  }
});
test("anonymous-only page makes no User identity lookup; named page makes one bounded batch lookup", async () => {
  await knownResponses(); const lookup = vi.spyOn(User, "find");
  await details("?page=1&limit=1"); expect(lookup).not.toHaveBeenCalled();
  await details("?page=2&limit=1"); expect(lookup).toHaveBeenCalledOnce(); expect(lookup.mock.calls[0][0]._id.$in.map(String)).toEqual([String(students[1]._id)]);
});
test("named account removal has a safe fallback and never changes identity mode", async () => {
  await knownResponses(); await User.deleteOne({ _id: students[1]._id });
  const items = (await details()).body.data.items; expect(items[1]).toEqual({ identityMode: "NAMED", text: "Beta: slower explanation", identity: null });
});
test("denominator uses matching active role/department/semester/normalized section/batch only", async () => {
  for (const fields of [{ section: "B" }, { semester: 3 }, { departmentId: new mongoose.Types.ObjectId() }, { batch: "2024-2026" }, { batch: null }, { isActive: false }, { role: "FACULTY" }]) await account(fields);
  await account({ section: "a" }); await publish(); expect((await get()).body.data.summary.eligibleStudents).toBe(4);
});
test("unbatched class has the same wildcard batch semantics as participation", async () => {
  await ClassGroup.updateOne({ _id: group._id }, { batch: null }); await account({ batch: null }); await account({ batch: "2024-2026" }); await publish();
  expect((await get()).body.data.summary.eligibleStudents).toBe(5);
});
test("current denominator may shrink while historical responses remain, including rates above 100 and zero denominator", async () => {
  await knownResponses(); await User.updateOne({ _id: students[0]._id }, { section: "B" });
  expect((await get()).body.data.summary).toMatchObject({ eligibleStudents: 2, totalResponses: 3, responseRate: 150 });
  await User.updateMany({ role: "STUDENT" }, { isActive: false }); expect((await get()).body.data.summary).toMatchObject({ eligibleStudents: 0, totalResponses: 3, responseRate: 0 });
});
test("owner reads scheduled, live, manually closed and effectively expired results", async () => {
  await publish({ opensAt: new Date(Date.now() + 3600000).toISOString() }); expect((await get()).body.data.session.availability).toBe("SCHEDULED");
  await Session.updateOne({ _id: draft.id }, { opensAt: null }); expect((await get()).body.data.session.availability).toBe("OPEN");
  await call("post", `/${draft.id}/close`).expect(200); expect((await get()).body.data.session.availability).toBe("CLOSED"); expect((await details()).status).toBe(200);
  await Session.updateOne({ _id: draft.id }, { status: "OPEN", closesAt: new Date(Date.now() - 100) }); expect((await get()).body.data.session.availability).toBe("CLOSED");
});
test("draft results are controlled and cross-owner/missing sessions share safe not-found errors", async () => {
  expect((await get()).status).toBe(409); expect((await details()).status).toBe(409);
  await publish();
  for (const response of [await get("", other), await details("", other), await call("get", `/${oid()}/results`)]) expect(response).toMatchObject({ status: 404, body: { message: "Feedback session unavailable." } });
});
test.each(["STUDENT", "HOD", "PRINCIPAL"])("%s cannot access analytics or text endpoints", async role => {
  await publish(); const actor = await account({ role }); expect((await get("", actor)).status).toBe(403); expect((await details("", actor)).status).toBe(403);
});
test.each(["missing", "first-login", "inactive", "revoked"])("%s Faculty session cannot bypass results guards", async kind => {
  await publish();
  if (kind === "first-login") await User.updateOne({ _id: faculty._id }, { mustChangePassword: true });
  if (kind === "inactive") await User.updateOne({ _id: faculty._id }, { isActive: false });
  if (kind === "revoked") await User.updateOne({ _id: faculty._id }, { $inc: { tokenVersion: 1 } });
  const expected = kind === "first-login" ? 403 : 401;
  expect((await get("", kind === "missing" ? null : faculty)).status).toBe(expected); expect((await details("", kind === "missing" ? null : faculty)).status).toBe(expected);
});
test.each(["?facultyId=evil", "?page=1", "?identityMode=ANONYMOUS"])("main results reject unsupported query %s", async query => { await publish(); expect((await get(query)).status).toBe(400); });
test.each(["?page=0", "?page=-1", "?page=1.5", "?limit=101", "?limit=0", "?facultyId=evil", "?page[]=1"])("text pagination rejects %s", async query => { await publish(); expect((await details(query)).status).toBe(400); });
test("malformed IDs, foreign questions and non-text questions are handled without leaking data", async () => {
  await publish(); expect((await call("get", "/bad/results")).status).toBe(400); expect((await details("", faculty, "bad")).status).toBe(400);
  for (const questionId of [oid(), draft.questions[0].id]) expect((await details("", faculty, questionId)).status).toBe(404);
});
test("analytics is read-only and dashboard counts use effective availability", async () => {
  await knownResponses(); const before = await Session.findById(draft.id).lean(), notifications = await Notification.countDocuments(); await get(); await details();
  expect(await Session.findById(draft.id).lean()).toEqual(before); expect(await Response.countDocuments()).toBe(3); expect(await Notification.countDocuments()).toBe(notifications);
  const dashboard = await request(app).get("/api/academic/dashboard").set("Cookie", `cv_auth=${signToken(faculty)}`);
  expect(dashboard.body.data.metrics).toMatchObject({ "My Sessions": 1, "Draft Sessions": 0, "Open Sessions": 1, "Scheduled Sessions": 0, "Closed Sessions": 0 });
  for (const [fields, key] of [[{ opensAt: new Date(Date.now() + 3600000) }, "Scheduled Sessions"], [{ opensAt: null, closesAt: new Date(Date.now() - 100) }, "Closed Sessions"], [{ status: "DRAFT" }, "Draft Sessions"]]) {
    await Session.updateOne({ _id: draft.id }, fields);
    const updated = await request(app).get("/api/academic/dashboard").set("Cookie", `cv_auth=${signToken(faculty)}`);
    expect(updated.body.data.metrics[key]).toBe(1); expect(updated.body.data.metrics["Open Sessions"]).toBe(0);
  }
});
