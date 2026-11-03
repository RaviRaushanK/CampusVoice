import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";
import App from "../../App";
import * as api from "../../services/feedbackSessionService";
import * as auth from "../../services/authService";
import * as academic from "../../services/academicService";
import * as notifications from "../../services/notificationService";
vi.mock("../../services/feedbackSessionService", () => ({ getStudentSessions: vi.fn(), getStudentSession: vi.fn(), submitSessionResponse: vi.fn() }));
vi.mock("../../services/authService", () => ({ me: vi.fn(), logout: vi.fn() }));
vi.mock("../../services/academicService", () => ({ getAcademicDashboard: vi.fn() }));
vi.mock("../../services/notificationService", () => ({ getUnreadCount: vi.fn() }));
const session = { id: "session", title: "Unit feedback", description: "Please give feedback", allowAnonymous: true, faculty: { name: "Faculty Person" }, subject: { code: "MMC201", name: "Data Structures" }, classGroup: { semester: 2, section: "A", academicYear: "2026-2027" }, closesAt: null, availability: "OPEN", questions: [
  { id: "single", type: "SINGLE_CHOICE", prompt: "How clear?", required: true, options: ["Clear", "Unclear"] },
  { id: "multi", type: "MULTI_SELECT", prompt: "Which topics?", required: true, options: ["Stacks", "Queues"] },
  { id: "rating", type: "RATING", prompt: "Rate lecture", required: true },
  { id: "short", type: "SHORT_ANSWER", prompt: "Improvements", required: true },
  { id: "optional", type: "SHORT_ANSWER", prompt: "Anything else?", required: false },
] };
const result = (items = [], extra = {}) => ({ data: { items, pagination: { page: 1, limit: 20, total: items.length, totalPages: items.length ? 1 : 0, hasPreviousPage: false, hasNextPage: false, ...extra } } });
const open = (path = "/feedback-sessions", role = "STUDENT", overrides = {}) => { auth.me.mockResolvedValue({ data: { id: "student", role, name: "Student", userCode: "student", mustChangePassword: false, ...overrides } }); return render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>); };
const start = async () => { open("/feedback-sessions/session/respond"); await screen.findByRole("form", { name: "Student feedback" }); };
const fill = () => { fireEvent.click(screen.getByLabelText("Clear", { exact: true })); fireEvent.click(screen.getByLabelText("Stacks", { exact: true })); fireEvent.click(screen.getByLabelText("Queues", { exact: true })); fireEvent.click(screen.getByLabelText("5", { exact: true })); fireEvent.change(screen.getByLabelText("Answer question 4"), { target: { value: "More examples" } }); };
const confirm = () => { fireEvent.click(screen.getByRole("button", { name: "Submit Feedback" })); fireEvent.click(screen.getByRole("button", { name: "Confirm Submission" })); };
beforeEach(() => {
  notifications.getUnreadCount.mockResolvedValue({ data: { count: 0 } }); academic.getAcademicDashboard.mockResolvedValue({ data: { metrics: { "Pending Feedback Sessions": 1, "Completed Feedback Sessions": 0 } } });
  api.getStudentSessions.mockResolvedValue(result()); api.getStudentSession.mockResolvedValue({ data: session }); api.submitSessionResponse.mockResolvedValue({ data: { sessionId: "session", identityMode: "ANONYMOUS", submittedAt: "2026-11-03T10:00:00Z" } });
});
afterEach(() => { cleanup(); vi.resetAllMocks(); });
it("shows loading and both empty states with category changes", async () => {
  let resolve; api.getStudentSessions.mockImplementationOnce(() => new Promise(finish => { resolve = finish; })); open(); await screen.findByText("Loading feedback sessions"); await waitFor(() => expect(api.getStudentSessions).toHaveBeenCalled());
  await act(async () => resolve(result())); await screen.findByText("No feedback sessions are waiting for your response."); fireEvent.click(screen.getByRole("button", { name: "Completed", exact: true })); await screen.findByText("You have not completed any feedback sessions yet.");
  expect(api.getStudentSessions).toHaveBeenLastCalledWith({ category: "completed", page: 1 }, expect.anything());
});
it("renders pending context/navigation and paginates", async () => {
  api.getStudentSessions.mockResolvedValue(result([session], { totalPages: 2, hasNextPage: true })); open(); await screen.findByRole("article", { name: session.title });
  expect(screen.getByRole("link", { name: "Give Feedback" }).getAttribute("href")).toBe("/feedback-sessions/session/respond");
  expect(screen.getByText(/Semester 2/)).toBeTruthy(); fireEvent.click(screen.getByRole("button", { name: "Next" })); await waitFor(() => expect(api.getStudentSessions).toHaveBeenLastCalledWith({ category: "pending", page: 2 }, expect.anything()));
});
it("retries list failure", async () => {
  api.getStudentSessions.mockRejectedValueOnce(new Error("network")); open(); await screen.findByText("Unable to load feedback sessions. Please try again."); fireEvent.click(screen.getByRole("button", { name: "Retry feedback sessions" })); await screen.findByText("No feedback sessions are waiting for your response.");
});
it("completed view displays locked identity/time and offers no response editor", async () => {
  api.getStudentSessions.mockResolvedValue(result([{ ...session, completion: { submittedAt: "2026-11-03T10:00:00Z", identityMode: "ANONYMOUS" } }])); open("/feedback-sessions?category=completed"); const card = await screen.findByRole("article");
  expect(within(card).getByText("Identity: Anonymous (locked)")).toBeTruthy(); expect(within(card).queryByRole("link")).toBeNull();
});
it("dashboard renders real session counts and navigation", async () => {
  open("/student/dashboard"); await screen.findByText("Pending Feedback Sessions"); expect(screen.getByText("Completed Feedback Sessions")).toBeTruthy(); expect(screen.getAllByRole("link", { name: "Feedback Sessions" }).length).toBe(2);
});
it("renders all four labelled controls, optional question and anonymous default", async () => {
  await start(); expect(screen.getByLabelText("Stay Anonymous").checked).toBe(true); expect(screen.getByLabelText("Clear").type).toBe("radio"); expect(screen.getByLabelText("Stacks").type).toBe("checkbox"); expect(screen.getByLabelText("1").type).toBe("radio");
  expect(screen.getByLabelText("Answer question 4").maxLength).toBe(1000); expect(screen.getByText(/Anything else\? \(Optional\)/)).toBeTruthy();
});
it.each([1, 2, 3, 4])("validates missing required question %s before confirmation", async index => {
  await start();
  if (index > 1) fireEvent.click(screen.getByLabelText("Clear")); if (index > 2) fireEvent.click(screen.getByLabelText("Stacks")); if (index > 3) fireEvent.click(screen.getByLabelText("5"));
  fireEvent.click(screen.getByRole("button", { name: "Submit Feedback" })); await screen.findByText(`Answer required question ${index}.`); expect(api.submitSessionResponse).not.toHaveBeenCalled();
});
it("uses named-only mode with no fake anonymity choice", async () => {
  api.getStudentSession.mockResolvedValue({ data: { ...session, allowAnonymous: false } }); await start(); expect(screen.getByText("This session uses named responses.")).toBeTruthy(); expect(screen.queryByLabelText("Stay Anonymous")).toBeNull(); fill(); confirm();
  await waitFor(() => expect(api.submitSessionResponse).toHaveBeenCalledWith("session", expect.objectContaining({ identityMode: "NAMED" })));
});
it("confirmation can be cancelled; successful anonymous submission refreshes Completed authoritatively", async () => {
  api.getStudentSessions.mockResolvedValue(result([{ ...session, completion: { submittedAt: "2026-11-03T10:00:00Z", identityMode: "ANONYMOUS" } }])); await start(); fill();
  fireEvent.click(screen.getByRole("button", { name: "Submit Feedback" })); expect(screen.getByRole("alertdialog").textContent).toContain("not be able to edit"); expect(api.submitSessionResponse).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Keep editing" })); expect(screen.getByLabelText("Answer question 4").value).toBe("More examples"); confirm();
  await screen.findByText("Feedback submitted successfully. Thank you for completing this session."); expect(screen.getByText("Identity: Anonymous (locked)")).toBeTruthy();
  expect(api.submitSessionResponse).toHaveBeenCalledWith("session", { identityMode: "ANONYMOUS", answers: [{ questionId: "single", value: "Clear" }, { questionId: "multi", value: ["Stacks", "Queues"] }, { questionId: "rating", value: 5 }, { questionId: "short", value: "More examples" }] });
  expect(api.getStudentSessions).toHaveBeenLastCalledWith({ category: "completed", page: 1 }, expect.anything()); expect(screen.queryByRole("form", { name: "Student feedback" })).toBeNull();
});
it("can reveal identity, deselect multi choice and omit optional answers", async () => {
  await start(); fill(); fireEvent.click(screen.getByLabelText("Reveal Identity")); fireEvent.click(screen.getByLabelText("Queues")); confirm();
  await waitFor(() => expect(api.submitSessionResponse).toHaveBeenCalledWith("session", expect.objectContaining({ identityMode: "NAMED", answers: expect.arrayContaining([{ questionId: "multi", value: ["Stacks"] }]) })));
});
it("disables submission during processing and retains values on backend failure", async () => {
  let reject; api.submitSessionResponse.mockImplementationOnce(() => new Promise((_, fail) => { reject = fail; })); await start(); fill(); confirm();
  fireEvent.click(screen.getByRole("button", { name: "Submitting..." })); expect(api.submitSessionResponse).toHaveBeenCalledOnce(); expect(screen.getByRole("button", { name: "Submitting..." }).disabled).toBe(true);
  await act(async () => reject(new Error("Network failure. Please retry."))); await screen.findByText("Network failure. Please retry."); expect(screen.getByLabelText("Answer question 4").value).toBe("More examples"); expect(screen.getByRole("button", { name: "Submit Feedback" }).closest("fieldset").disabled).toBe(false);
});
it.each(["ALREADY_SUBMITTED", "SESSION_UNAVAILABLE"])("locks editor after authoritative %s submission rejection", async code => {
  api.submitSessionResponse.mockRejectedValueOnce(Object.assign(new Error("This session is unavailable."), { code })); await start(); fill(); confirm(); await screen.findByText("This session is unavailable."); expect(screen.getByRole("button", { name: "Submit Feedback" }).closest("fieldset").disabled).toBe(true);
});
it("retries questionnaire load errors and never shows editor for completed session", async () => {
  api.getStudentSession.mockRejectedValueOnce(new Error("Unable to load questionnaire.")); open("/feedback-sessions/session/respond"); await screen.findByText("Unable to load questionnaire."); fireEvent.click(screen.getByRole("button", { name: "Retry questionnaire" })); await screen.findByRole("form", { name: "Student feedback" });
});
it("completed questionnaire URL has no editable fields", async () => {
  api.getStudentSession.mockRejectedValueOnce(Object.assign(new Error("You have already submitted this feedback session."), { code: "ALREADY_SUBMITTED" })); open("/feedback-sessions/session/respond"); await screen.findByText("You have already submitted this feedback session."); expect(screen.queryByRole("form")).toBeNull(); expect(screen.queryByRole("button", { name: "Retry questionnaire" })).toBeNull();
});
it("does not fetch Student sessions during first-login restriction", async () => {
  open("/feedback-sessions", "STUDENT", { mustChangePassword: true }); await screen.findByText("First login - change your password"); expect(api.getStudentSessions).not.toHaveBeenCalled();
});
it.each(["FACULTY", "HOD", "PRINCIPAL"])("%s cannot open Student questionnaire route", async role => {
  open("/feedback-sessions/session/respond", role); await screen.findByText("No recent activity yet"); expect(api.getStudentSession).not.toHaveBeenCalled();
});
