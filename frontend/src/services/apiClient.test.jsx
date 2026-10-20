import { vi } from "vitest";
import { request } from "./apiClient";
afterEach(() => vi.unstubAllGlobals());
it("sends cookies and a non-simple CSRF header for state changes", async () => {
  const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true }) }); vi.stubGlobal("fetch", fetch);
  await request("/auth/login", { method: "POST", body: "{}" });
  expect(fetch.mock.calls[0][1].credentials).toBe("include");
  expect(fetch.mock.calls[0][1].headers["X-CSRF-Protection"]).toBe("1");
});
it("handles empty logout responses", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => { throw new Error("empty"); } }));
  expect(await request("/auth/logout", { method: "POST" })).toEqual({});
});
it("broadcasts session expiry and preserves HTTP status for callers", async () => {
  const handler = vi.fn(); window.addEventListener("auth:expired", handler);
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({ message: "Expired" }) }));
  await expect(request("/auth/me")).rejects.toMatchObject({ status: 401, message: "Expired" });
  expect(handler).toHaveBeenCalledOnce(); window.removeEventListener("auth:expired", handler);
});
it("can restore a missing session without displaying an expiry event on a fresh visit", async () => {
  const handler = vi.fn(); window.addEventListener("auth:expired", handler);
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({ message: "Sign in" }) }));
  await expect(request("/auth/me", { notifyAuthFailure: false })).rejects.toMatchObject({ status: 401 });
  expect(handler).not.toHaveBeenCalled(); window.removeEventListener("auth:expired", handler);
});
