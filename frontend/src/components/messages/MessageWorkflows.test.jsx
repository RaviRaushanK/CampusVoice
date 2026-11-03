import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";
import App from "../../App";
import * as feedback from "../../services/generalFeedbackService";
import * as suggestions from "../../services/suggestionService";
import * as auth from "../../services/authService";
import * as notices from "../../services/notificationService";
import * as academic from "../../services/academicService";
vi.mock("../../services/generalFeedbackService", () => ({ getFeedbackOptions: vi.fn(), submitGeneralFeedback: vi.fn(), getMyFeedback: vi.fn(), getReceivedFeedback: vi.fn(), getDepartmentFeedback: vi.fn(), getFeedbackAggregate: vi.fn() }));
vi.mock("../../services/suggestionService", () => ({ getSuggestionFaculty: vi.fn(), submitSuggestion: vi.fn(), getSentSuggestions: vi.fn(), getReceivedSuggestions: vi.fn() }));
vi.mock("../../services/authService", () => ({ me: vi.fn(), logout: vi.fn() }));
vi.mock("../../services/notificationService", () => ({ getUnreadCount: vi.fn() }));
vi.mock("../../services/academicService", () => ({ getAcademicDashboard: vi.fn(), listAcademic: vi.fn() }));
const summary = { totalFeedback: 2, averageRating: 4.5, distribution: [1, 2, 3, 4, 5].map(rating => ({ rating, count: rating >= 4 ? 1 : 0 })) };
const item = { id: "message", message: "Please add more worked examples.", identityMode: "ANONYMOUS", faculty: { name: "Professor One" }, subject: { code: "MMC201", name: "Data Structures" }, rating: 4, submittedAt: "2026-11-03T10:00:00Z" };
const page = (items = [], extra = {}) => ({ data: { items, summary, pagination: { page: 1, total: items.length, totalPages: items.length ? 1 : 0, hasNextPage: false, hasPreviousPage: false, ...extra } } });
const open = (path, role = "STUDENT", overrides = {}) => { auth.me.mockResolvedValue({ data: { id: "actor", role, name: "Actor", userCode: "actor", mustChangePassword: false, ...overrides } }); return render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>); };
const start = async (kind = "feedback") => { open(kind === "feedback" ? "/student/general-feedback" : "/student/suggestions"); await screen.findByLabelText(kind === "feedback" ? "Faculty / Subject" : "Send To"); };
const fill = (kind = "feedback") => {
  fireEvent.change(screen.getByLabelText(kind === "feedback" ? "Faculty / Subject" : "Send To"), { target: { value: kind === "feedback" ? "assignment" : "faculty" } });
  if (kind === "feedback") fireEvent.click(screen.getByLabelText("4", { exact: true }));
  fireEvent.change(screen.getByLabelText(kind === "feedback" ? "Your Feedback" : "Suggestion", { exact: true }), { target: { value: item.message } });
};
const submit = kind => { fireEvent.click(screen.getByRole("button", { name: kind === "feedback" ? "Submit Feedback" : "Send Suggestion", exact: true })); fireEvent.click(screen.getByRole("button", { name: kind === "feedback" ? "Confirm Feedback" : "Confirm Suggestion", exact: true })); };
beforeEach(() => {
  notices.getUnreadCount.mockResolvedValue({ data: { count: 0 } }); academic.getAcademicDashboard.mockResolvedValue({ data: { metrics: {} } }); academic.listAcademic.mockResolvedValue(page([{ id: "faculty", name: "Professor One", code: "MMC201" }]));
  feedback.getFeedbackOptions.mockResolvedValue(page([{ id: "assignment", faculty: item.faculty, subject: item.subject, academicYear: "2026-2027" }])); suggestions.getSuggestionFaculty.mockResolvedValue(page([{ id: "faculty", name: "Professor One" }]));
  for (const loader of [feedback.getMyFeedback, feedback.getReceivedFeedback, feedback.getDepartmentFeedback, suggestions.getSentSuggestions, suggestions.getReceivedSuggestions]) loader.mockResolvedValue(page());
  feedback.getFeedbackAggregate.mockResolvedValue({ data: summary }); feedback.submitGeneralFeedback.mockResolvedValue({ data: item }); suggestions.submitSuggestion.mockResolvedValue({ data: { item, notificationDelivery: { attempted: true, delivered: true } } });
});
afterEach(() => { cleanup(); vi.resetAllMocks(); });
it.each(["feedback", "suggestion"])("%s loads server options, anonymous default, labels and respectful-language note", async kind => {
  await start(kind); expect(screen.getByLabelText("Stay Anonymous").checked).toBe(true); expect(screen.getByText(/Please use respectful and appropriate language/)).toBeTruthy(); expect(screen.queryByLabelText("Department ID")).toBeNull();
  if (kind === "suggestion") expect(screen.getByText("This suggestion will be visible only to the selected Faculty member.")).toBeTruthy();
});
it("shows option loading, pages all options and excludes a manual ID editor", async () => {
  let finish; feedback.getFeedbackOptions.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; })).mockResolvedValueOnce(page([{ id: "assignment", faculty: item.faculty, subject: item.subject }])); open("/student/general-feedback"); await screen.findByText("Loading recipient options"); await waitFor(() => expect(feedback.getFeedbackOptions).toHaveBeenCalled()); await act(async () => finish(page([], { hasNextPage: true }))); await screen.findByLabelText("Faculty / Subject"); expect(feedback.getFeedbackOptions).toHaveBeenNthCalledWith(2, { page: 2, limit: 100 }, expect.anything());
});
it.each(["feedback", "suggestion"])("%s handles no recipients and retries option failure", async kind => {
  const loader = kind === "feedback" ? feedback.getFeedbackOptions : suggestions.getSuggestionFaculty; loader.mockRejectedValueOnce(new Error("network")).mockResolvedValueOnce(page()); await startError(kind);
  fireEvent.click(screen.getByRole("button", { name: "Retry recipient options" })); await screen.findByText(kind === "feedback" ? "No active teaching assignments are available for your class." : "No active Faculty recipients are available in your department."); expect(screen.queryByRole("form")).toBeNull();
});
const startError = async kind => { open(kind === "feedback" ? "/student/general-feedback" : "/student/suggestions"); await screen.findByText("Unable to load recipient options. Please try again."); };
it.each([["recipient", "Choose a recipient."], ["rating", "Choose a rating from 1 to 5."], ["message", "Message must contain 10–2000 characters."]])("validates Feedback %s", async (kind, expected) => {
  await start(); if (kind !== "recipient") fireEvent.change(screen.getByLabelText("Faculty / Subject"), { target: { value: "assignment" } }); if (kind === "message") fireEvent.click(screen.getByLabelText("4", { exact: true })); fireEvent.submit(screen.getByRole("form", { name: "General Feedback form" })); await screen.findByText(expected); expect(feedback.submitGeneralFeedback).not.toHaveBeenCalled();
});
it("confirms final feedback, submits Named fields only and refreshes own history", async () => {
  feedback.getMyFeedback.mockResolvedValueOnce(page()).mockResolvedValue(page([{ ...item, identityMode: "NAMED" }])); await start(); fill(); fireEvent.click(screen.getByLabelText("Reveal Identity")); fireEvent.click(screen.getByRole("button", { name: "Submit Feedback", exact: true })); expect(screen.getByRole("alertdialog").textContent).toContain("not be able to edit"); expect(feedback.submitGeneralFeedback).not.toHaveBeenCalled(); fireEvent.click(screen.getByRole("button", { name: "Keep editing" })); submit("feedback"); await screen.findByText("General Feedback submitted successfully.");
  expect(feedback.submitGeneralFeedback).toHaveBeenCalledWith({ facultyAssignmentId: "assignment", rating: 4, message: item.message, identityMode: "NAMED" }); await screen.findByText("Identity: Named (final)", { exact: false }); expect(screen.getByLabelText("Your Feedback").value).toBe(""); expect(screen.queryByRole("button", { name: "Edit Feedback" })).toBeNull();
});
it.each(["feedback", "suggestion"])("%s preserves text on moderation failure then permits revision", async kind => {
  const api = kind === "feedback" ? feedback.submitGeneralFeedback : suggestions.submitSuggestion;
  const rejection = "Your message contains inappropriate language. Please revise it before submitting."; api.mockRejectedValueOnce(new Error(rejection)); await start(kind); fill(kind); submit(kind); await screen.findByText(rejection); expect(screen.getByLabelText(kind === "feedback" ? "Your Feedback" : "Suggestion", { exact: true }).value).toBe(item.message);
  fireEvent.change(screen.getByLabelText(kind === "feedback" ? "Your Feedback" : "Suggestion", { exact: true }), { target: { value: "Revised respectful message content." } }); submit(kind); await screen.findByText(kind === "feedback" ? "General Feedback submitted successfully." : "Private Suggestion sent successfully."); expect(api).toHaveBeenCalledTimes(2);
});
it.each(["feedback", "suggestion"])("%s prevents concurrent clicks while processing", async kind => {
  const api = kind === "feedback" ? feedback.submitGeneralFeedback : suggestions.submitSuggestion; let complete; api.mockImplementationOnce(() => new Promise(resolve => { complete = resolve; })); await start(kind); fill(kind); submit(kind); fireEvent.click(screen.getByRole("button", { name: "Submitting..." })); expect(api).toHaveBeenCalledOnce(); expect(screen.getByRole("button", { name: "Submitting..." }).disabled).toBe(true); await act(async () => complete({ data: { item, notificationDelivery: { attempted: true, delivered: true } } }));
});
it("Suggestion retry preserves its key unless content changes, and reports notification failure", async () => {
  suggestions.submitSuggestion.mockRejectedValueOnce(new Error("Network failure.")).mockResolvedValueOnce({ data: { item, notificationDelivery: { attempted: true, delivered: false } } }); await start("suggestion"); fill("suggestion"); fireEvent.click(screen.getByLabelText("Reveal Identity")); submit("suggestion"); await screen.findByText("Network failure."); const first = suggestions.submitSuggestion.mock.calls[0][0]; submit("suggestion"); await screen.findByText("Suggestion saved. The Faculty notification could not be delivered."); expect(suggestions.submitSuggestion.mock.calls[1][0].submissionKey).toBe(first.submissionKey); expect(first).toMatchObject({ facultyId: "faculty", identityMode: "NAMED" }); expect(first).not.toHaveProperty("studentId");
});
it.each([["/faculty/general-feedback", "Received Feedback", "feedback"], ["/faculty/suggestions", "Received Suggestions", "suggestion"]])("%s renders anonymous/named received messages, summary where appropriate and pagination", async (path, title, kind) => {
  const loader = kind === "feedback" ? feedback.getReceivedFeedback : suggestions.getReceivedSuggestions; loader.mockResolvedValue(page([item, { ...item, id: "named", identityMode: "NAMED", identity: { name: "Named Student", userCode: "student.usn" } }], { total: 21, totalPages: 2, hasNextPage: true })); open(path, "FACULTY"); await screen.findByRole("heading", { name: "Anonymous", exact: true }); expect(screen.getByText("Named Student — STUDENT.USN")).toBeTruthy(); if (kind === "feedback") expect(screen.getByText("4.50 / 5")).toBeTruthy(); fireEvent.click(screen.getByRole("button", { name: "Next messages" })); await waitFor(() => expect(loader).toHaveBeenLastCalledWith({ page: 2, limit: 20 }, expect.anything()));
});
it("recipient list keeps Anonymous safe even if unexpected identity fields appear", async () => {
  feedback.getReceivedFeedback.mockResolvedValue(page([{ ...item, identity: { name: "Hidden Person", userCode: "secret.code" }, studentId: "hidden-id" }])); open("/faculty/general-feedback", "FACULTY"); await screen.findByRole("heading", { name: "Anonymous" }); expect(document.body.textContent).not.toMatch(/Hidden Person|secret.code|hidden-id/);
});
it("message list shows loading/error/retry and a safe empty state", async () => {
  feedback.getReceivedFeedback.mockRejectedValueOnce(new Error("network")); open("/faculty/general-feedback", "FACULTY"); await screen.findByText("Unable to load messages. Please try again."); fireEvent.click(screen.getByRole("button", { name: "Retry messages" })); await screen.findByText("No messages yet.");
});
it("HOD page uses scoped Faculty/Subject/rating filters and anonymous-safe cards", async () => {
  feedback.getDepartmentFeedback.mockResolvedValue(page([item])); open("/hod/general-feedback", "HOD"); await screen.findByRole("heading", { name: "Anonymous" }); await screen.findByRole("option", { name: "Professor One" }); fireEvent.change(screen.getByLabelText("Faculty filter"), { target: { value: "faculty" } }); fireEvent.change(screen.getByLabelText("Subject filter"), { target: { value: "faculty" } }); fireEvent.change(screen.getByLabelText("Rating filter"), { target: { value: "4" } }); await waitFor(() => expect(feedback.getDepartmentFeedback).toHaveBeenLastCalledWith({ page: 1, limit: 20, facultyId: "faculty", subjectId: "faculty", rating: "4" }, expect.anything())); expect(screen.getByText("Department General Feedback")).toBeTruthy();
});
it("Principal only presents aggregate values, handles retry and never renders unexpected individual data", async () => {
  feedback.getFeedbackAggregate.mockRejectedValueOnce(new Error("network")).mockResolvedValueOnce({ data: { ...summary, message: "Secret feedback text", items: [item] } }); open("/principal/feedback-overview", "PRINCIPAL"); await screen.findByText("Unable to load feedback overview. Please try again."); fireEvent.click(screen.getByRole("button", { name: "Retry overview" })); await screen.findByText("4.50 / 5"); expect(screen.queryByText(item.message)).toBeNull(); expect(screen.queryByText("Secret feedback text")).toBeNull(); expect(screen.queryByRole("heading", { name: "Anonymous" })).toBeNull(); expect(screen.queryByRole("link", { name: "Private Suggestions" })).toBeNull();
});
it.each(["HOD", "PRINCIPAL"])("%s has no Suggestions navigation or access to Faculty Suggestions", async role => {
  open("/faculty/suggestions", role); await screen.findByText("Workspace ready"); expect(screen.queryByRole("link", { name: "Private Suggestions" })).toBeNull(); expect(suggestions.getReceivedSuggestions).not.toHaveBeenCalled();
});
it.each(["/student/general-feedback", "/student/suggestions", "/faculty/general-feedback", "/faculty/suggestions", "/hod/general-feedback", "/principal/feedback-overview"])("%s preserves first-login guard", async path => {
  const role = path.split("/")[1].toUpperCase(); open(path, role, { mustChangePassword: true }); await screen.findByText("First login - change your password"); expect(feedback.getFeedbackOptions).not.toHaveBeenCalled(); expect(suggestions.getReceivedSuggestions).not.toHaveBeenCalled(); expect(feedback.getFeedbackAggregate).not.toHaveBeenCalled();
});
