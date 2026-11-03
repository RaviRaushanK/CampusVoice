const assert = require("node:assert/strict");
const { resolve } = require("node:path");
const runAuditWorkflow = async ({ page, frontendOrigin, apiOrigin, width, artifacts, checkLayout, student, faculty, hod, principalPassword, login, logout }) => {
  const api = `${apiOrigin}/api/audit-logs`;
  const response = page.waitForResponse(res => res.url().startsWith(`${api}?`) && res.request().method() === "GET");
  await page.goto(`${frontendOrigin}/principal/audit-logs`); const result = await response; assert.equal(result.status(), 200, await result.text()); const data = (await result.json()).data; assert.ok(data.pagination.total > 20); assert.equal(data.items.length, 20);
  await page.getByRole("heading", { name: "Audit Logs", exact: true }).waitFor(); await page.getByRole("table", { name: "Audit operations" }).getByRole("row").nth(1).waitFor(); await checkLayout(page);
  const safe = value => { const json = JSON.stringify(value); for (const secret of [student.id, student.name, student.userCode, student.email, "Private anonymous suggestion", "General anonymous feedback", "LongComplaintDescription", "LongStudentAnswer", "passwordHash", "tokenVersion", "actorId", "resourceId", "operationId", "COMPLAINT", "SUGGESTION"]) assert.equal(json.includes(secret), false, `Audit data leaked ${secret}`); };
  safe(data);
  const next = page.waitForResponse(res => res.url().startsWith(`${api}?`) && res.url().includes("page=2")); await page.getByRole("button", { name: "Next audit logs", exact: true }).click(); assert.equal((await next).status(), 200); await page.getByText(/^Page 2 of /).waitFor();
  await page.getByLabel("Action", { exact: true }).selectOption("DEPARTMENT_CREATED"); await page.getByLabel("Resource Type", { exact: true }).selectOption("DEPARTMENT"); const filtered = page.waitForResponse(res => res.url().startsWith(`${api}?`) && res.url().includes("action=DEPARTMENT_CREATED")); await page.getByRole("button", { name: "Apply audit filters", exact: true }).click(); const filteredResponse = await filtered; assert.equal(filteredResponse.status(), 200); const operations = (await filteredResponse.json()).data; assert.ok(operations.items.length > 0); assert.ok(operations.items.every(item => item.action === "DEPARTMENT_CREATED" && item.outcome === "SUCCEEDED")); await page.getByRole("heading", { name: "Department Created", exact: true }).first().waitFor(); await checkLayout(page);
  await page.evaluate(() => window.scrollTo(0, 0)); await page.screenshot({ path: resolve(artifacts, `audit-logs-${width}.png`), fullPage: true });
  await page.getByLabel("Date From", { exact: true }).fill("2000-01-01"); await page.getByLabel("Date To", { exact: true }).fill("2000-12-31"); await page.getByRole("button", { name: "Apply audit filters", exact: true }).click(); await page.getByText("No audit operations found.", { exact: true }).waitFor(); await checkLayout(page);
  const signIns = await page.request.get(`${api}?action=AUTH_LOGIN_SUCCESS&limit=100`); assert.equal(signIns.status(), 200); const signedData = (await signIns.json()).data; safe(signedData); assert.ok(signedData.items.some(item => item.role === "STUDENT" && item.actor === "Student account"));
  for (const [actor, role] of [[hod, "HOD"], [faculty, "FACULTY"], [student, "STUDENT"]]) {
    await logout(); await login(actor.userCode, `Academic_${role}_${width}!`, role); assert.equal((await page.request.get(api)).status(), 403); assert.equal(await page.getByRole("link", { name: "Audit Logs", exact: true }).count(), 0);
    await page.goto(`${frontendOrigin}/principal/audit-logs`); await page.waitForURL(`**/${role.toLowerCase()}/dashboard`); await page.getByText("Workspace ready", { exact: true }).waitFor();
  }
  await logout(); await login("browser.principal", principalPassword, "PRINCIPAL"); await page.goto(`${frontendOrigin}/principal/dashboard`); await page.getByText("Workspace ready", { exact: true }).waitFor();
  console.log(`PASS: Complete Principal→HOD→Faculty→Student integration ends in Principal-only Audit Logs; action/resource/date filters, pagination, empty state, masked Student actors, private-content/complaint exclusion and cross-role denial at ${width}px`);
};
module.exports = { runAuditWorkflow };
