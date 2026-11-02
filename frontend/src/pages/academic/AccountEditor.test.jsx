import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import AccountEditor from "./AccountEditor";
import * as api from "../../services/academicService";
vi.mock("../../services/academicService", () => ({ listAcademic: vi.fn() }));
let save;
beforeEach(() => {
  save = vi.fn().mockResolvedValue(undefined);
  api.listAcademic.mockResolvedValue({ data: { items: [{ id: "department-id", code: "MCA01", name: "MCA" }], pagination: { hasNextPage: false } } });
});
afterEach(() => { cleanup(); vi.resetAllMocks(); });
const open = async () => {
  render(<AccountEditor accountType="HOD" onSave={save} onCancel={() => {}} />);
  await screen.findByRole("option", { name: "MCA01 — MCA" });
};
const change = (label, value) => fireEvent.change(screen.getByLabelText(label, { exact: true }), { target: { value } });
const fill = async () => {
  await open();
  change("Name", "Test HOD"); change("Email", "hod@college.edu"); change("User code", "hod.mca01");
  change("Temporary password", "Temporary_123!"); change("Department", "department-id");
};
it.each([
  ["Temporary password", "Short1!", "Temporary password must contain at least 8 characters."],
  ["User code", "ab", "User code must contain at least 3 characters."],
  ["Email", "not-an-email", "Enter a valid email address."],
  ["Name", " ", "Name is required."],
  ["Name", " A ", "Name must contain at least 2 characters."],
  ["Department", "", "Department is required."],
])("identifies and focuses invalid %s instead of showing an ambiguous form error", async (label, value, message) => {
  await fill(); change(label, value); fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));
  expect(screen.getByRole("alert").textContent).toBe(message);
  expect(document.activeElement).toBe(screen.getByLabelText(label, { exact: true }));
  expect(save).not.toHaveBeenCalled();
});
it("submits a completely valid form", async () => {
  await fill(); fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));
  expect(save).toHaveBeenCalledWith(expect.objectContaining({ name: "Test HOD", email: "hod@college.edu", userCode: "hod.mca01", initialPassword: "Temporary_123!", departmentId: "department-id" }));
});
it("clears an old warning when the user corrects a field", async () => {
  await fill(); change("Email", "invalid"); fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));
  expect(screen.getByRole("alert").textContent).toBe("Enter a valid email address.");
  change("Email", "valid@college.edu"); expect(screen.queryByRole("alert")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Save Changes" })); expect(save).toHaveBeenCalledOnce();
});
it("accepts native autofilled values even when no React change event was emitted", async () => {
  await open();
  for (const [label, value] of [["Name", "Autofilled HOD"], ["Email", "hod@college.edu"], ["User code", "autofilled.hod"], ["Temporary password", "Temporary_123!"], ["Department", "department-id"]]) {
    screen.getByLabelText(label, { exact: true }).value = value;
  }
  fireEvent.submit(screen.getByRole("form", { name: "Add HOD" }));
  expect(save).toHaveBeenCalledWith(expect.objectContaining({ name: "Autofilled HOD", userCode: "autofilled.hod", initialPassword: "Temporary_123!", departmentId: "department-id" }));
});
