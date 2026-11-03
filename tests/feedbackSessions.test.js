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
const Notification = require("../models/Notification");
const { signToken } = require("../middleware/jwt");
const { hashPassword } = require("../services/authService");
const { createTestDatabase } = require("./helpers/testDatabase");
const { parseBody, parseQuery } = require("../validators/feedbackSessionValidator");
const service = require("../services/feedbackSessionService");
const database = createTestDatabase("feedback");
let hash, faculty, other, department, subject, group, assignment;
const oid = () => String(new mongoose.Types.ObjectId());
const question = (type = "SHORT_ANSWER", overrides = {}) => ({ type, prompt: "What could improve?", required: true,
  ...(["SINGLE_CHOICE", "MULTI_SELECT"].includes(type) ? { options: ["Very clear", "Needs work"] } : {}),
  ...(type === "RATING" ? { ratingMin: 1, ratingMax: 5 } : {}), ...overrides });
const body = (overrides = {}) => ({ title: "  Lecture feedback  ", facultyAssignmentId: String(assignment._id), ...overrides });
const modelFields = (overrides = {}) => ({ title: "Draft", facultyId: faculty._id, departmentId: department._id, facultyAssignmentId: assignment._id, subjectId: subject._id, classGroupId: group._id, createdBy: faculty._id, ...overrides });
const call = (method, path = "", user = faculty, fields) => {
  let req = request(app)[method](`/api/feedback-sessions${path}`).set("Origin", process.env.FRONTEND_ORIGIN).set("X-CSRF-Protection", "1");
  if (user) req = req.set("Cookie", `cv_auth=${signToken(user)}`);
  return fields === undefined ? req : req.send(fields);
};
const create = async overrides => { const result = await call("post", "", faculty, body(overrides)); expect(result.status).toBe(201); return result.body.data; };
beforeAll(async () => {
  await mongoose.connect(database.uri, { serverSelectionTimeoutMS: 5000 }); database.assertConnection(mongoose.connection);
  await Promise.all([User.init(), Department.init(), Subject.init(), ClassGroup.init(), Assignment.init(), Session.init()]);
  hash = await hashPassword("Temporary_123!");
});
beforeEach(async () => {
  database.assertConnection(mongoose.connection);
  for (const model of [Session, Assignment, Subject, ClassGroup, Department, User, Notification]) await model.deleteMany({});
  [faculty, other] = await User.create(["owner", "other"].map(code => ({ name: `Faculty ${code}`, userCode: code, role: "FACULTY", passwordHash: hash, mustChangePassword: false })));
  department = await Department.create({ name: "Computer Applications", code: "MCA", createdBy: faculty._id });
  await User.updateMany({}, { departmentId: department._id });
  [faculty, other] = await Promise.all([User.findById(faculty._id).select("+tokenVersion"), User.findById(other._id).select("+tokenVersion")]);
  subject = await Subject.create({ name: "Data Structures", code: "MMC201", semester: 2, departmentId: department._id, createdBy: faculty._id });
  group = await ClassGroup.create({ departmentId: department._id, semester: 2, section: "A", academicYear: "2026-2027", createdBy: faculty._id });
  assignment = await Assignment.create({ facultyId: faculty._id, departmentId: department._id, subjectId: subject._id, classGroupId: group._id, academicYear: group.academicYear, createdBy: faculty._id });
});
afterAll(async () => { try { if (mongoose.connection.readyState !== 0) await database.drop(mongoose.connection); } finally { await mongoose.disconnect(); } });
afterEach(() => vi.restoreAllMocks());

