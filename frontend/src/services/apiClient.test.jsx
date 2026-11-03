import { vi } from "vitest";
import { request } from "./apiClient";
import { updateProfile } from "./profileService";
afterEach(() => vi.unstubAllGlobals());
it("sends cookies and a non-simple CSRF header for state changes", async () => {
  const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true }) }); vi.stubGlobal("fetch", fetch);
  await request("/auth/login", { method: "POST", body: "{}" });
  expect(fetch.mock.calls[0][1].credentials).toBe("include");
  expect(fetch.mock.calls[0][1].headers["X-CSRF-Protection"]).toBe("1");
});
it("multipart preserves cookies/CSRF and lets the browser set its boundary while JSON keeps its content type", async () => {
  const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true }) }); vi.stubGlobal("fetch", fetch);
  const body = new FormData(); body.append("type", "DEPARTMENT_ISSUE");
  await request("/complaints", { method: "POST", body });
  const upload = fetch.mock.calls[0][1];
  expect(upload.body).toBe(body); expect(upload.credentials).toBe("include"); expect(upload.headers["X-CSRF-Protection"]).toBe("1"); expect(upload.headers).not.toHaveProperty("Content-Type");
  await request("/complaints/case/acknowledge", { method: "POST", body: "{}" });
  expect(fetch.mock.calls[1][1].headers["Content-Type"]).toBe("application/json");
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
it("profile PATCH reuses cookies and CSRF and sends only supported fields", async () => {
  const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: { name: "Updated" } }) });
  vi.stubGlobal("fetch", fetch);
  await updateProfile({ name: "Updated", email: null, role: "PRINCIPAL" });
  const [url, options] = fetch.mock.calls[0];
  expect(url.endsWith("/api/profile")).toBe(true);
  expect(options).toMatchObject({ method: "PATCH", credentials: "include", headers: { "X-CSRF-Protection": "1" } });
  expect(JSON.parse(options.body)).toEqual({ name: "Updated", email: null });
});
it("a cancelled old response cannot expire a newer authenticated session", async () => {
  const controller = new AbortController();
  let finishBody;
  const handler = vi.fn(); window.addEventListener("auth:expired", handler);
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 401,
    json: () => new Promise(resolve => { finishBody = resolve; }),
  }));
  try {
    const pending = request("/notifications/unread-count", { signal: controller.signal });
    await Promise.resolve();
    controller.abort(); finishBody({ message: "Old session expired" });
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    expect(handler).not.toHaveBeenCalled();
  } finally { window.removeEventListener("auth:expired", handler); }
});
