import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";
import Profile from "./Profile";
import App from "../../App";
import { AuthProvider } from "../../context/AuthContext";
import * as service from "../../services/profileService";
import * as auth from "../../services/authService";
import * as notifications from "../../services/notificationService";
vi.mock("../../services/notificationService", () => ({ getUnreadCount: vi.fn() }));
vi.mock("../../services/profileService", () => ({ getProfile: vi.fn(), updateProfile: vi.fn() }));
vi.mock("../../services/authService", () => ({ me: vi.fn(), login: vi.fn(), logout: vi.fn(), changePassword: vi.fn() }));
const profile = { name: "Ravi Raushan Kumar", userCode: "student001", email: "ravi@example.edu", role: "STUDENT", isActive: true,
  lastLoginAt: "2026-10-27T09:00:00Z", createdAt: "2026-10-20T09:00:00Z", departmentId: null, semester: null, section: null };
const open = path => render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>);
beforeEach(() => auth.me.mockResolvedValue({ data: profile }));
beforeEach(() => notifications.getUnreadCount.mockResolvedValue({ data: { count: 0 } }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });
it("shows the shared loading state", () => {
  service.getProfile.mockReturnValue(new Promise(() => {})); render(<MemoryRouter><AuthProvider><Profile /></AuthProvider></MemoryRouter>);
  expect(screen.getByRole("status").textContent).toContain("Loading profile");
});
it("renders read-only personal, account and formatted date information", async () => {
  service.getProfile.mockResolvedValue({ data: profile }); render(<MemoryRouter><AuthProvider><Profile /></AuthProvider></MemoryRouter>);
  const personal = await screen.findByRole("region", { name: "Personal Information" });
  expect(within(personal).getByText(profile.name)).toBeTruthy();
  expect(within(personal).getByText(profile.email)).toBeTruthy();
  const account = screen.getByRole("region", { name: "Account Information" });
  for (const value of [profile.userCode, "Student", "Active"]) expect(within(account).getByText(value)).toBeTruthy();
  const dates = within(account).getAllByText(/Oct 2026/);
  expect(dates).toHaveLength(2);
  expect(dates[0].textContent).toMatch(/27 Oct 2026.*\d+:\d+/);
  expect(dates[1].textContent).toBe("20 Oct 2026");
  expect(screen.getByText("RR")).toBeTruthy();
  expect(screen.queryByRole("textbox")).toBeNull();
  expect(screen.getByRole("button", { name: "Edit Profile" })).toBeTruthy();
});
it.each([["Ravi", "R"], [" Ravi   Kumar ", "RK"], ["", "?"], [null, "?"]])("handles initials for %j", async (name, initials) => {
  service.getProfile.mockResolvedValue({ data: { ...profile, name } }); render(<MemoryRouter><AuthProvider><Profile /></AuthProvider></MemoryRouter>);
  expect(await screen.findByText(initials)).toBeTruthy();
});
it("handles missing values and invalid dates without invented information", async () => {
  service.getProfile.mockResolvedValue({ data: { lastLoginAt: "broken", createdAt: null } }); render(<MemoryRouter><AuthProvider><Profile /></AuthProvider></MemoryRouter>);
  await screen.findByRole("region", { name: "Account Information" });
  expect(screen.getAllByText("Not provided")).toHaveLength(4);
  expect(screen.getAllByText("Not assigned")).toHaveLength(3);
  expect(screen.getAllByText("Not available")).toHaveLength(5);
  expect(screen.queryByText("Invalid Date")).toBeNull();
});
it("shows a safe API failure and can retry", async () => {
  service.getProfile.mockRejectedValueOnce(new Error("internal stack secret")).mockResolvedValue({ data: profile }); render(<MemoryRouter><AuthProvider><Profile /></AuthProvider></MemoryRouter>);
  expect((await screen.findByRole("alert")).textContent).toContain("Unable to load your profile");
  expect(screen.queryByText(/internal stack secret/)).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  expect(await screen.findByText(profile.userCode)).toBeTruthy();
});
it("handles an unavailable profile", async () => {
  service.getProfile.mockResolvedValue({ data: null }); render(<MemoryRouter><AuthProvider><Profile /></AuthProvider></MemoryRouter>);
  expect((await screen.findByRole("alert")).textContent).toContain("profile is unavailable");
});
it.each(["PRINCIPAL", "HOD", "FACULTY", "STUDENT"])("%s navigation opens the shared profile with its existing layout", async role => {
  auth.me.mockResolvedValue({ data: { ...profile, role } });
  service.getProfile.mockResolvedValue({ data: { ...profile, role } }); open(`/${role.toLowerCase()}/dashboard`);
  await screen.findByText("No recent activity yet");
  const link = screen.getByRole("link", { name: "Profile", exact: true });
  expect(link.getAttribute("href")).toBe("/profile");
  fireEvent.click(link);
  await screen.findByRole("heading", { name: "My Profile" });
  expect(await screen.findByText(profile.userCode)).toBeTruthy();
  const label = { PRINCIPAL: "Principal", HOD: "HOD", FACULTY: "Faculty", STUDENT: "Student" }[role];
  expect(screen.getByRole("complementary", { name: `${label} navigation` })).toBeTruthy();
  expect(within(screen.getByRole("region", { name: "Account Information" })).getByText(label)).toBeTruthy();
});
it("redirects an unauthenticated profile visit to login without fetching profile data", async () => {
  auth.me.mockRejectedValue({ status: 401 }); open("/profile");
  expect(await screen.findByRole("heading", { name: "Welcome back" })).toBeTruthy();
  expect(service.getProfile).not.toHaveBeenCalled();
});
it("preserves the first-login redirect", async () => {
  auth.me.mockResolvedValue({ data: { ...profile, mustChangePassword: true } }); open("/profile");
  expect(await screen.findByText("First login - change your password")).toBeTruthy();
  expect(service.getProfile).not.toHaveBeenCalled();
});
it("removes the profile after a session-expiry event", async () => {
  auth.me.mockResolvedValue({ data: profile }); service.getProfile.mockResolvedValue({ data: profile }); open("/profile");
  await screen.findByText(profile.userCode);
  act(() => window.dispatchEvent(new Event("auth:expired")));
  expect(await screen.findByRole("heading", { name: "Welcome back" })).toBeTruthy();
  expect(screen.queryByRole("heading", { name: "My Profile" })).toBeNull();
});

