import { request } from "./apiClient";
const path = "/suggestions";
const list = (suffix, query, options) => request(`${path}/${suffix}?${new URLSearchParams({ page: 1, limit: 20, ...query })}`, options);
export const getSuggestionFaculty = (query = {}, options = {}) => list("faculty-options", query, options);
export const submitSuggestion = fields => request(path, { method: "POST", body: JSON.stringify(fields) });
export const getSentSuggestions = (query = {}, options = {}) => list("mine", query, options);
export const getReceivedSuggestions = (query = {}, options = {}) => list("received", query, options);
