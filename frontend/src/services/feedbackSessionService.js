import { request } from "./apiClient";
const path = "/feedback-sessions";
export const getMySessions = (query = {}, options = {}) => request(`${path}/mine?${new URLSearchParams({ page: 1, limit: 20, ...query })}`, options);
export const getSession = (id, options = {}) => request(`${path}/${encodeURIComponent(id)}`, options);
export const createSession = fields => request(path, { method: "POST", body: JSON.stringify(fields) });
export const updateSession = (id, fields) => request(`${path}/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(fields) });
export const deleteDraft = id => request(`${path}/${encodeURIComponent(id)}`, { method: "DELETE" });
