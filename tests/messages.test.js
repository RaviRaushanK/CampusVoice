process.env.NODE_ENV = "test";
process.env.JWT_SECRET = require("crypto").randomBytes(48).toString("hex");
process.env.FRONTEND_ORIGIN = "http://localhost:5173";
process.env.COOKIE_SECURE = "false";
process.env.COOKIE_SAME_SITE = "lax";
const { randomUUID } = require("crypto");
const mongoose = require("mongoose"), request = require("supertest");
const app = require("../app");
const User = require("../models/User"), Department = require("../models/Department"), Subject = require("../models/Subject"), ClassGroup = require("../models/ClassGroup"), Assignment = require("../models/FacultyAssignment");
const Feedback = require("../models/Feedback"), Suggestion = require("../models/Suggestion"), Notification = require("../models/Notification"), Session = require("../models/FeedbackSession"), Response = require("../models/SessionResponse");
const notifications = require("../services/notificationService"), { REJECTION_MESSAGE } = require("../utils/constants/moderation");
const { hashPassword } = require("../services/authService"), { signToken } = require("../middleware/jwt"), { createTestDatabase } = require("./helpers/testDatabase");
const database = createTestDatabase("messages");
let hash, principal, department, foreignDepartment, hod, foreignHod, faculty, otherFaculty, foreignFaculty, student, otherStudent, subject, group, assignment;
const oid = () => String(new mongoose.Types.ObjectId());
const call = (method, path, actor = student, body) => {
  let req = request(app)[method](`/api/${path}`).set("Origin", process.env.FRONTEND_ORIGIN).set("X-CSRF-Protection", "1"); if (actor) req = req.set("Cookie", `cv_auth=${signToken(actor)}`); return body === undefined ? req : req.send(body);
};
const account = overrides => User.create({ name: "Test Person", userCode: `person.${oid()}`, passwordHash: hash, role: "STUDENT", departmentId: department._id, semester: 2, section: "A", batch: "2025-2027", mustChangePassword: false, ...overrides });
const feedbackBody = fields => ({ facultyAssignmentId: String(assignment._id), rating: 4, message: "Please add more worked examples.", identityMode: "ANONYMOUS", ...fields });
const suggestionBody = fields => ({ facultyId: String(faculty._id), message: "Please organize another coding workshop.", identityMode: "ANONYMOUS", ...fields });
const feedback = async fields => { const res = await call("post", "general-feedback", student, feedbackBody(fields)); expect(res.status).toBe(201); return res.body.data; };
const suggestion = async fields => { const res = await call("post", "suggestions", student, suggestionBody(fields)); expect(res.status).toBe(201); return res.body.data; };
beforeAll(async () => { await mongoose.connect(database.uri, { serverSelectionTimeoutMS: 5000 }); database.assertConnection(mongoose.connection); await Promise.all([User, Department, Subject, ClassGroup, Assignment, Feedback, Suggestion, Notification, Session, Response].map(model => model.init())); hash = await hashPassword("Temporary_123!"); });
beforeEach(async () => {
  database.assertConnection(mongoose.connection); for (const model of [Feedback, Suggestion, Notification, Response, Session, Assignment, Subject, ClassGroup, User, Department]) await model.deleteMany({});
  principal = await User.create({ name: "Principal", userCode: "principal", role: "PRINCIPAL", passwordHash: hash, mustChangePassword: false });
  [department, foreignDepartment] = await Department.create([{ name: "Applications", code: "MCA", createdBy: principal._id }, { name: "Computer Science", code: "CSE", createdBy: principal._id }]);
  hod = await account({ name: "Own HOD", role: "HOD" }); foreignHod = await account({ name: "Other HOD", role: "HOD", departmentId: foreignDepartment._id });
  faculty = await account({ name: "Recipient Faculty", role: "FACULTY" }); otherFaculty = await account({ name: "Other Faculty", role: "FACULTY" }); foreignFaculty = await account({ role: "FACULTY", departmentId: foreignDepartment._id });
  student = await account({ name: "Private Student Person", userCode: "private.usn.123", email: "private.student@test.example" }); otherStudent = await account({ name: "Other Student Person" });
  subject = await Subject.create({ code: "MMC201", name: "Data Structures", semester: 2, departmentId: department._id, createdBy: hod._id });
  group = await ClassGroup.create({ semester: 2, section: "A", academicYear: "2026-2027", batch: "2025-2027", departmentId: department._id, createdBy: hod._id });
  assignment = await Assignment.create({ facultyId: faculty._id, subjectId: subject._id, classGroupId: group._id, departmentId: department._id, academicYear: group.academicYear, createdBy: hod._id });
});
afterEach(() => vi.restoreAllMocks());
afterAll(async () => { try { if (mongoose.connection.readyState !== 0) await database.drop(mongoose.connection); } finally { await mongoose.disconnect(); } });
const noStudentLeaks = response => {
  const text = JSON.stringify(response.body);
  for (const secret of [String(student._id), student.name, student.userCode, student.email]) expect(text).not.toContain(secret);
  for (const key of ["student", "studentId", "namedStudentId", "email", "passwordHash", "tokenVersion", "mustChangePassword", "submissionKey", "submissionFingerprint"]) expect(text).not.toContain(`"${key}"`);
};

