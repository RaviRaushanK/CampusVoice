import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";
import App from "../../App";
import * as api from "../../services/feedbackSessionService";
import * as auth from "../../services/authService";
import * as academic from "../../services/academicService";
import * as notifications from "../../services/notificationService";
vi.mock("../../services/feedbackSessionService", () => ({ getSessionResults: vi.fn(), getShortAnswerResults: vi.fn(), getMySessions: vi.fn() }));
vi.mock("../../services/authService", () => ({ me: vi.fn(), logout: vi.fn() }));
vi.mock("../../services/academicService", () => ({ getAcademicDashboard: vi.fn() }));
vi.mock("../../services/notificationService", () => ({ getUnreadCount: vi.fn() }));
const options = [{ option: "Clear", count: 1, percentage: 50 }, { option: "Unclear", count: 1, percentage: 50 }, { option: "Never selected", count: 0, percentage: 0 }];
const results = { session: { id: "session", title: "Unit feedback", description: "Details", status: "OPEN", availability: "OPEN", subject: { code: "MMC201", name: "Data Structures" }, classGroup: { semester: 2, section: "A", academicYear: "2026-2027" }, opensAt: null, closesAt: null },
  summary: { eligibleStudents: 4, totalResponses: 3, responseRate: 75, anonymousResponses: 2, namedResponses: 1, totalQuestions: 5, requiredQuestions: 1 },
  questions: [
    { questionId: "single", prompt: "How clear?", type: "SINGLE_CHOICE", required: false, answeredCount: 2, skippedCount: 1, options },
    { questionId: "multi", prompt: "Which topics?", type: "MULTI_SELECT", required: false, answeredCount: 2, skippedCount: 1, options: [{ option: "Stacks", count: 2, percentage: 100 }, { option: "Queues", count: 1, percentage: 50 }] },
    { questionId: "rating", prompt: "Rate lecture", type: "RATING", required: true, answeredCount: 3, skippedCount: 0, average: 4, distribution: [1, 2, 3, 4, 5].map(rating => ({ rating, count: rating >= 3 ? 1 : 0, percentage: rating >= 3 ? 33.33 : 0 })) },
    { questionId: "short", prompt: "Improvements", type: "SHORT_ANSWER", required: false, answeredCount: 2, skippedCount: 1 },
    { questionId: "emptyrating", prompt: "Optional rating", type: "RATING", required: false, answeredCount: 0, skippedCount: 3, average: null, distribution: [1, 2, 3, 4, 5].map(rating => ({ rating, count: 0, percentage: 0 })) },
  ] };
