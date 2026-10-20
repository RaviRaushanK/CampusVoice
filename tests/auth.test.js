process.env.NODE_ENV = "test";
process.env.JWT_SECRET = require("crypto").randomBytes(48).toString("hex");
process.env.FRONTEND_ORIGIN = "http://localhost:5173";
process.env.COOKIE_SECURE = "false";
process.env.COOKIE_SAME_SITE = "lax";
process.env.TRUST_PROXY_HOPS = "0";
const mongoose = require("mongoose");
const express = require("express");
const cookieParser = require("cookie-parser");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const app = require("../app");
const env = require("../config/env");
const User = require("../models/User");
const { hashPassword } = require("../services/authService");
const { seedPrincipal } = require("../seeders/seedPrincipal");
const { protect } = require("../middleware/authMiddleware");
const { requireRole } = require("../middleware/roleMiddleware");
const errorHandler = require("../middleware/errorHandler");
const { ROLES } = require("../utils/constants/roles");
const { createTestDatabase } = require("./helpers/testDatabase");
const database = createTestDatabase("auth");
const roles = Object.values(ROLES);
const password = "Temporary_123!";
const nextPassword = "Changed_456!";
const origin = env.frontendOrigin;
const fixtureApp = express();
fixtureApp.use(cookieParser());
for (const role of roles) fixtureApp.get(`/test/${role}`, protect, requireRole(role), (req, res) => res.json({ role: req.user.role }));
fixtureApp.use(errorHandler);
let agent, passwordHash;
beforeAll(async () => {
  await mongoose.connect(database.uri, { serverSelectionTimeoutMS: 5000 });
  database.assertConnection(mongoose.connection);
  await User.init();
  passwordHash = await hashPassword(password);
});
afterAll(async () => {
  try { if (mongoose.connection.readyState !== 0) await database.drop(mongoose.connection); }
  finally { await mongoose.disconnect(); }
});
beforeEach(async () => { database.assertConnection(mongoose.connection); await User.deleteMany({}); agent = request.agent(app); });
const createUser = (overrides = {}) => User.create({ name: "Test Principal", userCode: "principal1", passwordHash, role: "PRINCIPAL", mustChangePassword: false, ...overrides });
const post = (path, body, client = agent) => client.post(`/api/auth/${path}`).set("Origin", origin).set("X-CSRF-Protection", "1").send(body);
const login = (userCode = "principal1", pass = password) => post("login", { userCode, password: pass });
const cookieOf = response => response.headers["set-cookie"].find(value => value.startsWith("cv_auth=")).split(";")[0];

