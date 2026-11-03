// Visual inventory only: isolated real API fixtures, no full lifecycle regression.
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const { resolve } = require("node:path");
const { createServer } = require("node:http");
const { randomBytes, randomUUID } = require("node:crypto");
const { chromium } = require("playwright");
const mongoose = require("mongoose");
const { createTestDatabase } = require("../helpers/testDatabase");
require("dotenv").config({ quiet: true });
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = randomBytes(48).toString("hex");
process.env.COOKIE_SECURE = "false";
process.env.COOKIE_SAME_SITE = "lax";
process.env.TRUST_PROXY_HOPS = "0";
const database = createTestDatabase("visual");
const artifacts = resolve("test-results/ui-review");
process.env.COMPLAINT_UPLOAD_DIR = resolve(artifacts, `complaint-uploads-${randomUUID()}`);
const password = `Review_${randomBytes(12).toString("hex")}!`;
let server, vite, browser;
const only = process.env.UI_REVIEW_ONLY?.split(",");
const report = { pages: [], errors: [], widths: process.env.UI_REVIEW_WIDTHS ? process.env.UI_REVIEW_WIDTHS.split(",").map(Number) : [1440, 1024, 768, 375, 320] };

async function fixtures() {
  database.assertConnection(mongoose.connection);
  const User = require("../../models/User"), Department = require("../../models/Department");
  const Subject = require("../../models/Subject"), ClassGroup = require("../../models/ClassGroup"), Assignment = require("../../models/FacultyAssignment");
  const Session = require("../../models/FeedbackSession"), Response = require("../../models/SessionResponse");
  const Feedback = require("../../models/Feedback"), Suggestion = require("../../models/Suggestion"), Notice = require("../../models/Notification");
  const hash = await require("../../services/authService").hashPassword(password);
  const principal = await User.create({ name: "Review Principal", userCode: "review.principal", email: "principal@review.example", role: "PRINCIPAL", passwordHash: hash, mustChangePassword: false });
  const department = await Department.create({ name: "Computer Applications", code: "MCA01", description: "Postgraduate academic department", createdBy: principal._id });
  await Department.create({ name: "Business Administration", code: "MBA01", createdBy: principal._id, isActive: false });
  const users = { PRINCIPAL: principal };
  for (const role of ["HOD", "FACULTY", "STUDENT"]) users[role] = await User.create({ name: `Review ${role === "HOD" ? "Department Head" : role === "FACULTY" ? "Faculty" : "Student"}`, userCode: `review.${role.toLowerCase()}`, email: `${role.toLowerCase()}@review.example`, role, passwordHash: hash, departmentId: department._id, semester: role === "STUDENT" ? 2 : null, section: role === "STUDENT" ? "A" : null, batch: role === "STUDENT" ? "2026-2028" : null, mustChangePassword: false });
  const other = await User.create({ name: "Response Review Student", userCode: "review.response", role: "STUDENT", passwordHash: hash, departmentId: department._id, semester: 2, section: "A", batch: "2026-2028", mustChangePassword: false });
  const firstLogin = await User.create({ name: "First Login Review", userCode: "review.first", role: "STUDENT", passwordHash: hash, departmentId: department._id, mustChangePassword: true });
  const subject = await Subject.create({ name: "Data Structures and Applications", code: "MCA203", semester: 2, departmentId: department._id, createdBy: users.HOD._id });
  const group = await ClassGroup.create({ semester: 2, section: "A", batch: "2026-2028", academicYear: "2026-2027", departmentId: department._id, createdBy: users.HOD._id });
  const assignment = await Assignment.create({ facultyId: users.FACULTY._id, subjectId: subject._id, classGroupId: group._id, departmentId: department._id, academicYear: "2026-2027", createdBy: users.HOD._id });
  const questions = [
    { type: "SINGLE_CHOICE", prompt: "How clear were the concepts covered in this module?", options: ["Very clear", "Clear", "Somewhat clear", "Need more explanation"], required: true },
    { type: "MULTI_SELECT", prompt: "Which learning activities helped you the most?", options: ["Practical exercises", "Class discussions", "Worked examples"], required: true },
    { type: "RATING", prompt: "How would you rate the pace of the module?", ratingMin: 1, ratingMax: 5, required: true },
    { type: "SHORT_ANSWER", prompt: "What could make the next module more useful?", required: false },
  ];
  const common = { facultyId: users.FACULTY._id, departmentId: department._id, facultyAssignmentId: assignment._id, subjectId: subject._id, classGroupId: group._id, createdBy: users.FACULTY._id, description: "Help shape the next module with your honest perspective.", questions, allowAnonymous: true };
  const draft = await Session.create({ ...common, title: "Next module feedback", status: "DRAFT" });
  const open = await Session.create({ ...common, title: "Data Structures - Module Feedback", status: "OPEN", publishedAt: new Date(), audience: { semester: 2, section: "A", batch: "2026-2028", academicYear: "2026-2027" } });
  const closed = await Session.create({ ...common, title: "Completed learning experience", status: "CLOSED", publishedAt: new Date(), closedAt: new Date(), audience: { semester: 2, section: "A", batch: "2026-2028", academicYear: "2026-2027" } });
  for (const [session, student] of [[open, other], [closed, users.STUDENT]]) await Response.create({ sessionId: session._id, studentId: student._id, identityMode: "ANONYMOUS", answers: session.questions.map((question, index) => ({ questionId: question._id, value: index === 0 ? "Very clear" : index === 1 ? ["Practical exercises", "Worked examples"] : index === 2 ? 4 : "More practical demonstrations would help connect the concepts." })) });
  await Response.create({ sessionId: closed._id, studentId: other._id, identityMode: "NAMED", answers: [{ questionId: closed.questions[3]._id, value: "The laboratory demonstrations helped connect the concepts with practical use." }] });
  for (const [student, identityMode, rating] of [[users.STUDENT, "ANONYMOUS", 4], [other, "NAMED", 5]]) {
    await Feedback.create({ studentId: student._id, facultyId: users.FACULTY._id, departmentId: department._id, facultyAssignmentId: assignment._id, subjectId: subject._id, identityMode, rating, message: "The practical examples made the concepts easier to understand. More time for exercises would be helpful." });
    await Suggestion.create({ studentId: student._id, facultyId: users.FACULTY._id, departmentId: department._id, identityMode, message: "Could we have a short recap at the beginning of each module to connect it with the previous topic?" });
  }
  const complaints = require("../../services/complaintService"), cases = {};
  for (const [role, type, title] of [["FACULTY", "FACULTY_ISSUE", "Additional guidance for laboratory exercises"], ["HOD", "DEPARTMENT_ISSUE", "Laboratory resources need maintenance"], ["PRINCIPAL", "COLLEGE_CAMPUS", "Improve lighting near the library entrance"]]) {
    const evidence = Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\n%%EOF");
    const result = await complaints.create(users.STUDENT, { type, title, description: "Please review the current arrangements and provide an update on the available support for students.", identityMode: "ANONYMOUS", ...(role === "FACULTY" ? { facultyAssignmentId: String(assignment._id) } : {}) }, role === "FACULTY" ? [{ originalname: "laboratory-note.pdf", mimetype: "application/pdf", size: evidence.length, buffer: evidence }] : []);
    cases[role] = result.item.id;
    await complaints.act(users[role], result.item.id, "acknowledge", {});
    await complaints.act(users[role], result.item.id, "start", {});
  }
  await complaints.create(users.STUDENT, { type: "SAFETY_URGENT", title: "Safety review for an obstructed walkway", description: "An obstruction near the academic building requires a safety review and appropriate follow-up.", identityMode: "ANONYMOUS" });
  for (const actor of Object.values(users)) {
    await Notice.create({ recipient: actor._id, type: "SYSTEM", title: "Your academic workspace is ready", message: "Review your current assignments and notifications for the latest updates." });
    await Notice.create({ recipient: actor._id, type: "ACCOUNT", title: "Account information reviewed", message: "You can review your personal and account information from My Profile.", isRead: true, readAt: new Date() });
  }
  const audit = require("../../services/auditService");
  await audit.record({ actor: principal, action: "DEPARTMENT_CREATED", resourceType: "DEPARTMENT", resourceId: department._id, phase: "SUCCEEDED", isRoot: true, metadata: { changedFields: ["name", "code"], isActive: true } });
  return { users, firstLogin, draft: String(draft._id), open: String(open._id), closed: String(closed._id), cases };
}

