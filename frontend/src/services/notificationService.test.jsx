import { vi } from "vitest";
import * as service from "./notificationService";

let fetchMock;
beforeEach(() => {
  fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true, data: {} }) });
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());
it("lists with backend defaults and no recipient identity", async () => {
  await service.getNotifications();
  const url = new URL(fetchMock.mock.calls[0][0]);
  expect(url.pathname).toBe("/api/notifications");
  expect(Object.fromEntries(url.searchParams)).toEqual({ page: "1", limit: "20", status: "all" });
});
it("sends backend filter and pagination while discarding unsupported options", async () => {
  await service.getNotifications({ page: 3, limit: 20, status: "unread", recipient: "other" });
  expect(Object.fromEntries(new URL(fetchMock.mock.calls[0][0]).searchParams)).toEqual({ page: "3", limit: "20", status: "unread" });
});
it("fetches unread count with the shared client's cookies", async () => {
  await service.getUnreadCount();
  expect(fetchMock.mock.calls[0][0].endsWith("/notifications/unread-count")).toBe(true);
  expect(fetchMock.mock.calls[0][1].credentials).toBe("include");
});
it("read mutations reuse CSRF and cookie handling without body fields", async () => {
  await service.markNotificationRead("a/b"); await service.markAllNotificationsRead();
  expect(fetchMock.mock.calls[0][0].endsWith("/notifications/a%2Fb/read")).toBe(true);
  expect(fetchMock.mock.calls[1][0].endsWith("/notifications/read-all")).toBe(true);
  for (const [, options] of fetchMock.mock.calls) {
    expect(options).toMatchObject({ method: "PATCH", credentials: "include", headers: { "X-CSRF-Protection": "1" } });
    expect(options.body).toBeUndefined();
  }
});
it("forwards cancellation signals", async () => {
  const controller = new AbortController();
  await service.getNotifications({}, { signal: controller.signal });
  expect(fetchMock.mock.calls[0][1].signal).toBe(controller.signal);
});
it("preserves the existing session-expiry event on notification rejection", async () => {
  const handler = vi.fn(); window.addEventListener("auth:expired", handler);
  try {
    fetchMock.mockResolvedValue({ ok: false, status: 401, json: async () => ({ message: "Session expired" }) });
    await expect(service.getUnreadCount()).rejects.toMatchObject({ status: 401 });
    expect(handler).toHaveBeenCalledOnce();
  } finally { window.removeEventListener("auth:expired", handler); }
});
