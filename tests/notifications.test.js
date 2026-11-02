process.env.NODE_ENV = "test";
process.env.JWT_SECRET = require("crypto").randomBytes(48).toString("hex");
process.env.FRONTEND_ORIGIN = "http://localhost:5173";
process.env.COOKIE_SECURE = "false";
process.env.COOKIE_SAME_SITE = "lax";
const mongoose = require("mongoose");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const app = require("../app");
const env = require("../config/env");
const User = require("../models/User");
const Notification = require("../models/Notification");
const service = require("../services/notificationService");
const { hashPassword } = require("../services/authService");
const { signToken } = require("../middleware/jwt");
const { NOTIFICATION_TYPES, RESOURCE_TYPES } = require("../utils/constants/notifications");
const { createTestDatabase } = require("./helpers/testDatabase");
const database = createTestDatabase("notify");
const basePath = "/api/notifications";
const safeKeys = ["id", "type", "title", "message", "isRead", "readAt", "relatedResourceType", "relatedResourceId", "createdAt"].sort();
const originalReadAt = new Date("2026-10-20T09:00:00Z");
let passwordHash, userA, userB;

beforeAll(async () => {
  await mongoose.connect(database.uri, { serverSelectionTimeoutMS: 5000 });
  database.assertConnection(mongoose.connection);
  await Promise.all([User.init(), Notification.init()]);
  passwordHash = await hashPassword("Temporary_123!");
});
beforeEach(async () => {
  database.assertConnection(mongoose.connection);
  await Notification.deleteMany({});
  await User.deleteMany({});
  [userA, userB] = await User.create([
    { name: "User A", userCode: "notification.a", role: "STUDENT", passwordHash, mustChangePassword: false },
    { name: "User B", userCode: "notification.b", role: "FACULTY", passwordHash, mustChangePassword: false },
  ]);
});
afterEach(() => vi.restoreAllMocks());
afterAll(async () => {
  try { if (mongoose.connection.readyState !== 0) await database.drop(mongoose.connection); }
  finally { await mongoose.disconnect(); }
});

const creation = (overrides = {}) => ({ recipient: userA._id, type: "SYSTEM", title: "Test title", message: "Test message", ...overrides });
const notice = overrides => Notification.create(creation(overrides));
const cookie = (user = userA) => `cv_auth=${signToken(user)}`;
const get = (path = "", user = userA) => request(app).get(`${basePath}${path}`).set("Cookie", cookie(user));
const patch = (path, user = userA, body) => {
  const req = request(app).patch(`${basePath}${path}`).set("Cookie", cookie(user)).set("Origin", env.frontendOrigin).set("X-CSRF-Protection", "1");
  return body === undefined ? req : req.send(body);
};
const routeCases = () => [
  ["get", ""], ["get", "/unread-count"], ["patch", `/${new mongoose.Types.ObjectId()}/read`], ["patch", "/read-all"],
];
const callRoute = (method, path, authCookie) => {
  let req = request(app)[method](`${basePath}${path}`);
  if (authCookie) req = req.set("Cookie", authCookie);
  return req.set("Origin", env.frontendOrigin).set("X-CSRF-Protection", "1");
};

