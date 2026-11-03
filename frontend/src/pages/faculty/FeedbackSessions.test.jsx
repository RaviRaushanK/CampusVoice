import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";
import App from "../../App";
import * as service from "../../services/feedbackSessionService";
import * as academic from "../../services/academicService";
import * as auth from "../../services/authService";
import * as notifications from "../../services/notificationService";
vi.mock("../../services/feedbackSessionService", () => ({ getMySessions: vi.fn(), getSession: vi.fn(), createSession: vi.fn(), updateSession: vi.fn(), deleteDraft: vi.fn(), publishSession: vi.fn(), closeSession: vi.fn() }));
vi.mock("../../services/academicService", () => ({ listAcademic: vi.fn(), getAcademicDashboard: vi.fn() }));
vi.mock("../../services/authService", () => ({ me: vi.fn(), logout: vi.fn() }));
vi.mock("../../services/notificationService", () => ({ getUnreadCount: vi.fn() }));
const assignment = { id: "assignment", isUsable: true, academicYear: "2026-2027", subject: { code: "MMC201", name: "Data Structures" }, classGroup: { semester: 2, section: "A", academicYear: "2026-2027" } };
const draft = { ...assignment, id: "session", facultyAssignmentId: "assignment", title: "Lecture feedback", description: "Details", allowAnonymous: true, opensAt: null, closesAt: null, status: "DRAFT", questionCount: 1, questions: [{ id: "question", type: "SHORT_ANSWER", prompt: "Any suggestions?", required: true }] };
const result = (items = [], pagination = {}) => ({ data: { items, pagination: { page: 1, total: items.length, totalPages: items.length ? 1 : 0, hasNextPage: false, hasPreviousPage: false, ...pagination } } });
const open = (path = "/my-sessions", role = "FACULTY", extra = {}) => {
  auth.me.mockResolvedValue({ data: { id: "actor", userCode: "actor", role, name: "Actor", mustChangePassword: false, ...extra } });
  return render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>);
};
const change = (label, value) => fireEvent.change(screen.getByLabelText(label, { exact: true }), { target: { value } });
const add = (type, number, prompt = `Prompt ${number}`) => {
  change("New question type", type); fireEvent.click(screen.getByRole("button", { name: "Add Question", exact: true })); change(`Question ${number} prompt`, prompt);
};
const start = async () => { open("/my-sessions/new"); await screen.findByLabelText("Teaching Assignment"); change("Teaching Assignment", "assignment"); change("Title", "New feedback"); };
beforeEach(() => {
  notifications.getUnreadCount.mockResolvedValue({ data: { count: 0 } });
  academic.listAcademic.mockResolvedValue(result([assignment])); academic.getAcademicDashboard.mockResolvedValue({ data: { metrics: {} } });
  service.getMySessions.mockResolvedValue(result()); service.getSession.mockResolvedValue({ data: draft });
  service.createSession.mockResolvedValue({ data: draft }); service.updateSession.mockResolvedValue({ data: draft }); service.deleteDraft.mockResolvedValue({ data: { deleted: true } });
  service.publishSession.mockResolvedValue({ data: { ...draft, status: "OPEN", availability: "OPEN", notificationDelivery: { sent: 1, failed: 0 } } }); service.closeSession.mockResolvedValue({ data: { ...draft, status: "CLOSED", availability: "CLOSED" } });
});
afterEach(() => { cleanup(); vi.resetAllMocks(); });
it("question Add/Undo/Redo restores local state and new edit clears redo", async () => {
  await start(); expect(screen.getByRole("button", { name: "Undo", exact: true }).disabled).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Add Question", exact: true }));
  fireEvent.click(screen.getByRole("button", { name: "Undo", exact: true })); expect(screen.queryByLabelText("Question 1 prompt")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Redo", exact: true })); expect(screen.getByLabelText("Question 1 prompt").value).toBe("");
  change("Question 1 prompt", "First change"); change("Question 1 prompt", "Second change");
  fireEvent.click(screen.getByRole("button", { name: "Undo", exact: true })); expect(screen.getByLabelText("Question 1 prompt").value).toBe("First change");
  change("Question 1 prompt", "New branch"); expect(screen.getByRole("button", { name: "Redo", exact: true }).disabled).toBe(true); expect(service.createSession).not.toHaveBeenCalled();
});
it("question removal and reordering Undo preserve stable IDs and normal Save", async () => {
  service.getSession.mockResolvedValue({ data: { ...draft, questions: [draft.questions[0], { ...draft.questions[0], id: "second", prompt: "Second prompt" }] } });
  open("/my-sessions/session/edit"); await screen.findByLabelText("Question 1 prompt");
  fireEvent.click(screen.getByRole("button", { name: "Move question 2 up", exact: true })); expect(screen.getByLabelText("Question 1 prompt").value).toBe("Second prompt");
  fireEvent.click(screen.getByRole("button", { name: "Undo", exact: true })); expect(screen.getByLabelText("Question 1 prompt").value).toBe("Any suggestions?");
  fireEvent.click(screen.getByRole("button", { name: "Remove question 1", exact: true }));
  fireEvent.click(screen.getByRole("button", { name: "Undo", exact: true })); expect(screen.getByLabelText("Question 1 prompt").value).toBe("Any suggestions?");
  fireEvent.click(screen.getByRole("button", { name: "Save Draft", exact: true }));
  await waitFor(() => expect(service.updateSession).toHaveBeenCalled()); expect(service.updateSession.mock.calls[0][1].questions.map(item => item.id)).toEqual(["question", "second"]);
});
it("question history is bounded to 50 states", async () => {
  await start(); fireEvent.click(screen.getByRole("button", { name: "Add Question", exact: true }));
  const prompt = screen.getByLabelText("Question 1 prompt"), undoButton = screen.getByRole("button", { name: "Undo", exact: true });
  for (let index = 0; index <= 50; index++) fireEvent.change(prompt, { target: { value: `Edit ${index}` } });
  for (let index = 0; index < 50; index++) fireEvent.click(undoButton);
  expect(screen.getByLabelText("Question 1 prompt").value).toBe("Edit 0"); expect(screen.getByRole("button", { name: "Undo", exact: true }).disabled).toBe(true);
});
it("published sessions cannot expose Undo or Redo", async () => { service.getSession.mockResolvedValue({ data: { ...draft, status: "OPEN" } }); open("/my-sessions/session/edit"); await screen.findByText("Only draft sessions can be edited."); expect(screen.queryByRole("button", { name: "Undo", exact: true })).toBeNull(); expect(screen.queryByRole("button", { name: "Redo", exact: true })).toBeNull(); });
it("shows loading, empty state and Create Session navigation", async () => {
  let finish; service.getMySessions.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; })); open();
  await screen.findByText("Loading sessions"); await waitFor(() => expect(service.getMySessions).toHaveBeenCalled()); await act(async () => finish(result()));
  await screen.findByText("No feedback sessions yet."); expect(screen.getByRole("link", { name: "Create Session" }).getAttribute("href")).toBe("/my-sessions/new");
});
it("renders draft/context/settings and edit navigation; filters and paginates server-side", async () => {
  service.getMySessions.mockResolvedValue(result([draft], { totalPages: 2, hasNextPage: true })); open();
  const card = await screen.findByRole("article", { name: draft.title });
  expect(within(card).getByText("DRAFT")).toBeTruthy(); expect(within(card).getByText(/MMC201.*Semester 2.*Section A.*2026-2027/)).toBeTruthy();
  expect(within(card).getByRole("link", { name: "Edit Draft" }).getAttribute("href")).toBe("/my-sessions/session/edit");
  fireEvent.click(screen.getByRole("button", { name: "Next" })); await waitFor(() => expect(service.getMySessions).toHaveBeenLastCalledWith({ page: 2, status: "all" }, expect.anything()));
  change("Session status", "DRAFT"); await waitFor(() => expect(service.getMySessions).toHaveBeenLastCalledWith({ page: 1, status: "DRAFT" }, expect.anything()));
});
it("retries a list failure", async () => {
  service.getMySessions.mockRejectedValueOnce(new Error("offline")); open(); await screen.findByText("Unable to load sessions. Please try again.");
  fireEvent.click(screen.getByRole("button", { name: "Retry sessions" })); await screen.findByText("No feedback sessions yet.");
});
it("confirms draft deletion, retains data after failure and retries", async () => {
  service.getMySessions.mockResolvedValue(result([draft])); service.deleteDraft.mockRejectedValueOnce(new Error("Unable to delete draft.")); open();
  fireEvent.click(await screen.findByRole("button", { name: "Delete Draft" })); expect(service.deleteDraft).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Cancel deletion" })); expect(screen.queryByText("Confirm delete")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Delete Draft" })); fireEvent.click(screen.getByRole("button", { name: "Confirm delete" }));
  await screen.findByText("Unable to delete draft."); expect(screen.getByRole("article")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Confirm delete" })); await waitFor(() => expect(service.deleteDraft).toHaveBeenCalledTimes(2));
});
it("loads assignments with cancellation and offers no form when none are usable", async () => {
  let finish; academic.listAcademic.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; })); open("/my-sessions/new"); await screen.findByText("Loading assignments"); await waitFor(() => expect(academic.listAcademic).toHaveBeenCalled());
  await act(async () => finish(result([{ ...assignment, isUsable: false }])));
  await screen.findByText("You do not currently have an active teaching assignment."); expect(screen.queryByRole("button", { name: "Save Draft" })).toBeNull();
});
it("loads subsequent assignment pages and filters unusable records", async () => {
  academic.listAcademic.mockResolvedValueOnce(result([{ ...assignment, id: "inactive", isUsable: false }], { hasNextPage: true })).mockResolvedValueOnce(result([assignment]));
  open("/my-sessions/new"); await screen.findByRole("option", { name: /MMC201/ });
  expect(academic.listAcademic).toHaveBeenNthCalledWith(2, "faculty-assignments/mine", { status: "active", page: 2, limit: 100 }, expect.anything());
  expect(screen.getAllByRole("option").filter(option => option.value === "inactive")).toHaveLength(0);
});
it("retries assignment failure", async () => {
  academic.listAcademic.mockRejectedValueOnce(new Error("offline")); open("/my-sessions/new"); await screen.findByText("Unable to load teaching assignments. Please try again.");
  fireEvent.click(screen.getByRole("button", { name: "Retry builder" })); await screen.findByLabelText("Teaching Assignment");
});
it("builds all four types, edits/removes options, toggles required, reorders and saves only allowed fields", async () => {
  await start(); change("Description", "Please give feedback."); fireEvent.click(screen.getByLabelText("Allow students to stay anonymous"));
  change("Opens At", "2027-01-01T10:00"); change("Closes At", "2027-01-01T11:00");
  add("SINGLE_CHOICE", 1); change("Question 1 option 1", "Clear"); change("Question 1 option 2", "Unclear");
  fireEvent.click(screen.getByRole("button", { name: "Add Option to question 1" })); change("Question 1 option 3", "Average"); fireEvent.click(screen.getByRole("button", { name: "Remove question 1 option 3" }));
  expect(screen.getByRole("button", { name: "Remove question 1 option 1" }).disabled).toBe(true);
  add("MULTI_SELECT", 2); change("Question 2 option 1", "Stacks"); change("Question 2 option 2", "Queues");
  add("RATING", 3); expect(screen.getByText("Scale: 1 to 5")).toBeTruthy();
  add("SHORT_ANSWER", 4); fireEvent.click(screen.getByLabelText("Question 4 required"));
  fireEvent.click(screen.getByRole("button", { name: "Move question 4 up" })); fireEvent.click(screen.getByRole("button", { name: "Move question 3 down" }));
  fireEvent.click(screen.getByRole("button", { name: "Save Draft" })); await screen.findByText("DRAFT session saved.");
  const payload = service.createSession.mock.calls[0][0];
  expect(payload).toMatchObject({ facultyAssignmentId: "assignment", title: "New feedback", description: "Please give feedback.", allowAnonymous: false });
  expect(payload.questions.map(q => q.type)).toEqual(["SINGLE_CHOICE", "MULTI_SELECT", "RATING", "SHORT_ANSWER"]); expect(payload.questions[3].required).toBe(false);
  expect(payload.opensAt).toMatch(/Z$/); expect(new Date(payload.closesAt) > new Date(payload.opensAt)).toBe(true);
  expect(Object.keys(payload).sort()).toEqual(["facultyAssignmentId", "title", "description", "allowAnonymous", "opensAt", "closesAt", "questions"].sort());
  expect(payload.questions[0]).not.toHaveProperty("key");
});
it("removes a question and previews read-only questions", async () => {
  await start(); add("SHORT_ANSWER", 1); add("RATING", 2);
  fireEvent.click(screen.getByRole("button", { name: "Remove question 1", exact: true })); expect(screen.getByLabelText("Question 1 prompt").value).toBe("Prompt 2");
  expect(screen.queryByLabelText("Question 2 prompt")).toBeNull(); expect(screen.getByText("Questionnaire preview")).toBeTruthy();
});
it.each([["prompt", "Enter a prompt for question 1."], ["blank option", "Question 1 has a blank option."], ["duplicate", "Question 1 options must be unique."], ["dates", "Closing time must be after opening time."], ["title", "Enter a session title."]])("validates %s locally without saving", async (kind, message) => {
  await start();
  if (kind === "title") change("Title", " ");
  else if (kind === "dates") { change("Opens At", "2027-01-01T12:00"); change("Closes At", "2027-01-01T11:00"); }
  else { add("SINGLE_CHOICE", 1); if (kind === "prompt") change("Question 1 prompt", " "); if (kind === "duplicate") { change("Question 1 option 1", "Same"); change("Question 1 option 2", " same "); } }
  fireEvent.submit(screen.getByRole("form", { name: "Feedback draft" })); await screen.findByText(message); expect(service.createSession).not.toHaveBeenCalled();
});
it("preserves draft input after backend failure and prevents concurrent saves", async () => {
  let reject; service.createSession.mockImplementationOnce(() => new Promise((_, fail) => { reject = fail; })); await start();
  const form = screen.getByRole("form", { name: "Feedback draft" }); fireEvent.submit(form); fireEvent.submit(form);
  expect(service.createSession).toHaveBeenCalledOnce(); expect(screen.getByText("Saving...").closest("fieldset").disabled).toBe(true);
  await act(async () => reject(new Error("Request body too large."))); await screen.findByText("Request body too large."); expect(screen.getByLabelText("Title").value).toBe("New feedback");
});
it("edits a saved draft with immutable assignment and stable IDs", async () => {
  open("/my-sessions/session/edit"); await screen.findByLabelText("Title");
  expect(screen.queryByLabelText("Teaching Assignment")).toBeNull(); expect(screen.getByText("Teaching assignment (fixed)")).toBeTruthy();
  change("Title", "Edited"); change("Question 1 prompt", "Edited prompt"); fireEvent.click(screen.getByRole("button", { name: "Save Draft" }));
  await screen.findByText("DRAFT session saved."); expect(service.updateSession).toHaveBeenCalledWith("session", expect.objectContaining({ title: "Edited", questions: [{ ...draft.questions[0], prompt: "Edited prompt" }] }));
  expect(service.updateSession.mock.calls[0][1]).not.toHaveProperty("facultyAssignmentId");
});
it("handles an unavailable draft and future OPEN status without an editor", async () => {
  service.getSession.mockRejectedValueOnce(new Error("Not found")); open("/my-sessions/session/edit"); await screen.findByText("Unable to load this feedback draft. It may be unavailable.");
  service.getSession.mockResolvedValueOnce({ data: { ...draft, status: "OPEN" } }); fireEvent.click(screen.getByRole("button", { name: "Retry builder" }));
  await screen.findByText("Only draft sessions can be edited."); expect(screen.queryByRole("button", { name: "Save Draft" })).toBeNull();
});
it("does not show academic/security ID or status editors", async () => {
  await start(); for (const name of ["Department ID", "Subject ID", "Class ID", "Faculty ID", "Status"]) expect(screen.queryByLabelText(name)).toBeNull();
});
it.each(["PRINCIPAL", "HOD", "STUDENT"])("blocks %s at the Faculty builder route", async role => {
  open("/my-sessions/new", role); await screen.findByText("No recent activity yet"); expect(academic.listAcademic).not.toHaveBeenCalled();
});
it("first-login guard prevents session loading", async () => {
  open("/my-sessions", "FACULTY", { mustChangePassword: true }); await screen.findByText("First login - change your password"); expect(service.getMySessions).not.toHaveBeenCalled();
});
it("confirms publication, refreshes authoritative state and freezes editing", async () => {
  service.getMySessions.mockResolvedValueOnce(result([draft])).mockResolvedValue(result([{ ...draft, status: "OPEN", availability: "OPEN" }])); open();
  fireEvent.click(await screen.findByRole("button", { name: "Publish Session" })); expect(service.publishSession).not.toHaveBeenCalled();
  expect(screen.getByRole("alertdialog").textContent).toContain("cannot be edited"); fireEvent.click(screen.getByRole("button", { name: "Confirm Publish" }));
  await screen.findByText("Session published. Eligible students have been notified."); await screen.findByRole("button", { name: "Close Session" }); expect(screen.queryByRole("link", { name: "Edit Draft" })).toBeNull();
});
it("retains confirmation on publish failure, prevents duplicate actions and reports notification failure", async () => {
  let reject; service.publishSession.mockImplementationOnce(() => new Promise((_, fail) => { reject = fail; })); service.getMySessions.mockResolvedValue(result([draft])); open();
  fireEvent.click(await screen.findByRole("button", { name: "Publish Session" })); fireEvent.click(screen.getByRole("button", { name: "Confirm Publish" })); fireEvent.click(screen.getByRole("button", { name: "Processing..." })); expect(service.publishSession).toHaveBeenCalledOnce();
  await act(async () => reject(new Error("Add at least one question before publishing."))); await screen.findByText("Add at least one question before publishing.");
  service.publishSession.mockResolvedValueOnce({ data: { notificationDelivery: { failed: 1, sent: 0 } } }); fireEvent.click(screen.getByRole("button", { name: "Confirm Publish" })); await screen.findByText(/Some notifications could not be delivered/);
});
it.each(["OPEN", "SCHEDULED"])("confirms close from effective %s and removes actions after closure", async availability => {
  service.getMySessions.mockResolvedValueOnce(result([{ ...draft, status: "OPEN", availability }])).mockResolvedValue(result([{ ...draft, status: "CLOSED", availability: "CLOSED" }])); open();
  fireEvent.click(await screen.findByRole("button", { name: "Close Session" })); expect(service.closeSession).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Cancel action" })); fireEvent.click(screen.getByRole("button", { name: "Close Session" })); fireEvent.click(screen.getByRole("button", { name: "Confirm Close" }));
  await screen.findByText("Session closed."); await waitFor(() => expect(screen.queryByRole("button", { name: "Close Session" })).toBeNull()); expect(screen.queryByRole("link", { name: "Edit Draft" })).toBeNull();
});
it("effective expiry hides close and edit actions even with stored OPEN", async () => {
  service.getMySessions.mockResolvedValue(result([{ ...draft, status: "OPEN", availability: "CLOSED" }])); open();
  const card = await screen.findByRole("article"); expect(within(card).getByText("CLOSED")).toBeTruthy(); expect(within(card).queryByRole("button")).toBeNull(); expect(within(card).getByRole("link", { name: "View Results" }).getAttribute("href")).toBe("/my-sessions/session/results");
});
it.each(["DRAFT", "OPEN", "CLOSED"])("%s has the correct Results entry point", async status => {
  service.getMySessions.mockResolvedValue(result([{ ...draft, status, availability: status }])); open(); const card = await screen.findByRole("article");
  const link = within(card).queryByRole("link", { name: "View Results" }); if (status === "DRAFT") expect(link).toBeNull(); else expect(link.getAttribute("href")).toBe("/my-sessions/session/results");
});
