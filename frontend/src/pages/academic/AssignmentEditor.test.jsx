import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import AssignmentEditor from "./AssignmentEditor";
import * as api from "../../services/academicService";
vi.mock("../../services/academicService", () => ({ listAcademic: vi.fn(), getAcademicOptions: vi.fn() }));
const result = items => ({ data: { items, pagination: { hasNextPage: false } } });
const open = props => render(<AssignmentEditor onSave={vi.fn()} onCancel={() => {}} {...props} />);
const choose = (label, value) => fireEvent.change(screen.getByLabelText(label, { exact: true }), { target: { value } });
beforeEach(() => {
  api.getAcademicOptions.mockResolvedValue({ data: { academicYears: ["2026-2027", "2027-2028"], sections: [] } });
  api.listAcademic.mockImplementation(async (resource, query) => result(resource === "faculty" ? [{ id: "faculty", name: "Faculty Person", userCode: "faculty.one" }] : resource === "subjects" ? [{ id: "subject", code: "MCA201", name: "Data Structures", semester: 2 }] : [{ id: query.academicYear === "2026-2027" ? "class-a" : "class-b", semester: 2, section: "A", academicYear: query.academicYear }]));
});
afterEach(() => { cleanup(); vi.resetAllMocks(); });
it("requires a configured academic year before loading matching class groups", async () => {
  open(); await screen.findByRole("option", { name: "2026-2027", exact: true });
  expect(screen.getByLabelText("Academic year").tagName).toBe("SELECT");
  expect(screen.getByLabelText("Class group").disabled).toBe(true);
  expect(api.listAcademic.mock.calls.some(([resource]) => resource === "classes")).toBe(false);
  choose("Academic year", "2026-2027");
  await screen.findByRole("option", { name: /Semester 2 \/ A \/ 2026-2027/ });
  expect(api.listAcademic).toHaveBeenCalledWith("classes", expect.objectContaining({ academicYear: "2026-2027", status: "active" }), expect.anything());
});
it("clears a previously selected class when the academic year changes", async () => {
  open(); await screen.findByRole("option", { name: "2026-2027", exact: true }); choose("Academic year", "2026-2027");
  await screen.findByRole("option", { name: /Semester 2 \/ A \/ 2026-2027/ }); choose("Class group", "class-a");
  choose("Academic year", "2027-2028"); await screen.findByRole("option", { name: /Semester 2 \/ A \/ 2027-2028/ });
  expect(screen.getByLabelText("Class group").value).toBe("");
  expect(screen.queryByRole("option", { name: /Semester 2 \/ A \/ 2026-2027/ })).toBeNull();
});
it("saves the selected year and matching class using the existing assignment payload", async () => {
  const save = vi.fn().mockResolvedValue(undefined); open({ onSave: save });
  await screen.findByRole("option", { name: "Faculty Person (faculty.one)" });
  await screen.findByRole("option", { name: "2026-2027", exact: true });
  choose("Faculty", "faculty"); choose("Subject", "subject"); choose("Academic year", "2026-2027");
  await screen.findByRole("option", { name: /Semester 2 \/ A \/ 2026-2027/ }); choose("Class group", "class-a");
  fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));
  await waitFor(() => expect(save).toHaveBeenCalledWith({ facultyId: "faculty", subjectId: "subject", classGroupId: "class-a", academicYear: "2026-2027", isActive: true }));
});
it("explains missing configuration and retries a failed year lookup", async () => {
  api.getAcademicOptions.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce({ data: { academicYears: [], sections: [] } });
  open(); await screen.findByText("Unable to load academic dropdown options. Please try again.");
  fireEvent.click(screen.getByRole("button", { name: "Retry academic years" }));
  await screen.findByText("Create an active class group with its academic year in Classes first.");
});
it("keeps historical assignment relationships read-only during status editing", () => {
  open({ record: { isActive: true, academicYear: "2025-2026", faculty: { name: "Faculty Person" }, subject: { code: "MCA201" }, classGroup: { semester: 2, section: "A" } } });
  expect(screen.queryByLabelText("Academic year")).toBeNull();
  expect(api.getAcademicOptions).not.toHaveBeenCalled();
});