test("Student options derive real active Faculty/Subject relationships and return safe paginated data", async () => {
  const res = await call("get", "general-feedback/options"); expect(res.status).toBe(200); expect(res.body.data.items).toEqual([{ id: String(assignment._id), faculty: { name: faculty.name }, subject: { code: subject.code, name: subject.name }, academicYear: group.academicYear }]);
  expect((await call("get", "general-feedback/options?page=2&limit=1")).body.data.items).toEqual([]);
});
test.each([{ departmentId: "foreign" }, { semester: 3 }, { section: "B" }, { batch: "2024-2026" }, { batch: null }])("options and submission exclude ineligible student %#", async fields => {
  await User.updateOne({ _id: student._id }, { ...fields, ...(fields.departmentId ? { departmentId: foreignDepartment._id } : {}) }); student = await User.findById(student._id).select("+tokenVersion");
  expect((await call("get", "general-feedback/options")).body.data.items).toEqual([]); expect((await call("post", "general-feedback", student, feedbackBody())).status).toBe(404);
});
test.each(["faculty", "assignment", "subject", "class", "department"])("inactive %s cannot receive new subject feedback", async kind => {
  await ({ faculty: User, assignment: Assignment, subject: Subject, class: ClassGroup, department: Department }[kind]).updateOne({ _id: { faculty: faculty._id, assignment: assignment._id, subject: subject._id, class: group._id, department: department._id }[kind] }, { isActive: false });
  const res = await call("get", "general-feedback/options"); if (kind === "department") expect(res.status).toBe(403); else expect(res.body.data.items).toEqual([]);
  expect((await call("post", "general-feedback", student, feedbackBody())).status).toBe(kind === "department" ? 403 : 404);
});
test("unbatched class accepts matching students with any batch and normalized sections", async () => {
  await ClassGroup.updateOne({ _id: group._id }, { batch: null }); await User.updateOne({ _id: student._id }, { batch: null, section: "a" });
  expect((await call("get", "general-feedback/options")).body.data.items).toHaveLength(1); await feedback();
});
test.each([1, 2, 3, 4, 5])("General Feedback accepts rating %s, repeats over time, retains internal Student and sends no notifications", async rating => {
  const item = await feedback({ rating }); await feedback({ rating }); expect(await Feedback.countDocuments()).toBe(2); expect(await Notification.countDocuments()).toBe(0);
  const stored = await Feedback.findById(item.id).select("+studentId"); expect(String(stored.studentId)).toBe(String(student._id)); expect(String(stored.facultyId)).toBe(String(faculty._id)); expect(String(stored.subjectId)).toBe(String(subject._id)); expect(String(stored.departmentId)).toBe(String(department._id));
});
test.each([{ rating: 0 }, { rating: 6 }, { rating: "4" }, { rating: 2.5 }, { message: "" }, { message: "   " }, { message: "short" }, { message: "x".repeat(2001) }, { identityMode: "INVALID" }, { facultyAssignmentId: "bad" }, { facultyAssignmentId: new mongoose.Types.ObjectId().toString() }])("rejects malformed General Feedback %#", async fields => { expect((await call("post", "general-feedback", student, feedbackBody(fields))).status).toBe(fields.facultyAssignmentId?.length === 24 ? 404 : 400); expect(await Feedback.countDocuments()).toBe(0); });
test.each(["studentId", "facultyId", "subjectId", "departmentId", "isAnonymous", "createdAt", "submittedAt"])("rejects Feedback injection %s", async field => expect((await call("post", "general-feedback", student, feedbackBody({ [field]: oid() }))).status).toBe(400));
test("Faculty/HOD receive Anonymous feedback with no Student identity in the complete HTTP JSON", async () => {
  const item = await feedback();
  for (const res of [await call("get", "general-feedback/received", faculty), await call("get", "general-feedback/department", hod), await call("get", `general-feedback/${item.id}`, faculty), await call("get", `general-feedback/${item.id}`, hod)]) { expect(res.status).toBe(200); noStudentLeaks(res); }
  expect((await call("get", "general-feedback/received", otherFaculty)).body.data.items).toEqual([]); expect((await call("get", `general-feedback/${item.id}`, otherFaculty)).status).toBe(404); expect((await call("get", `general-feedback/${item.id}`, foreignHod)).status).toBe(404);
});
test("Named feedback discloses only name/userCode to Faculty/HOD; own history stays Student-scoped", async () => {
  await feedback({ identityMode: "NAMED" });
  for (const actor of [faculty, hod]) { const items = (await call("get", actor.role === "HOD" ? "general-feedback/department" : "general-feedback/received", actor)).body.data.items; expect(items[0].identity).toEqual({ name: student.name, userCode: student.userCode }); expect(JSON.stringify(items)).not.toContain(student.email); expect(JSON.stringify(items)).not.toContain(String(student._id)); }
  const mine = await call("get", "general-feedback/mine"); expect(mine.body.data.items[0]).toMatchObject({ identityMode: "NAMED", message: feedbackBody().message, rating: 4 }); expect(mine.body.data.items[0].submittedAt).toBeTruthy();
  expect((await call("get", "general-feedback/mine", otherStudent)).body.data.items).toEqual([]);
});
test("Principal aggregate is numeric-only and exposes neither messages nor any identities", async () => {
  await feedback({ rating: 4 }); await feedback({ rating: 5, identityMode: "NAMED" });
  const res = await call("get", "general-feedback/aggregate", principal); expect(res.status).toBe(200); expect(res.body.data).toEqual({ totalFeedback: 2, averageRating: 4.5, distribution: [1, 2, 3, 4, 5].map(rating => ({ rating, count: rating >= 4 ? 1 : 0 })) });
  for (const key of ["message", "student", "studentId", "name", "userCode", "email", "items", "identityMode"]) expect(res.text).not.toContain(`"${key}"`); expect(res.text).not.toContain(feedbackBody().message);
  for (const path of ["general-feedback/received", "general-feedback/department", "general-feedback/mine", `general-feedback/${(await Feedback.findOne())._id}`]) expect((await call("get", path, principal)).status).toBe(403);
});
test("HOD filters preserve department and current Faculty ownership; transfers do not leak historical records", async () => {
  const item = await feedback(); expect((await call("get", `general-feedback/department?facultyId=${faculty._id}&subjectId=${subject._id}&rating=4`, hod)).body.data.pagination.total).toBe(1);
  expect((await call("get", `general-feedback/department?facultyId=${foreignFaculty._id}`, hod)).body.data.items).toEqual([]); expect((await call("get", "general-feedback/department?rating=1", hod)).body.data.items).toEqual([]);
  await User.updateOne({ _id: faculty._id }, { departmentId: foreignDepartment._id }); expect((await call("get", `general-feedback/${item.id}`, hod)).status).toBe(404); expect((await call("get", `general-feedback/${item.id}`, foreignHod)).status).toBe(404);
});
test("Suggestion Faculty choices are active, same-department Faculty only", async () => {
  const res = await call("get", "suggestions/faculty-options"); expect(res.status).toBe(200); expect(res.body.data.items.map(item => item.id).sort()).toEqual([String(faculty._id), String(otherFaculty._id)].sort());
  await User.updateOne({ _id: otherFaculty._id }, { isActive: false }); expect((await call("get", "suggestions/faculty-options")).body.data.items).toHaveLength(1);
});
test.each(["foreign", "inactive", "HOD", "PRINCIPAL", "unknown", "malformed"])("Suggestion rejects %s recipient", async kind => {
  if (kind === "inactive") await User.updateOne({ _id: faculty._id }, { isActive: false });
  const target = { foreign: foreignFaculty._id, inactive: faculty._id, HOD: hod._id, PRINCIPAL: principal._id, unknown: oid(), malformed: "bad" }[kind];
  expect((await call("post", "suggestions", student, suggestionBody({ facultyId: String(target) }))).status).toBe(kind === "malformed" ? 400 : 404); expect(await Suggestion.countDocuments()).toBe(0); expect(await Notification.countDocuments()).toBe(0);
});
test.each(["ANONYMOUS", "NAMED"])("Suggestion %s is final, retained internally and visible only to Student/selected Faculty", async identityMode => {
  const { item } = await suggestion({ identityMode }); const stored = await Suggestion.findById(item.id).select("+studentId"); expect(String(stored.studentId)).toBe(String(student._id));
  const received = await call("get", "suggestions/received", faculty); expect(received.status).toBe(200); if (identityMode === "ANONYMOUS") noStudentLeaks(received); else expect(received.body.data.items[0].identity).toEqual({ name: student.name, userCode: student.userCode });
  const detail = await call("get", `suggestions/${item.id}`, faculty); expect(detail.status).toBe(200); if (identityMode === "ANONYMOUS") noStudentLeaks(detail);
  expect((await call("get", "suggestions/mine")).body.data.items[0].message).toBe(suggestionBody().message); expect((await call("get", "suggestions/mine", otherStudent)).body.data.items).toEqual([]);
  for (const actor of [otherFaculty, otherStudent]) expect((await call("get", `suggestions/${item.id}`, actor)).status).toBe(404);
  for (const actor of [hod, principal]) for (const path of ["suggestions/received", "suggestions/mine", `suggestions/${item.id}`, "suggestions/aggregate"]) expect((await call("get", path, actor)).status).toBe(403);
  for (const path of [`suggestions/${item.id}`, `general-feedback/${oid()}`]) for (const method of ["patch", "delete"]) expect((await call(method, path, student, { identityMode: "NAMED" })).status).toBe(404);
});
test("Suggestion notification is neutral, selected-Faculty-only and uses the shared contract", async () => {
  const result = await suggestion(); expect(result.notificationDelivery).toEqual({ attempted: true, delivered: true }); expect(await Notification.countDocuments()).toBe(1);
  const notice = await Notification.findOne(); expect(String(notice.recipient)).toBe(String(faculty._id)); expect(notice).toMatchObject({ type: "SUGGESTION", title: "New Private Suggestion", message: "You received a new private suggestion.", relatedResourceType: "SUGGESTION" });
  const json = JSON.stringify(notice); for (const secret of [student.name, student.userCode, student.email, String(student._id), suggestionBody().message]) expect(json).not.toContain(secret);
});
test("Suggestion notification failure preserves final content and reports failure safely", async () => {
  vi.spyOn(notifications, "createNotification").mockRejectedValueOnce(new Error("sensitive DB info")); const log = vi.spyOn(console, "warn").mockImplementation(() => {});
  const result = await suggestion(); expect(result.notificationDelivery).toEqual({ attempted: true, delivered: false }); expect(await Suggestion.countDocuments()).toBe(1); expect(log).toHaveBeenCalledWith("Private suggestion saved with a notification delivery failure.");
});
test("retry key protects concurrent Suggestion retries without forbidding future suggestions", async () => {
  const fields = suggestionBody({ submissionKey: randomUUID() }); const results = await Promise.all([call("post", "suggestions", student, fields), call("post", "suggestions", student, fields)]); expect(results.map(result => result.status)).toEqual([201, 201]); expect(results[0].body.data.item.id).toBe(results[1].body.data.item.id); expect(await Suggestion.countDocuments()).toBe(1); expect(await Notification.countDocuments()).toBe(1);
  expect((await call("post", "suggestions", student, { ...fields, message: "Different message for the same key." })).status).toBe(409);
  await suggestion({ submissionKey: randomUUID() }); expect(await Suggestion.countDocuments()).toBe(2); expect(await Notification.countDocuments()).toBe(2);
});
test.each([{ message: "" }, { message: "short" }, { message: "x".repeat(2001) }, { identityMode: "INVALID" }, { submissionKey: "bad-key" }])("Suggestion fields remain strictly bounded %#", async fields => {
  expect((await call("post", "suggestions", student, suggestionBody(fields))).status).toBe(400); expect(await Suggestion.countDocuments()).toBe(0); expect(await Notification.countDocuments()).toBe(0);
});
test("zero aggregates and private dashboard counts do not leak to HOD/Principal", async () => {
  expect((await call("get", "general-feedback/aggregate", principal)).body.data).toEqual({ totalFeedback: 0, averageRating: null, distribution: [1, 2, 3, 4, 5].map(rating => ({ rating, count: 0 })) });
  await feedback(); await suggestion();
  const dashboard = async actor => (await request(app).get("/api/academic/dashboard").set("Cookie", `cv_auth=${signToken(actor)}`)).body.data.metrics;
  expect(await dashboard(faculty)).toMatchObject({ "General Feedback Received": 1, "Private Suggestions": 1 }); expect(await dashboard(student)).toMatchObject({ "Feedback Submitted": 1, "Suggestions Sent": 1 }); expect(await dashboard(otherFaculty)).toMatchObject({ "General Feedback Received": 0, "Private Suggestions": 0 });
  for (const actor of [hod, principal]) expect(JSON.stringify(await dashboard(actor))).not.toMatch(/Suggestion/);
});
test("new message models enforce references, enum, rating and message bounds", async () => {
  const refs = { studentId: student._id, facultyId: faculty._id, departmentId: department._id, identityMode: "ANONYMOUS", message: feedbackBody().message };
  await expect(new Suggestion(refs).validate()).resolves.toBeUndefined();
  await expect(new Feedback({ ...refs, subjectId: subject._id, facultyAssignmentId: assignment._id, rating: 4 }).validate()).resolves.toBeUndefined();
  for (const fields of [{ message: " " }, { message: "x".repeat(2001) }, { identityMode: "INVALID" }, { studentId: undefined }, { facultyId: undefined }]) await expect(new Suggestion({ ...refs, ...fields }).validate()).rejects.toThrow();
  await expect(new Feedback({ ...refs, subjectId: subject._id, facultyAssignmentId: assignment._id, rating: 6 }).validate()).rejects.toThrow();
});
test.each(["student", "studentId", "departmentId", "recipientRole", "createdAt", "isAnonymous", "submittedAt"])("Suggestion rejects injected %s", async field => expect((await call("post", "suggestions", student, suggestionBody({ [field]: oid() }))).status).toBe(400));
test("moderation rejects both message modules before persistence and notification", async () => {
  for (const [path, body] of [["general-feedback", feedbackBody({ message: "Your lecture was f.u.c.k this." })], ["suggestions", suggestionBody({ message: "You are a b1tch, change it." })]]) {
    const res = await call("post", path, student, body); expect(res.status).toBe(400); expect(res.body.message).toBe(REJECTION_MESSAGE); expect(Object.keys(res.body).sort()).toEqual(["message", "success"]);
  }
  expect(await Feedback.countDocuments()).toBe(0); expect(await Suggestion.countDocuments()).toBe(0); expect(await Notification.countDocuments()).toBe(0); await feedback(); await suggestion();
});
test("session SHORT_ANSWER moderation rejects the entire response, then permits a clean revision", async () => {
  const created = await call("post", "feedback-sessions", faculty, { title: "Moderation session", facultyAssignmentId: String(assignment._id), questions: [{ type: "RATING", prompt: "Rate", required: true }, { type: "SHORT_ANSWER", prompt: "Explain", required: true }, { type: "SINGLE_CHOICE", prompt: "Choose", options: ["shit", "clean"], required: true }] }); expect(created.status).toBe(201);
  const session = created.body.data; await call("post", `feedback-sessions/${session.id}/publish`, faculty).expect(200);
  const fields = { identityMode: "ANONYMOUS", answers: [{ questionId: session.questions[0].id, value: 5 }, { questionId: session.questions[1].id, value: "This is sh1t." }, { questionId: session.questions[2].id, value: "shit" }] };
  const rejected = await call("post", `feedback-sessions/${session.id}/responses`, student, fields); expect(rejected.status).toBe(400); expect(rejected.body.message).toBe(REJECTION_MESSAGE); expect(await Response.countDocuments()).toBe(0);
  fields.answers[1].value = "More examples would help."; await call("post", `feedback-sessions/${session.id}/responses`, student, fields).expect(201); expect(await Response.countDocuments()).toBe(1);
  expect((await call("post", `feedback-sessions/${session.id}/responses`, student, fields)).status).toBe(409);
});
test("lists paginate newest-first with bounded queries; summaries follow scope and filters", async () => {
  await feedback({ rating: 1 }); const newest = await feedback({ rating: 5, message: "The latest valid message here." });
  const page = await call("get", "general-feedback/received?limit=1", faculty); expect(page.body.data.items[0].id).toBe(newest.id); expect(page.body.data.pagination).toMatchObject({ total: 2, totalPages: 2, hasNextPage: true }); expect(page.body.data.summary.averageRating).toBe(3);
  expect((await call("get", "general-feedback/department?rating=5", hod)).body.data.summary).toMatchObject({ totalFeedback: 1, averageRating: 5 });
  for (const path of ["general-feedback/mine", "general-feedback/received", "general-feedback/department", "suggestions/mine", "suggestions/received", "general-feedback/options", "suggestions/faculty-options"]) {
    const actor = path.includes("department") ? hod : path.includes("received") ? faculty : student;
    for (const query of ["page=0", "limit=101", "page[]=1", "studentId=evil"]) expect((await call("get", `${path}?${query}`, actor)).status).toBe(400);
  }
});
test("all new APIs preserve role/auth/first-login/CSRF/inactive/revocation and small-payload bounds", async () => {
  const cases = [["get", "general-feedback/options", student], ["post", "general-feedback", student], ["get", "general-feedback/mine", student], ["get", "general-feedback/received", faculty], ["get", "general-feedback/department", hod], ["get", "general-feedback/aggregate", principal], ["get", "suggestions/faculty-options", student], ["post", "suggestions", student], ["get", "suggestions/mine", student], ["get", "suggestions/received", faculty]];
  for (const [method, path, actor] of cases) {
    expect((await call(method, path, null)).status).toBe(401); await User.updateOne({ _id: actor._id }, { mustChangePassword: true }); expect((await call(method, path, actor)).body.code).toBe("PASSWORD_CHANGE_REQUIRED"); await User.updateOne({ _id: actor._id }, { mustChangePassword: false });
    const wrong = actor.role === "STUDENT" ? faculty : student; expect((await call(method, path, wrong)).status).toBe(403);
  }
  for (const path of ["general-feedback", "suggestions"]) {
    expect((await request(app).post(`/api/${path}`).set("Cookie", `cv_auth=${signToken(student)}`).send({})).body.code).toBe("CSRF_REJECTED"); expect((await call("post", path, student, { message: "x".repeat(17000) })).status).toBe(413);
  }
  for (const [fields, expected] of [[{ isActive: false }, 401], [{ isActive: true }, 401]]) { await User.updateOne({ _id: student._id }, fields); expect((await call("get", "suggestions/mine")).status).toBe(expected); }
});
