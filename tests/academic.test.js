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
const { signToken } = require("../middleware/jwt");
const { hashPassword } = require("../services/authService");
const { createTestDatabase } = require("./helpers/testDatabase");
const database = createTestDatabase("academic");
const password = "Temporary_123!";
let hash, principal, hodA, hodB, departmentA, departmentB;
beforeAll(async () => {
  await mongoose.connect(database.uri, { serverSelectionTimeoutMS: 5000 }); database.assertConnection(mongoose.connection);
  await Promise.all([User.init(), Department.init(), Subject.init(), ClassGroup.init(), Assignment.init()]);
  hash = await hashPassword(password);
});
beforeEach(async () => {
  database.assertConnection(mongoose.connection);
  for (const model of [Assignment, Subject, ClassGroup, User, Department]) await model.deleteMany({});
  principal = await User.create({ name: "Principal", userCode: "principal", role: "PRINCIPAL", passwordHash: hash, mustChangePassword: false });
  departmentA = await Department.create({ name: "Department A", code: "MCA", createdBy: principal._id });
  departmentB = await Department.create({ name: "Department B", code: "CSE", createdBy: principal._id });
  [hodA, hodB] = await User.create([departmentA, departmentB].map((department, index) => ({ name: `HOD ${index}`, userCode: `hod.${index}`, role: "HOD", departmentId: department._id, passwordHash: hash, mustChangePassword: false })));
});
afterAll(async () => { try { if (mongoose.connection.readyState !== 0) await database.drop(mongoose.connection); } finally { await mongoose.disconnect(); } });
const call = (method, path, user = principal, body) => {
  let req = request(app)[method](`/api/${path}`).set("Origin", process.env.FRONTEND_ORIGIN).set("X-CSRF-Protection", "1");
  if (user) req = req.set("Cookie", `cv_auth=${signToken(user)}`);
  return body === undefined ? req : req.send(body);
};
const account = (role = "FACULTY", department = departmentA, overrides = {}) => User.create({ name: "Faculty Person", userCode: `user.${new mongoose.Types.ObjectId()}`, role, departmentId: department._id, passwordHash: hash, mustChangePassword: false, ...overrides });
const subject = (department = departmentA, overrides = {}) => Subject.create({ name: "Data Structures", code: "MMC201", departmentId: department._id, semester: 2, createdBy: hodA._id, ...overrides });
const group = (department = departmentA, overrides = {}) => ClassGroup.create({ departmentId: department._id, semester: 2, section: "A", academicYear: "2026-2027", createdBy: hodA._id, ...overrides });
const provision = (overrides = {}) => ({ name: "New Person", userCode: "new.person", email: "new@example.edu", initialPassword: password, ...overrides });
const safeUser = data => { for (const field of ["passwordHash", "tokenVersion", "initialPassword", "passwordChangedAt", "mustChangePassword", "__v"]) expect(data).not.toHaveProperty(field); };
const assignmentFields = async () => ({ facultyId: String((await account())._id), subjectId: String((await subject())._id), classGroupId: String((await group())._id), academicYear: "2026-2027" });