test.each(Object.values(NOTIFICATION_TYPES))("internal creation supports %s and returns safe defaults", async type => {
  const result = await service.createNotification(creation({ type, title: "  Title  ", message: "  Message  " }));
  expect(Object.keys(result).sort()).toEqual(safeKeys);
  expect(result).toMatchObject({ type, title: "Title", message: "Message", isRead: false, readAt: null, relatedResourceType: null, relatedResourceId: null });
  const saved = await Notification.findById(result.id);
  expect(String(saved.recipient)).toBe(String(userA._id));
  expect(saved.createdAt).toBeInstanceOf(Date); expect(saved.updatedAt).toBeInstanceOf(Date);
});
test.each(["recipient", "type", "title", "message"])("creation requires %s", async field => {
  await expect(service.createNotification(creation({ [field]: undefined }))).rejects.toMatchObject({ statusCode: 400 });
  expect(await Notification.countDocuments()).toBe(0);
});
test.each([
  { recipient: "bad-id" }, { recipient: 42 }, { recipient: {} }, { type: "ARBITRARY" }, { type: {} },
  { title: "  " }, { message: "  " }, { title: 123 }, { message: [] }, { title: "x".repeat(161) }, { message: "x".repeat(2001) },
  { relatedResourceType: "DEPARTMENT" }, { relatedResourceId: "bad-id", relatedResourceType: "PROFILE" },
  { relatedResourceId: new mongoose.Types.ObjectId() }, { isRead: true }, { readAt: new Date() }, { url: "/fake" },
])("creation rejects malformed or unsupported input %#", async overrides => {
  await expect(service.createNotification(creation(overrides))).rejects.toMatchObject({ statusCode: 400 });
  expect(await Notification.countDocuments()).toBe(0);
});
test("creation rejects missing input and a nonexistent recipient", async () => {
  await expect(service.createNotification()).rejects.toMatchObject({ statusCode: 400 });
  await expect(service.createNotification(creation({ recipient: new mongoose.Types.ObjectId() }))).rejects.toMatchObject({ statusCode: 400, message: "Notification recipient is unavailable." });
});
test.each(Object.values(RESOURCE_TYPES))("related resource %s does not need an existing target model", async relatedResourceType => {
  const relatedResourceId = new mongoose.Types.ObjectId();
  const result = await service.createNotification(creation({ relatedResourceType, relatedResourceId }));
  expect(String(result.relatedResourceId)).toBe(String(relatedResourceId));
  expect(result.relatedResourceType).toBe(relatedResourceType);
});
test("a related resource type may be supplied without an ID", async () => {
  const result = await service.createNotification(creation({ relatedResourceType: "SYSTEM" }));
  expect(result.relatedResourceType).toBe("SYSTEM"); expect(result.relatedResourceId).toBeNull();
});
test.each([
  { recipient: null }, { type: null }, { title: " " }, { message: " " }, { title: "x".repeat(161) }, { message: "x".repeat(2001) },
  { type: "UNKNOWN" }, { relatedResourceId: "bad" }, { relatedResourceId: new mongoose.Types.ObjectId() },
  { isRead: true }, { readAt: new Date() },
])("the model independently validates invalid fields %#", async fields => {
  await expect(new Notification(creation(fields)).validate()).rejects.toBeInstanceOf(mongoose.Error.ValidationError);
});

test.each(["PRINCIPAL", "HOD", "FACULTY", "STUDENT"])("%s can use every notification operation with an authenticated cookie", async role => {
  userA.role = role; await userA.save();
  const agent = request.agent(app);
  await agent.post("/api/auth/login").set("Origin", env.frontendOrigin).set("X-CSRF-Protection", "1")
    .send({ userCode: userA.userCode, password: "Temporary_123!" }).expect(200);
  const item = await notice();
  expect((await agent.get(basePath)).body.data.notifications.map(n => n.id)).toEqual([String(item._id)]);
  expect((await agent.get(`${basePath}/unread-count`)).body.data.count).toBe(1);
  await agent.patch(`${basePath}/${item._id}/read`).set("Origin", env.frontendOrigin).set("X-CSRF-Protection", "1").expect(200);
  await agent.patch(`${basePath}/read-all`).set("Origin", env.frontendOrigin).set("X-CSRF-Protection", "1").expect(200);
});
test("listing returns only own notifications, newest first with safe fields", async () => {
  const older = await notice({ createdAt: new Date("2026-10-20T00:00:00Z") });
  const newer = await notice({ createdAt: new Date("2026-10-21T00:00:00Z") });
  await notice({ recipient: userB._id });
  const res = await get();
  expect(res.status).toBe(200); expect(res.headers["cache-control"]).toBe("no-store");
  expect(res.body.data.notifications.map(n => n.id)).toEqual([String(newer._id), String(older._id)]);
  for (const item of res.body.data.notifications) expect(Object.keys(item).sort()).toEqual(safeKeys);
  expect(res.body.data.pagination).toEqual({ page: 1, limit: 20, total: 2, totalPages: 1, hasNextPage: false, hasPreviousPage: false });
});
test("equal creation dates use descending ID as deterministic ordering", async () => {
  const createdAt = new Date("2026-10-20T00:00:00Z");
  const ids = ["000000000000000000000001", "000000000000000000000003", "000000000000000000000002"];
  await Notification.insertMany(ids.map(_id => creation({ _id, createdAt })));
  expect((await get()).body.data.notifications.map(item => item.id)).toEqual([...ids].sort().reverse());
});
test("default and custom pagination are bounded and have correct metadata", async () => {
  await Notification.insertMany(Array.from({ length: 25 }, (_, i) => creation({ title: `Item ${i}`, createdAt: new Date(1700000000000 + i * 1000) })));
  const first = (await get()).body.data;
  expect(first.notifications).toHaveLength(20);
  expect(first.notifications[0].title).toBe("Item 24");
  expect(first.pagination).toEqual({ page: 1, limit: 20, total: 25, totalPages: 2, hasNextPage: true, hasPreviousPage: false });
  const second = (await get("?page=2&limit=10")).body.data;
  expect(second.notifications).toHaveLength(10); expect(second.notifications[0].title).toBe("Item 14");
  expect(second.pagination).toEqual({ page: 2, limit: 10, total: 25, totalPages: 3, hasNextPage: true, hasPreviousPage: true });
  const last = (await get("?page=3&limit=10")).body.data;
  expect(last.notifications).toHaveLength(5); expect(last.pagination.hasNextPage).toBe(false);
  const beyond = (await get("?page=4&limit=10")).body.data;
  expect(beyond.notifications).toEqual([]); expect(beyond.pagination.hasPreviousPage).toBe(true);
  expect((await get("?limit=100")).body.data.notifications).toHaveLength(25);
});
test.each(["page=0", "page=-1", "page=1.5", "page=abc", "page=", "page=1000001", "page=9007199254740992",
  "limit=0", "limit=-1", "limit=1.5", "limit=abc", "limit=", "limit=101", "limit=1000000", "limit=1&limit=2",
  "page[]=1", "status=unknown", "status=", "status[$ne]=read", "status=read&status=unread", "userId=other", "recipient=other", "sort=oldest"])("rejects unsupported/malformed query %s", async query => {
  const res = await get(`?${query}`);
  expect(res.status).toBe(400); expect(res.body.stack).toBeUndefined();
});
test.each([["all", 3], ["unread", 2], ["read", 1]])("status=%s filters own results and totals", async (status, expected) => {
  await notice(); await notice(); await notice({ isRead: true, readAt: originalReadAt });
  await notice({ recipient: userB._id });
  const res = await get(`?status=${status}`);
  expect(res.body.data.notifications).toHaveLength(expected);
  expect(res.body.data.pagination.total).toBe(expected);
  if (status !== "all") for (const item of res.body.data.notifications) expect(item.isRead).toBe(status === "read");
});
test("empty list and zero unread count have neutral responses", async () => {
  await notice({ recipient: userB._id });
  const res = await get();
  expect(res.body.data).toEqual({ notifications: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0, hasNextPage: false, hasPreviousPage: false } });
  expect((await get("/unread-count")).body).toEqual({ success: true, data: { count: 0 } });
});
test("unread count excludes read records and other users", async () => {
  await notice(); await notice(); await notice({ isRead: true, readAt: originalReadAt });
  await notice({ recipient: userB._id });
  const res = await get("/unread-count");
  expect(res.status).toBe(200); expect(res.body.data.count).toBe(2);
});

