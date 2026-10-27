process.env.NODE_ENV = "test";
process.env.JWT_SECRET = require("crypto").randomBytes(48).toString("hex");
process.env.FRONTEND_ORIGIN = "http://localhost:5173";
process.env.COOKIE_SECURE = "false";
process.env.COOKIE_SAME_SITE = "lax";
const mongoose = require("mongoose");
const request = require("supertest");
const app = require("../app");
const User = require("../models/User");
const { hashPassword } = require("../services/authService");
const { signToken } = require("../middleware/jwt");
const { createTestDatabase } = require("./helpers/testDatabase");
const database = createTestDatabase("profile");
const roles = ["PRINCIPAL", "HOD", "FACULTY", "STUDENT"];
let passwordHash;
beforeAll(async () => {
  await mongoose.connect(database.uri, { serverSelectionTimeoutMS: 5000 });
  database.assertConnection(mongoose.connection);
  await User.init();
  passwordHash = await hashPassword("Temporary_123!");
});
beforeEach(async () => { database.assertConnection(mongoose.connection); await User.deleteMany({}); });
afterAll(async () => {
  try { if (mongoose.connection.readyState !== 0) await database.drop(mongoose.connection); }
  finally { await mongoose.disconnect(); }
});
const createUser = (overrides = {}) => User.create({ name: "Profile User", userCode: "profile.user", role: "STUDENT", passwordHash, mustChangePassword: false, ...overrides });
const fetchProfile = user => request(app).get("/api/profile").set("Cookie", `cv_auth=${signToken(user)}`);

test.each(roles)("%s logs in and retrieves only safe own-profile fields", async role => {
  const created = await createUser({ role, email: "profile@example.edu", semester: 3, section: "B", departmentId: new mongoose.Types.ObjectId() });
  const agent = request.agent(app);
  const login = await agent.post("/api/auth/login").set("Origin", process.env.FRONTEND_ORIGIN).set("X-CSRF-Protection", "1")
    .send({ userCode: created.userCode, password: "Temporary_123!" });
  expect(login.status).toBe(200);
  const res = await agent.get("/api/profile");
  expect(res.status).toBe(200);
  expect(res.headers["cache-control"]).toBe("no-store");
  expect(res.body.success).toBe(true);
  expect(res.body.data).toEqual({
    name: created.name, userCode: created.userCode, role, email: "profile@example.edu", isActive: true,
    departmentId: String(created.departmentId), semester: 3, section: "B",
    lastLoginAt: expect.any(String), createdAt: created.createdAt.toISOString(),
  });
  for (const key of ["passwordHash", "tokenVersion", "token", "jwt", "jwtSecret", "cookie", "temporaryPassword", "passwordResetToken", "passwordChangedAt", "mustChangePassword", "__v"]) {
    expect(res.body.data).not.toHaveProperty(key);
  }
  expect(res.headers["set-cookie"]).toBeUndefined();
});
test("unauthenticated request receives 401", async () => {
  expect((await request(app).get("/api/profile")).status).toBe(401);
});
test("query/body IDs cannot select another user and no ID route exists", async () => {
  const own = await createUser();
  const other = await createUser({ name: "Other User", userCode: "other.user" });
  const cookie = `cv_auth=${signToken(own)}`;
  const res = await request(app).get(`/api/profile?userId=${other._id}`).set("Cookie", cookie).send({ userId: String(other._id) });
  expect(res.status).toBe(200);
  expect(res.body.data.name).toBe(own.name);
  expect(res.body.data.userCode).toBe(own.userCode);
  expect((await request(app).get(`/api/profile/${other._id}`).set("Cookie", cookie)).status).toBe(404);
});
test("missing optional data returns neutral nulls", async () => {
  const res = await fetchProfile(await createUser());
  expect(res.status).toBe(200);
  for (const field of ["email", "departmentId", "semester", "section", "lastLoginAt"]) expect(res.body.data[field]).toBeNull();
});
test("deactivated, reactivated and deleted accounts cannot reuse their sessions", async () => {
  const user = await createUser();
  await User.updateOne({ _id: user._id }, { isActive: false });
  expect((await fetchProfile(user)).status).toBe(401);
  await User.updateOne({ _id: user._id }, { isActive: true });
  expect((await fetchProfile(user)).status).toBe(401);
  await User.deleteOne({ _id: user._id });
  expect((await fetchProfile(user)).status).toBe(401);
});
test("first-login restriction is preserved on the profile business route", async () => {
  const res = await fetchProfile(await createUser({ mustChangePassword: true }));
  expect(res.status).toBe(403);
  expect(res.body.code).toBe("PASSWORD_CHANGE_REQUIRED");
});
test("logout revokes profile access", async () => {
  const user = await createUser();
  await request(app).post("/api/auth/logout").set("Cookie", `cv_auth=${signToken(user)}`)
    .set("Origin", process.env.FRONTEND_ORIGIN).set("X-CSRF-Protection", "1").expect(204);
  expect((await fetchProfile(user)).status).toBe(401);
});
const patchProfile = (user, body) => request(app).patch("/api/profile").set("Cookie", `cv_auth=${signToken(user)}`)
  .set("Origin", process.env.FRONTEND_ORIGIN).set("X-CSRF-Protection", "1").send(body);

