process.env.NODE_ENV = "test";
process.env.JWT_SECRET = require("crypto").randomBytes(48).toString("hex");
process.env.FRONTEND_ORIGIN = "http://localhost:5173";
process.env.COOKIE_SECURE = "false";
const { randomUUID } = require("node:crypto"), { resolve } = require("node:path"), fs = require("node:fs/promises");
process.env.COMPLAINT_UPLOAD_DIR = resolve(__dirname, "../test-results", `complaint-uploads-${randomUUID()}`);
const mongoose = require("mongoose"), request = require("supertest"), app = require("../app");
const User = require("../models/User"), Department = require("../models/Department"), Subject = require("../models/Subject"), Group = require("../models/ClassGroup"), Assignment = require("../models/FacultyAssignment"), Complaint = require("../models/Complaint"), Notification = require("../models/Notification");
const notifications = require("../services/notificationService"), service = require("../services/complaintService"), { TYPES } = require("../utils/constants/complaints"), { REJECTION_MESSAGE } = require("../utils/constants/moderation");
const { hashPassword } = require("../services/authService"), { signToken } = require("../middleware/jwt"), { createTestDatabase } = require("./helpers/testDatabase");
const database = createTestDatabase("complaints");
let hash, principal, department, otherDepartment, hod, otherHod, faculty, otherFaculty, student, otherStudent, assignment, group, subject;
const oid = () => String(new mongoose.Types.ObjectId());
const call = (method, path, actor = student, body) => { let req = request(app)[method](`/api/complaints${path}`).set("Origin", process.env.FRONTEND_ORIGIN).set("X-CSRF-Protection", "1"); if (actor) req = req.set("Cookie", `cv_auth=${signToken(actor)}`); return body === undefined ? req : req.send(body); };
const account = fields => User.create({ name: "Test Person", userCode: `person.${oid()}`, passwordHash: hash, role: "STUDENT", departmentId: department._id, semester: 2, section: "A", batch: "2025-2027", mustChangePassword: false, ...fields });
const body = (type = "FACULTY_ISSUE", fields = {}) => ({ type, title: "Please review this issue", description: "The scheduled laboratory equipment needs a repair and review.", identityMode: "ANONYMOUS", ...(["FACULTY_ISSUE", "AGAINST_FACULTY"].includes(type) ? { facultyAssignmentId: String(assignment._id) } : {}), ...fields });
const pdf = Buffer.from("%PDF-1.7\nEvidence\n%%EOF");
const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0]);
const jpeg = Buffer.from([255, 216, 255, 224, 0, 10, 255, 217]);
const upload = (fields = body(), attachments = [{ bytes: pdf, name: "PrivateStudent.pdf", mime: "application/pdf" }], actor = student) => {
  let req = call("post", "", actor); for (const [key, value] of Object.entries(fields)) req = req.field(key, value); for (const file of attachments) req = req.attach("attachments", file.bytes, { filename: file.name, contentType: file.mime }); return req;
};
const create = async (type, fields = {}, attachments = []) => { const res = await upload(body(type, fields), attachments); expect(res.status, res.text).toBe(201); return res.body.data.item; };
const action = (item, kind, actor, data = {}) => call(kind === "priority" ? "patch" : "post", `/${item.id}/${kind}`, actor, data);
const act = async (item, kind, actor, fields) => { const res = await action(item, kind, actor, fields); expect(res.status, res.text).toBe(200); return res.body.data.item; };
const diskFiles = async () => { try { return await fs.readdir(process.env.COMPLAINT_UPLOAD_DIR); } catch (err) { if (err.code === "ENOENT") return []; throw err; } };
const noLeaks = res => { for (const secret of [String(student._id), student.name, student.userCode, student.email, "PrivateStudent.pdf"]) expect(res.text).not.toContain(secret); for (const key of ["studentId", "actorId", "storageName", "originalName", "diskPath", "passwordHash", "tokenVersion", "mustChangePassword", "email", "departmentId", "initialHandlerId", "currentHandlerId", "priorHandlers", "targetHodId", "targetFacultyId"]) expect(res.text).not.toContain(`"${key}"`); };
beforeAll(async () => { await mongoose.connect(database.uri, { serverSelectionTimeoutMS: 5000 }); database.assertConnection(mongoose.connection); await Promise.all([User, Department, Subject, Group, Assignment, Complaint, Notification].map(model => model.init())); hash = await hashPassword("Temporary_123!"); });
beforeEach(async () => {
  database.assertConnection(mongoose.connection); for (const model of [Complaint, Notification, Assignment, Subject, Group, User, Department]) await model.deleteMany({});
  for (const file of await diskFiles()) await fs.unlink(resolve(process.env.COMPLAINT_UPLOAD_DIR, file));
  principal = await User.create({ name: "Principal", userCode: "principal", role: "PRINCIPAL", passwordHash: hash, mustChangePassword: false });
  [department, otherDepartment] = await Department.create([{ name: "Applications", code: "MCA", createdBy: principal._id }, { name: "Other", code: "CSE", createdBy: principal._id }]);
  hod = await account({ role: "HOD" }); otherHod = await account({ role: "HOD", departmentId: otherDepartment._id }); faculty = await account({ role: "FACULTY" }); otherFaculty = await account({ role: "FACULTY" });
  student = await account({ name: "PrivateStudent", userCode: "private.student", email: "private@student.example" }); otherStudent = await account({});
  subject = await Subject.create({ code: "LAB201", name: "Laboratory", semester: 2, departmentId: department._id, createdBy: hod._id });
  group = await Group.create({ semester: 2, section: "A", academicYear: "2026-2027", batch: "2025-2027", departmentId: department._id, createdBy: hod._id });
  assignment = await Assignment.create({ facultyId: faculty._id, subjectId: subject._id, classGroupId: group._id, departmentId: department._id, academicYear: group.academicYear, createdBy: hod._id });
});
afterEach(() => vi.restoreAllMocks());
afterAll(async () => { try { if (mongoose.connection.readyState !== 0) await database.drop(mongoose.connection); } finally { await mongoose.disconnect(); for (const file of await diskFiles()) await fs.unlink(resolve(process.env.COMPLAINT_UPLOAD_DIR, file)); await fs.rmdir(process.env.COMPLAINT_UPLOAD_DIR).catch(err => { if (err.code !== "ENOENT") throw err; }); } });

