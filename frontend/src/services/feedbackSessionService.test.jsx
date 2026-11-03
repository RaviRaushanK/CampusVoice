import { vi } from "vitest";
import { request } from "./apiClient";
import * as service from "./feedbackSessionService";
vi.mock("./apiClient", () => ({ request: vi.fn() }));
afterEach(() => vi.clearAllMocks());
it("uses the shared cookie/CSRF API client for all session operations", () => {
  service.getMySessions({ status: "DRAFT" }); expect(request).toHaveBeenLastCalledWith("/feedback-sessions/mine?page=1&limit=20&status=DRAFT", {});
  service.getSession("id"); expect(request).toHaveBeenLastCalledWith("/feedback-sessions/id", {});
  service.createSession({ title: "Draft" }); expect(request).toHaveBeenLastCalledWith("/feedback-sessions", { method: "POST", body: '{"title":"Draft"}' });
  service.updateSession("id", { questions: [] }); expect(request).toHaveBeenLastCalledWith("/feedback-sessions/id", { method: "PATCH", body: '{"questions":[]}' });
  service.deleteDraft("id"); expect(request).toHaveBeenLastCalledWith("/feedback-sessions/id", { method: "DELETE" });
});