test("Principal login normalizes codes, creates expiring HTTP-only cookie, and returns a safe profile", async () => {
  await createUser();
  const res = await login("  PRINCIPAL1  ");
  expect(res.status).toBe(200);
  expect(res.body.data.role).toBe("PRINCIPAL");
  for (const key of ["passwordHash", "tokenVersion", "token", "jwtSecret"]) expect(res.body.data[key]).toBeUndefined();
  expect(res.body.token).toBeUndefined();
  expect(res.headers["set-cookie"][0]).toMatch(/HttpOnly/);
  expect(res.headers["set-cookie"][0]).toMatch(/SameSite=Lax/);
  expect(res.headers["set-cookie"][0]).toMatch(/Expires=/);
  expect(res.headers["cache-control"]).toBe("no-store");
  expect((await User.findOne()).lastLoginAt).toBeInstanceOf(Date);
});
test("URL-encoded login is parsed before authentication validation", async () => {
  await createUser();
  const res = await agent.post("/api/auth/login").set("Origin", origin).set("X-CSRF-Protection", "1")
    .type("form").send({ userCode: " PRINCIPAL1 ", password });
  expect(res.status).toBe(200);
  expect(res.body.data.userCode).toBe("principal1");
  expect(res.headers["set-cookie"][0]).toContain("HttpOnly");
  expect((await agent.get("/api/auth/me")).status).toBe(200);
});
test("URL-encoded login still requires CSRF protection and respects the body limit", async () => {
  const rejected = await agent.post("/api/auth/login").set("Origin", origin).type("form").send({ userCode: "principal1", password });
  expect(rejected.status).toBe(403);
  expect(rejected.body.code).toBe("CSRF_REJECTED");
  const oversized = await agent.post("/api/auth/login").set("Origin", origin).set("X-CSRF-Protection", "1")
    .type("form").send({ userCode: "principal1", password: "x".repeat(17000) });
  expect(oversized.status).toBe(413);
  expect(oversized.body.message).toBe("Request body too large.");
});
test("unknown account and wrong password return the same generic error", async () => {
  await createUser();
  const wrong = await login("principal1", "Wrong_123!");
  const missing = await login("missing1");
  expect(wrong.status).toBe(401); expect(missing.status).toBe(401);
  expect(wrong.body.message).toBe(missing.body.message);
  expect(wrong.body.stack).toBeUndefined();
});
test("inactive account cannot log in", async () => {
  await createUser({ isActive: false });
  expect((await login()).status).toBe(401);
});
test.each([{}, { userCode: {}, password }, { userCode: "bad code", password }, { userCode: "principal1", password: [] }])("rejects malformed login input %j", async body => {
  expect((await post("login", body)).status).toBe(400);
});
test("current-user endpoint restores the session and hides sensitive fields", async () => {
  await createUser(); await login();
  const res = await agent.get("/api/auth/me");
  expect(res.status).toBe(200); expect(res.body.data.userCode).toBe("principal1");
  expect(res.body.data.passwordHash).toBeUndefined(); expect(res.body.data.tokenVersion).toBeUndefined();
});
test("unauthenticated requests receive 401", async () => {
  expect((await request(app).get("/api/auth/me")).status).toBe(401);
  expect((await request(fixtureApp).get("/test/PRINCIPAL")).status).toBe(401);
});
test("logout clears cookie and invalidates captured sessions, including sessions in other tabs", async () => {
  await createUser(); const cookie = cookieOf(await login());
  const res = await post("logout");
  expect(res.status).toBe(204);
  expect(res.headers["set-cookie"][0]).toMatch(/Expires=Thu, 01 Jan 1970/);
  expect((await request(app).get("/api/auth/me").set("Cookie", cookie)).status).toBe(401);
  expect((await agent.get("/api/auth/me")).status).toBe(401);
});
test.each(["invalid", "expired", "futureVersion", "wrongRole"])("rejects %s token", async kind => {
  const user = await createUser();
  const token = kind === "invalid" ? "broken" : jwt.sign({ tokenVersion: kind === "futureVersion" ? 9 : 0, role: kind === "wrongRole" ? "HOD" : "PRINCIPAL" }, env.jwtSecret, {
    subject: String(user._id), expiresIn: kind === "expired" ? -1 : 3600, issuer: "campusvoice", audience: "campusvoice-web",
  });
  expect((await request(app).get("/api/auth/me").set("Cookie", `cv_auth=${token}`)).status).toBe(401);
});
test("deactivation and role changes reject previously authenticated sessions", async () => {
  const user = await createUser(); const cookie = cookieOf(await login());
  await User.updateOne({ _id: user._id }, { isActive: false });
  expect((await request(app).get("/api/auth/me").set("Cookie", cookie)).status).toBe(401);
  await User.updateOne({ _id: user._id }, { isActive: true });
  expect((await request(app).get("/api/auth/me").set("Cookie", cookie)).status).toBe(401);
  await User.updateOne({ _id: user._id }, { role: "STUDENT" });
  expect((await request(app).get("/api/auth/me").set("Cookie", cookie)).status).toBe(401);
});
test.each(roles)("%s may access only its own role API", async role => {
  await createUser({ role }); const cookie = cookieOf(await login());
  for (const target of roles) expect((await request(fixtureApp).get(`/test/${target}`).set("Cookie", cookie)).status).toBe(target === role ? 200 : 403);
});
test("first-login restriction blocks normal APIs but permits me, password change and logout", async () => {
  await createUser({ mustChangePassword: true }); const cookie = cookieOf(await login());
  const res = await request(fixtureApp).get("/test/PRINCIPAL").set("Cookie", cookie);
  expect(res.status).toBe(403); expect(res.body.code).toBe("PASSWORD_CHANGE_REQUIRED");
  expect((await agent.get("/api/auth/me")).body.data.mustChangePassword).toBe(true);
  expect((await post("logout")).status).toBe(204);
});
test("first password change clears restriction, rotates tokens, and establishes a usable new session", async () => {
  await createUser({ mustChangePassword: true }); const oldCookie = cookieOf(await login());
  const changed = await post("change-password", { currentPassword: password, newPassword: nextPassword, confirmPassword: nextPassword });
  expect(changed.status).toBe(200); expect(changed.body.data.mustChangePassword).toBe(false);
  expect((await agent.get("/api/auth/me")).status).toBe(200);
  expect((await request(fixtureApp).get("/test/PRINCIPAL").set("Cookie", cookieOf(changed))).status).toBe(200);
  expect((await request(app).get("/api/auth/me").set("Cookie", oldCookie)).status).toBe(401);
  expect((await login()).status).toBe(401);
  expect((await login("principal1", nextPassword)).status).toBe(200);
  expect((await User.findOne()).passwordChangedAt).toBeInstanceOf(Date);
});
test.each([
  { currentPassword: "Incorrect_123!", newPassword: nextPassword, confirmPassword: nextPassword },
  { currentPassword: password, newPassword: "weak", confirmPassword: "weak" },
  { currentPassword: password, newPassword: password, confirmPassword: password },
  { currentPassword: password, newPassword: nextPassword, confirmPassword: "mismatch" },
  { currentPassword: password, newPassword: "Aa1!" + "\u00e9".repeat(40), confirmPassword: "Aa1!" + "\u00e9".repeat(40) },
])("rejects invalid password changes without rotating the session %#", async body => {
  await createUser(); await login();
  expect((await post("change-password", body)).status).toBe(400);
  expect((await agent.get("/api/auth/me")).status).toBe(200);
});
test("password changes require authentication", async () => {
  expect((await post("change-password", {})).status).toBe(401);
});
test.each(["login", "logout", "change-password"])("CSRF blocks missing/untrusted origins and missing headers on %s", async endpoint => {
  for (const forgedOrigin of [undefined, "https://evil.example", "null"]) {
    let req = agent.post(`/api/auth/${endpoint}`).set("X-CSRF-Protection", "1");
    if (forgedOrigin) req = req.set("Origin", forgedOrigin);
    expect((await req.send({})).status).toBe(403);
  }
  expect((await agent.post(`/api/auth/${endpoint}`).set("Origin", origin).send({ _csrf: "anything" })).status).toBe(403);
});
test("CORS grants credentials and custom header only to the exact trusted origin", async () => {
  const trusted = await request(app).options("/api/auth/login").set("Origin", origin);
  expect(trusted.headers["access-control-allow-origin"]).toBe(origin);
  expect(trusted.headers["access-control-allow-credentials"]).toBe("true");
  expect(trusted.headers["access-control-allow-headers"]).toContain("X-CSRF-Protection");
  const evil = await request(app).options("/api/auth/login").set("Origin", "https://evil.example");
  expect(evil.headers["access-control-allow-origin"]).toBeUndefined();
});
test("bootstrap creates one hashed Principal; repeated/different-code runs preserve credentials", async () => {
  const settings = { PRINCIPAL_NAME: "Bootstrap Principal", PRINCIPAL_USER_CODE: "  FIRST.ADMIN ", PRINCIPAL_EMAIL: " ADMIN@TEST.EXAMPLE ", PRINCIPAL_PASSWORD: password };
  expect((await seedPrincipal(settings)).created).toBe(true);
  const user = await User.findOne().select("+passwordHash");
  expect(user.passwordHash).not.toBe(password); expect(user.email).toBe("admin@test.example");
  expect(user.mustChangePassword).toBe(true);
  expect((await login("first.admin")).status).toBe(200);
  const { promisify } = require("util");
  const { execFile } = require("child_process");
  const cli = await promisify(execFile)(process.execPath, ["seeders/seedPrincipal.js"], {
    env: database.subprocessEnv(settings), timeout: 15000,
  });
  expect(cli.stdout).toContain("Principal already exists");
  expect((await seedPrincipal({ ...settings, PRINCIPAL_USER_CODE: "another.admin", PRINCIPAL_PASSWORD: nextPassword })).created).toBe(false);
  expect(await User.countDocuments()).toBe(1);
  expect((await User.findOne().select("+passwordHash")).passwordHash).toBe(user.passwordHash);
});
test("user model normalizes codes and enforces unique codes, roles, and hashes", async () => {
  await createUser({ userCode: " Mixed.Code " });
  expect((await User.findOne()).userCode).toBe("mixed.code");
  await expect(createUser({ userCode: "MIXED.CODE" })).rejects.toMatchObject({ code: 11000 });
  await expect(createUser({ role: "ADMIN" })).rejects.toThrow();
  await expect(createUser({ passwordHash: "plaintext" })).rejects.toThrow();
});
test("document security changes increment a previously hidden token version atomically", async () => {
  const user = await createUser({ tokenVersion: 7 });
  const document = await User.findById(user._id);
  document.isActive = false; await document.save();
  expect((await User.findById(user._id).select("+tokenVersion")).tokenVersion).toBe(8);
});
test("malformed JSON and internal errors never expose request data or stacks", async () => {
  const res = await agent.post("/api/auth/login").set("Origin", origin).set("X-CSRF-Protection", "1").set("Content-Type", "application/json").send('{"password":"sensitive", invalid}');
  expect(res.status).toBe(400); expect(res.body.message).toBe("Invalid JSON request body.");
  expect(JSON.stringify(res.body)).not.toContain("sensitive"); expect(res.body.stack).toBeUndefined();
});
test("health endpoint is unchanged", async () => {
  const res = await request(app).get("/api/health");
  expect(res.status).toBe(200); expect(res.body.message).toBe("CampusVoice API is running");
});
test("a real occupied HTTP port exits cleanly after connecting only to the isolated database", async () => {
  const { createServer } = require("node:net");
  const { execFile } = require("node:child_process");
  const { promisify } = require("node:util");
  const blocker = createServer();
  await new Promise((resolve, reject) => {
    blocker.once("error", reject);
    blocker.listen(0, resolve);
  });
  try {
    let failure;
    try {
      await promisify(execFile)(process.execPath, ["server.js"], {
        env: database.subprocessEnv({ PORT: String(blocker.address().port) }), timeout: 15000,
      });
    } catch (err) { failure = err; }
    expect(failure).toBeDefined();
    expect(failure.code).toBe(1);
    expect(failure.stdout).toContain("MongoDB connected");
    expect(failure.stdout).not.toContain("API running");
    expect(failure.stderr).toContain("already in use (EADDRINUSE)");
    expect(failure.stderr).not.toMatch(/Unhandled|throw er|at startServer/);
    database.assertConnection(mongoose.connection);
  } finally { await new Promise(resolve => blocker.close(resolve)); }
});
test("login rate limiting rejects repeated attempts without trusting spoofed forwarding headers", async () => {
  let res;
  for (let index = 0; index < 12; index++) res = await post("login", { userCode: "missing1", password });
  expect(res.status).toBe(429);
});
