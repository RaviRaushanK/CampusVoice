const assert = require("node:assert/strict");
const { randomBytes } = require("node:crypto");
const { createServer } = require("node:http");
const { mkdir } = require("node:fs/promises");
const { resolve } = require("node:path");
const { chromium } = require("playwright");
const mongoose = require("mongoose");
const { createTestDatabase } = require("../helpers/testDatabase");
require("dotenv").config();

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = randomBytes(48).toString("hex");
process.env.COOKIE_SECURE = "false";
process.env.COOKIE_SAME_SITE = "lax";
process.env.TRUST_PROXY_HOPS = "0";

const artifacts = resolve(__dirname, "../../test-results/browser");
const roles = ["PRINCIPAL", "HOD", "FACULTY", "STUDENT"];
const temporaryPassword = `Temporary_${randomBytes(12).toString("hex")}!`;
const newPassword = `Changed_${randomBytes(12).toString("hex")}!`;
let apiServer, vite, browser, database;

const waitForDashboard = async (page, role) => {
  await page.waitForURL(`**/${role.toLowerCase()}/dashboard`);
  await page.getByText("No recent activity yet").waitFor();
};

const checkLayout = async (page) => {
  const measurements = await page.evaluate(async () => {
    await document.fonts.ready;
    const visible = [...document.querySelectorAll("input, button, h1, h2")].filter(element => {
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && rect.right > 0 && rect.left < innerWidth;
    });
    return {
      viewport: innerWidth,
      width: document.documentElement.scrollWidth,
      // Input text scrolls internally; only labels and buttons must fit their content.
      clipped: visible.filter(element => element.tagName !== "INPUT" && element.scrollWidth > element.clientWidth + 1).map(element => element.textContent),
      iconsLoaded: [...document.fonts].some(font => font.family === "bootstrap-icons" && font.status === "loaded"),
    };
  });
  assert.ok(measurements.width <= measurements.viewport, `Horizontal overflow: ${JSON.stringify(measurements)}`);
  assert.deepEqual(measurements.clipped, []);
  assert.ok(measurements.iconsLoaded, "Bootstrap Icons font did not load");
};

const login = async (page, userCode) => {
  await page.getByLabel("User Code", { exact: true }).fill(userCode);
  await page.getByLabel("Password", { exact: true }).fill(temporaryPassword);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
};

