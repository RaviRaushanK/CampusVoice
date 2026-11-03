import { StrictMode } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";
import App from "../../App";
import * as auth from "../../services/authService";
import * as service from "../../services/notificationService";
import * as academic from "../../services/academicService";
vi.mock("../../services/academicService", () => ({ getAcademicDashboard: vi.fn() }));
vi.mock("../../services/authService", () => ({ me: vi.fn(), login: vi.fn(), logout: vi.fn(), changePassword: vi.fn() }));
vi.mock("../../services/notificationService", () => ({ getNotifications: vi.fn(), getUnreadCount: vi.fn(), markNotificationRead: vi.fn(), markAllNotificationsRead: vi.fn() }));
const user = { id: "viewer", userCode: "viewer", name: "Notification Viewer", role: "STUDENT", mustChangePassword: false };
const item = (i = 1, extra = {}) => ({ id: `item-${i}`, title: `Notice ${i}`, message: `Notification message ${i}`, type: "SYSTEM", isRead: false, createdAt: "2026-11-03T08:30:00Z", ...extra });
let items;
const list = ({ page = 1, limit = 20, status = "all" } = {}) => {
  const filtered = items.filter(notification => status === "all" || notification.isRead === (status === "read"));
  const totalPages = Math.ceil(filtered.length / limit);
  return { data: { notifications: filtered.slice((page - 1) * limit, page * limit), pagination: {
    page, limit, total: filtered.length, totalPages, hasNextPage: page < totalPages, hasPreviousPage: page > 1 && filtered.length > 0,
  } } };
};
const open = (path = "/notifications", strict = false) => render(<MemoryRouter initialEntries={[path]}>{strict ? <StrictMode><App /></StrictMode> : <App />}</MemoryRouter>);
const filter = name => fireEvent.click(within(screen.getByRole("group", { name: "Filter notifications" })).getByRole("button", { name, exact: true }));
const loaded = () => screen.findByRole("article", { name: "Notice 1" });
beforeEach(() => {
  academic.getAcademicDashboard.mockResolvedValue({ data: { metrics: {} } });
  items = [item(), item(2, { isRead: true, type: "ACCOUNT" })];
  auth.me.mockResolvedValue({ data: user });
  service.getUnreadCount.mockImplementation(async () => ({ data: { count: items.filter(n => !n.isRead).length } }));
  service.getNotifications.mockImplementation(async query => list(query));
  service.markNotificationRead.mockImplementation(async id => {
    items = items.map(notification => notification.id === id ? { ...notification, isRead: true } : notification);
    return { data: items.find(notification => notification.id === id) };
  });
  service.markAllNotificationsRead.mockImplementation(async () => { items = items.map(notification => ({ ...notification, isRead: true })); return { data: { modifiedCount: 1 } }; });
});
afterEach(() => { cleanup(); vi.resetAllMocks(); });