test("options expose safe paginated academic targets and rules, never handler IDs", async () => {
  const res = await call("get", "/options"); expect(res.status).toBe(200); expect(res.body.data.types).toEqual(Object.values(TYPES)); expect(res.body.data.items[0].id).toBe(String(assignment._id)); expect(res.body.data.attachments).toMatchObject({ maxCount: 3, maxSize: 5242880 }); for (const id of [hod._id, principal._id, student._id]) expect(res.text).not.toContain(String(id));
  expect((await call("get", "/options?page=2&limit=1")).body.data.items).toEqual([]);
});
test.each(Object.values(TYPES))("%s routing/privacy/excluded counts/downloads/neutral notifications are enforced", async type => {
  const item = await create(type, {}, [{ bytes: pdf, name: "PrivateStudent.pdf", mime: "application/pdf" }]);
  const handler = type === "FACULTY_ISSUE" ? faculty : ["AGAINST_FACULTY", "DEPARTMENT_ISSUE"].includes(type) ? hod : principal;
  expect(item.currentHandlerRole).toBe(handler.role); expect(item.priority).toBe(type === "SAFETY_URGENT" ? "URGENT" : "NORMAL"); expect(item.status).toBe("SUBMITTED"); expect(item.timeline[0].actor).toBe("You");
  const stored = await Complaint.findById(item.id).select("+studentId").lean(); expect(String(stored.studentId)).toBe(String(student._id)); expect(stored.events).toHaveLength(1); expect(String(stored.currentHandlerId)).toBe(String(handler._id));
  const res = await call("get", `/${item.id}`, handler); expect(res.status).toBe(200); noLeaks(res); expect(res.body.data.timeline[0].actor).toBe("Anonymous Student"); expect(res.body.data.attachments[0].displayName).toBe("Attachment 1");
  for (const actor of [faculty, otherFaculty, hod, otherHod, principal, otherStudent].filter(actor => String(actor._id) !== String(handler._id))) {
    expect((await call("get", `/${item.id}`, actor)).status).toBe(404); expect((await call("get", `/${item.id}/attachments/${item.attachments[0].id}`, actor)).status).toBe(404);
    const list = await call("get", actor.role === "STUDENT" ? "/mine" : "/inbox", actor); expect(list.body.data.items).toEqual([]); expect(Object.values(await service.counts(actor))).toEqual(expect.arrayContaining([0])); expect((await service.counts(actor))[actor.role === "FACULTY" ? "Assigned Issues" : actor.role === "HOD" ? "Department Complaints" : actor.role === "PRINCIPAL" ? "Assigned Complaints" : "Total Complaints"]).toBe(0);
  }
  const inbox = await call("get", "/inbox", handler); expect(inbox.body.data.items).toHaveLength(1); noLeaks(inbox);
  for (const actor of [student, handler]) { const download = await call("get", `/${item.id}/attachments/${item.attachments[0].id}`, actor); expect(download.status).toBe(200); expect(download.headers["content-type"]).toContain("application/pdf"); expect(download.headers["content-disposition"]).toContain("attachment;"); expect(download.headers["content-disposition"]).not.toContain("PrivateStudent"); expect(download.headers["x-content-type-options"]).toBe("nosniff"); }
  expect((await Notification.find()).map(value => String(value.recipient))).toEqual([String(handler._id)]); const json = JSON.stringify(await Notification.find()); for (const secret of [student.name, student.email, student.userCode, body(type).description, body(type).title]) expect(json).not.toContain(secret);
});
test("Named exposes name/userCode only in complete detail and inbox responses", async () => { const item = await create("FACULTY_ISSUE", { identityMode: "NAMED" }); for (const path of [`/${item.id}`, "/inbox"]) { const res = await call("get", path, faculty), data = path === "/inbox" ? res.body.data.items[0] : res.body.data; expect(data.identity).toEqual({ name: student.name, userCode: student.userCode }); for (const secret of [String(student._id), student.email, "actorId", "passwordHash"]) expect(res.text).not.toContain(secret); } });
test.each(["faculty", "assignment", "subject", "class", "department", "wrong-section", "wrong-semester", "wrong-batch", "foreign-department"])("academic source %s revalidated before Faculty selection", async kind => {
  const model = { faculty: User, assignment: Assignment, subject: Subject, class: Group, department: Department }[kind];
  if (model) await model.updateOne({ _id: { faculty: faculty._id, assignment: assignment._id, subject: subject._id, class: group._id, department: department._id }[kind] }, { isActive: false });
  else { await User.updateOne({ _id: student._id }, kind === "wrong-section" ? { section: "B" } : kind === "wrong-semester" ? { semester: 3 } : kind === "wrong-batch" ? { batch: "2020-2022" } : { departmentId: otherDepartment._id }); student = await User.findById(student._id).select("+tokenVersion"); }
  expect([403, 404]).toContain((await upload(body(), [])).status); expect(await Complaint.countDocuments()).toBe(0);
});
test.each(["faculty", "otherFaculty", "hod", "principal", "foreignFaculty", "unknown", "bad"])("reject arbitrary target %s", async kind => { const foreignFaculty = await account({ role: "FACULTY", departmentId: otherDepartment._id }); const target = { faculty, otherFaculty, hod, principal, foreignFaculty }[kind]?._id || (kind === "bad" ? "bad" : oid()); expect([400, 404]).toContain((await upload(body("FACULTY_ISSUE", { facultyAssignmentId: String(target) }), [])).status); });
test.each(["studentId", "departmentId", "currentHandlerId", "currentHandlerRole", "priority", "status", "targetHodId", "targetFacultyId", "createdAt", "events", "attachments", "unknown"])("reject injected %s", async field => { expect((await call("post", "", student, body("DEPARTMENT_ISSUE", { [field]: "spoof" }))).status).toBe(400); expect(await Complaint.countDocuments()).toBe(0); });
test.each([{ title: "no" }, { title: "x".repeat(151) }, { description: "short" }, { description: "x".repeat(5001) }, { type: "UNKNOWN" }, { identityMode: "UNKNOWN" }, { title: { $ne: null } }])("reject invalid fields %#", async fields => expect((await call("post", "", student, body("DEPARTMENT_ISSUE", fields))).status).toBe(400));
test.each(["title", "description"])("moderates %s before files or database writes", async field => { const res = await upload(body("DEPARTMENT_ISSUE", { [field]: "This is sh1t and requires revision." })); expect(res.status).toBe(400); expect(res.body.message).toBe(REJECTION_MESSAGE); expect(await Complaint.countDocuments()).toBe(0); expect(await diskFiles()).toEqual([]); });
test.each(["HOD", "PRINCIPAL"])("missing/inactive %s fails safely, no file orphan", async role => { const actor = role === "HOD" ? hod : principal; await User.updateOne({ _id: actor._id }, { isActive: false }); expect((await upload(body(role === "HOD" ? "DEPARTMENT_ISSUE" : "COLLEGE_CAMPUS"))).status).toBe(409); expect(await diskFiles()).toEqual([]); });
test("ambiguous Principal configuration fails safely", async () => { await account({ role: "PRINCIPAL" }); expect((await upload(body("COLLEGE_CAMPUS"))).status).toBe(409); });
test("full state machine with immutable original context, resolution and author closure", async () => {
  let item = await create("FACULTY_ISSUE"); const original = await Complaint.findById(item.id).select("+studentId").lean();
  for (const kind of ["start", "resolve", "close"]) expect((await action(item, kind, kind === "close" ? student : faculty, kind === "resolve" ? { resolutionSummary: "Meaningful resolution supplied." } : {})).status).toBe(409);
  item = await act(item, "acknowledge", faculty); item = await act(item, "start", faculty);
  expect((await action(item, "resolve", faculty, {})).status).toBe(400); expect((await action(item, "resolve", faculty, { resolutionSummary: "This resolution is sh1t." })).body.message).toBe(REJECTION_MESSAGE);
  item = await act(item, "resolve", faculty, { resolutionSummary: "The equipment was repaired and verified." }); expect(item.resolvedAt).toBeTruthy(); expect(item.availableActions).toEqual([]);
  expect((await action(item, "close", otherStudent)).status).toBe(404); item = await act(item, "close", student); expect(item.closedAt).toBeTruthy(); expect(item.status).toBe("CLOSED"); expect(item.timeline.map(entry => entry.eventType)).toEqual(["SUBMITTED", "ACKNOWLEDGED", "IN_PROGRESS", "RESOLVED", "CLOSED"]);
  for (const kind of ["acknowledge", "start", "escalate", "resolve"]) expect((await action(item, kind, faculty, kind === "resolve" ? { resolutionSummary: "Resolved again with valid length." } : {})).status).toBe(409);
  const after = await Complaint.findById(item.id).select("+studentId").lean(); for (const field of ["studentId", "departmentId", "type", "targetFacultyId", "identityMode", "initialHandlerId", "createdAt"]) expect(String(after[field])).toBe(String(original[field]));
});
test("Student requests escalation without rerouting; Facultyâ†’HODâ†’Principal grants only actual prior handlers", async () => {
  let item = await create("FACULTY_ISSUE", {}, [{ bytes: png, name: "evidence.png", mime: "image/png" }]);
  expect((await action(item, "escalation-request", student, { reason: "This is sh1t please escalate." })).body.message).toBe(REJECTION_MESSAGE);
  item = await act(item, "escalation-request", student, { reason: "Please review this at the next level." }); expect(item.currentHandlerRole).toBe("FACULTY"); expect(item.escalationRequestedAt).toBeTruthy(); expect((await action(item, "escalation-request", student, { reason: "Another meaningful request reason." })).status).toBe(409);
  item = await act(item, "escalate", faculty); expect(item.currentHandlerRole).toBe("HOD"); expect(item.escalationRequestedAt).toBeNull(); expect(item.escalationLevel).toBe(1); expect((await call("get", `/${item.id}`, faculty)).body.data.readOnly).toBe(true);
  for (const kind of ["acknowledge", "start", "escalate", "priority"]) expect((await action(item, kind, faculty, kind === "priority" ? { priority: "HIGH" } : {})).status).toBe(409);
  expect((await call("get", `/${item.id}/attachments/${item.attachments[0].id}`, faculty)).status).toBe(200); expect((await call("get", `/${item.id}`, principal)).status).toBe(404);
  item = await act(item, "acknowledge", hod); item = await act(item, "start", hod); item = await act(item, "escalate", hod); expect(item.currentHandlerRole).toBe("PRINCIPAL"); expect(item.escalationLevel).toBe(2);
  for (const actor of [faculty, hod]) { const res = await call("get", `/${item.id}`, actor); expect(res.status).toBe(200); noLeaks(res); expect(res.body.data.availableActions).toEqual([]); }
  expect((await action(item, "escalate", principal)).status).toBe(409); expect((await action(item, "escalation-request", student, { reason: "Please escalate beyond this level." })).status).toBe(409);
  item = await act(item, "acknowledge", principal); item = await act(item, "start", principal); item = await act(item, "resolve", principal, { resolutionSummary: "The issue has been reviewed and corrected." }); await act(item, "close", student);
  const notices = await Notification.find().lean(); expect(notices.map(value => String(value.recipient)).sort()).toEqual([faculty._id, faculty._id, student._id, hod._id, student._id, student._id, student._id, principal._id, student._id, student._id, student._id].map(String).sort());
});
test("Against Faculty escalation never authorizes target; Against HOD always bypasses target", async () => {
  let item = await create("AGAINST_FACULTY"); item = await act(item, "escalate", hod); expect((await call("get", `/${item.id}`, faculty)).status).toBe(404); expect((await call("get", "/inbox", faculty)).body.data.items).toEqual([]);
  item = await create("AGAINST_HOD"); expect((await action(item, "escalate", principal)).status).toBe(409); expect((await call("get", `/${item.id}`, hod)).status).toBe(404);
  expect(await Notification.countDocuments({ recipient: faculty._id })).toBe(0); expect(await Notification.countDocuments({ recipient: hod._id })).toBe(1);
});
test("priority only current handler, only raises and every change has an event; safety stays Urgent", async () => {
  let item = await create("FACULTY_ISSUE"); expect((await action(item, "priority", student, { priority: "HIGH" })).status).toBe(403); expect((await action(item, "priority", otherFaculty, { priority: "HIGH" })).status).toBe(404);
  item = await act(item, "priority", faculty, { priority: "HIGH" }); item = await act(item, "priority", faculty, { priority: "URGENT" }); expect(item.timeline.filter(entry => entry.eventType === "PRIORITY_CHANGED")).toHaveLength(2); expect((await action(item, "priority", faculty, { priority: "NORMAL" })).status).toBe(409);
  item = await create("SAFETY_URGENT"); expect(item.availableActions).not.toContain("priority"); expect((await action(item, "priority", principal, { priority: "HIGH" })).status).toBe(409);
});
test.each(["acknowledge", "escalate", "resolve", "close"])("concurrent double %s records only one event and one notification set", async kind => {
  let item = await create("FACULTY_ISSUE"); if (["resolve", "close"].includes(kind)) { item = await act(item, "acknowledge", faculty); item = await act(item, "start", faculty); } if (kind === "close") item = await act(item, "resolve", faculty, { resolutionSummary: "The issue has been fully corrected." });
  const previous = await Complaint.findById(item.id).lean(), count = await Notification.countDocuments();
  const results = await Promise.all([1, 2].map(() => action(item, kind, kind === "close" ? student : faculty, kind === "resolve" ? { resolutionSummary: "The issue has been fully corrected." } : {})));
  expect(results.map(res => res.status).sort()).toEqual([200, 409]); expect((await Complaint.findById(item.id)).events).toHaveLength(previous.events.length + 1); expect(await Notification.countDocuments()).toBe(count + (kind === "escalate" ? 2 : kind === "close" ? 0 : 1));
});
test("competing Resolve/Escalate operations preserve atomic status/history consistency", async () => { let item = await create("FACULTY_ISSUE"); item = await act(item, "acknowledge", faculty); item = await act(item, "start", faculty); const results = await Promise.all([action(item, "resolve", faculty, { resolutionSummary: "The problem has been resolved completely." }), action(item, "escalate", faculty)]); expect(results.map(res => res.status).sort()).toEqual([200, 409]); const stored = await Complaint.findById(item.id); expect(stored.events.at(-1).toStatus).toBe(stored.status); expect(stored.events.at(-1).toHandlerRole).toBe(stored.currentHandlerRole); });
test("notification failures preserve submission and lifecycle atomically", async () => { vi.spyOn(notifications, "createNotification").mockRejectedValue(new Error("sensitive")); vi.spyOn(console, "warn").mockImplementation(() => {}); const res = await upload(body(), []); expect(res.status).toBe(201); expect(res.body.data.notificationDelivery).toEqual({ attempted: 1, delivered: 0 }); const next = await action(res.body.data.item, "acknowledge", faculty); expect(next.status).toBe(200); expect(next.body.data.item.timeline).toHaveLength(2); expect(next.body.data.notificationDelivery.delivered).toBe(0); });
test("failed DB create removes saved files; failed transition records no event or notification", async () => {
  vi.spyOn(Complaint, "create").mockRejectedValueOnce(new Error("database unavailable")); expect((await upload()).status).toBe(500); expect(await diskFiles()).toEqual([]);
  const item = await create("FACULTY_ISSUE"); const count = await Notification.countDocuments(); vi.spyOn(Complaint, "findOneAndUpdate").mockRejectedValueOnce(new Error("write failed")); expect((await action(item, "acknowledge", faculty)).status).toBe(500); expect((await Complaint.findById(item.id)).events).toHaveLength(1); expect(await Notification.countDocuments()).toBe(count);
});
test.each([[pdf, "evidence.pdf", "application/pdf"], [png, "evidence.png", "image/png"], [jpeg, "evidence.jpeg", "image/jpeg"]])("valid evidence %s %s accepted", async (bytes, name, mime) => { const res = await upload(body(), [{ bytes, name, mime }]); expect(res.status).toBe(201); expect(await diskFiles()).toHaveLength(1); });
test.each([[pdf, "evidence.exe", "application/pdf"], [pdf, "evidence.pdf", "image/png"], [png, "evidence.pdf", "application/pdf"], [Buffer.from("<html>bad</html>"), "evidence.png", "image/png"], [Buffer.alloc(0), "empty.pdf", "application/pdf"], [Buffer.alloc(5242881, 1), "large.pdf", "application/pdf"]])("invalid attachment %s %s rejected without files", async (bytes, name, mime) => { expect((await upload(body(), [{ bytes, name, mime }])).status).toBe(400); expect(await diskFiles()).toEqual([]); expect(await Complaint.countDocuments()).toBe(0); });
test("too many files, unexpected multipart fields and duplicate scalar fields reject with cleanup", async () => { expect((await upload(body(), Array.from({ length: 4 }, () => ({ bytes: pdf, name: "file.pdf", mime: "application/pdf" })))).status).toBe(400); expect((await upload({ ...body(), extra: "value" })).status).toBe(400); expect((await call("post", "").field("type", "DEPARTMENT_ISSUE").field("type", "COLLEGE_CAMPUS").field("title", "Valid title").field("description", "Long enough meaningful description.")).status).toBe(400); expect(await diskFiles()).toEqual([]); });
test("path traversal filename is sanitized, stored under generated name, private directory inaccessible", async () => { const res = await upload(body(), [{ bytes: pdf, name: "../../PrivateStudent.pdf", mime: "application/pdf" }]); expect(res.status).toBe(201); expect((await diskFiles())[0]).toMatch(/^[a-f0-9-]{36}\.pdf$/); expect((await request(app).get(`/uploads/complaints/${(await diskFiles())[0]}`)).status).toBe(404); });
test("attachment from another complaint and malformed IDs cannot bypass authorization", async () => { const first = await create("FACULTY_ISSUE", {}, [{ bytes: pdf, name: "file.pdf", mime: "application/pdf" }]), second = await create("DEPARTMENT_ISSUE"); expect((await call("get", `/${second.id}/attachments/${first.attachments[0].id}`)).status).toBe(404); expect((await call("get", "/bad")).status).toBe(400); expect((await call("get", `/${first.id}/attachments/bad`)).status).toBe(400); expect((await call("get", `/${oid()}`)).status).toBe(404); });
test("historical department survives Student transfer; handlers are not silently reassigned or broadened", async () => { const item = await create("FACULTY_ISSUE"); await User.updateOne({ _id: student._id }, { departmentId: otherDepartment._id }); student = await User.findById(student._id).select("+tokenVersion"); expect((await call("get", `/${item.id}`)).status).toBe(200); await User.updateOne({ _id: faculty._id }, { departmentId: otherDepartment._id }); faculty = await User.findById(faculty._id).select("+tokenVersion"); expect((await call("get", `/${item.id}`, faculty)).status).toBe(404); expect((await call("get", `/${item.id}`, otherHod)).status).toBe(404); expect(String((await Complaint.findById(item.id)).departmentId)).toBe(String(department._id)); });
test.each(["/mine?limit=101", "/mine?page=0", "/mine?type=BAD", "/mine?status=BAD", "/mine?priority=BAD", "/mine?studentId=spoof", "/options?limit=101"])("bounded strict query %s", async path => expect((await call("get", path)).status).toBe(400));
test("all role lists paginate/filter inside visibility boundaries; dashboard counts share scope", async () => { await create("FACULTY_ISSUE"); await create("DEPARTMENT_ISSUE"); await create("SAFETY_URGENT"); for (const [actor, path, total] of [[student, "/mine", 3], [faculty, "/inbox", 1], [hod, "/inbox", 1], [principal, "/inbox", 1]]) { const res = await call("get", `${path}?limit=1`, actor); expect(res.body.data.pagination.total).toBe(total); expect(res.body.data.items).toHaveLength(1); expect((await call("get", `${path}?page=10&limit=1`, actor)).body.data.items).toEqual([]); } expect((await call("get", "/mine?status=RESOLVED")).body.data.items).toEqual([]); expect((await call("get", "/inbox?type=FACULTY_ISSUE", hod)).body.data.items).toEqual([]); expect(await service.counts(principal)).toEqual({ "Assigned Complaints": 1, "Urgent Complaints": 1, "Escalated Complaints": 0 }); });
test("auth, RBAC, first-login, inactive and revoked sessions protect complaints and downloads", async () => {
  const item = await create("FACULTY_ISSUE", {}, [{ bytes: pdf, name: "file.pdf", mime: "application/pdf" }]); const paths = ["/mine", `/${item.id}`, `/${item.id}/attachments/${item.attachments[0].id}`]; for (const path of paths) expect((await call("get", path, null)).status).toBe(401);
  for (const actor of [faculty, hod, principal]) expect((await upload(body(), [], actor)).status).toBe(403); expect((await call("get", "/inbox", student)).status).toBe(403);
  const token = signToken(student); await User.updateOne({ _id: student._id }, { mustChangePassword: true }); for (const path of paths) expect((await call("get", path)).status).toBe(403);
  await User.updateOne({ _id: student._id }, { mustChangePassword: false, isActive: false }); for (const path of paths) expect((await call("get", path)).status).toBe(401);
  await User.updateOne({ _id: student._id }, { isActive: true }); expect((await request(app).get(`/api/complaints/${item.id}`).set("Cookie", `cv_auth=${token}`)).status).toBe(401);
});
test("multipart cannot bypass CSRF; no disk files on unauthenticated upload; normal JSON stays bounded", async () => { expect((await request(app).post("/api/complaints").set("Cookie", `cv_auth=${signToken(student)}`).field("type", "DEPARTMENT_ISSUE").attach("attachments", pdf, "file.pdf")).status).toBe(403); expect((await upload(body(), [{ bytes: pdf, name: "file.pdf", mime: "application/pdf" }], null)).status).toBe(401); expect((await call("post", "", student, { ...body(), description: "x".repeat(17000) })).status).toBe(413); expect(await diskFiles()).toEqual([]); });
test("submission and escalation-request limiter bounds per-account spam", async () => { for (let index = 0; index < 30; index++) expect((await call("post", "", student, { invalid: true })).status).toBe(400); expect((await call("post", "", student, body())).status).toBe(429); });
test.each(["STUDENT", "FACULTY", "HOD", "PRINCIPAL"])("%s first-login/inactive/revoked guards also protect detail and evidence", async role => {
  const type = role === "HOD" ? "DEPARTMENT_ISSUE" : role === "PRINCIPAL" ? "COLLEGE_CAMPUS" : "FACULTY_ISSUE";
  const item = await create(type, {}, [{ bytes: pdf, name: "file.pdf", mime: "application/pdf" }]);
  const actor = { STUDENT: student, FACULTY: faculty, HOD: hod, PRINCIPAL: principal }[role];
  const paths = [`/${item.id}`, `/${item.id}/attachments/${item.attachments[0].id}`];
  await User.updateOne({ _id: actor._id }, { mustChangePassword: true });
  for (const path of paths) expect((await call("get", path, actor)).body.code).toBe("PASSWORD_CHANGE_REQUIRED");
  await User.updateOne({ _id: actor._id }, { mustChangePassword: false, isActive: false });
  for (const path of paths) expect((await call("get", path, actor)).status).toBe(401);
  await User.updateOne({ _id: actor._id }, { isActive: true });
  for (const path of paths) expect((await call("get", path, actor)).status).toBe(401);
});
test("escalation requests cannot target another author's, resolved, closed or Principal-level complaints", async () => {
  let item = await create("FACULTY_ISSUE"); const reason = { reason: "Please review this at the next level." };
  expect((await action(item, "escalation-request", otherStudent, reason)).status).toBe(404);
  item = await act(item, "acknowledge", faculty); item = await act(item, "start", faculty); item = await act(item, "resolve", faculty, { resolutionSummary: "The issue was fixed and verified completely." });
  expect((await action(item, "escalation-request", student, reason)).status).toBe(409);
  item = await act(item, "close", student); expect((await action(item, "escalation-request", student, reason)).status).toBe(409);
  for (const type of ["AGAINST_HOD", "COLLEGE_CAMPUS", "SAFETY_URGENT"]) { const direct = await create(type); expect((await action(direct, "escalation-request", student, reason)).status).toBe(409); }
});
test("inactive next authorities do not change current handler, events or pending requests", async () => {
  let item = await create("FACULTY_ISSUE"); item = await act(item, "escalation-request", student, { reason: "Please review at the next level of handling." });
  await User.updateOne({ _id: hod._id }, { isActive: false }); expect((await action(item, "escalate", faculty)).status).toBe(409);
  const stored = await Complaint.findById(item.id); expect(stored.events).toHaveLength(2); expect(stored.escalationRequestedAt).toBeTruthy(); expect(stored.currentHandlerRole).toBe("FACULTY");
});
test("original complaint and events have no generic edit/delete/reveal API", async () => {
  const item = await create("FACULTY_ISSUE");
  for (const method of ["patch", "put", "delete"]) expect((await call(method, `/${item.id}`, student, { title: "Changed title", identityMode: "NAMED", events: [] })).status).toBe(404);
  expect((await call("post", `/${item.id}/reveal`, principal, {})).status).toBe(404);
  const stored = await Complaint.findById(item.id); expect(stored.title).toBe(item.title); expect(stored.identityMode).toBe("ANONYMOUS"); expect(stored.events).toHaveLength(1);
});
