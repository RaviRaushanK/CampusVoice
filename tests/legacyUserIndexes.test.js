process.env.NODE_ENV = "test";
process.env.JWT_SECRET = require("node:crypto").randomBytes(48).toString("hex");
process.env.FRONTEND_ORIGIN = "http://localhost:5173";
process.env.COOKIE_SECURE = "false";
const mongoose = require("mongoose");
const request = require("supertest");
const { createTestDatabase } = require("./helpers/testDatabase");
const database = createTestDatabase("legacyindexes");
const app = require("../app");
const User = require("../models/User");
const Department = require("../models/Department");
const { hashPassword } = require("../services/authService");
const { signToken } = require("../middleware/jwt");
let principal, department;
beforeAll(async () => {
  const client = new mongoose.mongo.MongoClient(database.uri);
  try {
    await client.connect();
    // Reproduce the original development schema before Mongoose initializes.
    await client.db().collection("users").createIndex({ email: 1 }, { sparse: true, name: "email_1" });
  } finally { await client.close(); }
  await mongoose.connect(database.uri);
  database.assertConnection(mongoose.connection);
  await User.init();
  principal = await User.create({ name: "Principal", userCode: "legacy.principal", role: "PRINCIPAL", mustChangePassword: false, passwordHash: await hashPassword("Temporary_123!") });
  department = await Department.create({ name: "Applications", code: "MCA01", createdBy: principal._id });
});
afterAll(async () => { try { if (mongoose.connection.readyState !== 0) await database.drop(mongoose.connection); } finally { await mongoose.disconnect(); } });
test("a complete Add HOD request succeeds with the legacy sparse email index present", async () => {
  const fields = { name: "New HOD", email: "hod@example.edu", userCode: "hod.mca01", initialPassword: "Temporary_123!", departmentId: String(department._id), isActive: true };
  const response = await request(app).post("/api/hods").set("Origin", process.env.FRONTEND_ORIGIN).set("X-CSRF-Protection", "1").set("Cookie", `cv_auth=${signToken(principal)}`).send(fields);
  expect(response.status).toBe(201);
  const saved = await User.findOne({ userCode: fields.userCode });
  expect(saved.role).toBe("HOD");
  expect(saved.mustChangePassword).toBe(true);
  expect(String(saved.departmentId)).toBe(String(department._id));
  const indexes = await User.collection.indexes();
  expect(indexes.find(index => index.name === "email_1").sparse).toBe(true);
  expect(indexes.some(index => index.key.email === 1 && index.unique && index.partialFilterExpression)).toBe(true);
  await expect(User.create({ name: "Duplicate Email", userCode: "duplicate.email", email: fields.email, role: "PRINCIPAL", passwordHash: await hashPassword("Temporary_123!") })).rejects.toMatchObject({ code: 11000 });
});
