import React from "react";
import { render, screen, waitFor, cleanup, fireEvent, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";
import App from "../App";
import * as auth from "../services/authService";
import * as notifications from "../services/notificationService";
import * as academic from "../services/academicService";
vi.mock("../services/academicService", () => ({ getAcademicDashboard: vi.fn() }));
vi.mock("../services/notificationService", () => ({ getUnreadCount: vi.fn() }));
vi.mock("../services/authService", () => ({ me: vi.fn(), login: vi.fn(), logout: vi.fn(), changePassword: vi.fn() }));
const roles = ["PRINCIPAL", "HOD", "FACULTY", "STUDENT"];
const profile = (role = "PRINCIPAL", mustChangePassword = false) => ({ name: "Authenticated User", role, mustChangePassword, userCode: "test1" });
const open = path => render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>);
beforeEach(() => notifications.getUnreadCount.mockResolvedValue({ data: { count: 0 } }));
beforeEach(() => academic.getAcademicDashboard.mockResolvedValue({ data: { metrics: {} } }));
afterEach(() => { cleanup(); vi.resetAllMocks(); vi.useRealTimers(); });
it.each(roles)("%s workspace root recovers to its own dashboard", async role => {
  auth.me.mockResolvedValue({ data: profile(role) });
  open(`/${role.toLowerCase()}`);
  expect(await screen.findByText("Workspace ready")).toBeTruthy();
});
it.each(roles)("direct %s dashboard URL requires authentication", async role => {
  auth.me.mockRejectedValue({ status: 401 }); open(`/${role.toLowerCase()}/dashboard`);
  expect(await screen.findByRole("heading", { name: "Welcome back" })).toBeTruthy();
  expect(screen.queryByText("Workspace ready")).toBeNull();
});
it("does not expose dashboard content while checking authentication", async () => {
  auth.me.mockReturnValue(new Promise(() => {})); open("/principal/dashboard");
  expect(screen.getByText("Verifying session")).toBeTruthy();
  expect(screen.queryByText("Workspace ready")).toBeNull();
});
it.each(roles)("restores %s dashboard with original empty states and shared navigation", async role => {
  auth.me.mockResolvedValue({ data: profile(role) }); open(`/${role.toLowerCase()}/dashboard`);
  expect(await screen.findByText("Workspace ready")).toBeTruthy();
  expect(screen.getByText("Authenticated User")).toBeTruthy();
  expect(screen.getAllByRole("button", { name: "Logout" }).length).toBeGreaterThan(0);
});
it.each(roles.flatMap(role => roles.filter(target => target !== role).map(target => [role, target])))("%s cannot view %s dashboard", async (role, target) => {
  auth.me.mockResolvedValue({ data: profile(role) }); open(`/${target.toLowerCase()}/dashboard`);
  await screen.findByText("Workspace ready");
  const title = role === "HOD" ? "HOD" : role[0] + role.slice(1).toLowerCase();
  expect(screen.getAllByRole("heading", { name: `${title} Dashboard` }).length).toBeGreaterThan(0);
  expect(screen.queryByRole("heading", { name: `${target === "HOD" ? "HOD" : target[0] + target.slice(1).toLowerCase()} Dashboard` })).toBeNull();
});
it.each(["/", "/login", "/student/dashboard"])("first-login session at %s redirects to password change on restoration", async path => {
  auth.me.mockResolvedValue({ data: profile("STUDENT", true) }); open(path);
  expect(await screen.findByText("First login - change your password")).toBeTruthy();
  expect(screen.queryByText("Workspace ready")).toBeNull();
});
it("password change requires authentication", async () => {
  auth.me.mockRejectedValue({ status: 401 }); open("/change-password");
  expect(await screen.findByText("Welcome back")).toBeTruthy();
});
it("login uses backend role and routes first-login accounts to password change", async () => {
  auth.me.mockRejectedValue({ status: 401 }); auth.login.mockResolvedValue({ data: profile("HOD", true) }); open("/login");
  await screen.findByText("Welcome back");
  fireEvent.change(screen.getByLabelText("User Code"), { target: { value: "hod1" } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "Temp_123!" } });
  fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
  expect(await screen.findByText("First login - change your password")).toBeTruthy();
  expect(auth.login).toHaveBeenCalledWith("hod1", "Temp_123!");
});
it("password change establishes new session and redirects to own dashboard", async () => {
  auth.me.mockResolvedValue({ data: profile("FACULTY", true) }); auth.changePassword.mockResolvedValue({ data: profile("FACULTY") }); open("/change-password");
  await screen.findByText("First login - change your password");
  for (const [label, value] of [["Current password", "Temp_123!"], ["New password", "Changed_456!"], ["Confirm new password", "Changed_456!"]]) fireEvent.change(screen.getByLabelText(label), { target: { value } });
  fireEvent.click(screen.getByRole("button", { name: "Update password" }));
  expect(await screen.findByText("Workspace ready")).toBeTruthy();
});
it.each([0, 1])("logout control %i clears authenticated UI", async control => {
  auth.me.mockResolvedValue({ data: profile() }); auth.logout.mockResolvedValue({}); open("/principal/dashboard");
  await screen.findByText("Workspace ready");
  fireEvent.click(screen.getAllByRole("button", { name: "Logout" })[control]);
  expect(await screen.findByText("Welcome back")).toBeTruthy();
});
it("failed logout keeps session visible with a retryable error", async () => {
  auth.me.mockResolvedValue({ data: profile() }); auth.logout.mockRejectedValue(new Error("offline")); open("/principal/dashboard");
  await screen.findByText("Workspace ready"); fireEvent.click(screen.getAllByRole("button", { name: "Logout" })[1]);
  expect(await screen.findByRole("alert")).toBeTruthy(); expect(screen.getByText("Workspace ready")).toBeTruthy();
});
it("expired-session events remove protected content", async () => {
  auth.me.mockResolvedValue({ data: profile() }); open("/principal/dashboard");
  await screen.findByText("Workspace ready");
  act(() => window.dispatchEvent(new Event("auth:expired")));
  await waitFor(() => expect(screen.queryByText("Workspace ready")).toBeNull());
  expect(await screen.findByText("Welcome back")).toBeTruthy();
});