test("creates only an owned draft, derives references, returns safe academic context and generates no notifications", async () => {
  const result = await create({ questions: [question("SINGLE_CHOICE"), question("MULTI_SELECT"), question("RATING"), question()] });
  expect(result).toMatchObject({ title: "Lecture feedback", status: "DRAFT", allowAnonymous: true, questionCount: 4, subject: { code: "MMC201" }, classGroup: { semester: 2, section: "A", academicYear: "2026-2027" } });
  expect(new Set(result.questions.map(value => value.id)).size).toBe(4);
  const stored = await Session.findById(result.id);
  for (const key of ["departmentId", "subjectId", "classGroupId", "facultyId", "createdBy"]) expect(String(stored[key])).toBe(String(modelFields()[key]));
  for (const key of ["passwordHash", "tokenVersion", "facultyId", "createdBy", "__v"]) expect(result).not.toHaveProperty(key);
  expect(result.publishedAt).toBeNull(); expect(result.closedAt).toBeNull();
  expect(await Notification.countDocuments()).toBe(0);
});
test("rejects another faculty's assignment and inactive assignment", async () => {
  expect((await call("post", "", other, body())).status).toBe(404);
  await Assignment.updateOne({ _id: assignment._id }, { isActive: false });
  expect((await call("post", "", faculty, body())).status).toBe(400);
});
test.each(["department", "subject", "class"])("rejects inactive %s source even if the assignment is active", async kind => {
  const model = { department: Department, subject: Subject, class: ClassGroup }[kind];
  await model.updateMany({}, { isActive: false }); expect((await call("post", "", faculty, body())).status).toBe(400);
});
test("rejects corrupt cross-department, semester or year assignment context", async () => {
  for (const patch of [{ departmentId: new mongoose.Types.ObjectId() }, { semester: 3 }]) {
    await Subject.updateOne({ _id: subject._id }, patch);
    expect((await call("post", "", faculty, body())).status).toBe(400);
    await Subject.updateOne({ _id: subject._id }, { departmentId: department._id, semester: 2 });
  }
  await Assignment.updateOne({ _id: assignment._id }, { academicYear: "2027-2028" });
  expect((await call("post", "", faculty, body())).status).toBe(400);
});
test.each(["faculty", "facultyId", "department", "departmentId", "subject", "subjectId", "classGroup", "classGroupId", "status", "createdBy", "publishedAt", "closedAt", "__v"])("rejects protected %s on creation and update", async field => {
  expect((await call("post", "", faculty, body({ [field]: field === "status" ? "OPEN" : oid() }))).status).toBe(400);
  const draft = await create();
  expect((await call("patch", `/${draft.id}`, faculty, { [field]: oid() })).status).toBe(400);
});
test("draft assignment cannot change", async () => {
  const draft = await create(); expect((await call("patch", `/${draft.id}`, faculty, { facultyAssignmentId: oid() })).status).toBe(400);
});
test("ownership scopes read/list/edit/question replacement/delete with safe not-found behavior", async () => {
  const draft = await create({ questions: [question()] });
  expect((await call("get", `/${draft.id}`)).status).toBe(200);
  for (const [method, fields] of [["get", undefined], ["patch", { title: "Stolen" }], ["patch", { questions: [] }], ["delete", undefined]]) {
    const response = await call(method, `/${draft.id}`, other, fields);
    expect(response.status).toBe(404); expect(response.body.message).toBe("Feedback session unavailable.");
  }
  expect((await call("get", "/mine", other)).body.data.pagination.total).toBe(0);
  expect((await call("get", `/${oid()}`)).body.message).toBe("Feedback session unavailable.");
});
test("updates all draft settings, retains stable question IDs across edits/moves and removes questions", async () => {
  const draft = await create({ questions: [question(), question("RATING")] });
  const questions = [...draft.questions].reverse(); questions[1].prompt = "Updated prompt";
  const response = await call("patch", `/${draft.id}`, faculty, { title: "Updated title", description: "Details", allowAnonymous: false, opensAt: "2027-01-01T10:00:00Z", closesAt: "2027-01-01T11:00:00Z", questions });
  expect(response.status).toBe(200); expect(response.body.data).toMatchObject({ title: "Updated title", description: "Details", allowAnonymous: false, questions });
  expect((await call("patch", `/${draft.id}`, faculty, { questions: [questions[1], question("MULTI_SELECT")] })).body.data.questions[0].id).toBe(draft.questions[0].id);
  expect((await call("patch", `/${draft.id}`, faculty, { questions: [] })).body.data.questionCount).toBe(0);
  expect((await call("delete", `/${draft.id}`)).status).toBe(200);
  expect((await call("get", `/${draft.id}`)).status).toBe(404);
});
test("rejects duplicate/foreign question IDs and client IDs during create", async () => {
  const draft = await create({ questions: [question()] }); const q = draft.questions[0];
  for (const questions of [[q, q], [{ ...q, id: oid() }], [{ ...q, id: "bad" }]]) expect((await call("patch", `/${draft.id}`, faculty, { questions })).status).toBe(400);
  expect((await call("post", "", faculty, body({ questions: [{ ...question(), id: oid() }] }))).status).toBe(400);
});
test.each(["OPEN", "CLOSED"])("future %s sessions are readable but cannot be edited or deleted", async status => {
  const draft = await create(); await Session.updateOne({ _id: draft.id }, { status });
  expect((await call("get", `/${draft.id}`)).body.data.status).toBe(status);
  expect((await call("patch", `/${draft.id}`, faculty, { title: "No" })).status).toBe(409);
  expect((await call("delete", `/${draft.id}`)).status).toBe(409);
});
test("retired assignment retains draft context and permits metadata/question editing", async () => {
  const draft = await create({ questions: [question()] });
  await Assignment.updateOne({ _id: assignment._id }, { isActive: false });
  const updated = await call("patch", `/${draft.id}`, faculty, { title: "Retained draft", questions: draft.questions });
  expect(updated.status).toBe(200); expect(updated.body.data.subject.code).toBe("MMC201");
});
test.each(["version", "status"])("a concurrent %s change prevents a stale in-flight draft write", async kind => {
  const draft = await create();
  const updateOne = Session.updateOne.bind(Session);
  vi.spyOn(Session, "updateOne").mockImplementationOnce(async (...args) => {
    await updateOne({ _id: draft.id }, kind === "version" ? { $inc: { __v: 1 }, $set: { title: "Concurrent edit" } } : { $set: { status: "OPEN" } });
    return updateOne(...args);
  });
  await expect(service.update(faculty, draft.id, { title: "Stale edit" })).rejects.toMatchObject({ statusCode: 409 });
  const saved = await Session.findById(draft.id);
  expect(saved.title).not.toBe("Stale edit"); if (kind === "status") expect(saved.status).toBe("OPEN");
});
test("partial date updates validate against stored dates; dates can be cleared", async () => {
  const draft = await create({ opensAt: "2027-01-01T10:00:00Z", closesAt: "2027-01-01T11:00:00Z" });
  expect((await call("patch", `/${draft.id}`, faculty, { opensAt: "2027-01-01T12:00:00Z" })).status).toBe(400);
  expect((await call("patch", `/${draft.id}`, faculty, { closesAt: "2027-01-01T09:00:00Z" })).status).toBe(400);
  expect((await call("patch", `/${draft.id}`, faculty, { opensAt: null, closesAt: null })).body.data.opensAt).toBeNull();
});
test("lists newest-first with deterministic ties, pagination/status filters, real own dashboard counts", async () => {
  const drafts = [await create(), await create(), await create()];
  await Session.updateMany({}, { createdAt: new Date("2026-01-01") });
  const result = await call("get", "/mine?page=1&limit=2&status=DRAFT");
  expect(result.body.data.pagination).toMatchObject({ total: 3, totalPages: 2, hasNextPage: true });
  expect(result.body.data.items.map(value => value.id)).toEqual(drafts.map(value => value.id).sort().reverse().slice(0, 2));
  expect(result.body.data.items[0]).not.toHaveProperty("questions");
  expect((await call("get", "/mine?page=2&limit=2")).body.data.items).toHaveLength(1);
  expect((await call("get", "/mine?page=99")).body.data.items).toEqual([]);
  expect((await call("get", "/mine?status=OPEN")).body.data.items).toEqual([]);
  const dashboard = await request(app).get("/api/academic/dashboard").set("Cookie", `cv_auth=${signToken(faculty)}`);
  expect(dashboard.body.data.metrics).toEqual({ "My Sessions": 3, "Draft Sessions": 3, "Open Sessions": 0, "Scheduled Sessions": 0, "Closed Sessions": 0, "General Feedback Received": 0, "Private Suggestions": 0, "Assigned Issues": 0, "Pending Issues": 0 });
});
test.each(["PRINCIPAL", "HOD", "STUDENT"])("%s is blocked from every Faculty session endpoint", async role => {
  await User.updateOne({ _id: other._id }, { role }); const actor = await User.findById(other._id).select("+tokenVersion");
  for (const [method, path, fields] of [["get", "/mine"], ["get", `/${oid()}`], ["post", "", body()], ["patch", `/${oid()}`, { title: "No" }], ["delete", `/${oid()}`]]) expect((await call(method, path, actor, fields)).status).toBe(403);
});
test("every endpoint requires auth and first-login completion", async () => {
  const routes = [["get", "/mine"], ["get", `/${oid()}`], ["post", ""], ["patch", `/${oid()}`], ["delete", `/${oid()}`]];
  for (const [method, path] of routes) expect((await call(method, path, null)).status).toBe(401);
  await User.updateOne({ _id: faculty._id }, { mustChangePassword: true });
  for (const [method, path] of routes) expect((await call(method, path)).body.code).toBe("PASSWORD_CHANGE_REQUIRED");
});
test.each(["inactive", "revoked"])("%s account session is rejected", async kind => {
  if (kind === "inactive") await User.updateOne({ _id: faculty._id }, { isActive: false });
  else await User.updateOne({ _id: faculty._id }, { $inc: { tokenVersion: 1 } });
  expect((await call("post", "", faculty, body())).status).toBe(401);
});
test.each(["post", "patch", "delete"])("%s requires both CSRF header and allowed Origin", async method => {
  for (const headers of [{}, { Origin: process.env.FRONTEND_ORIGIN }, { "X-CSRF-Protection": "1" }, { Origin: "https://evil.example", "X-CSRF-Protection": "1" }]) {
    const result = await request(app)[method](`/api/feedback-sessions${method === "post" ? "" : `/${oid()}`}`).set("Cookie", `cv_auth=${signToken(faculty)}`).set(headers).send(body());
    expect(result.body.code).toBe("CSRF_REJECTED");
  }
});
test("malformed IDs and oversized request produce controlled errors", async () => {
  for (const method of ["get", "patch", "delete"]) expect((await call(method, "/bad", faculty, method === "patch" ? { title: "Valid" } : undefined)).status).toBe(400);
  expect((await call("post", "", faculty, body({ facultyAssignmentId: "bad" }))).status).toBe(400);
  const huge = await call("post", "", faculty, body({ description: "x".repeat(2 * 1024 * 1024 + 1) }));
  expect(huge.status).toBe(413); expect(huge.body.message).toBe("Request body too large.");
});

