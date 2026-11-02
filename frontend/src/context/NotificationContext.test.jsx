import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";
import { NotificationProvider, useNotifications } from "./NotificationContext";
import { useAuth } from "./AuthContext";
import NotificationBell from "../components/notifications/NotificationBell";
import * as service from "../services/notificationService";
vi.mock("./AuthContext", () => ({ useAuth: vi.fn() }));
vi.mock("../services/notificationService", () => ({ getUnreadCount: vi.fn(), markNotificationRead: vi.fn(), markAllNotificationsRead: vi.fn() }));
const user = { id: "user-a", userCode: "user.a", role: "STUDENT", mustChangePassword: false };
const Controls = () => {
  const { unreadCount, countError, refreshUnreadCount, markRead, markAllRead } = useNotifications();
  return <><NotificationBell /><output aria-label="Unread count">{unreadCount ?? "unknown"}</output><p>{countError}</p>
    <button onClick={() => refreshUnreadCount()}>Refresh count</button>
    <button onClick={() => refreshUnreadCount({ force: true })}>Force refresh</button>
    <button onClick={() => markRead("item")}>Read one</button>
    <button onClick={() => markAllRead()}>Read all</button></>;
};
const tree = () => <MemoryRouter><NotificationProvider><Controls /></NotificationProvider></MemoryRouter>;
beforeEach(() => { useAuth.mockReturnValue({ user, loading: false }); service.getUnreadCount.mockResolvedValue({ data: { count: 3 } }); });
afterEach(() => { cleanup(); vi.resetAllMocks(); });

it.each([{ user: null, loading: false }, { user, loading: true }, { user: { ...user, mustChangePassword: true }, loading: false }])("does not request notifications before application authentication is ready %#", state => {
  useAuth.mockReturnValue(state); render(tree());
  expect(service.getUnreadCount).not.toHaveBeenCalled();
});
it("loads count after session restoration and exposes the bell's accessible label", async () => {
  useAuth.mockReturnValue({ user: null, loading: true }); const view = render(tree());
  useAuth.mockReturnValue({ user, loading: false }); view.rerender(tree());
  expect(await screen.findByRole("link", { name: "Notifications, 3 unread" })).toBeTruthy();
  expect(screen.getByLabelText("Unread count").textContent).toBe("3");
});
it.each([[0, null], [9, "9"], [99, "99"], [100, "99+"]])("renders a safe badge for %i unread", async (count, badge) => {
  service.getUnreadCount.mockResolvedValue({ data: { count } }); render(tree());
  await waitFor(() => expect(screen.getByLabelText("Unread count").textContent).toBe(String(count)));
  expect(screen.getByRole("link").querySelector(".notification-badge")?.textContent ?? null).toBe(badge);
  expect(screen.getByRole("link").getAttribute("href")).toBe("/notifications");
});
it("count failure keeps the bell usable without inventing a count and allows retry", async () => {
  service.getUnreadCount.mockRejectedValueOnce(new Error("internal secret")).mockResolvedValue({ data: { count: 2 } }); render(tree());
  expect(await screen.findByRole("link", { name: "Notifications, unread count unavailable" })).toBeTruthy();
  expect(screen.getByRole("link").querySelector(".notification-badge")).toBeNull();
  expect(screen.queryByText("internal secret")).toBeNull();
  fireEvent.click(screen.getByText("Refresh count"));
  expect(await screen.findByRole("link", { name: "Notifications, 2 unread" })).toBeTruthy();
});
it("deduplicates simultaneous refreshes and prevents late responses replacing a newer count", async () => {
  let first, latest;
  service.getUnreadCount.mockImplementationOnce(() => new Promise(resolve => { first = resolve; }))
    .mockImplementationOnce(() => new Promise(resolve => { latest = resolve; }));
  render(tree()); fireEvent.click(screen.getByText("Refresh count")); fireEvent.click(screen.getByText("Refresh count"));
  expect(service.getUnreadCount).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByText("Force refresh"));
  await act(async () => latest({ data: { count: 1 } }));
  await act(async () => first({ data: { count: 12 } }));
  expect(screen.getByLabelText("Unread count").textContent).toBe("1");
});
it("logout clears count, aborts requests and ignores a late old-user response", async () => {
  let finish;
  service.getUnreadCount.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  const view = render(tree()); const signal = service.getUnreadCount.mock.calls[0][0].signal;
  useAuth.mockReturnValue({ user: null, loading: false }); view.rerender(tree());
  expect(signal.aborted).toBe(true);
  await act(async () => finish({ data: { count: 7 } }));
  expect(screen.getByLabelText("Unread count").textContent).toBe("unknown");
  fireEvent.click(screen.getByText("Refresh count"));
  document.dispatchEvent(new Event("visibilitychange"));
  expect(service.getUnreadCount).toHaveBeenCalledOnce();
});
it("a different account cannot inherit the previous user's badge", async () => {
  const view = render(tree()); await screen.findByRole("link", { name: "Notifications, 3 unread" });
  service.getUnreadCount.mockReturnValue(new Promise(() => {}));
  useAuth.mockReturnValue({ user: { ...user, id: "user-b", userCode: "user.b" }, loading: false }); view.rerender(tree());
  expect(screen.getByLabelText("Unread count").textContent).toBe("unknown");
});
it("successful read operations refresh count from the server rather than decrementing locally", async () => {
  service.markNotificationRead.mockResolvedValue({ data: { id: "item", isRead: true } });
  service.markAllNotificationsRead.mockResolvedValue({ data: { modifiedCount: 2 } });
  render(tree()); await screen.findByRole("link", { name: "Notifications, 3 unread" });
  service.getUnreadCount.mockResolvedValueOnce({ data: { count: 2 } }).mockResolvedValue({ data: { count: 0 } });
  fireEvent.click(screen.getByText("Read one")); await screen.findByRole("link", { name: "Notifications, 2 unread" });
  fireEvent.click(screen.getByText("Read all"));
  await waitFor(() => expect(screen.getByLabelText("Unread count").textContent).toBe("0"));
});
it("unmount aborts requests and removes visibility refresh listeners", () => {
  service.getUnreadCount.mockReturnValue(new Promise(() => {})); const view = render(tree());
  const signal = service.getUnreadCount.mock.calls[0][0].signal; view.unmount();
  document.dispatchEvent(new Event("visibilitychange"));
  expect(signal.aborted).toBe(true); expect(service.getUnreadCount).toHaveBeenCalledOnce();
});
