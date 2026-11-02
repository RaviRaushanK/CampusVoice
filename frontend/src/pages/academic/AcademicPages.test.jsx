import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";
import App from "../../App";
import * as api from "../../services/academicService";
import * as auth from "../../services/authService";
import * as notifications from "../../services/notificationService";
vi.mock("../../services/academicService", () => ({ listAcademic: vi.fn(), createAcademic: vi.fn(), updateAcademic: vi.fn(), getAcademicDashboard: vi.fn() }));
vi.mock("../../services/authService", () => ({ me: vi.fn(), login: vi.fn(), logout: vi.fn(), changePassword: vi.fn() }));
vi.mock("../../services/notificationService", () => ({ getUnreadCount: vi.fn() }));
const user = role => ({ id: "actor", name: "Authenticated User", role, userCode: "actor", mustChangePassword: false });
const pageResult = (items = [], page = 1, total = items.length) => ({ data: { items, pagination: { page, limit: 20, total, totalPages: Math.ceil(total / 20), hasNextPage: page * 20 < total, hasPreviousPage: page > 1 && total > 0 } } });
const department = { id: "dept", code: "MCA", name: "Computer Applications", description: "Description", isActive: true };
const row = { id: "record", name: "Example Person", userCode: "example.person", email: "example@college.edu", departmentId: "dept", department, semester: 2, section: "A", academicYear: "2026-2027", batch: "2025-2027", isActive: true, code: "MMC201", faculty: { id: "faculty", name: "Example Person" }, subject: { id: "subject", code: "MMC201", name: "Data Structures" }, classGroup: { id: "group", semester: 2, section: "A" } };
const pages = [["/departments", "PRINCIPAL", "Departments", "Department"], ["/hods", "PRINCIPAL", "HOD Management", "HOD"], ["/faculty", "HOD", "Faculty Management", "Faculty"], ["/students", "HOD", "Student Management", "Student"], ["/subjects", "HOD", "Subjects", "Subject"], ["/classes", "HOD", "Class Groups", "Class Group"], ["/faculty-assignments", "HOD", "Faculty Assignments", "Assignment"]];
const open = (path, role) => { auth.me.mockResolvedValue({ data: user(role) }); return render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>); };
const change = (label, value) => fireEvent.change(screen.getByLabelText(label, { exact: true }), { target: { value } });
beforeEach(() => {
  notifications.getUnreadCount.mockResolvedValue({ data: { count: 0 } });
  api.getAcademicDashboard.mockResolvedValue({ data: { metrics: { Departments: 2 } } });
  api.listAcademic.mockResolvedValue(pageResult());
  api.createAcademic.mockResolvedValue({ data: row }); api.updateAcademic.mockResolvedValue({ data: row });
});
afterEach(() => { cleanup(); vi.resetAllMocks(); });

