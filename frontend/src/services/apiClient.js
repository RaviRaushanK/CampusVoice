const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";
export const request = async (path, options = {}) => {
  const { notifyAuthFailure = true, ...fetchOptions } = options;
  const method = (options.method || "GET").toUpperCase();
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...fetchOptions, credentials: "include",
    headers: { "Content-Type": "application/json", ...(!["GET", "HEAD"].includes(method) ? { "X-CSRF-Protection": "1" } : {}), ...options.headers },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && notifyAuthFailure) window.dispatchEvent(new Event("auth:expired"));
    if (data.code === "PASSWORD_CHANGE_REQUIRED") window.dispatchEvent(new Event("auth:password-required"));
    throw Object.assign(new Error(data.message || "API request failed"), { status: response.status, code: data.code });
  }
  return data;
};
