import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { vi } from "vitest";
import AccountEditor from "./AccountEditor";
import * as api from "../../services/academicService";
vi.mock("../../services/academicService", () => ({ listAcademic: vi.fn() }));
const result = (items, more = false) => ({ data: { items, pagination: { hasNextPage: more } } });
const choices = [{ batch: "2026-2028", section: "B", isActive: true }, { batch: "2025-2027", section: "A", isActive: true }, { batch: "2026-2028", section: "A", isActive: true }, { batch: "2024-2026", section: "Z", isActive: false }];
const open = props => render(<AccountEditor accountType="Student" onSave={vi.fn()} onCancel={() => {}} {...props} />);
beforeEach(() => api.listAcademic.mockResolvedValue(result(choices)));
afterEach(() => { cleanup(); vi.resetAllMocks(); });
it("uses sorted, unique dropdown values from active department classes", async () => {
  open(); await screen.findByRole("option", { name: "2025-2027" });
  expect(screen.getByLabelText("Admission batch").tagName).toBe("SELECT");
  expect(screen.getByLabelText("Section").tagName).toBe("SELECT");
  expect([...screen.getByLabelText("Section").options].map(option => option.value)).toEqual(["", "A", "B"]);
  expect([...screen.getByLabelText("Admission batch").options].map(option => option.value)).toEqual(["", "2025-2027", "2026-2028"]);
  expect(api.listAcademic).toHaveBeenCalledWith("classes", { page: 1, limit: 100, status: "active" }, expect.objectContaining({ signal: expect.anything() }));
});
it("loads all pages so later configured sections remain selectable", async () => {
  api.listAcademic.mockResolvedValueOnce(result(choices.slice(0, 1), true)).mockResolvedValueOnce(result([{ batch: "2027-2029", section: "C", isActive: true }]));
  open(); await screen.findByRole("option", { name: "C" });
  expect(api.listAcademic).toHaveBeenLastCalledWith("classes", { page: 2, limit: 100, status: "active" }, expect.anything());
});
it("submits chosen batch and section as the existing student fields", async () => {
  const save = vi.fn().mockResolvedValue(undefined); open({ onSave: save });
  await screen.findByRole("option", { name: "A" });
  for (const [label, value] of [["Name", "New Student"], ["USN / User code", "student.test"], ["Temporary password", "Temporary_123!"], ["Admission batch", "2026-2028"], ["Section", "B"]]) fireEvent.change(screen.getByLabelText(label, { exact: true }), { target: { value } });
  fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));
  await waitFor(() => expect(save).toHaveBeenCalledWith(expect.objectContaining({ batch: "2026-2028", section: "B", semester: 1 })));
});
it("keeps existing student values when their class is no longer active", async () => {
  open({ record: { id: "student", name: "Existing Student", userCode: "student.existing", batch: "2023-2025", section: "D", semester: 2 } });
  await screen.findByRole("option", { name: "2025-2027" });
  expect(screen.getByLabelText("Admission batch").value).toBe("2023-2025");
  expect(screen.getByLabelText("Section").value).toBe("D");
});
it("explains empty configuration and refreshes after the HOD creates classes", async () => {
  api.listAcademic.mockResolvedValueOnce(result([])); open();
  await screen.findByText("No admission batches or sections have been configured yet.");
  expect(within(screen.getByRole("form")).getByRole("link", { name: /Manage batches/ }).getAttribute("href")).toBe("/classes");
  fireEvent.click(screen.getByRole("button", { name: "Refresh batch and section options" }));
  await screen.findByRole("option", { name: "2026-2028" });
});
it("reports load errors and recovers without discarding entered student details", async () => {
  api.listAcademic.mockRejectedValueOnce(new Error("offline")); open();
  fireEvent.change(screen.getByLabelText("Name", { exact: true }), { target: { value: "Unsaved Student" } });
  await screen.findByText(/Unable to load admission batches and sections/);
  fireEvent.click(screen.getByRole("button", { name: "Refresh batch and section options" }));
  await screen.findByRole("option", { name: "A" });
  expect(screen.getByLabelText("Name", { exact: true }).value).toBe("Unsaved Student");
});