it.each(roles)("%s navigation contains only implemented modules", async role => {
  auth.me.mockResolvedValue({ data: profile(role) }); open(`/${role.toLowerCase()}/dashboard`);
  await screen.findByText("Workspace ready");
  expect(screen.queryByRole("button", { name: "Academic Feedback", exact: true })).toBeNull();
  expect(screen.queryByRole("button", { name: "My Classes", exact: true })).toBeNull();
  if (role === "STUDENT") expect(screen.getByRole("link", { name: "Raise Complaint", exact: true }).getAttribute("href")).toBe("/student/complaints/new");
  else expect(screen.getByRole("link", { name: "Analytics", exact: true }).getAttribute("href")).toBe(`/${role.toLowerCase()}/analytics`);
  expect(screen.getByRole("link", { name: "Change password" }).getAttribute("href")).toBe("/change-password");
});

it.each(["/", "/unknown"])("%s resolves to the current user's dashboard", async path => {
  auth.me.mockResolvedValue({ data: profile("HOD") }); open(path);
  expect(await screen.findByText("Workspace ready")).toBeTruthy();
  expect(screen.getAllByRole("heading", { name: "HOD Dashboard" }).length).toBe(2);
});

it("a transient session-check failure keeps the known user and recovers on retry", async () => {
  auth.me.mockResolvedValueOnce({ data: profile() }).mockRejectedValueOnce(new TypeError("offline")).mockResolvedValue({ data: profile() });
  open("/principal/dashboard"); await screen.findByText("Workspace ready");
  await act(async () => document.dispatchEvent(new Event("visibilitychange")));
  expect(screen.getByRole("alert").textContent).toContain("Unable to check your session");
  expect(screen.getByText("Authenticated User")).toBeTruthy();
  expect(screen.queryByText("Welcome back")).toBeNull();
  await act(async () => document.dispatchEvent(new Event("visibilitychange")));
  expect(screen.queryByRole("alert")).toBeNull();
});

it("a confirmed 401 during refresh clears the protected UI", async () => {
  auth.me.mockResolvedValueOnce({ data: profile() }).mockRejectedValue({ status: 401 });
  open("/principal/dashboard"); await screen.findByText("Workspace ready");
  await act(async () => document.dispatchEvent(new Event("visibilitychange")));
  expect(await screen.findByText("Welcome back")).toBeTruthy();
  expect(screen.queryByText("Workspace ready")).toBeNull();
});

it("an initial network failure shows an error without revealing protected content", async () => {
  auth.me.mockRejectedValue(new TypeError("offline")); open("/principal/dashboard");
  expect(await screen.findByRole("alert")).toBeTruthy();
  expect(screen.queryByText("Workspace ready")).toBeNull();
});

it("a stale session refresh cannot restore the dashboard after logout", async () => {
  let completeRefresh;
  auth.me.mockResolvedValueOnce({ data: profile() }).mockImplementationOnce(() => new Promise(resolve => { completeRefresh = resolve; }));
  auth.logout.mockResolvedValue({}); open("/principal/dashboard");
  await screen.findByText("Workspace ready");
  act(() => document.dispatchEvent(new Event("visibilitychange")));
  fireEvent.click(screen.getAllByRole("button", { name: "Logout" })[0]);
  await screen.findByText("Welcome back");
  await act(async () => completeRefresh({ data: profile() }));
  expect(screen.queryByText("Workspace ready")).toBeNull();
});

it("first-login logout returns to login and disables duplicate requests", async () => {
  let completeLogout;
  auth.me.mockResolvedValue({ data: profile("STUDENT", true) });
  auth.logout.mockImplementation(() => new Promise(resolve => { completeLogout = resolve; }));
  open("/change-password"); await screen.findByText("First login - change your password");
  fireEvent.click(screen.getByRole("button", { name: "Logout" }));
  expect(screen.getByRole("button", { name: "Logging out..." }).disabled).toBe(true);
  expect(screen.getByLabelText("Current password").closest("fieldset").disabled).toBe(true);
  await act(async () => completeLogout({}));
  expect(await screen.findByText("Welcome back")).toBeTruthy();
  expect(auth.logout).toHaveBeenCalledOnce();
});