const invalidQuestions = [question("BOGUS"), question("SHORT_ANSWER", { prompt: " " }), question("SHORT_ANSWER", { required: "true" }), question("SHORT_ANSWER", { prompt: "x".repeat(1001) }), question("SINGLE_CHOICE", { options: ["one"] }), question("SINGLE_CHOICE", { options: ["one", " "] }), question("MULTI_SELECT", { options: ["  Same   answer ", "same answer"] }), question("SINGLE_CHOICE", { options: Array.from({ length: 21 }, (_, i) => `Option ${i}`) }), question("SINGLE_CHOICE", { options: ["x".repeat(201), "Two"] }), question("RATING", { ratingMax: 100000 }), question("RATING", { ratingMin: 0 }), question("SHORT_ANSWER", { options: ["one", "two"] }), question("SHORT_ANSWER", { ratingMin: 1 })];
test.each(invalidQuestions)("API rejects invalid question %#", async q => { expect((await call("post", "", faculty, body({ questions: [q] }))).status).toBe(400); });
test("API enforces question limit", async () => { expect((await call("post", "", faculty, body({ questions: Array.from({ length: 51 }, () => question()) }))).status).toBe(400); });
test.each([{}, { title: " " }, { title: "x".repeat(161) }, { description: "x".repeat(2001) }, { allowAnonymous: "yes" }, { questions: {} }, { opensAt: "yesterday" }, { opensAt: "2027-02-30T10:00:00Z" }, { opensAt: "2027-01-01T10:00:00" }, { opensAt: "2027-01-01T11:00:00Z", closesAt: "2027-01-01T11:00:00Z" }])("validator rejects malformed fields %#", fields => {
  expect(() => parseBody(Object.keys(fields).length ? body(fields) : {})).toThrow();
});
test.each([{ page: "0" }, { page: "1.5" }, { limit: "101" }, { status: "draft" }, { page: ["1"] }, { facultyId: "evil" }])("rejects malformed list query %#", query => expect(() => parseQuery(query)).toThrow());
test("model accepts all question types and enforces required references/title/status/dates", async () => {
  const valid = new Session(modelFields({ questions: [question("SINGLE_CHOICE"), question("MULTI_SELECT"), question("RATING"), question()] }));
  await expect(valid.validate()).resolves.toBeUndefined();
  const defaultRating = new Session(modelFields({ questions: [{ type: "RATING", prompt: "Rate it" }] }));
  await expect(defaultRating.validate()).resolves.toBeUndefined(); expect(defaultRating.questions[0].ratingMax).toBe(5);
  for (const overrides of [{ title: " " }, { facultyId: undefined }, { status: "PUBLISHED" }, { opensAt: "2027-01-02", closesAt: "2027-01-01" }, { questions: Array.from({ length: 51 }, () => question()) }]) await expect(new Session(modelFields(overrides)).validate()).rejects.toThrow();
});
// Mongoose casts boolean strings at model boundaries; API parsing rejects them.
test.each(invalidQuestions.filter(q => typeof q.required === "boolean"))("model rejects invalid question %#", async q => { await expect(new Session(modelFields({ questions: [q] })).validate()).rejects.toThrow(); });
