import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";
import Sidebar from "./Sidebar";
import Navbar from "./Navbar";
vi.mock("../notifications/NotificationBell", () => ({ default: () => <a href="/notifications">Notifications</a> }));
const items = [{ label: "Dashboard", path: "/principal/dashboard", icon: "bi-speedometer2" }, { label: "Profile", path: "/profile", icon: "bi-person" }, { label: "Logout", action: "logout", icon: "bi-box-arrow-right" }];
beforeEach(() => { vi.stubGlobal("matchMedia", () => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
it("focuses the mobile drawer, locks scrolling, and closes on Escape", async () => {
  vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue([{ width: 1, height: 1 }]);
  const close = vi.fn();
  const view = render(<MemoryRouter><Sidebar brand="Principal" navItems={items} isOpen onClose={close} /></MemoryRouter>);
  expect(document.body.style.overflow).toBe("hidden");
  await waitFor(() => expect(screen.getByRole("complementary").contains(document.activeElement)).toBe(true));
  fireEvent.keyDown(document, { key: "Escape" }); expect(close).toHaveBeenCalledOnce();
  view.rerender(<MemoryRouter><Sidebar brand="Principal" navItems={items} isOpen={false} onClose={close} /></MemoryRouter>);
  expect(document.body.style.overflow).toBe("");
});
it("keeps forward and backward Tab navigation inside an open drawer", () => {
  vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue([{ width: 1, height: 1 }]);
  render(<MemoryRouter><Sidebar brand="Principal" navItems={items} isOpen onClose={() => {}} /></MemoryRouter>);
  const last = screen.getByRole("button", { name: "Logout" });
  const first = screen.getAllByRole("button", { name: "Close navigation" })[0];
  last.focus(); fireEvent.keyDown(document, { key: "Tab" }); expect(document.activeElement).toBe(first);
  fireEvent.keyDown(document, { key: "Tab", shiftKey: true }); expect(document.activeElement).toBe(last);
});
it("preserves active navigation and closes after choosing a destination", () => {
  const close = vi.fn();
  render(<MemoryRouter initialEntries={["/principal/dashboard"]}><Sidebar brand="Principal" navItems={items} isOpen={false} onClose={close} /></MemoryRouter>);
  expect(screen.getByRole("link", { name: "Dashboard" }).getAttribute("aria-current")).toBe("page");
  fireEvent.click(screen.getByRole("link", { name: "Profile" })); expect(close).toHaveBeenCalledOnce();
});
it("exposes avatar profile access, labelled notifications and menu expansion state", () => {
  render(<MemoryRouter><Navbar title="Principal Workspace" user={{ name: "Campus Reviewer", role: "PRINCIPAL" }} menuOpen onMenuClick={() => {}} onLogout={() => {}} /></MemoryRouter>);
  expect(screen.getByRole("link", { name: "Open my profile" }).getAttribute("href")).toBe("/profile");
  expect(screen.getByText("CR")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Open navigation" }).getAttribute("aria-expanded")).toBe("true");
  expect(screen.getByRole("link", { name: "Notifications" })).toBeTruthy();
});