describe("Departments", () => {
  test("Principal creates, normalizes, edits and retires a department without deleting dependents", async () => {
    const created = await call("post", "departments", principal, { name: "  Information Science ", code: " ise ", description: " Description " });
    expect(created.status).toBe(201); expect(created.body.data).toMatchObject({ code: "ISE", name: "Information Science", description: "Description", isActive: true });
    expect((await call("post", "departments", principal, { name: "Duplicate", code: "ISE" })).status).toBe(409);
    expect((await call("patch", `departments/${departmentA._id}`, principal, { name: "Changed", isActive: false })).status).toBe(200);
    expect(await User.countDocuments({ departmentId: departmentA._id })).toBe(1);
    expect((await call("get", "subjects", hodA)).status).toBe(403);
    await call("patch", `departments/${departmentA._id}`, principal, { isActive: true }).expect(200);
  });
  test.each(["HOD", "FACULTY", "STUDENT"])("%s cannot create or modify departments", async role => {
    const user = role === "HOD" ? hodA : await account(role);
    expect((await call("post", "departments", user, { name: "Blocked", code: "BLK" })).status).toBe(403);
    expect((await call("patch", `departments/${departmentA._id}`, user, { name: "Blocked" })).status).toBe(403);
  });
  test("HOD reads only own department; Principal sees both", async () => {
    expect((await call("get", "departments", hodA)).body.data.items.map(d => d.id)).toEqual([String(departmentA._id)]);
    expect((await call("get", `departments/${departmentB._id}`, hodA)).status).toBe(404);
    expect((await call("get", "departments", principal)).body.data.pagination.total).toBe(2);
  });
  test.each([{ name: " " , code: "X" }, { name: "Valid", code: "bad code" }, { name: "Valid", code: "x", createdBy: "injected" }])("rejects malformed department fields %#", async fields => {
    expect((await call("post", "departments", principal, fields)).status).toBe(400);
  });
});
describe("Account provisioning", () => {
  test("Principal provisions an HOD with a hashed temporary password and forced password change", async () => {
    await User.updateOne({ _id: hodA._id }, { isActive: false });
    const res = await call("post", "hods", principal, provision({ departmentId: String(departmentA._id) }));
    expect(res.status).toBe(201); safeUser(res.body.data);
    expect(res.body.data).toMatchObject({ role: "HOD", departmentId: String(departmentA._id) });
    const saved = await User.findById(res.body.data.id).select("+passwordHash");
    expect(saved.passwordHash).not.toBe(password); expect(saved.mustChangePassword).toBe(true);
    const agent = request.agent(app);
    await agent.post("/api/auth/login").set("Origin", process.env.FRONTEND_ORIGIN).set("X-CSRF-Protection", "1").send({ userCode: saved.userCode, password }).expect(200);
    expect((await agent.get("/api/subjects")).body.code).toBe("PASSWORD_CHANGE_REQUIRED");
    await agent.post("/api/auth/change-password").set("Origin", process.env.FRONTEND_ORIGIN).set("X-CSRF-Protection", "1").send({ currentPassword: password, newPassword: "Changed_456!", confirmPassword: "Changed_456!" }).expect(200);
    expect((await agent.get("/api/subjects")).status).toBe(200);
  });
  test("database uniqueness allows only one concurrent active HOD per department", async () => {
    await User.updateOne({ _id: hodA._id }, { isActive: false });
    const results = await Promise.all([call("post", "hods", principal, provision({ departmentId: String(departmentA._id), userCode: "hod.new1", email: "one@example.edu" })), call("post", "hods", principal, provision({ departmentId: String(departmentA._id), userCode: "hod.new2", email: "two@example.edu" }))]);
    expect(results.map(res => res.status).sort()).toEqual([201, 409]);
    expect(await User.countDocuments({ role: "HOD", departmentId: departmentA._id, isActive: true })).toBe(1);
  });
  test("HOD department reassignment invalidates existing cookies", async () => {
    await User.updateOne({ _id: hodB._id }, { isActive: false });
    expect((await call("patch", `hods/${hodA._id}`, principal, { departmentId: String(departmentB._id) })).status).toBe(200);
    expect((await call("get", "subjects", hodA)).status).toBe(401);
  });
  test("HOD provisioning respects email/user-code uniqueness and reactivation cannot create two active HODs", async () => {
    const department = await Department.create({ code: "NEW", name: "New Department", createdBy: principal._id });
    await User.updateOne({ _id: principal._id }, { email: "taken@example.edu" });
    expect((await call("post", "hods", principal, provision({ departmentId: String(department._id), userCode: hodA.userCode }))).status).toBe(409);
    expect((await call("post", "hods", principal, provision({ departmentId: String(department._id), email: " TAKEN@EXAMPLE.EDU " }))).status).toBe(409);
    await call("patch", `hods/${hodA._id}`, principal, { isActive: false }).expect(200);
    await call("post", "hods", principal, provision({ departmentId: String(departmentA._id) })).expect(201);
    expect((await call("patch", `hods/${hodA._id}`, principal, { isActive: true })).status).toBe(409);
  });
  test.each(["HOD", "FACULTY", "STUDENT"])("%s cannot provision HODs", async role => {
    expect((await call("post", "hods", role === "HOD" ? hodA : await account(role), provision({ departmentId: String(departmentA._id) }))).status).toBe(403);
  });
  test.each([{}, { departmentId: "bad" }, { departmentId: new mongoose.Types.ObjectId().toString() }, { departmentId: "", initialPassword: "weak" }])("HOD provisioning validates required department/password %#", async fields => {
    expect((await call("post", "hods", principal, provision(fields))).status).toBe(400);
  });
  test.each(["faculty", "students"])("HOD creates and safely updates own %s account", async path => {
    const res = await call("post", path, hodA, provision(path === "students" ? { userCode: "  1MV25MC061 ", semester: 2, section: " a ", batch: "2025-2027" } : {}));
    expect(res.status).toBe(201); safeUser(res.body.data);
    expect(res.body.data.departmentId).toBe(String(departmentA._id)); expect(res.body.data.role).toBe(path === "faculty" ? "FACULTY" : "STUDENT");
    if (path === "students") expect(res.body.data).toMatchObject({ userCode: "1mv25mc061", semester: 2, section: "A", batch: "2025-2027" });
    expect((await call("patch", `${path}/${res.body.data.id}`, hodA, { name: "Updated Name", email: " OTHER@EXAMPLE.EDU " })).body.data.email).toBe("other@example.edu");
    expect((await call("get", `${path}/${res.body.data.id}`, hodB)).status).toBe(404);
    expect((await call("patch", `${path}/${res.body.data.id}`, hodB, { name: "Foreign change" })).status).toBe(404);
  });
  test.each(["faculty", "students"])("%s account uniqueness and email clearing follow existing User rules", async path => {
    const fields = provision(path === "students" ? { semester: 1 } : {});
    expect((await call("post", path, hodA, fields)).status).toBe(201);
    expect((await call("post", path, hodA, { ...fields, userCode: " NEW.PERSON ", email: "unique@example.edu" })).status).toBe(409);
    expect((await call("post", path, hodA, { ...fields, userCode: "different", email: " NEW@EXAMPLE.EDU " })).status).toBe(409);
    const created = await User.findOne({ userCode: "new.person" });
    expect((await call("patch", `${path}/${created._id}`, hodA, { email: null })).body.data.email).toBeNull();
  });
  test.each(["role", "departmentId", "tokenVersion", "passwordHash", "mustChangePassword", "createdAt"])("rejects %s injection into Faculty/Student creation", async field => {
    for (const path of ["faculty", "students"]) {
      expect((await call("post", path, hodA, provision({ ...(path === "students" ? { semester: 2 } : {}), [field]: field === "role" ? "PRINCIPAL" : String(departmentB._id) }))).status).toBe(400);
    }
    expect(await User.countDocuments({ role: "PRINCIPAL" })).toBe(1);
  });
  test.each(["role", "departmentId", "tokenVersion", "passwordHash", "mustChangePassword", "initialPassword", "userCode"])("rejects mixed valid/protected %s changes atomically", async field => {
    const faculty = await account(); const before = await User.findById(faculty._id).select("+passwordHash +tokenVersion").lean();
    expect((await call("patch", `faculty/${faculty._id}`, hodA, { name: "Forbidden mixed change", [field]: "injected" })).status).toBe(400);
    expect(await User.findById(faculty._id).select("+passwordHash +tokenVersion").lean()).toEqual(before);
  });
  test.each([0, 5, 100, 1.5, "2"])("rejects invalid MCA semester %j", async semester => {
    expect((await call("post", "students", hodA, provision({ semester }))).status).toBe(400);
  });
  test.each([{ section: "a bad" }, { section: "A".repeat(11) }, { batch: "2025-27" }, { batch: "2025-2026" }])("rejects invalid student academic fields %#", async fields => {
    expect((await call("post", "students", hodA, provision({ semester: 2, ...fields }))).status).toBe(400);
  });
  test("student listing filters and paginates in MongoDB without exposing other departments", async () => {
    await account("STUDENT", departmentA, { name: "Search Person", userCode: "student.a", semester: 2, section: "A" });
    await account("STUDENT", departmentA, { userCode: "student.b", semester: 1 });
    await account("STUDENT", departmentB, { userCode: "student.c", semester: 2, section: "A" });
    const res = await call("get", "students?search=SEARCH&semester=2&section=a&limit=1", hodA);
    expect(res.body.data.items).toHaveLength(1); expect(res.body.data.items[0].userCode).toBe("student.a");
    expect(res.body.data.pagination).toMatchObject({ total: 1, limit: 1 }); safeUser(res.body.data.items[0]);
    expect((await call("get", "students?limit=1&page=2", hodA)).body.data.pagination).toMatchObject({ total: 2, hasPreviousPage: true, hasNextPage: false });
    expect((await call("get", "students?search=.*", hodA)).body.data.pagination.total).toBe(0);
  });
  test.each(["PRINCIPAL", "FACULTY", "STUDENT"])("%s cannot manage Faculty/Student accounts", async role => {
    const user = role === "PRINCIPAL" ? principal : await account(role);
    for (const path of ["faculty", "students"]) {
      expect((await call("get", path, user)).status).toBe(403);
      expect((await call("post", path, user, provision({ semester: 2 }))).status).toBe(403);
    }
  });
  test("deactivating Faculty revokes login/profile access while preserving assignments", async () => {
    const fields = await assignmentFields(); await call("post", "faculty-assignments", hodA, fields).expect(201);
    const faculty = await User.findById(fields.facultyId).select("+tokenVersion");
    await call("patch", `faculty/${faculty._id}`, hodA, { isActive: false }).expect(200);
    expect((await call("get", "profile", faculty)).status).toBe(401);
    await request(app).post("/api/auth/login").set("Origin", process.env.FRONTEND_ORIGIN).set("X-CSRF-Protection", "1").send({ userCode: faculty.userCode, password }).expect(401);
    expect(await Assignment.countDocuments()).toBe(1);
  });
});
describe("Subjects and class groups", () => {
  test("HOD creates normalized curriculum, edits it and deactivates without deletion", async () => {
    const s = await call("post", "subjects", hodA, { name: " Data Structures ", code: " mmc201 ", semester: 2 });
    expect(s.status).toBe(201); expect(s.body.data.code).toBe("MMC201");
    expect((await call("post", "subjects", hodA, { name: "Duplicate", code: "MMC201", semester: 2 })).status).toBe(409);
    expect((await call("post", "subjects", hodB, { name: "Other dept", code: "MMC201", semester: 2 })).status).toBe(201);
    const c = await call("post", "classes", hodA, { semester: 2, section: " a ", academicYear: "2026-2027", batch: "2025-2027" });
    expect(c.status).toBe(201); expect(c.body.data.section).toBe("A");
    expect((await call("post", "classes", hodA, { semester: 2, section: "A", academicYear: "2026-2027" })).status).toBe(409);
    expect((await call("patch", `subjects/${s.body.data.id}`, hodA, { name: "Updated Subject", isActive: false })).body.data.isActive).toBe(false);
    expect((await call("patch", `classes/${c.body.data.id}`, hodA, { section: "B", isActive: false })).body.data.section).toBe("B");
    expect((await call("get", "subjects?semester=2&search=updated", hodA)).body.data.pagination.total).toBe(1);
    expect((await call("get", "classes?academicYear=2026-2027&section=b", hodA)).body.data.pagination.total).toBe(1);
  });
  test.each(["subjects", "classes"])("%s access is department-scoped and rejects department injection", async path => {
    const item = path === "subjects" ? await subject(departmentB) : await group(departmentB);
    expect((await call("get", `${path}/${item._id}`, hodA)).status).toBe(404);
    expect((await call("patch", `${path}/${item._id}`, hodA, { isActive: false })).status).toBe(404);
    expect((await call("post", path, hodA, { departmentId: String(departmentB._id), name: "Blocked", code: "BLOCK", semester: 2, academicYear: "2026-2027" })).status).toBe(400);
  });
  test.each(["2026-27", "2026-2028", "year", "1999-2000"])("rejects invalid academic year %s", async academicYear => {
    expect((await call("post", "classes", hodA, { semester: 2, section: "A", academicYear })).status).toBe(400);
  });
  test("referenced academic identities cannot be silently rewritten", async () => {
    const fields = await assignmentFields(); await call("post", "faculty-assignments", hodA, fields).expect(201);
    expect((await call("patch", `subjects/${fields.subjectId}`, hodA, { semester: 3 })).status).toBe(409);
    expect((await call("patch", `classes/${fields.classGroupId}`, hodA, { academicYear: "2027-2028" })).status).toBe(409);
    expect((await call("patch", `classes/${fields.classGroupId}`, hodA, { isActive: false })).status).toBe(200);
    expect((await call("get", "faculty-assignments", hodA)).body.data.items[0].isUsable).toBe(false);
  });
});
describe("Faculty assignments", () => {
  test("valid assignment is visible only to owner Faculty and HOD", async () => {
    const fields = await assignmentFields(); const res = await call("post", "faculty-assignments", hodA, fields);
    expect(res.status).toBe(201); expect(res.body.data.isUsable).toBe(true);
    const faculty = await User.findById(fields.facultyId).select("+tokenVersion");
    const otherFaculty = await account();
    expect((await call("get", "faculty-assignments/mine", faculty)).body.data.items[0].id).toBe(res.body.data.id);
    expect((await call("get", "faculty-assignments/mine", otherFaculty)).body.data.items).toEqual([]);
    expect((await call("get", `faculty-assignments/${res.body.data.id}`, hodB)).status).toBe(404);
    expect((await call("patch", `faculty-assignments/${res.body.data.id}`, hodB, { isActive: false })).status).toBe(404);
    expect((await Assignment.findById(res.body.data.id)).isActive).toBe(true);
    expect((await call("patch", `faculty-assignments/${res.body.data.id}`, faculty, { isActive: false })).status).toBe(403);
    expect((await call("post", "faculty-assignments", await account("STUDENT"), fields)).status).toBe(403);
  });
  test.each(["facultyId", "subjectId", "classGroupId"])("cross-department %s is rejected", async field => {
    const fields = await assignmentFields();
    fields[field] = String((field === "facultyId" ? await account("FACULTY", departmentB) : field === "subjectId" ? await subject(departmentB) : await group(departmentB))._id);
    expect((await call("post", "faculty-assignments", hodA, fields)).status).toBe(400);
    expect(await Assignment.countDocuments()).toBe(0);
  });
  test.each(["facultyId", "subjectId", "classGroupId"])("inactive %s cannot receive a new assignment", async field => {
    const fields = await assignmentFields(); const model = field === "facultyId" ? User : field === "subjectId" ? Subject : ClassGroup;
    await model.updateOne({ _id: fields[field] }, { isActive: false });
    expect((await call("post", "faculty-assignments", hodA, fields)).status).toBe(400);
  });
  test("semester and academic year must match the class", async () => {
    const fields = await assignmentFields();
    expect((await call("post", "faculty-assignments", hodA, { ...fields, academicYear: "2027-2028" })).status).toBe(400);
    await Subject.updateOne({ _id: fields.subjectId }, { semester: 3 });
    expect((await call("post", "faculty-assignments", hodA, fields)).status).toBe(400);
  });
  test("duplicate active assignments conflict, history survives and reactivation is checked", async () => {
    const fields = await assignmentFields(); const first = await call("post", "faculty-assignments", hodA, fields);
    expect((await call("post", "faculty-assignments", hodA, fields)).status).toBe(409);
    await call("patch", `faculty-assignments/${first.body.data.id}`, hodA, { isActive: false }).expect(200);
    expect((await call("post", "faculty-assignments", hodA, fields)).status).toBe(201);
    expect((await call("patch", `faculty-assignments/${first.body.data.id}`, hodA, { isActive: true })).status).toBe(409);
    expect(await Assignment.countDocuments()).toBe(2);
    expect((await call("patch", `faculty-assignments/${first.body.data.id}`, hodA, { facultyId: fields.facultyId })).status).toBe(400);
  });
  test("assignment usability reflects current department/semester integrity", async () => {
    const fields = await assignmentFields(); const created = await call("post", "faculty-assignments", hodA, fields);
    await Subject.updateOne({ _id: fields.subjectId }, { semester: 3 });
    expect((await call("get", `faculty-assignments/${created.body.data.id}`, hodA)).body.data.isUsable).toBe(false);
    await Subject.updateOne({ _id: fields.subjectId }, { semester: 2 });
    await User.updateOne({ _id: fields.facultyId }, { departmentId: departmentB._id });
    expect((await call("get", `faculty-assignments/${created.body.data.id}`, hodA)).body.data.isUsable).toBe(false);
  });
});
describe("Security and dashboards", () => {
  test.each(["departments", "hods", "faculty", "students", "subjects", "classes", "faculty-assignments"])("%s requires auth, CSRF, controlled IDs and bounded pagination", async path => {
    expect((await call("get", path, null)).status).toBe(401);
    const user = ["departments", "hods"].includes(path) ? principal : hodA;
    expect((await call("get", `${path}/invalid`, user)).status).toBe(400);
    expect((await call("get", `${path}?limit=101`, user)).status).toBe(400);
    expect((await call("get", `${path}?page=-1`, user)).status).toBe(400);
    expect((await call("get", `${path}?departmentId=${departmentB._id}`, user)).status).toBe(400);
    await request(app).post(`/api/${path}`).set("Cookie", `cv_auth=${signToken(user)}`).send({}).expect(403);
  });
  test.each(["inactive", "revoked", "first-login"])("%s sessions cannot use academic routes", async state => {
    const old = signToken(hodA);
    if (state === "inactive") await User.updateOne({ _id: hodA._id }, { isActive: false });
    if (state === "revoked") await User.updateOne({ _id: hodA._id }, { $inc: { tokenVersion: 1 } });
    if (state === "first-login") await User.updateOne({ _id: hodA._id }, { mustChangePassword: true });
    expect((await request(app).get("/api/students").set("Cookie", `cv_auth=${old}`)).status).toBe(state === "first-login" ? 403 : 401);
  });
  test("real dashboard counts are scoped and Student gets only own academic information", async () => {
    await account("FACULTY"); const student = await account("STUDENT", departmentA, { semester: 2, section: "A", batch: "2025-2027" });
    await account("STUDENT", departmentB); await subject(); await group();
    expect((await call("get", "academic/dashboard", principal)).body.data.metrics).toEqual({ Departments: 2, "Active HODs": 2, Faculty: 1, Students: 2, "Assigned Complaints": 0, "Urgent Complaints": 0, "Escalated Complaints": 0 });
    expect((await call("get", "academic/dashboard", hodA)).body.data.metrics).toEqual({ Faculty: 1, Students: 1, Subjects: 1, "Class Groups": 1, "Active Assignments": 0, "Department Complaints": 0, "Pending Complaints": 0, "Escalation Requests": 0 });
    expect((await call("get", "academic/dashboard", student)).body.data).toMatchObject({ department: { code: "MCA" }, semester: 2, section: "A", batch: "2025-2027" });
    expect((await call("get", "students", student)).status).toBe(403);
  });
});

