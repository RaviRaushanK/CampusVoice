import { request } from "./apiClient";

export const getProfile = () => request("/profile");
export const updateProfile = ({ name, email }) => request("/profile", {
  method: "PATCH", body: JSON.stringify({ name, email }),
});
