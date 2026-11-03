const assert = require("node:assert/strict");
const { resolve } = require("node:path");
const { runFeedbackWorkflow } = require("./feedbackWorkflow");

const runAcademicWorkflow = async ({ page, frontendOrigin, apiOrigin, width, principalPassword, temporaryPassword, checkLayout, artifacts }) => {
  const navigate = async (path, heading) => {
    await page.goto(`${frontendOrigin}${path}`);
    await page.getByRole("heading", { name: heading, exact: true }).waitFor();
    await page.getByText(/Loading (departments|hod management|faculty management|student management|subjects|class groups|faculty assignments|my teaching assignments)/).waitFor({ state: "hidden" });
  };
  const save = async resource => {
    const response = page.waitForResponse(res => res.url() === `${apiOrigin}/api/${resource}` && res.request().method() === "POST");
    await page.getByRole("button", { name: "Save Changes", exact: true }).click();
    const result = await response;
    assert.equal(result.status(), 201, `Creation failed for ${resource}: ${await result.text()}`);
    const data = (await result.json()).data;
    await page.getByText(/saved successfully\./).waitFor();
    await checkLayout(page);
    return data;
  };
  const addAccount = async ({ path, heading, type, name, code, email, departmentId }) => {
    await navigate(path, heading); await page.getByRole("button", { name: `Add ${type}`, exact: true }).click();
    await page.getByLabel("Name", { exact: true }).fill(name);
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel(type === "Student" ? "USN / User code" : "User code", { exact: true }).fill(code);
    await page.getByLabel("Temporary password", { exact: true }).fill(temporaryPassword);
    if (type === "HOD") {
      await page.getByLabel("Department", { exact: true }).locator(`option[value="${departmentId}"]`).waitFor({ state: "attached" });
      await page.getByLabel("Department", { exact: true }).selectOption(departmentId);
    }
    if (type === "Student") {
      await page.getByLabel("Semester", { exact: true }).selectOption("2");
      await page.getByLabel("Section", { exact: true }).fill("a");
      await page.getByLabel("Admission batch", { exact: true }).fill("2025-2027");
    }
    await checkLayout(page);
    await page.screenshot({ path: resolve(artifacts, `academic-${type.toLowerCase()}-form-${width}.png`), fullPage: true });
    return save(path.slice(1));
  };
  const logout = async () => {
    await page.locator(".app-navbar").getByRole("button", { name: "Logout", exact: true }).click();
    await page.waitForURL("**/login"); await page.getByRole("heading", { name: "Welcome back", exact: true }).waitFor();
  };
  const login = async (code, password, role, firstLogin = false) => {
    await page.getByLabel("User Code", { exact: true }).fill(code);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    if (firstLogin) {
      await page.waitForURL("**/change-password");
      await page.getByLabel("Current password", { exact: true }).fill(password);
      await page.getByLabel("New password", { exact: true }).fill(`Academic_${role}_${width}!`);
      await page.getByLabel("Confirm new password", { exact: true }).fill(`Academic_${role}_${width}!`);
      await page.getByRole("button", { name: "Update password", exact: true }).click();
    }
    await page.waitForURL(`**/${role.toLowerCase()}/dashboard`);
    await page.getByText("No recent activity yet", { exact: true }).waitFor();
  };
  await navigate("/departments", "Departments");
  await page.getByRole("button", { name: "Add Department", exact: true }).click();
  const departmentName = `Academic Test Department ${width} — ${"Applications ".repeat(5).trim()}`;
  await page.getByLabel("Department name", { exact: true }).fill(departmentName);
  await page.getByLabel("Department code", { exact: true }).fill(`TEST${width}`);
  const department = await save("departments");
  await page.getByRole("cell", { name: department.code, exact: true }).waitFor();
  await page.screenshot({ path: resolve(artifacts, `academic-departments-${width}.png`), fullPage: true });
  const hod = await addAccount({ path: "/hods", heading: "HOD Management", type: "HOD", name: `Academic HOD ${width}`, code: `academic.hod.${width}`, email: `hod.${width}@test.example`, departmentId: department.id });
  await logout(); await login(hod.userCode, temporaryPassword, "HOD", true);
  await page.getByText(`Department: ${department.code} — ${department.name}`, { exact: true }).waitFor();
  const faculty = await addAccount({ path: "/faculty", heading: "Faculty Management", type: "Faculty", name: `Academic Faculty ${width}`, code: `academic.faculty.${width}`, email: `faculty.${width}@test.example` });
  const student = await addAccount({ path: "/students", heading: "Student Management", type: "Student", name: `Academic Student ${width}`, code: `1MV25MC${width}`, email: `student.${width}@test.example` });
  await page.getByLabel("Search", { exact: true }).fill(student.userCode);
  await page.getByLabel("Semester filter", { exact: true }).selectOption("2");
  await page.getByLabel("Section filter", { exact: true }).fill("A");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await page.getByRole("cell", { name: student.userCode.toUpperCase(), exact: true }).waitFor();
  await checkLayout(page);
  await page.screenshot({ path: resolve(artifacts, `academic-students-${width}.png`), fullPage: true });
  await navigate("/subjects", "Subjects"); await page.getByRole("button", { name: "Add Subject", exact: true }).click();
  await page.getByLabel("Subject name", { exact: true }).fill(`DataStructures${"LongSubject".repeat(16)}`);
  await page.getByLabel("Subject code", { exact: true }).fill(`SUB${width}`);
  await page.getByLabel("Semester", { exact: true }).selectOption("2");
  const subject = await save("subjects");
  await navigate("/classes", "Class Groups"); await page.getByRole("button", { name: "Add Class Group", exact: true }).click();
  await page.getByLabel("Semester", { exact: true }).selectOption("2");
  await page.getByLabel("Section", { exact: true }).fill("A");
  await page.getByLabel("Academic year", { exact: true }).fill("2026-2027");
  await page.getByLabel("Admission batch", { exact: true }).fill("2025-2027");
  const group = await save("classes");
  await navigate("/faculty-assignments", "Faculty Assignments"); await page.getByRole("button", { name: "Add Assignment", exact: true }).click();
  for (const [label, value] of [["Faculty", faculty.id], ["Subject", subject.id], ["Class group", group.id]]) {
    await page.getByLabel(label, { exact: true }).locator(`option[value="${value}"]`).waitFor({ state: "attached" });
    await page.getByLabel(label, { exact: true }).selectOption(value);
  }
  await page.getByLabel("Academic year", { exact: true }).fill("2026-2027");
  await checkLayout(page); await page.screenshot({ path: resolve(artifacts, `academic-assignment-form-${width}.png`), fullPage: true });
  await save("faculty-assignments");
  await page.getByRole("cell", { name: `${subject.code} — ${subject.name}`, exact: true }).waitFor();
  await page.screenshot({ path: resolve(artifacts, `academic-assignments-${width}.png`), fullPage: true });
  await logout(); await login(faculty.userCode, temporaryPassword, "FACULTY", true);
  await navigate("/my-assignments", "My Teaching Assignments");
  await page.getByRole("cell", { name: `${subject.code} — ${subject.name}`, exact: true }).waitFor();
  assert.equal(await page.getByRole("button", { name: "Edit", exact: true }).count(), 0);
  await checkLayout(page); await page.screenshot({ path: resolve(artifacts, `academic-my-assignments-${width}.png`), fullPage: true });
  await runFeedbackWorkflow({ page, frontendOrigin, apiOrigin, width, checkLayout, artifacts });
  await logout(); await login(student.userCode, temporaryPassword, "STUDENT", true);
  await page.getByText("Semester: 2", { exact: true }).waitFor();
  await page.getByText("Admission batch: 2025-2027", { exact: true }).waitFor(); await checkLayout(page);
  await logout(); await login("browser.principal", principalPassword, "PRINCIPAL");
  console.log(`PASS: Principal → Department/HOD → HOD Faculty/Student/Subject/Class/Assignment → Faculty assignment visibility → Student academic information at ${width}px`);
};
module.exports = { runAcademicWorkflow };
