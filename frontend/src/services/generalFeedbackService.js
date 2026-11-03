import { request } from "./apiClient";
const path = "/general-feedback";
const list = (suffix, query, options) => request(`${path}/${suffix}?${new URLSearchParams({ page: 1, limit: 20, ...query })}`, options);
export const getFeedbackOptions = (query = {}, options = {}) => list("options", query, options);
export const submitGeneralFeedback = fields => request(path, { method: "POST", body: JSON.stringify(fields) });
export const getMyFeedback = (query = {}, options = {}) => list("mine", query, options);
export const getReceivedFeedback = (query = {}, options = {}) => list("received", query, options);
export const getDepartmentFeedback = (query = {}, options = {}) => list("department", query, options);
export const getFeedbackAggregate = (options = {}) => request(`${path}/aggregate`, options);