const run = async () => {
  database = createTestDatabase("browser");
  const { createServer: createViteServer } = await import("vite");
  // Bind ephemeral local ports so browser checks never reuse another running app.
  apiServer = createServer();
  await new Promise((resolveListen, reject) => {
    apiServer.once("error", reject);
    apiServer.listen(0, "localhost", resolveListen);
  });
  const apiOrigin = `http://localhost:${apiServer.address().port}`;
  vite = await createViteServer({
    configFile: resolve(__dirname, "../../vite.config.mjs"),
    define: { "import.meta.env.VITE_API_BASE_URL": JSON.stringify(`${apiOrigin}/api`) },
    server: { host: "localhost", port: 0, strictPort: true },
  });
  await vite.listen();
  const frontendOrigin = `http://localhost:${vite.httpServer.address().port}`;
  process.env.FRONTEND_ORIGIN = frontendOrigin;
  const app = require("../../app");
  const User = require("../../models/User");
  const { seedPrincipal } = require("../../seeders/seedPrincipal");
  const { hashPassword } = require("../../services/authService");
  await mongoose.connect(database.uri, { serverSelectionTimeoutMS: 5000 });
  database.assertConnection(mongoose.connection);
  await seedPrincipal({ PRINCIPAL_NAME: "Browser Principal", PRINCIPAL_USER_CODE: "browser.principal", PRINCIPAL_PASSWORD: temporaryPassword });
  const passwordHash = await hashPassword(temporaryPassword);
  await User.create(roles.slice(1).map(role => ({ name: `Browser ${role}`, userCode: `browser.${role.toLowerCase()}`, passwordHash, role, mustChangePassword: false })));
  apiServer.on("request", app);
  assert.deepEqual(await (await fetch(`${apiOrigin}/api/health`)).json(), { success: true, message: "CampusVoice API is running" });
  await mkdir(artifacts, { recursive: true });
  browser = await chromium.launch();
  const errors = [];

  for (const width of [1440, 1024, 768, 375, 320]) {
    database.assertConnection(mongoose.connection);
    await User.updateMany({}, { $set: { passwordHash, mustChangePassword: false } });
    await User.updateOne({ userCode: "browser.principal" }, { $set: { passwordHash, mustChangePassword: true } });
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    const page = await context.newPage();
    page.on("pageerror", error => errors.push(error.message));
    page.on("console", message => {
      if (message.type() === "error" && !message.text().includes("401 (Unauthorized)")) errors.push(message.text());
    });
    await page.goto(`${frontendOrigin}/profile`);
    await page.getByRole("heading", { name: "Welcome back" }).waitFor();
    await checkLayout(page);
    await page.screenshot({ path: resolve(artifacts, `login-${width}.png`), fullPage: true });

    await login(page, "browser.principal");
    await page.waitForURL("**/change-password");
    await page.goto(`${frontendOrigin}/principal/dashboard`);
    await page.waitForURL("**/change-password");
    await page.getByLabel("Current password", { exact: true }).fill(temporaryPassword);
    await page.getByLabel("New password", { exact: true }).fill(newPassword);
    await page.getByLabel("Confirm new password", { exact: true }).fill(newPassword);
    await checkLayout(page);
    await page.screenshot({ path: resolve(artifacts, `first-login-${width}.png`), fullPage: true });
    await page.getByRole("button", { name: "Update password", exact: true }).click();
    await waitForDashboard(page, "PRINCIPAL");

    for (const role of roles) {
      if (role !== "PRINCIPAL") { await login(page, `browser.${role.toLowerCase()}`); await waitForDashboard(page, role); }
      await checkLayout(page);
      await page.screenshot({ path: resolve(artifacts, `${role.toLowerCase()}-${width}.png`), fullPage: true });
      const cookies = await context.cookies(apiOrigin);
      assert.ok(cookies.some(cookie => cookie.name === "cv_auth" && cookie.httpOnly && cookie.expires > Date.now() / 1000));
      assert.equal(await page.evaluate(() => document.cookie.includes("cv_auth=")), false);
      assert.equal(await page.evaluate(() => localStorage.length + sessionStorage.length), 0);

      if (width < 992) {
        await page.getByRole("button", { name: "Open navigation", exact: true }).click();
        await page.locator(".app-sidebar.is-open").waitFor();
      }
      const profileResponse = page.waitForResponse(response => response.url() === `${apiOrigin}/api/profile`);
      await page.getByRole("link", { name: "Profile", exact: true }).click();
      await page.waitForURL("**/profile");
      await page.getByRole("heading", { name: "My Profile", exact: true }).waitFor();
      const response = await profileResponse;
      assert.equal(response.status(), 200);
      const data = (await response.json()).data;
      assert.equal(data.role, role);
      assert.equal(data.userCode, `browser.${role.toLowerCase()}`);
      assert.deepEqual(Object.keys(data).sort(), ["name", "userCode", "email", "role", "isActive", "departmentId", "semester", "section", "lastLoginAt", "createdAt"].sort());
      await page.getByText(data.userCode, { exact: true }).waitFor();
      await checkLayout(page);
      await page.screenshot({ path: resolve(artifacts, `profile-${role.toLowerCase()}-${width}.png`), fullPage: true });
      await page.reload();
      await page.getByText(data.userCode, { exact: true }).waitFor();
      await page.getByRole("button", { name: "Edit Profile", exact: true }).click();
      assert.equal(await page.getByLabel("Name", { exact: true }).inputValue(), data.name);
      await page.getByLabel("Name", { exact: true }).fill("Unsaved Name");
      await page.getByRole("button", { name: "Cancel", exact: true }).click();
      await page.getByRole("heading", { name: data.name, exact: true }).waitFor();
      await page.getByRole("button", { name: "Edit Profile", exact: true }).click();
      const updatedName = `Updated ${role} ${width}`;
      const updatedEmail = `${role.toLowerCase()}.${width}.${"long".repeat(9)}@campus.example.edu`;
      await page.getByLabel("Name", { exact: true }).fill(updatedName);
      await page.getByLabel("Email", { exact: true }).fill(updatedEmail);
      await checkLayout(page);
      await page.screenshot({ path: resolve(artifacts, `profile-edit-${role.toLowerCase()}-${width}.png`), fullPage: true });
      const patchResponse = page.waitForResponse(response => response.url() === `${apiOrigin}/api/profile` && response.request().method() === "PATCH");
      await page.getByRole("button", { name: "Save Changes", exact: true }).click();
      assert.equal((await patchResponse).status(), 200);
      await page.getByText("Profile updated successfully.", { exact: true }).waitFor();
      await page.locator(".app-navbar").getByText(updatedName, { exact: true }).waitFor();
      await page.getByText(updatedEmail, { exact: true }).waitFor();
      await checkLayout(page);
      await page.screenshot({ path: resolve(artifacts, `profile-saved-${role.toLowerCase()}-${width}.png`), fullPage: true });
      await page.reload();
      await page.getByText(updatedEmail, { exact: true }).waitFor();
      const oldCookie = (await context.cookies(apiOrigin)).find(cookie => cookie.name === "cv_auth");
      await page.getByRole("region", { name: "Security", exact: true }).getByRole("link", { name: "Change Password", exact: true }).click();
      await page.waitForURL("**/change-password");
      await page.getByText("Change your password", { exact: true }).waitFor();
      await page.getByLabel("Current password", { exact: true }).fill(role === "PRINCIPAL" ? newPassword : temporaryPassword);
      const voluntaryPassword = `Voluntary_${role}_${width}!`;
      await page.getByLabel("New password", { exact: true }).fill(voluntaryPassword);
      await page.getByLabel("Confirm new password", { exact: true }).fill(voluntaryPassword);
      await page.getByRole("button", { name: "Update password", exact: true }).click();
      await waitForDashboard(page, role);
      assert.equal((await fetch(`${apiOrigin}/api/profile`, { headers: { Cookie: `cv_auth=${oldCookie.value}` } })).status, 401);
      assert.equal(await page.getByRole("link", { name: "Change password", exact: true }).count(), 1);
      for (const target of roles.filter(target => target !== role)) {
        await page.goto(`${frontendOrigin}/${target.toLowerCase()}/dashboard`);
        await waitForDashboard(page, role);
      }
      await page.reload();
      await waitForDashboard(page, role);
      await page.locator(".app-navbar").getByRole("button", { name: "Logout", exact: true }).click();
      await page.waitForURL("**/login");
      await page.getByRole("heading", { name: "Welcome back" }).waitFor();
      assert.equal((await context.cookies(apiOrigin)).some(cookie => cookie.name === "cv_auth"), false);
    }
    console.log(`PASS: four roles, dashboards, profile view/edit/cancel/save, shared UI sync, forced/voluntary password change, token revocation and logout at ${width}px`);
    await context.close();
  }
  assert.deepEqual(errors, [], "Unexpected browser console/runtime errors");
};

run().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  if (browser) await browser.close();
  if (vite) await vite.close();
  if (apiServer) await new Promise(resolveClose => apiServer.close(resolveClose));
  try { if (mongoose.connection.readyState !== 0) await database.drop(mongoose.connection); }
  finally { await mongoose.disconnect(); }
});
