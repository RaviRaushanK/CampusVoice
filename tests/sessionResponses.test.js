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
const notices = require("../services/notificationService");
const { parseResponse } = require("../validators/sessionResponseValidator");
const { parseBody } = require("../validators/feedbackSessionValidator");
const { signToken } = require("../middleware/jwt");
const { hashPassword } = require("../services/authService");
const { createTestDatabase } = require("./helpers/testDatabase");
const database = createTestDatabase("responses");
let hash, faculty, other, student, department, subject, group, assignment, draft;
const oid = () => String(new mongoose.Types.ObjectId());
const call = (method, path, actor = faculty, body) => {
  let req = request(app)[method](`/api/feedback-sessions${path}`).set("Origin", process.env.FRONTEND_ORIGIN).set("X-CSRF-Protection", "1");
  if (actor) req = req.set("Cookie", `cv_auth=${signToken(actor)}`);
  return body === undefined ? req : req.send(body);
};
const questions = () => [
  { type: "SINGLE_CHOICE", prompt: "Clarity", options: ["Clear", "Unclear"], required: true },
  { type: "MULTI_SELECT", prompt: "Topics", options: ["Stacks", "Queues"], required: true },
  { type: "RATING", prompt: "Rate", required: true },
  { type: "SHORT_ANSWER", prompt: "Improve", required: true },
  { type: "SHORT_ANSWER", prompt: "Optional", required: false },
];
const provision = overrides => User.create({ name: "Test Student", userCode: `student.${oid()}`, passwordHash: hash, role: "STUDENT", departmentId: department._id, semester: 2, section: "A", batch: "2025-2027", mustChangePassword: false, ...overrides });
const publish = async (overrides = {}) => {
  if (Object.keys(overrides).length) await Session.updateOne({ _id: draft.id }, { $set: overrides });
  const res = await call("post", `/${draft.id}/publish`); expect(res.status).toBe(200); return res.body.data;
};
const payload = (overrides = {}) => ({ identityMode: "ANONYMOUS", answers: draft.questions.slice(0, 4).map((q, i) => ({ questionId: q.id, value: ["Clear", ["Stacks", "Queues"], 5, " More examples "][i] })), ...overrides });
beforeAll(async () => {
  await mongoose.connect(database.uri, { serverSelectionTimeoutMS: 5000 }); database.assertConnection(mongoose.connection);
  await Promise.all([User.init(), Department.init(), Subject.init(), ClassGroup.init(), Assignment.init(), Session.init(), Response.init(), Notification.init()]);
  hash = await hashPassword("Temporary_123!");
});
beforeEach(async () => {
  database.assertConnection(mongoose.connection);
  for (const model of [Response, Session, Notification, Assignment, Subject, ClassGroup, Department, User]) await model.deleteMany({});
  faculty = await User.create({ name: "Faculty Owner", userCode: "faculty.owner", role: "FACULTY", passwordHash: hash, mustChangePassword: false });
  department = await Department.create({ name: "Computer Applications", code: "MCA", createdBy: faculty._id });
  await User.updateOne({ _id: faculty._id }, { departmentId: department._id }); faculty = await User.findById(faculty._id).select("+tokenVersion");
  other = await User.create({ name: "Other Faculty", userCode: "faculty.other", role: "FACULTY", departmentId: department._id, passwordHash: hash, mustChangePassword: false });
  student = await provision({});
  subject = await Subject.create({ name: "Data Structures", code: "MMC201", semester: 2, departmentId: department._id, createdBy: faculty._id });
  group = await ClassGroup.create({ departmentId: department._id, semester: 2, section: "A", academicYear: "2026-2027", batch: "2025-2027", createdBy: faculty._id });
  assignment = await Assignment.create({ facultyId: faculty._id, departmentId: department._id, subjectId: subject._id, classGroupId: group._id, academicYear: group.academicYear, createdBy: faculty._id });
  const res = await call("post", "", faculty, { title: "Unit feedback", facultyAssignmentId: String(assignment._id), questions: questions() }); expect(res.status).toBe(201); draft = res.body.data;
});
afterEach(() => vi.restoreAllMocks());
afterAll(async () => { try { if (mongoose.connection.readyState !== 0) await database.drop(mongoose.connection); } finally { await mongoose.disconnect(); } });