test("owner marks one read; repeated and concurrent requests preserve the first readAt", async () => {
  const item = await notice();
  const results = await Promise.all([patch(`/${item._id}/read`), patch(`/${item._id}/read`)]);
  for (const res of results) {
    expect(res.status).toBe(200); expect(res.body.data.isRead).toBe(true);
    expect(Object.keys(res.body.data).sort()).toEqual(safeKeys);
  }
  expect(results[0].body.data.readAt).toBe(results[1].body.data.readAt);
  const saved = await Notification.findById(item._id);
  expect(saved.readAt).toBeInstanceOf(Date);
  const repeated = await patch(`/${item._id}/read`);
  expect(repeated.body.data.readAt).toBe(saved.readAt.toISOString());
  expect((await Notification.findById(item._id)).updatedAt).toEqual(saved.updatedAt);
  expect((await get("/unread-count")).body.data.count).toBe(0);
});
test("IDOR: User A cannot modify User B's notification; unavailable IDs reveal no ownership", async () => {
  await notice();
  const other = await notice({ recipient: userB._id });
  const before = await Notification.findById(other._id).lean();
  const denied = await patch(`/${other._id}/read`);
  const missing = await patch(`/${new mongoose.Types.ObjectId()}/read`);
  expect(denied.status).toBe(404); expect(missing.status).toBe(404);
  expect(denied.body).toEqual(missing.body);
  expect(denied.body.message).toBe("Notification unavailable.");
  expect(await Notification.findById(other._id).lean()).toEqual(before);
});
test.each(["invalid", "123", "z".repeat(24)])("malformed notification ID %s has a controlled error", async id => {
  const res = await patch(`/${id}/read`);
  expect(res.status).toBe(400); expect(res.body.message).toBe("Invalid notification identifier.");
  expect(res.body.stack).toBeUndefined();
});
test("mark-all scopes unread records by owner and preserves already-read timestamps", async () => {
  const unread = await notice(); const unread2 = await notice();
  const read = await notice({ isRead: true, readAt: originalReadAt });
  const other = await notice({ recipient: userB._id });
  const readBefore = await Notification.findById(read._id).lean();
  const otherBefore = await Notification.findById(other._id).lean();
  const res = await patch("/read-all");
  expect(res.status).toBe(200); expect(res.body.data.modifiedCount).toBe(2);
  const first = await Notification.findById(unread._id); const second = await Notification.findById(unread2._id);
  expect(first.isRead).toBe(true); expect(first.readAt).toBeInstanceOf(Date); expect(first.readAt).toEqual(second.readAt);
  expect(await Notification.findById(read._id).lean()).toEqual(readBefore);
  expect(await Notification.findById(other._id).lean()).toEqual(otherBefore);
  expect((await patch("/read-all")).body.data.modifiedCount).toBe(0);
  expect((await Notification.findById(unread._id)).readAt).toEqual(first.readAt);
});
test("mark-all with no own notifications is safe", async () => {
  await notice({ recipient: userB._id });
  expect((await patch("/read-all")).body).toEqual({ success: true, data: { modifiedCount: 0 } });
});
test("read requests cannot edit notification content, recipient or timestamps", async () => {
  const item = await notice();
  for (const path of [`/${item._id}/read`, "/read-all"]) {
    expect((await patch(path, userA, { title: "Forged", recipient: String(userB._id), readAt: originalReadAt })).status).toBe(400);
    expect((await patch(`${path}?userId=${userB._id}`)).status).toBe(400);
  }
  expect((await Notification.findById(item._id)).isRead).toBe(false);
  expect((await Notification.findById(item._id)).title).toBe(item.title);
});

