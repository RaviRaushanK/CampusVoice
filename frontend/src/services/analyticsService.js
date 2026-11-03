import { request } from "./apiClient";
export const getAnalytics = (kind, query = {}, options) => request(`/analytics/${kind}?${new URLSearchParams(Object.entries(query).filter(([, value]) => value !== ""))}`, options);