const enterEdit = async () => {
  auth.me.mockResolvedValue({ data: { ...profile, mustChangePassword: false } });
  service.getProfile.mockResolvedValue({ data: profile }); open("/profile");
  fireEvent.click(await screen.findByRole("button", { name: "Edit Profile" }));
};
const changeField = (label, value) => fireEvent.change(screen.getByLabelText(label, { exact: true }), { target: { value } });
it("opens only name/email inputs and cancel restores saved values without submitting", async () => {
  await enterEdit();
  expect(screen.getByLabelText("Name").value).toBe(profile.name);
  expect(screen.getByLabelText("Email").value).toBe(profile.email);
  expect(screen.getAllByRole("textbox")).toHaveLength(2);
  expect(screen.queryByRole("region", { name: "Personal Information" })).toBeNull();
  changeField("Name", "Unsaved"); changeField("Email", "unsaved@example.edu");
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(screen.queryByRole("textbox")).toBeNull();
  expect(service.updateProfile).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Edit Profile" }));
  expect(screen.getByLabelText("Name").value).toBe(profile.name);
  expect(screen.getByLabelText("Email").value).toBe(profile.email);
});
it.each([["Name", ""], ["Name", "   "], ["Email", "invalid"]])("validates %s=%j before submitting", async (label, value) => {
  await enterEdit(); changeField(label, value);
  fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));
  expect(screen.getByRole("alert").textContent).toContain(label === "Name" ? "Name must" : "valid email");
  expect(service.updateProfile).not.toHaveBeenCalled();
});
it("prevents repeated submissions while saving and uses authoritative server values throughout the shared UI", async () => {
  let finish;
  service.updateProfile.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  await enterEdit(); changeField("Name", "  Requested Name  "); changeField("Email", "NEW@EXAMPLE.EDU");
  fireEvent.submit(screen.getByRole("form", { name: "Edit profile form" }));
  expect(screen.getByRole("status").textContent).toBe("Saving...");
  expect(screen.getByRole("button", { name: "Saving..." }).disabled).toBe(true);
  expect(screen.getByLabelText("Name").closest("fieldset").disabled).toBe(true);
  fireEvent.submit(screen.getByRole("form", { name: "Edit profile form" }));
  expect(service.updateProfile).toHaveBeenCalledOnce();
  expect(service.updateProfile).toHaveBeenCalledWith({ name: "Requested Name", email: "NEW@EXAMPLE.EDU" });
  const saved = { ...profile, name: "Server Confirmed", email: "new@example.edu" };
  await act(async () => finish({ data: saved }));
  expect(screen.getByRole("alert").textContent).toBe("Profile updated successfully.");
  expect(screen.queryByRole("textbox")).toBeNull();
  expect(within(screen.getByRole("banner")).getByText(saved.name)).toBeTruthy();
  expect(screen.getByText(saved.email)).toBeTruthy();
  expect(screen.getByText("SC")).toBeTruthy();
  expect(screen.queryByText("Requested Name")).toBeNull();
});
it.each([
  [{ status: 409, message: "This email address is already in use." }, "This email address is already in use."],
  [new TypeError("internal network details"), "Unable to save your profile. Please try again."],
  [{ status: 500, message: "server secret" }, "Unable to save your profile. Please try again."],
  [{ status: 403, message: "Request blocked by CSRF protection." }, "Request blocked by CSRF protection."],
])("shows a clean update failure and retains draft values %#", async (error, message) => {
  service.updateProfile.mockRejectedValue(error); await enterEdit(); changeField("Name", "Draft Name");
  fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));
  expect((await screen.findByRole("alert")).textContent).toBe(message);
  expect(screen.getByLabelText("Name").value).toBe("Draft Name");
  expect(within(screen.getByRole("banner")).getByText(profile.name)).toBeTruthy();
});
it("allows clearing the optional email", async () => {
  service.updateProfile.mockResolvedValue({ data: { ...profile, email: null } });
  await enterEdit(); changeField("Email", ""); fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));
  expect(await screen.findByText("Not provided")).toBeTruthy();
  expect(service.updateProfile).toHaveBeenCalledWith({ name: profile.name, email: null });
});
it("Security opens the existing voluntary password-change page", async () => {
  await enterEdit(); fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  fireEvent.click(within(screen.getByRole("region", { name: "Security" })).getByRole("link", { name: "Change Password" }));
  expect(await screen.findByText("Change your password")).toBeTruthy();
  expect(screen.getByLabelText("Current password")).toBeTruthy();
});
it("a late update cannot restore protected content after session expiry", async () => {
  let finish;
  service.updateProfile.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  await enterEdit(); fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));
  act(() => window.dispatchEvent(new Event("auth:expired")));
  await screen.findByRole("heading", { name: "Welcome back" });
  await act(async () => finish({ data: { ...profile, name: "Late Name" } }));
  expect(screen.queryByText("Late Name")).toBeNull();
  expect(screen.getByRole("heading", { name: "Welcome back" })).toBeTruthy();
});
it("a session refresh started before save cannot overwrite the confirmed shared user", async () => {
  let finishRefresh;
  auth.me.mockResolvedValueOnce({ data: profile }).mockImplementationOnce(() => new Promise(resolve => { finishRefresh = resolve; }));
  service.getProfile.mockResolvedValue({ data: profile });
  const saved = { ...profile, name: "Confirmed Name" };
  service.updateProfile.mockResolvedValue({ data: saved }); open("/profile");
  fireEvent.click(await screen.findByRole("button", { name: "Edit Profile" }));
  act(() => document.dispatchEvent(new Event("visibilitychange")));
  changeField("Name", saved.name); fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));
  await screen.findByText("Profile updated successfully.");
  await act(async () => finishRefresh({ data: profile }));
  expect(within(screen.getByRole("banner")).getByText(saved.name)).toBeTruthy();
  expect(within(screen.getByRole("banner")).queryByText(profile.name)).toBeNull();
});
it("a pending session rejection still removes protected content after a profile save", async () => {
  let rejectRefresh;
  auth.me.mockResolvedValueOnce({ data: profile }).mockImplementationOnce(() => new Promise((resolve, reject) => { rejectRefresh = reject; }));
  service.getProfile.mockResolvedValue({ data: profile });
  service.updateProfile.mockResolvedValue({ data: { ...profile, name: "Confirmed Name" } }); open("/profile");
  fireEvent.click(await screen.findByRole("button", { name: "Edit Profile" }));
  act(() => document.dispatchEvent(new Event("visibilitychange")));
  changeField("Name", "Confirmed Name"); fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));
  await screen.findByText("Profile updated successfully.");
  await act(async () => rejectRefresh({ status: 401 }));
  expect(await screen.findByRole("heading", { name: "Welcome back" })).toBeTruthy();
  expect(screen.queryByRole("heading", { name: "My Profile" })).toBeNull();
});