it("shows initial loading without pretending the list is empty", async () => {
  service.getNotifications.mockReturnValue(new Promise(() => {})); open();
  expect(await screen.findByText("Loading notifications")).toBeTruthy();
  expect(screen.queryByText("No notifications yet.")).toBeNull();
});
it("renders server notifications with readable types/dates and no resource IDs or invented links", async () => {
  items[0].message = "long".repeat(500); items[0].relatedResourceId = "private-resource-id"; open(); await loaded();
  expect(screen.getByText(items[0].message)).toBeTruthy();
  expect(screen.getByText("System")).toBeTruthy(); expect(screen.getByText("Account")).toBeTruthy();
  expect(screen.getAllByText(/3 Nov 2026/)).toHaveLength(2);
  expect(screen.getAllByText("Unread").length).toBeGreaterThan(0);
  expect(screen.queryByText("private-resource-id")).toBeNull();
  expect(screen.queryByRole("link", { name: "Notice 1" })).toBeNull();
  expect(service.getNotifications).toHaveBeenCalledWith({ page: 1, limit: 20, status: "all" }, expect.any(Object));
});
it("uses a neutral fallback for missing or invalid dates", async () => {
  items = [item(1, { createdAt: null }), item(2, { createdAt: "invalid" })]; open(); await loaded();
  expect(screen.getAllByText("Not available")).toHaveLength(2);
  expect(screen.queryByText("Invalid Date")).toBeNull();
});
it.each([["All", "all", 2], ["Unread", "unread", 1], ["Read", "read", 1]])("%s requests the corresponding server filter", async (label, status, count) => {
  open(); await loaded(); filter(label);
  await waitFor(() => expect(service.getNotifications).toHaveBeenLastCalledWith({ page: 1, limit: 20, status }, expect.any(Object)));
  await waitFor(() => expect(screen.getAllByRole("article")).toHaveLength(count));
  expect(screen.getByRole("button", { name: label, exact: true }).getAttribute("aria-pressed")).toBe("true");
});
it.each([["All", "No notifications yet."], ["Unread", "You're all caught up."], ["Read", "No read notifications yet."]])("%s has a meaningful empty state and disabled pagination", async (label, title) => {
  items = []; open(); await screen.findByText("No notifications yet."); filter(label);
  expect(await screen.findByText(title)).toBeTruthy();
  expect(screen.getByRole("button", { name: "Previous" }).disabled).toBe(true);
  expect(screen.getByRole("button", { name: "Next" }).disabled).toBe(true);
  expect(screen.getByText("No pages to display")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Mark all as read" }).disabled).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Mark all as read" }));
  expect(service.markAllNotificationsRead).not.toHaveBeenCalled();
});
it("paginates both directions and resets page when the filter changes", async () => {
  items = Array.from({ length: 25 }, (_, i) => item(i + 1)); open(); await loaded();
  expect(screen.getByText("Page 1 of 2")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Previous" }).disabled).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  await screen.findByRole("article", { name: "Notice 21" });
  expect(screen.getByText("Page 2 of 2")).toBeTruthy(); expect(screen.getByRole("button", { name: "Next" }).disabled).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Previous" })); await loaded();
  fireEvent.click(screen.getByRole("button", { name: "Next" })); await screen.findByRole("article", { name: "Notice 21" });
  filter("Unread"); await loaded();
  expect(service.getNotifications).toHaveBeenLastCalledWith({ page: 1, limit: 20, status: "unread" }, expect.any(Object));
});
it("ignores an old filter response after a rapid filter switch", async () => {
  let finishUnread;
  service.getNotifications.mockImplementation(query => query.status === "unread" ? new Promise(resolve => { finishUnread = resolve; }) : Promise.resolve(list(query)));
  open(); await loaded(); filter("Unread"); filter("Read");
  await screen.findByRole("article", { name: "Notice 2" });
  await act(async () => finishUnread({ data: { ...list({ status: "unread" }).data } }));
  expect(screen.queryByRole("article", { name: "Notice 1" })).toBeNull();
  expect(screen.getByRole("article", { name: "Notice 2" })).toBeTruthy();
});
it("mark-one updates read state and badge using the server", async () => {
  open(); await loaded(); await screen.findByRole("link", { name: "Notifications, 1 unread" });
  fireEvent.click(screen.getByRole("button", { name: "Mark as read: Notice 1" }));
  await screen.findByText("Notification marked as read.");
  await waitFor(() => expect(screen.queryByRole("button", { name: "Mark as read: Notice 1" })).toBeNull());
  expect(within(screen.getByRole("banner")).getByRole("link", { name: "Notifications", exact: true }).querySelector(".notification-badge")).toBeNull();
});
it("read failure retains the unread card and count and shows a clean error", async () => {
  service.markNotificationRead.mockRejectedValue(new Error("sensitive server stack")); open(); await loaded();
  fireEvent.click(screen.getByRole("button", { name: "Mark as read: Notice 1" }));
  expect(await screen.findByText("Unable to mark notifications as read. Please try again.")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Mark as read: Notice 1" })).toBeTruthy();
  expect(screen.getByRole("link", { name: "Notifications, 1 unread" })).toBeTruthy();
  expect(screen.queryByText("sensitive server stack")).toBeNull();
});
it("prevents duplicate read requests while showing per-item progress", async () => {
  let finish;
  service.markNotificationRead.mockImplementation(() => new Promise(resolve => { finish = resolve; })); open(); await loaded();
  const button = screen.getByRole("button", { name: "Mark as read: Notice 1" }); fireEvent.click(button); fireEvent.click(button);
  expect(button.disabled).toBe(true); expect(screen.getByText("Marking as read...")).toBeTruthy();
  expect(service.markNotificationRead).toHaveBeenCalledOnce();
  items[0].isRead = true; await act(async () => finish({ data: items[0] }));
  await screen.findByText("Notification marked as read.");
});
it("mark-all in the unread filter clears stale cards and resets the badge", async () => {
  items = [item(), item(2)]; open(); await loaded(); filter("Unread"); await loaded();
  fireEvent.click(screen.getByRole("button", { name: "Mark all as read" }));
  await screen.findByText("All notifications marked as read.");
  expect(await screen.findByText("You're all caught up.")).toBeTruthy();
  expect(screen.queryByRole("article")).toBeNull();
  expect(screen.getByRole("button", { name: "Mark all as read" }).disabled).toBe(true);
});
it("mark-all failure leaves notifications untouched", async () => {
  service.markAllNotificationsRead.mockRejectedValue({ status: 403, message: "internal details" }); open(); await loaded();
  fireEvent.click(screen.getByRole("button", { name: "Mark all as read" }));
  expect(await screen.findByText("Unable to update notifications. Refresh the page and try again.")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Mark as read: Notice 1" })).toBeTruthy();
  expect(screen.queryByText("internal details")).toBeNull();
});
it("prevents duplicate mark-all requests and distinguishes its progress", async () => {
  let finish;
  service.markAllNotificationsRead.mockImplementation(() => new Promise(resolve => { finish = resolve; })); open(); await loaded();
  const button = screen.getByRole("button", { name: "Mark all as read" }); fireEvent.click(button); fireEvent.click(button);
  expect(screen.getByText("Marking all as read...")).toBeTruthy(); expect(service.markAllNotificationsRead).toHaveBeenCalledOnce();
  items = items.map(notification => ({ ...notification, isRead: true })); await act(async () => finish({ data: { modifiedCount: 1 } }));
  await screen.findByText("All notifications marked as read.");
});
it("moves to the preceding unread page when marking the final item on the last page", async () => {
  items = Array.from({ length: 21 }, (_, i) => item(i + 1)); open(); await loaded(); filter("Unread"); await loaded();
  fireEvent.click(screen.getByRole("button", { name: "Next" })); await screen.findByRole("article", { name: "Notice 21" });
  fireEvent.click(screen.getByRole("button", { name: "Mark as read: Notice 21" }));
  expect(await screen.findByText("Page 1 of 1")).toBeTruthy();
  expect(screen.getByRole("article", { name: "Notice 1" })).toBeTruthy();
});
it("a failed list request has a safe retry", async () => {
  service.getNotifications.mockRejectedValueOnce(new Error("database password")); open();
  expect(await screen.findByText("Unable to load notifications. Please try again.")).toBeTruthy();
  expect(screen.queryByText("database password")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Try again" })); await loaded();
});
it("a count failure leaves the list and navbar usable and provides a count retry", async () => {
  service.getUnreadCount.mockRejectedValue(new TypeError("network secret")); open(); await loaded();
  expect(await screen.findByRole("link", { name: "Notifications, unread count unavailable" })).toBeTruthy();
  service.getUnreadCount.mockResolvedValue({ data: { count: 1 } });
  fireEvent.click(screen.getByRole("button", { name: "Retry unread count" }));
  expect(await screen.findByRole("link", { name: "Notifications, 1 unread" })).toBeTruthy();
});
it.each(["PRINCIPAL", "HOD", "FACULTY", "STUDENT"])("%s opens the shared page from the navbar bell", async role => {
  auth.me.mockResolvedValue({ data: { ...user, role } }); open(`/${role.toLowerCase()}/dashboard`);
  await screen.findByText("Workspace ready");
  fireEvent.click(within(screen.getByRole("banner")).getByRole("link", { name: /^Notifications/ }));
  await loaded(); expect(screen.getByRole("heading", { name: "Notifications" })).toBeTruthy();
  expect(screen.getByRole("link", { name: "Notifications", exact: true }).getAttribute("href")).toBe("/notifications");
});
it.each(["unauthenticated", "first-login"])("%s routes do not fetch notification data", async state => {
  if (state === "unauthenticated") auth.me.mockRejectedValue({ status: 401 });
  else auth.me.mockResolvedValue({ data: { ...user, mustChangePassword: true } });
  open(); await screen.findByText(state === "unauthenticated" ? "Welcome back" : "First login - change your password");
  expect(service.getNotifications).not.toHaveBeenCalled(); expect(service.getUnreadCount).not.toHaveBeenCalled();
});
it("session expiry removes notification cards and badge", async () => {
  open(); await loaded(); act(() => window.dispatchEvent(new Event("auth:expired")));
  await screen.findByText("Welcome back"); expect(screen.queryByRole("article")).toBeNull();
  expect(screen.queryByRole("link", { name: /^Notifications/ })).toBeNull();
});
it("works under React StrictMode request cleanup", async () => {
  open("/notifications", true); await loaded();
  expect(await screen.findByRole("link", { name: "Notifications, 1 unread" })).toBeTruthy();
});
