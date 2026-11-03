import { request } from "./apiClient";
export const getAuditLogs = (query = {}, options) => request(`/audit-logs?${new URLSearchParams(Object.entries(query).filter(([, value]) => value !== ""))}`, options);