test.each([["get", ""], ["get", "/unread-count"], ["patch", "/000000000000000000000001/read"], ["patch", "/read-all"]])("unauthenticated %s %s receives 401", async (method, path) => {
  expect((await callRoute(method, path)).status).toBe(401);
});
test.each(["/000000000000000000000001/read", "/read-all"])("CSRF applies to %s", async path => {
  for (const origin of [undefined, "https://evil.example", "null"]) {
    let req = request(app).patch(`${basePath}${path}`).set("Cookie", cookie()).set("X-CSRF-Protection", "1");
    if (origin) req = req.set("Origin", origin);
    expect((await req).body.code).toBe("CSRF_REJECTED");
  }
  const res = await request(app).patch(`${basePath}${path}`).set("Cookie", cookie()).set("Origin", env.frontendOrigin).send({ _csrf: "fake" });
  expect(res.status).toBe(403); expect(res.body.code).toBe("CSRF_REJECTED");
});
test.each(["inactive", "revoked", "reactivated", "role-changed", "deleted", "forced-password"])("%s account cannot use any notification operation", async state => {
  const authCookie = cookie();
  if (state === "inactive" || state === "reactivated") await User.updateOne({ _id: userA._id }, { isActive: false });
  if (state === "reactivated") await User.updateOne({ _id: userA._id }, { isActive: true });
  if (state === "revoked") await User.updateOne({ _id: userA._id }, { $inc: { tokenVersion: 1 } });
  if (state === "role-changed") await User.updateOne({ _id: userA._id }, { role: "PRINCIPAL" });
  if (state === "deleted") await User.deleteOne({ _id: userA._id });
  if (state === "forced-password") await User.updateOne({ _id: userA._id }, { mustChangePassword: true });
  const item = await notice();
  for (const [method, path] of routeCases()) {
    const res = await callRoute(method, path, authCookie);
    expect(res.status).toBe(state === "forced-password" ? 403 : 401);
    if (state === "forced-password") expect(res.body.code).toBe("PASSWORD_CHANGE_REQUIRED");
  }
  expect((await Notification.findById(item._id)).isRead).toBe(false);
});
test.each(["invalid", "expired"])("%s JWT cannot retrieve notifications", async kind => {
  const token = kind === "invalid" ? "broken" : jwt.sign({ tokenVersion: 0, role: userA.role }, env.jwtSecret, {
    subject: String(userA._id), expiresIn: -1, issuer: "campusvoice", audience: "campusvoice-web",
  });
  expect((await callRoute("get", "", `cv_auth=${token}`)).status).toBe(401);
});
test("logout invalidates previously captured notification cookies", async () => {
  const authCookie = cookie();
  await request(app).post("/api/auth/logout").set("Cookie", authCookie).set("Origin", env.frontendOrigin).set("X-CSRF-Protection", "1").expect(204);
  expect((await callRoute("get", "", authCookie)).status).toBe(401);
});
test("no public creation, deletion, or content-update endpoint exists", async () => {
  const item = await notice();
  for (const [method, path] of [["post", ""], ["delete", `/${item._id}`], ["patch", `/${item._id}`]]) {
    expect((await callRoute(method, path, cookie()).send({ title: "Forged" })).status).toBe(404);
  }
  expect(await Notification.countDocuments()).toBe(1);
  expect((await Notification.findById(item._id)).title).toBe(item.title);
});
test("database errors use centralized safe error handling", async () => {
  vi.spyOn(Notification, "countDocuments").mockRejectedValueOnce(new Error("sensitive MongoDB connection details"));
  const res = await get("/unread-count");
  expect(res.status).toBe(500);
  expect(res.body).toEqual({ success: false, message: "Internal server error" });
});
test("unread count cannot accept a recipient query", async () => {
  expect((await get(`/unread-count?recipient=${userB._id}`)).status).toBe(400);
});
