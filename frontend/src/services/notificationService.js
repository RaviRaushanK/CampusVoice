import { request } from "./apiClient";

export const getNotifications = ({ page = 1, limit = 20, status = "all" } = {}, options = {}) =>
  request(`/notifications?${new URLSearchParams({ page, limit, status })}`, options);
export const getUnreadCount = (options = {}) => request("/notifications/unread-count", options);
export const markNotificationRead = (id, options = {}) => request(`/notifications/${encodeURIComponent(id)}/read`, { ...options, method: "PATCH" });
export const markAllNotificationsRead = (options = {}) => request("/notifications/read-all", { ...options, method: "PATCH" });
