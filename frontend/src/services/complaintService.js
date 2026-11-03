import { request, apiBaseUrl } from "./apiClient";
const queryString = query => new URLSearchParams(Object.entries(query).filter(([, value]) => value !== "")).toString();
export const complaintOptions = (query = {}, options) => request(`/complaints/options?${queryString(query)}`, options);
export const createComplaint = body => request("/complaints", { method: "POST", body });
export const listComplaints = (own, query, options) => request(`/complaints/${own ? "mine" : "inbox"}?${queryString(query)}`, options);
export const getComplaint = (id, options) => request(`/complaints/${id}`, options);
export const actOnComplaint = (id, action, body = {}) => request(`/complaints/${id}/${action}`, { method: action === "priority" ? "PATCH" : "POST", body: JSON.stringify(body) });
export const attachmentUrl = (id, attachmentId) => `${apiBaseUrl}/complaints/${id}/attachments/${attachmentId}`;
