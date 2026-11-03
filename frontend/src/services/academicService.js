import { request } from "./apiClient";
export const listAcademic = (resource, query = {}, options = {}) => {
  const params = new URLSearchParams(Object.entries({ page: 1, limit: 20, ...query }).filter(([, value]) => value !== "" && value !== undefined));
  return request(`/${resource}?${params}`, options);
};
export const createAcademic = (resource, fields) => request(`/${resource}`, { method: "POST", body: JSON.stringify(fields) });
export const updateAcademic = (resource, id, fields) => request(`/${resource}/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(fields) });
export const getAcademicDashboard = (options = {}) => request("/academic/dashboard", options);
export const getAcademicOptions = (resource, status = "all", options = {}) => request(`/academic/options?${new URLSearchParams({ resource, status })}`, options);