test("publishes once, timestamps, snapshots class criteria, notifies eligible student and freezes all content", async () => {
  expect(await Notification.countDocuments()).toBe(0);
  const published = await publish(); expect(published).toMatchObject({ status: "OPEN", availability: "OPEN", notificationDelivery: { sent: 1, failed: 0 } }); expect(published.publishedAt).toBeTruthy();
  const stored = await Session.findById(draft.id); expect(stored.audience.toObject()).toEqual({ semester: 2, section: "A", batch: "2025-2027", academicYear: "2026-2027" });
  const notice = await Notification.findOne(); expect(notice).toMatchObject({ type: "SESSION", relatedResourceType: "SESSION" }); expect(String(notice.recipient)).toBe(String(student._id)); expect(String(notice.relatedResourceId)).toBe(draft.id);
  for (const fields of [{ questions: [] }, { title: "Changed" }, { description: "Changed" }, { allowAnonymous: false }, { opensAt: null }, { status: "OPEN" }, { facultyAssignmentId: oid() }]) expect((await call("patch", `/${draft.id}`, faculty, fields)).status).toBe(fields.status || fields.facultyAssignmentId ? 400 : 409);
  expect((await call("delete", `/${draft.id}`)).status).toBe(409);
  expect((await call("post", `/${draft.id}/publish`)).status).toBe(409); expect(await Notification.countDocuments()).toBe(1);
  expect((await call("get", `/${draft.id}`)).body.data.publishedAt).toBe(published.publishedAt);
});
test("concurrent publish has one winner and sends one set of notifications", async () => {
  const results = await Promise.all([call("post", `/${draft.id}/publish`), call("post", `/${draft.id}/publish`)]);
  expect(results.map(res => res.status).sort()).toEqual([200, 409]); expect(await Notification.countDocuments()).toBe(1);
});
test.each(["empty", "inactive assignment", "inactive department", "inactive subject", "inactive class", "invalid questions", "expired"])("rejects publication of %s draft", async kind => {
  if (kind === "empty") await Session.updateOne({ _id: draft.id }, { questions: [] });
  if (kind === "inactive assignment") await Assignment.updateOne({ _id: assignment._id }, { isActive: false });
  if (kind === "inactive department") await Department.updateOne({ _id: department._id }, { isActive: false });
  if (kind === "inactive subject") await Subject.updateOne({ _id: subject._id }, { isActive: false });
  if (kind === "inactive class") await ClassGroup.updateOne({ _id: group._id }, { isActive: false });
  if (kind === "invalid questions") await Session.collection.updateOne({ _id: new mongoose.Types.ObjectId(draft.id) }, { $set: { "questions.0.options": ["One"] } });
  if (kind === "expired") await Session.updateOne({ _id: draft.id }, { closesAt: new Date(Date.now() - 1000) });
  expect((await call("post", `/${draft.id}/publish`)).status).toBe(400); expect((await Session.findById(draft.id)).status).toBe("DRAFT"); expect(await Notification.countDocuments()).toBe(0);
});
test("cross-owner lifecycle calls are safely not found and body injection is rejected", async () => {
  for (const action of ["publish", "close"]) {
    expect((await call("post", `/${draft.id}/${action}`, other)).status).toBe(404);
    expect((await call("post", `/${draft.id}/${action}`, faculty, { recipientIds: [oid()] })).status).toBe(400);
    expect((await call("post", `/bad/${action}`)).status).toBe(400);
  }
});
test("scheduled publication is truthful; early access/submission blocked", async () => {
  const opensAt = new Date(Date.now() + 3600000);
  const published = await publish({ opensAt }); expect(published.availability).toBe("SCHEDULED");
  expect((await Notification.findOne()).message).toContain(opensAt.toISOString()); expect((await Notification.findOne()).title).toContain("scheduled");
  expect((await call("get", "/student", student)).body.data.items).toEqual([]);
  expect((await call("get", `/${draft.id}/respond`, student)).body.code).toBe("SESSION_UNAVAILABLE");
  expect((await call("post", `/${draft.id}/responses`, student, payload())).status).toBe(409);
});
test("notification failure reports partial delivery without rolling back publication or allowing duplicate retry", async () => {
  vi.spyOn(notices, "createNotification").mockRejectedValueOnce(new Error("private database failure")); const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
  const published = await publish(); expect(published).toMatchObject({ status: "OPEN", notificationDelivery: { sent: 0, failed: 1 } }); expect(warning).toHaveBeenCalledWith("Feedback publication completed with notification delivery failures.");
  expect((await call("post", `/${draft.id}/publish`)).status).toBe(409); expect(notices.createNotification).toHaveBeenCalledOnce();
});
test.each([{ section: "B" }, { semester: 3 }, { departmentId: new mongoose.Types.ObjectId() }, { batch: "2024-2026" }, { batch: null }, { isActive: false }])("wrong cohort/inactive student is excluded %#", async overrides => {
  const wrong = await provision(overrides); await publish();
  expect(await Notification.countDocuments({ recipient: wrong._id })).toBe(0);
  for (const [method, path, fields] of [["get", "/student"], ["get", `/${draft.id}/respond`], ["post", `/${draft.id}/responses`, payload()]]) {
    const response = await call(method, path, wrong, fields);
    if (overrides.isActive === false) expect(response.status).toBe(401);
    else if (path === "/student") expect(response.body.data.items).toEqual([]);
    else expect(response.status).toBe(404);
  }
});
test("unbatched classes match students regardless of batch; null/empty sections normalize consistently", async () => {
  await ClassGroup.updateOne({ _id: group._id }, { batch: null, section: "" }); await User.updateOne({ _id: student._id }, { batch: null, section: null });
  await publish(); expect((await call("get", "/student", student)).body.data.items).toHaveLength(1); expect(await Notification.countDocuments({ recipient: student._id })).toBe(1);
});
test("legacy lower-case sections receive the same eligible publication notification", async () => {
  await User.updateOne({ _id: student._id }, { section: "a" }); await publish();
  expect((await call("get", "/student", student)).body.data.items).toHaveLength(1); expect(await Notification.countDocuments({ recipient: student._id })).toBe(1);
});
test("draft IDs, unrelated IDs and foreign sessions do not reveal questionnaires", async () => {
  for (const identifier of [draft.id, oid()]) expect((await call("get", `/${identifier}/respond`, student)).status).toBe(404);
  expect((await call("get", "/bad/respond", student)).status).toBe(400);
  expect((await call("get", "/mine", student)).status).toBe(403);
});
test("manual close is idempotent, concurrency-safe, final, preserves publishedAt and blocks stale pages", async () => {
  expect((await call("post", `/${draft.id}/close`)).status).toBe(409);
  const published = await publish(); await call("get", `/${draft.id}/respond`, student).expect(200);
  const closed = await call("post", `/${draft.id}/close`); expect(closed.body.data).toMatchObject({ status: "CLOSED", availability: "CLOSED", publishedAt: published.publishedAt }); expect(closed.body.data.closedAt).toBeTruthy();
  const repeat = await call("post", `/${draft.id}/close`); expect(repeat.body.data.closedAt).toBe(closed.body.data.closedAt);
  expect((await call("post", `/${draft.id}/responses`, student, payload())).body.code).toBe("SESSION_UNAVAILABLE");
  expect((await call("post", `/${draft.id}/publish`)).status).toBe(409); expect((await call("patch", `/${draft.id}`, faculty, { title: "Edit" })).status).toBe(409);
});
test("expiry closes effectively with no cron or manual-close timestamp", async () => {
  await publish(); await Session.updateOne({ _id: draft.id }, { closesAt: new Date(Date.now() - 100) });
  const value = (await call("get", `/${draft.id}`)).body.data; expect(value).toMatchObject({ status: "OPEN", availability: "CLOSED", closedAt: null });
  expect((await call("get", "/student", student)).body.data.items).toEqual([]); expect((await call("post", `/${draft.id}/responses`, student, payload())).status).toBe(409);
});
test("post-publication assignment deactivation and class changes preserve frozen academic eligibility", async () => {
  await publish(); await Assignment.updateOne({ _id: assignment._id }, { isActive: false }); await ClassGroup.updateOne({ _id: group._id }, { batch: "2024-2026" });
  expect((await call("get", "/student", student)).body.data.items).toHaveLength(1); expect((await call("post", `/${draft.id}/responses`, student, payload())).status).toBe(201);
});
test("student academic changes after opening are rechecked on submission", async () => {
  await publish(); await call("get", `/${draft.id}/respond`, student).expect(200); await User.updateOne({ _id: student._id }, { section: "B" });
  expect((await call("post", `/${draft.id}/responses`, student, payload())).status).toBe(404); expect(await Response.countDocuments()).toBe(0);
});
test.each(["ANONYMOUS", "NAMED"])("stores final %s response with internal student reference and safe own completion", async identityMode => {
  await publish(); const questionnaire = await call("get", `/${draft.id}/respond`, student); expect(questionnaire.status).toBe(200); expect(questionnaire.body.data.questions).toHaveLength(5);
  expect(questionnaire.body.data).not.toHaveProperty("facultyId"); expect(questionnaire.body.data.faculty).toEqual({ name: faculty.name });
  const response = await call("post", `/${draft.id}/responses`, student, payload({ identityMode })); expect(response.status).toBe(201); expect(Object.keys(response.body.data).sort()).toEqual(["sessionId", "identityMode", "submittedAt"].sort());
  const stored = await Response.findOne().select("+studentId"); expect(String(stored.studentId)).toBe(String(student._id)); expect(stored.identityMode).toBe(identityMode); expect(stored.answers[3].value).toBe("More examples"); expect(stored.answers).toHaveLength(4);
  expect(stored.toJSON()).not.toHaveProperty("studentId");
  expect((await call("get", "/student", student)).body.data.items).toHaveLength(0);
  const completed = await call("get", "/student?category=completed", student); expect(completed.body.data.items[0].completion.identityMode).toBe(identityMode);
  const another = await provision({}); expect((await call("get", "/student?category=completed", another)).body.data.items).toEqual([]);
  expect((await call("get", `/${draft.id}/respond`, student)).body.code).toBe("ALREADY_SUBMITTED");
  expect((await call("post", `/${draft.id}/responses`, student, payload())).body.code).toBe("ALREADY_SUBMITTED");
  for (const method of ["patch", "delete"]) expect((await call(method, `/${draft.id}/responses`, student, payload())).status).toBe(403);
  expect(await Response.countDocuments()).toBe(1);
});
test("named-only session rejects anonymous and accepts named", async () => {
  await publish({ allowAnonymous: false }); expect((await call("post", `/${draft.id}/responses`, student, payload())).status).toBe(400);
  expect((await call("post", `/${draft.id}/responses`, student, payload({ identityMode: "NAMED" }))).status).toBe(201);
});
test("concurrent submissions and direct duplicate inserts are protected by a database unique index", async () => {
  await publish(); const responses = await Promise.all([call("post", `/${draft.id}/responses`, student, payload()), call("post", `/${draft.id}/responses`, student, payload())]);
  expect(responses.map(res => res.status).sort()).toEqual([201, 409]); expect(await Response.countDocuments()).toBe(1);
  await expect(Response.create({ sessionId: draft.id, studentId: student._id, identityMode: "NAMED", answers: [] })).rejects.toMatchObject({ code: 11000 });
});
test.each(["expiry", "manual close"])("%s between validation and admission rejects the response", async kind => {
  await publish(); const init = Response.init.bind(Response);
  vi.spyOn(Response, "init").mockImplementationOnce(async () => { await Session.updateOne({ _id: draft.id }, kind === "expiry" ? { closesAt: new Date(Date.now() - 100) } : { status: "CLOSED", closedAt: new Date() }); return init(); });
  expect((await call("post", `/${draft.id}/responses`, student, payload())).body.code).toBe("SESSION_UNAVAILABLE"); expect(await Response.countDocuments()).toBe(0);
});
test("concurrent Close preserves its first timestamp and publication timestamp", async () => {
  const published = await publish(); const results = await Promise.all([call("post", `/${draft.id}/close`), call("post", `/${draft.id}/close`)]);
  expect(results.map(value => value.status)).toEqual([200, 200]); expect(results[0].body.data.closedAt).toBe(results[1].body.data.closedAt); expect(results[0].body.data.publishedAt).toBe(published.publishedAt);
});
test("response schema enforces controlled identity, question bounds and duplicate IDs", async () => {
  const fields = { sessionId: draft.id, studentId: student._id, identityMode: "ANONYMOUS", answers: payload().answers };
  await expect(new Response(fields).validate()).resolves.toBeUndefined();
  for (const overrides of [{ sessionId: undefined }, { studentId: undefined }, { identityMode: "OTHER" }, { answers: [fields.answers[0], fields.answers[0]] }, { answers: Array.from({ length: 51 }, () => ({ questionId: oid(), value: "answer" })) }]) await expect(new Response({ ...fields, ...overrides }).validate()).rejects.toThrow();
});
const invalidValues = [[0, "Arbitrary"], [0, ["Clear"]], [1, ["Stacks", "Unknown"]], [1, ["Stacks", "Stacks"]], [1, []], [1, "Stacks"], [2, 0], [2, 6], [2, "five"], [2, "5"], [2, 2.5], [3, " "], [3, "x".repeat(1001)], [3, { value: "hi" }]];
test.each(invalidValues)("rejects invalid answer type/value %#", async (index, value) => {
  await publish(); const fields = payload(); fields.answers[index].value = value; expect((await call("post", `/${draft.id}/responses`, student, fields)).status).toBe(400); expect(await Response.countDocuments()).toBe(0);
});
test.each([1, 5])("accepts rating boundary %s", async value => { await publish(); const fields = payload(); fields.answers[2].value = value; expect((await call("post", `/${draft.id}/responses`, student, fields)).status).toBe(201); });
test("optional empty multi/text answers are canonically omitted", () => {
  const session = { allowAnonymous: true, questions: [{ _id: oid(), type: "MULTI_SELECT", options: ["A", "B"], required: false }, { _id: oid(), type: "SHORT_ANSWER", required: false }] };
  expect(parseResponse({ identityMode: "ANONYMOUS", answers: session.questions.map((q, index) => ({ questionId: q._id, value: index ? "  " : [] })) }, session).answers).toEqual([]);
});
test.each(["unknown", "duplicate", "missing", "bad id", "question definition"])("rejects %s question manipulation", async kind => {
  await publish(); const fields = payload();
  if (kind === "unknown") fields.answers[0].questionId = oid(); if (kind === "duplicate") fields.answers.push(fields.answers[0]); if (kind === "missing") fields.answers.shift(); if (kind === "bad id") fields.answers[0].questionId = "bad"; if (kind === "question definition") fields.answers[0].type = "SHORT_ANSWER";
  expect((await call("post", `/${draft.id}/responses`, student, fields)).status).toBe(400);
});
test.each(["studentId", "facultyId", "departmentId", "classGroupId", "semester", "section", "isAnonymous", "status", "submittedAt"])("rejects injected %s", async field => {
  await publish(); expect((await call("post", `/${draft.id}/responses`, student, payload({ [field]: oid() }))).status).toBe(400);
});
test.each(["PRINCIPAL", "HOD", "FACULTY"])("%s cannot use Student APIs", async role => {
  const actor = await provision({ role }); for (const [method, path, fields] of [["get", "/student"], ["get", `/${draft.id}/respond`], ["post", `/${draft.id}/responses`, payload()]]) expect((await call(method, path, actor, fields)).status).toBe(403);
});
test.each(["STUDENT", "HOD", "PRINCIPAL"])("%s cannot publish or close", async role => {
  const actor = role === "STUDENT" ? student : await provision({ role }); for (const action of ["publish", "close"]) expect((await call("post", `/${draft.id}/${action}`, actor)).status).toBe(403);
});
test("new APIs preserve auth/first-login/CSRF/inactive/revoked safeguards", async () => {
  await publish();
  const routes = [["get", "/student", student], ["get", `/${draft.id}/respond`, student], ["post", `/${draft.id}/responses`, student], ["post", `/${draft.id}/publish`, faculty], ["post", `/${draft.id}/close`, faculty]];
  for (const [method, path, actor] of routes) {
    expect((await call(method, path, null)).status).toBe(401);
    await User.updateOne({ _id: actor._id }, { mustChangePassword: true }); expect((await call(method, path, actor)).body.code).toBe("PASSWORD_CHANGE_REQUIRED"); await User.updateOne({ _id: actor._id }, { mustChangePassword: false });
    if (method === "post") expect((await request(app).post(`/api/feedback-sessions${path}`).set("Cookie", `cv_auth=${signToken(actor)}`).send({})).body.code).toBe("CSRF_REJECTED");
  }
  const old = signToken(student); await User.updateOne({ _id: student._id }, { isActive: false });
  expect((await request(app).get("/api/feedback-sessions/student").set("Cookie", `cv_auth=${old}`)).status).toBe(401);
  await User.updateOne({ _id: student._id }, { isActive: true }); expect((await call("get", "/student", student)).status).toBe(401);
});
test("bounded list pagination and real student dashboard counts", async () => {
  await publish();
  for (const query of ["limit=101", "page=0", "category=other", "studentId=evil"]) expect((await call("get", `/student?${query}`, student)).status).toBe(400);
  expect((await call("get", "/student?limit=1&page=2", student)).body.data.items).toEqual([]);
  const dashboard = async () => (await request(app).get("/api/academic/dashboard").set("Cookie", `cv_auth=${signToken(student)}`)).body.data.metrics;
  expect(await dashboard()).toEqual({ "Pending Feedback Sessions": 1, "Completed Feedback Sessions": 0 });
  await call("post", `/${draft.id}/responses`, student, payload()); expect(await dashboard()).toEqual({ "Pending Feedback Sessions": 0, "Completed Feedback Sessions": 1 });
});
test("maximum-size questionnaire including JSON escaping reaches domain validation and persists safely", async () => {
  const make = character => ({ title: "Large valid draft", facultyAssignmentId: String(assignment._id), questions: Array.from({ length: 50 }, () => ({ type: "SINGLE_CHOICE", prompt: character.repeat(1000), required: true, options: Array.from({ length: 20 }, (_, index) => `${String(index).padStart(2, "0")}${character.repeat(198)}`) })) });
  for (const character of ["x", "क", "\u0001"]) {
    const fields = make(character), bytes = Buffer.byteLength(JSON.stringify(fields)); expect(bytes).toBeGreaterThan(64 * 1024); expect(bytes).toBeLessThan(2 * 1024 * 1024);
    expect(() => parseBody(fields)).not.toThrow(); expect((await call("post", "", faculty, fields)).status).toBe(201);
  }
  const malformed = make("x"); malformed.questions[0].options[0] = " "; expect((await call("post", "", faculty, malformed)).status).toBe(400);
  expect((await call("post", "", faculty, { title: "x".repeat(2 * 1024 * 1024) })).status).toBe(413);
  // Other APIs and URL-encoded parsing keep their original 16 KB ceiling.
  expect((await request(app).post("/api/auth/login").send({ userCode: "x".repeat(17000) })).status).toBe(413);
  expect((await request(app).post("/api/feedback-sessions").type("form").send({ title: "x".repeat(17000) })).status).toBe(413);
});