test.each(roles)("%s may update own name and email with a safe persisted response", async role => {
  const user = await createUser({ role });
  const res = await patchProfile(user, { name: "  Updated नाम  ", email: "  Person@Example.EDU  " });
  expect(res.status).toBe(200);
  expect(res.headers["cache-control"]).toBe("no-store");
  expect(res.body.data).toEqual({ ...(await fetchProfile(user)).body.data, name: "Updated नाम", email: "person@example.edu" });
  const saved = await User.findById(user._id).select("+passwordHash +tokenVersion");
  expect(saved.name).toBe("Updated नाम"); expect(saved.email).toBe("person@example.edu");
  expect(saved.passwordHash).toBe(passwordHash); expect(saved.tokenVersion).toBe(0);
  expect(Object.keys(res.body.data).sort()).toEqual(["name", "userCode", "email", "role", "isActive", "departmentId", "semester", "section", "lastLoginAt", "createdAt"].sort());
  expect((await request(app).get("/api/auth/me").set("Cookie", `cv_auth=${signToken(user)}`)).body.data.name).toBe(saved.name);
});
test.each([{ name: "New Name" }, { email: "new@example.edu" }])("supports partial updates %j", async fields => {
  const user = await createUser({ email: "original@example.edu" });
  const res = await patchProfile(user, fields);
  expect(res.status).toBe(200);
  expect(res.body.data.name).toBe(fields.name || user.name);
  expect(res.body.data.email).toBe(fields.email || user.email);
});
test.each([{}, [], { name: "" }, { name: "   " }, { name: "A" }, { name: "a".repeat(121) }, { name: null }, { name: {} },
  { email: "invalid" }, { email: "a@@example.edu" }, { email: 12 }, { email: {} }])("rejects invalid input without changing data %#", async fields => {
  const user = await createUser();
  expect((await patchProfile(user, fields)).status).toBe(400);
  expect((await User.findById(user._id)).name).toBe(user.name);
});
test.each(["role", "userCode", "isActive", "departmentId", "department", "semester", "section", "mustChangePassword", "tokenVersion", "passwordHash", "password", "createdAt", "lastLoginAt", "userId", "_id", "$set", "unknown"])("rejects mixed requests containing %s atomically", async field => {
  const user = await createUser();
  const before = await User.findById(user._id).select("+passwordHash +tokenVersion").lean();
  expect((await patchProfile(user, { name: "Changed", [field]: "protected" })).status).toBe(400);
  expect(await User.findById(user._id).select("+passwordHash +tokenVersion").lean()).toEqual(before);
});
test("duplicate normalized email returns a clean conflict; own email is allowed", async () => {
  await createUser({ userCode: "other.user", email: "taken@example.edu" });
  const user = await createUser({ email: "own@example.edu" });
  const res = await patchProfile(user, { name: "Must not change", email: " TAKEN@Example.edu " });
  expect(res.status).toBe(409); expect(res.body.message).toBe("This email address is already in use.");
  expect(res.body.stack).toBeUndefined(); expect(JSON.stringify(res.body)).not.toContain("E11000");
  expect((await User.findById(user._id)).name).toBe(user.name);
  expect((await patchProfile(user, { email: " OWN@Example.EDU " })).status).toBe(200);
});
test("concurrent claims to an email have only one winner", async () => {
  const first = await createUser();
  const second = await createUser({ userCode: "second.user" });
  const results = await Promise.all([patchProfile(first, { email: "race@example.edu" }), patchProfile(second, { email: " RACE@EXAMPLE.EDU " })]);
  expect(results.map(res => res.status).sort()).toEqual([200, 409]);
  expect(await User.countDocuments({ email: "race@example.edu" })).toBe(1);
});
test.each([null, "", "   "])("optional email can be cleared with %j", async email => {
  const user = await createUser({ email: "own@example.edu" });
  const res = await patchProfile(user, { email });
  expect(res.status).toBe(200); expect(res.body.data.email).toBeNull();
  expect((await User.findById(user._id)).email).toBeUndefined();
  await createUser({ userCode: "other.user", email: "own@example.edu" });
});
test("optional email index allows multiple missing, null and empty values", async () => {
  for (let i = 0; i < 6; i++) await createUser({ userCode: `optional.${i}`, email: [undefined, null, ""][i % 3] });
  expect(await User.countDocuments()).toBe(6);
});
test("PATCH requires authentication and CSRF", async () => {
  await request(app).patch("/api/profile").set("Origin", process.env.FRONTEND_ORIGIN).set("X-CSRF-Protection", "1").send({ name: "Changed" }).expect(401);
  const user = await createUser();
  for (const origin of [undefined, "https://evil.example"]) {
    let req = request(app).patch("/api/profile").set("Cookie", `cv_auth=${signToken(user)}`).set("X-CSRF-Protection", "1");
    if (origin) req = req.set("Origin", origin);
    expect((await req.send({ name: "Changed" })).status).toBe(403);
  }
  await request(app).patch("/api/profile").set("Cookie", `cv_auth=${signToken(user)}`).set("Origin", process.env.FRONTEND_ORIGIN).send({ name: "Changed" }).expect(403);
  expect((await User.findById(user._id)).name).toBe(user.name);
});
test("inactive, revoked and forced-password sessions cannot update", async () => {
  const user = await createUser();
  await User.updateOne({ _id: user._id }, { isActive: false });
  expect((await patchProfile(user, { name: "Changed" })).status).toBe(401);
  await User.updateOne({ _id: user._id }, { isActive: true });
  expect((await patchProfile(user, { name: "Changed" })).status).toBe(401);
  const forced = await createUser({ userCode: "forced.user", mustChangePassword: true });
  expect((await patchProfile(forced, { name: "Changed" })).body.code).toBe("PASSWORD_CHANGE_REQUIRED");
  expect((await User.findById(user._id)).name).toBe(user.name);
});
test("service rechecks security changes between authentication and the write", async () => {
  const user = await createUser();
  await User.updateOne({ _id: user._id }, { $inc: { tokenVersion: 1 } });
  await expect(require("../services/profileService").updateProfile(user, { name: "Changed" })).rejects.toMatchObject({ statusCode: 401 });
  expect((await User.findById(user._id)).name).toBe(user.name);
});
test("another user cannot be targeted by query, body or path", async () => {
  const user = await createUser(); const other = await createUser({ userCode: "other.user" });
  await request(app).patch(`/api/profile?userId=${other._id}`).set("Cookie", `cv_auth=${signToken(user)}`)
    .set("Origin", process.env.FRONTEND_ORIGIN).set("X-CSRF-Protection", "1").send({ name: "Own new name" }).expect(200);
  expect((await User.findById(other._id)).name).toBe(other.name);
  expect((await patchProfile(user, { userId: String(other._id), name: "Changed" })).status).toBe(400);
  await request(app).patch(`/api/profile/${other._id}`).set("Cookie", `cv_auth=${signToken(user)}`)
    .set("Origin", process.env.FRONTEND_ORIGIN).set("X-CSRF-Protection", "1").send({ name: "Changed" }).expect(404);
});