const texts = (items = [], pagination = {}) => ({ data: { items, pagination: { page: 1, limit: 20, total: items.length, totalPages: items.length ? 1 : 0, hasNextPage: false, hasPreviousPage: false, ...pagination } } });
const open = (path = "/my-sessions/session/results", role = "FACULTY", overrides = {}) => { auth.me.mockResolvedValue({ data: { id: "actor", role, name: "Faculty Actor", userCode: "actor", mustChangePassword: false, ...overrides } }); return render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>); };
const question = number => screen.getByRole("region", { name: `Question ${number} results`, exact: true });
beforeEach(() => {
  api.getSessionResults.mockResolvedValue({ data: results }); api.getShortAnswerResults.mockResolvedValue(texts([{ identityMode: "ANONYMOUS", text: "More examples." }, { identityMode: "NAMED", text: "Go slowly.", identity: { name: "Named Student", userCode: "named.usn" } }]));
  api.getMySessions.mockResolvedValue({ data: { items: [], pagination: { totalPages: 0 } } }); notifications.getUnreadCount.mockResolvedValue({ data: { count: 0 } }); academic.getAcademicDashboard.mockResolvedValue({ data: { metrics: {} } });
});
afterEach(() => { cleanup(); vi.resetAllMocks(); });
it("shows loading, session context, summary and live-result notice", async () => {
  let finish; api.getSessionResults.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; })); open(); await screen.findByText("Loading session results"); await waitFor(() => expect(api.getSessionResults).toHaveBeenCalled()); await act(async () => finish({ data: results }));
  await screen.findByText(results.session.title); expect(screen.getByText("This session is still accepting responses. Results may change.")).toBeTruthy(); expect(screen.getByText(/Semester 2/)).toBeTruthy();
  const summary = screen.getByRole("region", { name: "Session summary" }); for (const label of ["Eligible Students", "Responses", "Response Rate", "Anonymous", "Named"]) expect(within(summary).getByText(label)).toBeTruthy(); expect(within(summary).getByText("75.0%")).toBeTruthy(); expect(screen.getByText(/rate can exceed 100%/)).toBeTruthy();
});
it("retries a load error and handles controlled draft results", async () => {
  api.getSessionResults.mockRejectedValueOnce(new Error("offline")); open(); await screen.findByText("Unable to load session results. The session may be unavailable. Please try again."); fireEvent.click(screen.getByRole("button", { name: "Retry results" })); await screen.findByText(results.session.title);
  api.getSessionResults.mockRejectedValueOnce(Object.assign(new Error("Draft"), { status: 409 })); fireEvent.click(screen.getByRole("button", { name: "Refresh results" })); await screen.findByText("Results are available only for published sessions.");
});
it.each([["CLOSED", "Session closed."], ["SCHEDULED", "Scheduled session. Students can respond when the opening time arrives."]])("renders effective %s results", async (availability, notice) => {
  api.getSessionResults.mockResolvedValue({ data: { ...results, session: { ...results.session, availability } } }); open(); await screen.findByText(notice); expect(screen.getByText(availability)).toBeTruthy();
});
it("zero responses have finite rates, zero distributions and no text loading", async () => {
  api.getSessionResults.mockResolvedValue({ data: { ...results, summary: { ...results.summary, totalResponses: 0, responseRate: 0, anonymousResponses: 0, namedResponses: 0 }, questions: results.questions.map(q => ({ ...q, answeredCount: 0, skippedCount: 0, average: null, ...(q.options ? { options: q.options.map(o => ({ ...o, count: 0, percentage: 0 })) } : {}), ...(q.distribution ? { distribution: q.distribution.map(row => ({ ...row, count: 0, percentage: 0 })) } : {}) })) } });
  open(); await screen.findByText("No responses have been submitted yet."); expect(screen.getAllByText("No rating responses yet.").length).toBe(2); expect(screen.getByText("No text responses yet.")).toBeTruthy(); expect(api.getShortAnswerResults).not.toHaveBeenCalled();
});
it("single-choice chart includes counts, percentages, zero option and answered/skipped totals", async () => {
  open(); await screen.findByText(results.session.title); const card = question(1);
  expect(within(card).getByText("Answered: 2 · Skipped: 1")).toBeTruthy(); expect(within(card).getAllByText("1 · 50.0%")).toHaveLength(2); expect(within(card).getByText("Never selected")).toBeTruthy(); expect(within(card).getByText("0 · 0.0%")).toBeTruthy(); expect(within(card).getByRole("figure", { name: "Question 1 option distribution" })).toBeTruthy();
});
it("multi-select explains percentages above 100 and displays each option independently", async () => {
  open(); await screen.findByText(results.session.title); const card = question(2); expect(within(card).getByText(/percentages total more than 100%/)).toBeTruthy(); expect(within(card).getByText("2 · 100.0%")).toBeTruthy(); expect(within(card).getByText("1 · 50.0%")).toBeTruthy();
});
it("formats ratings to two decimals and keeps every distribution value including zeros", async () => {
  open(); await screen.findByText("Average Rating: 4.00 / 5"); const card = question(3); for (const value of [1, 2, 3, 4, 5]) expect(within(card).getByText(`Rating ${value}`)).toBeTruthy(); expect(within(question(5)).getByText("No rating responses yet.")).toBeTruthy();
});
it("manual refresh refetches without polling and back navigation returns to My Sessions", async () => {
  open(); await screen.findByText(results.session.title); expect(api.getSessionResults).toHaveBeenCalledOnce(); fireEvent.click(screen.getByRole("button", { name: "Refresh results" })); await waitFor(() => expect(api.getSessionResults).toHaveBeenCalledTimes(2)); await screen.findByText(results.session.title);
  fireEvent.click(screen.getByRole("link", { name: "Back to My Sessions" })); await screen.findByText("No feedback sessions yet.");
});
it("text loads on demand with Anonymous and minimal Named display", async () => {
  open(); await screen.findByText(results.session.title); expect(api.getShortAnswerResults).not.toHaveBeenCalled(); fireEvent.click(screen.getByRole("button", { name: "View text responses for question 4" }));
  await screen.findByText("More examples."); const panel = screen.getByRole("region", { name: "Short answers for question 4" }); expect(within(panel).getByRole("heading", { name: "Anonymous", exact: true })).toBeTruthy(); expect(within(panel).getByText("Named Student — NAMED.USN")).toBeTruthy(); expect(panel.innerHTML).not.toMatch(/studentId|submittedAt|Anonymous #/); expect(within(panel).queryByText(/@/)).toBeNull();
  expect(api.getShortAnswerResults).toHaveBeenCalledWith("session", "short", { page: 1, limit: 20 }, expect.anything());
});
it("never renders unexpected identity fields attached to an Anonymous row", async () => {
  api.getShortAnswerResults.mockResolvedValue(texts([{ identityMode: "ANONYMOUS", text: "Private text", identity: { name: "Must Stay Hidden", userCode: "secret.usn" }, studentId: "secret-id" }])); open(); await screen.findByText(results.session.title); fireEvent.click(screen.getByRole("button", { name: "View text responses for question 4" })); await screen.findByText("Private text"); expect(screen.queryByText(/Must Stay Hidden|secret.usn|secret-id/)).toBeNull();
});
it("text pages retry errors, paginate, collapse and handle missing named accounts", async () => {
  api.getShortAnswerResults.mockRejectedValueOnce(new Error("network")).mockResolvedValueOnce(texts([{ identityMode: "ANONYMOUS", text: "First page" }], { total: 21, totalPages: 2, hasNextPage: true })).mockResolvedValueOnce(texts([{ identityMode: "NAMED", identity: null, text: "Last page" }], { page: 2, total: 21, totalPages: 2, hasPreviousPage: true }));
  open(); await screen.findByText(results.session.title); fireEvent.click(screen.getByRole("button", { name: "View text responses for question 4" })); await screen.findByText("Unable to load short answers. Please try again."); fireEvent.click(screen.getByRole("button", { name: "Retry short answers" })); await screen.findByText("First page"); fireEvent.click(screen.getByRole("button", { name: "Next answers" })); await screen.findByText("Last page"); expect(screen.getByText("Named student unavailable")).toBeTruthy(); expect(screen.getByRole("button", { name: "Next answers" }).disabled).toBe(true); fireEvent.click(screen.getByRole("button", { name: "Hide text responses for question 4" })); expect(screen.queryByText("Last page")).toBeNull();
});
it.each(["STUDENT", "HOD", "PRINCIPAL"])("%s cannot enter Faculty results route", async role => {
  open("/my-sessions/session/results", role); await screen.findByText("No recent activity yet"); expect(api.getSessionResults).not.toHaveBeenCalled();
});
it("first-login route guard blocks results requests", async () => {
  open("/my-sessions/session/results", "FACULTY", { mustChangePassword: true }); await screen.findByText("First login - change your password"); expect(api.getSessionResults).not.toHaveBeenCalled();
});