describe("Scoped academic dropdown options", () => {
  test("returns unique class years and sections only inside the HOD department", async () => {
    await group(departmentA, { section: "A", academicYear: "2026-2027" });
    await group(departmentA, { section: "B", academicYear: "2026-2027" });
    await group(departmentA, { section: "C", academicYear: "2025-2026", isActive: false });
    await group(departmentB, { section: "Z", academicYear: "2029-2030" });
    const all = await call("get", "academic/options?resource=classes", hodA);
    expect(all.status).toBe(200); expect(all.headers["cache-control"]).toBe("no-store");
    expect(all.body.data).toEqual({ academicYears: ["2025-2026", "2026-2027"], sections: ["A", "B", "C"] });
    const active = await call("get", "academic/options?resource=classes&status=active", hodA);
    expect(active.body.data).toEqual({ academicYears: ["2026-2027"], sections: ["A", "B"] });
    expect(all.text).not.toContain(String(departmentA._id)); expect(all.text).not.toContain("2029-2030");
  });
  test("Student section filters include retained history but exclude other departments and roles", async () => {
    await account("STUDENT", departmentA, { section: "A" }); await account("STUDENT", departmentA, { section: "D", isActive: false });
    await account("FACULTY", departmentA, { section: "Y" }); await account("STUDENT", departmentB, { section: "Z" });
    const result = await call("get", "academic/options?resource=students", hodA);
    expect(result.body.data).toEqual({ academicYears: [], sections: ["A", "D"] });
  });
  test("assignment years respect both HOD department and Faculty ownership", async () => {
    const own = await account(), other = await account(), foreign = await account("FACULTY", departmentB);
    for (const [faculty, department, year] of [[own, departmentA, "2026-2027"], [other, departmentA, "2027-2028"], [foreign, departmentB, "2028-2029"]]) {
      const sub = await subject(department, { code: "M" + year.slice(0, 4) }), cls = await group(department, { academicYear: year });
      await Assignment.create({ facultyId: faculty._id, subjectId: sub._id, classGroupId: cls._id, academicYear: year, departmentId: department._id, createdBy: hodA._id });
    }
    expect((await call("get", "academic/options?resource=faculty-assignments", hodA)).body.data.academicYears).toEqual(["2026-2027", "2027-2028"]);
    expect((await call("get", "academic/options?resource=faculty-assignments/mine", own)).body.data.academicYears).toEqual(["2026-2027"]);
    expect((await call("get", "academic/options?resource=classes", own)).status).toBe(403);
  });
  test.each(["resource[$ne]=classes", "resource=classes&status[$ne]=active", "resource=classes&departmentId=other", "resource=unknown"])("rejects unsupported option query %s", async query => {
    expect((await call("get", "academic/options?" + query, hodA)).status).toBe(400);
  });
  test("options reject unauthenticated, Student and Principal access", async () => {
    for (const actor of [null, principal, await account("STUDENT")]) expect((await call("get", "academic/options?resource=classes", actor)).status).toBe(actor ? 403 : 401);
  });
});