async function run() {
  await fs.mkdir(artifacts, { recursive: true });
  server = createServer();
  await new Promise(resolveListen => server.listen(0, "localhost", resolveListen));
  const apiOrigin = `http://localhost:${server.address().port}`;
  vite = await (await import("vite")).createServer({ configFile: resolve("vite.config.mjs"), define: { "import.meta.env.VITE_API_BASE_URL": JSON.stringify(`${apiOrigin}/api`) }, server: { host: "localhost", port: 0, strictPort: true } });
  await vite.listen();
  const origin = `http://localhost:${vite.httpServer.address().port}`;
  process.env.FRONTEND_ORIGIN = origin;
  server.on("request", require("../../app"));
  await mongoose.connect(database.uri);
  const data = await fixtures();
  browser = await chromium.launch();
  const snap = async (page, name, route, width) => {
    if (only && !only.includes(name)) return;
    await page.evaluate(async () => { await document.fonts.ready; window.scrollTo(0, 0); });
    const measure = await page.evaluate(() => ({ viewport: innerWidth, width: document.documentElement.scrollWidth }));
    assert.ok(measure.width <= measure.viewport, `${name} overflows at ${width}: ${JSON.stringify(measure)}`);
    const filename = `${name}-${width}.png`;
    await page.screenshot({ path: resolve(artifacts, filename), fullPage: true });
    await page.screenshot({ path: resolve(artifacts, `${name}-${width}-viewport.png`) });
    report.pages.push({ name, route, width, file: filename, overflow: false });
    console.log(`VISUAL: ${name} ${width}px`);
  };
  const go = async (page, route) => {
    await page.goto(origin + route);
    await page.waitForLoadState("networkidle");
    await page.locator(".loading-state").waitFor({ state: "hidden" }).catch(() => {});
  };
  for (const width of report.widths) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: "reduce" });
    const page = await context.newPage();
    page.on("pageerror", error => report.errors.push(error.message));
    const login = async user => {
      await context.clearCookies();
      const response = await context.request.post(`${apiOrigin}/api/auth/login`, { headers: { Origin: origin, "X-CSRF-Protection": "1" }, data: { userCode: user.userCode, password } });
      assert.equal(response.status(), 200, await response.text());
    };
    if ([1440, 320].includes(width)) {
      await go(page, "/login"); await snap(page, "login", "/login", width);
      await page.getByLabel("User Code", { exact: true }).focus(); await snap(page, "login-focus", "/login", width);
      await login(data.firstLogin); await go(page, "/change-password"); await snap(page, "first-password", "/change-password", width);
    }
    for (const role of ["PRINCIPAL", "HOD", "FACULTY", "STUDENT"]) {
      await login(data.users[role]);
      await go(page, `/${role.toLowerCase()}/dashboard`);
      await snap(page, `${role.toLowerCase()}-dashboard`, `/${role.toLowerCase()}/dashboard`, width);
      if (width < 992) {
        await page.getByRole("button", { name: "Open navigation", exact: true }).click();
        await page.waitForFunction(() => document.querySelector("#app-sidebar").contains(document.activeElement));
        if (role === "PRINCIPAL") await snap(page, "mobile-navigation", "drawer", width);
        await page.locator("#app-sidebar").getByRole("button", { name: "Logout", exact: true }).focus();
        await page.keyboard.press("Tab");
        assert.equal(await page.locator("#app-sidebar").getByRole("button", { name: "Close navigation", exact: true }).evaluate(element => element === document.activeElement), true);
        await page.keyboard.press("Shift+Tab");
        assert.equal(await page.locator("#app-sidebar").getByRole("button", { name: "Logout", exact: true }).evaluate(element => element === document.activeElement), true);
        await page.keyboard.press("Escape");
        await page.waitForFunction(() => !document.querySelector("#app-sidebar").classList.contains("is-open"));
      }
      if (![1440, 320].includes(width)) continue;
      await go(page, `/${role.toLowerCase()}`);
      assert.equal(new URL(page.url()).pathname, `/${role.toLowerCase()}/dashboard`);
      await snap(page, `${role.toLowerCase()}-workspace-root`, `/${role.toLowerCase()}`, width);
      const routes = role === "PRINCIPAL" ? [["departments", "/departments"], ["hod-management", "/hods"], ["feedback-overview", "/principal/feedback-overview"], ["principal-complaints", "/principal/complaints"], ["principal-detail", `/principal/complaints/${data.cases.PRINCIPAL}`], ["principal-analytics", "/principal/analytics"], ["principal-processing", "/principal/complaint-processing"], ["audit-logs", "/principal/audit-logs"], ["profile", "/profile"], ["notifications", "/notifications"], ["password", "/change-password"]]
        : role === "HOD" ? [["faculty-management", "/faculty"], ["student-management", "/students"], ["subjects", "/subjects"], ["classes", "/classes"], ["assignments", "/faculty-assignments"], ["hod-feedback", "/hod/general-feedback"], ["hod-complaints", "/hod/complaints"], ["hod-detail", `/hod/complaints/${data.cases.HOD}`], ["hod-analytics", "/hod/analytics"], ["hod-processing", "/hod/complaint-processing"]]
        : role === "FACULTY" ? [["session-results-closed", `/my-sessions/${data.closed}/results`], ["my-assignments", "/my-assignments"], ["my-sessions", "/my-sessions"], ["session-new", "/my-sessions/new"], ["session-builder", `/my-sessions/${data.draft}/edit`], ["session-results", `/my-sessions/${data.open}/results`], ["faculty-feedback", "/faculty/general-feedback"], ["faculty-suggestions", "/faculty/suggestions"], ["faculty-complaints", "/faculty/complaints"], ["faculty-detail", `/faculty/complaints/${data.cases.FACULTY}`], ["faculty-analytics", "/faculty/analytics"], ["faculty-processing", "/faculty/complaint-processing"]]
        : [["student-sessions", "/feedback-sessions"], ["student-completed", "/feedback-sessions?category=completed"], ["questionnaire", `/feedback-sessions/${data.open}/respond`], ["student-feedback", "/student/general-feedback"], ["student-suggestions", "/student/suggestions"], ["raise-complaint", "/student/complaints/new"], ["student-complaints", "/student/complaints"], ["student-detail", `/student/complaints/${data.cases.FACULTY}`]];
      for (const [name, route] of routes) {
        if (only && !only.includes(name)) continue;
        await go(page, route); await snap(page, name, route, width);
        if (name.endsWith("processing")) { await page.getByRole("button", { name: "Priority Queue", exact: true }).click(); await page.waitForLoadState("networkidle"); await snap(page, name.replace("processing", "priority"), route, width); }
        if (["departments", "hod-management", "faculty-management", "student-management", "subjects", "classes", "assignments"].includes(name)) {
          const labels = { departments: "Department", "hod-management": "HOD", "faculty-management": "Faculty", "student-management": "Student", subjects: "Subject", classes: "Class Group", assignments: "Assignment" };
          await page.getByRole("button", { name: `Add ${labels[name]}`, exact: true }).click(); await page.waitForLoadState("networkidle"); await snap(page, name + "-form", route, width);
        }
        if (name.startsWith("session-results")) { await page.getByRole("button", { name: "View text responses for question 4", exact: true }).click(); await page.waitForLoadState("networkidle"); await snap(page, name + "-answers", route, width); }
        if (name === "session-builder") { await page.getByText("Questionnaire preview", { exact: true }).click(); await snap(page, "session-preview", route, width); }
        if (name === "audit-logs") { await page.evaluate(() => window.dispatchEvent(new Event("audit:unconfirmed"))); await snap(page, "audit-warning", route, width); await page.getByRole("button", { name: "Dismiss audit notice", exact: true }).click(); }
        if (name.endsWith("detail") && role !== "STUDENT") { await page.getByRole("button", { name: "Resolve", exact: true }).click(); await snap(page, name + "-action", route, width); }
        if (name === "questionnaire") { await page.getByLabel("Very clear", { exact: true }).check(); await page.getByLabel("Practical exercises", { exact: true }).check(); await page.getByLabel("4", { exact: true }).check(); await snap(page, "questionnaire-selected", route, width); await page.getByRole("button", { name: "Submit Feedback", exact: true }).click(); await snap(page, "questionnaire-confirmation", route, width); }
        if (name === "profile") { await page.getByRole("button", { name: "Edit Profile", exact: true }).click(); await snap(page, "profile-edit", route, width); }
        if (name === "raise-complaint") { await page.getByLabel("Complaint Type", { exact: true }).selectOption("SAFETY_URGENT"); await snap(page, "raise-urgent", route, width); }
      }
      if (role !== "PRINCIPAL") { for (const route of ["/profile", "/notifications"]) { await go(page, route); await snap(page, role.toLowerCase() + route.replace("/", "-"), route, width); } }
      if (role === "PRINCIPAL" && !only) {
        await go(page, "/departments"); await page.getByRole("button", { name: "Deactivate", exact: true }).first().click(); await snap(page, "deactivation-confirmation", "/departments", width);
        await page.getByRole("button", { name: "Cancel deactivation", exact: true }).click(); await page.getByLabel("Search", { exact: true }).fill("No matching visual review records"); await page.getByRole("button", { name: "Search", exact: true }).click(); await page.waitForLoadState("networkidle"); await snap(page, "empty-state", "/departments?search", width);
        const endpoint = apiOrigin + "/api/departments?*";
        await page.route(endpoint, route => route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ success: false, message: "Internal server error" }) }));
        await go(page, "/departments"); await snap(page, "error-retry-state", "/departments", width); await page.unroute(endpoint);
        let release; const gate = new Promise(resolveGate => { release = resolveGate; });
        await page.route(endpoint, async route => { await gate; await route.continue(); });
        await page.goto(origin + "/departments"); await page.getByText("Loading departments", { exact: true }).waitFor(); await snap(page, "loading-state", "/departments", width); release(); await page.waitForLoadState("networkidle"); await page.unroute(endpoint);
      }
      if (role === "STUDENT") { await go(page, "/principal/audit-logs"); assert.equal(new URL(page.url()).pathname, "/student/dashboard"); await snap(page, "unauthorized-recovery", "/principal/audit-logs", width); await go(page, "/"); await snap(page, "root-recovery", "/", width); await go(page, "/not-a-route"); await snap(page, "unknown-route-recovery", "*", width); }
    }
    await context.close();
  }
  assert.deepEqual(report.errors, [], "Browser runtime errors");
  await fs.writeFile(resolve(artifacts, only ? "supplemental-inventory.json" : "inventory.json"), JSON.stringify(report, null, 2));
  console.log(`Visual review captured ${report.pages.length} page states across ${report.widths.length} widths.`);
}
run().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  try {
    if (browser) await browser.close();
    if (vite) await vite.close();
    if (server) await new Promise(resolveClose => server.close(resolveClose));
    if (mongoose.connection.readyState === 1) {
      database.assertConnection(mongoose.connection);
      const cases = await require("../../models/Complaint").find().select("attachments").lean();
      await require("../../utils/complaintFiles").cleanup(cases.flatMap(item => item.attachments));
      await database.drop(mongoose.connection);
    }
  } finally {
    await mongoose.disconnect();
    try { await fs.rmdir(process.env.COMPLAINT_UPLOAD_DIR); } catch (error) { if (error.code !== "ENOENT") throw error; }
  }
});
