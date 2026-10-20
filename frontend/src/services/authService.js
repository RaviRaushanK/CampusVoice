import { request } from "./apiClient";
export const login = (userCode, password) => request("/auth/login", { method: "POST", notifyAuthFailure: false, body: JSON.stringify({ userCode, password }) });
export const logout = () => request("/auth/logout", { method: "POST" });
export const me = () => request("/auth/me", { notifyAuthFailure: false });
export const changePassword = (currentPassword, newPassword, confirmPassword) => request("/auth/change-password", {
  method: "POST", body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
});