it.each(pages)("%s shows loading, a safe empty state and creation access", async (path, role, title, singular) => {
  let complete;
  api.listAcademic.mockImplementationOnce(() => new Promise(resolve => { complete = resolve; })); open(path, role);
  expect(await screen.findByText(`Loading ${title.toLowerCase()}`)).toBeTruthy();
  await waitFor(() => expect(api.listAcademic).toHaveBeenCalled());
  await act(async () => complete(pageResult()));
  expect(await screen.findByRole("heading", { name: `No ${title.toLowerCase()} yet` })).toBeTruthy();
  expect(screen.getByRole("button", { name: `Add ${singular}` })).toBeTruthy();
});
it.each(pages)("%s lists, edits and confirms deactivation", async (path, role, title) => {
  api.listAcademic.mockResolvedValue(pageResult([row])); open(path, role);
  const table = await screen.findByRole("table");
  fireEvent.click(within(table).getByRole("button", { name: "Edit" }));
  expect(screen.getByRole("button", { name: "Save Changes" })).toBeTruthy();
  change("Status", "false");
  fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));
  await screen.findByText(/saved successfully/);
  expect(api.updateAcademic).toHaveBeenCalledWith(path.slice(1), row.id, { isActive: false });
  fireEvent.click(within(await screen.findByRole("table")).getByRole("button", { name: "Deactivate" }));
  expect(screen.getByRole("region", { name: "Confirm deactivation" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Confirm deactivation" }));
  await screen.findByText(/deactivated\./);
});
it("creates a department and validates empty input before sending", async () => {
  open("/departments", "PRINCIPAL"); fireEvent.click(await screen.findByRole("button", { name: "Add Department" }));
  fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));
  expect(screen.getByRole("alert").textContent).toBe("Department name is required."); expect(api.createAcademic).not.toHaveBeenCalled();
  change("Department name", "Computer Applications"); change("Department code", "MCA");
  fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));
  expect(await screen.findByText("Department saved successfully.")).toBeTruthy();
  expect(api.createAcademic).toHaveBeenCalledWith("departments", { name: "Computer Applications", code: "MCA", description: "", isActive: true });
});
it.each([["/hods", "PRINCIPAL", "HOD"], ["/faculty", "HOD", "Faculty"], ["/students", "HOD", "Student"]])("%s provisions accounts with temporary passwords and no client role", async (path, role, singular) => {
  api.listAcademic.mockImplementation(async resource => resource === "departments" ? pageResult([department]) : pageResult());
  open(path, role); fireEvent.click(await screen.findByRole("button", { name: `Add ${singular}` }));
  change("Name", "New Person"); change("Email", "new@example.edu"); change(singular === "Student" ? "USN / User code" : "User code", "new.person"); change("Temporary password", "Temporary_123!");
  if (singular === "HOD") { await screen.findByRole("option", { name: "MCA — Computer Applications" }); change("Department", "dept"); }
  if (singular === "Student") { change("Semester", "2"); change("Section", "A"); change("Admission batch", "2025-2027"); }
  fireEvent.click(screen.getByRole("button", { name: "Save Changes" })); await screen.findByText(`${singular} saved successfully.`);
  const fields = api.createAcademic.mock.calls[0][1]; expect(fields.initialPassword).toBe("Temporary_123!"); expect(fields).not.toHaveProperty("role");
  if (singular !== "HOD") expect(fields).not.toHaveProperty("departmentId");
});
it.each([["/subjects", "Subject"], ["/classes", "Class Group"]])("%s creates curriculum with controlled semester/year fields", async (path, singular) => {
  open(path, "HOD"); fireEvent.click(await screen.findByRole("button", { name: `Add ${singular}` }));
  change("Semester", "2");
  if (singular === "Subject") { change("Subject name", "Data Structures"); change("Subject code", "MMC201"); }
  else { change("Section", "A"); change("Academic year", "2026-2027"); }
  fireEvent.click(screen.getByRole("button", { name: "Save Changes" })); await screen.findByText(`${singular} saved successfully.`);
  expect(api.createAcademic.mock.calls[0][1].semester).toBe(2);
});
it("creates assignments with server-backed choices and no department field", async () => {
  api.listAcademic.mockImplementation(async resource => resource === "faculty-assignments" ? pageResult() : pageResult([row]));
  open("/faculty-assignments", "HOD"); fireEvent.click(await screen.findByRole("button", { name: "Add Assignment" }));
  await screen.findByRole("option", { name: "Example Person (example.person)" });
  change("Faculty", "record"); change("Subject", "record"); change("Class group", "record"); change("Academic year", "2026-2027");
  fireEvent.click(screen.getByRole("button", { name: "Save Changes" })); await screen.findByText("Assignment saved successfully.");
  expect(api.createAcademic).toHaveBeenCalledWith("faculty-assignments", { facultyId: "record", subjectId: "record", classGroupId: "record", academicYear: "2026-2027", isActive: true });
});
it("duplicate/server failures retain editable values and prevent duplicate saves", async () => {
  let complete;
  api.createAcademic.mockImplementationOnce(() => new Promise((resolve, reject) => { complete = reject; }));
  open("/departments", "PRINCIPAL"); fireEvent.click(await screen.findByRole("button", { name: "Add Department" }));
  change("Department name", "Department"); change("Department code", "MCA");
  const form = screen.getByRole("form", { name: "Add Department" }); fireEvent.submit(form); fireEvent.submit(form);
  expect(api.createAcademic).toHaveBeenCalledOnce(); expect(screen.getByText("Saving...")).toBeTruthy();
  await act(async () => complete({ status: 409, message: "A record with this academic identity already exists." }));
  expect(screen.getByRole("alert").textContent).toContain("already exists"); expect(screen.getByLabelText("Department code").value).toBe("MCA");
  fireEvent.click(screen.getByRole("button", { name: "Cancel" })); expect(screen.queryByLabelText("Department code")).toBeNull();
});
it("search/filter resets pagination and Next/Previous use server pages", async () => {
  api.listAcademic.mockImplementation(async (resource, query) => pageResult([row], query.page, 21));
  open("/students", "HOD"); await screen.findByRole("table");
  fireEvent.click(screen.getByRole("button", { name: "Next" })); await screen.findByText("Page 2 of 2");
  change("Search", "example"); change("Semester filter", "2"); change("Section filter", "A"); fireEvent.submit(screen.getByRole("form", { name: "Search academic records" }));
  await screen.findByText("Page 1 of 2");
  expect(api.listAcademic).toHaveBeenLastCalledWith("students", expect.objectContaining({ page: 1, search: "example", semester: "2", section: "A" }), expect.any(Object));
  expect(screen.getByRole("button", { name: "Previous" }).disabled).toBe(true);
});
it("list failure can retry without displaying internal errors", async () => {
  api.listAcademic.mockRejectedValueOnce(new Error("database secret")); open("/departments", "PRINCIPAL");
  expect(await screen.findByText("Unable to load academic records. Please try again.")).toBeTruthy();
  expect(screen.queryByText("database secret")).toBeNull(); fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  await screen.findByText("No departments yet");
});
it("a failed search does not display stale records under the new filter", async () => {
  api.listAcademic.mockResolvedValueOnce(pageResult([row])).mockRejectedValueOnce(new Error("offline"));
  open("/faculty", "HOD"); await screen.findByRole("table");
  change("Search", "different"); fireEvent.submit(screen.getByRole("form", { name: "Search academic records" }));
  await screen.findByText("Unable to load academic records. Please try again.");
  expect(screen.queryByRole("table")).toBeNull();
  expect(screen.queryByRole("cell", { name: row.name })).toBeNull();
});
it.each([["/departments", "HOD"], ["/hods", "FACULTY"], ["/faculty", "PRINCIPAL"], ["/students", "STUDENT"], ["/subjects", "FACULTY"], ["/classes", "STUDENT"], ["/faculty-assignments", "FACULTY"]])("wrong-role %s is redirected before management data loads", async (path, role) => {
  open(path, role); await screen.findByText("No recent activity yet");
  expect(api.listAcademic).not.toHaveBeenCalled(); expect(screen.queryByRole("button", { name: /^Add / })).toBeNull();
});
it("Faculty sees only read-only assignment history", async () => {
  api.listAcademic.mockResolvedValue(pageResult([row])); open("/my-assignments", "FACULTY"); await screen.findByRole("table");
  expect(screen.getByRole("cell", { name: "MMC201 — Data Structures" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Edit" })).toBeNull(); expect(screen.queryByRole("button", { name: "Deactivate" })).toBeNull();
});
it("dashboard displays real zero/nonzero values from the API", async () => {
  api.getAcademicDashboard.mockResolvedValue({ data: { metrics: { Departments: 0, Faculty: 3 } } }); open("/principal/dashboard", "PRINCIPAL");
  await waitFor(() => expect(screen.getByText("0")).toBeTruthy()); expect(screen.getByText("3")).toBeTruthy();
});
