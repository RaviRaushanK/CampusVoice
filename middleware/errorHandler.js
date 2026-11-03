const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || err.status || 500;
  const message = err.code === "AUDIT_UNAVAILABLE" ? "This change could not start because audit recording is unavailable. Please try again later." : err.type === "entity.parse.failed" ? "Invalid JSON request body." : err.type === "entity.too.large" ? "Request body too large." : statusCode >= 500 ? "Internal server error" : err.message || "Request failed";
  const response = { success: false, message };
  if (["PASSWORD_CHANGE_REQUIRED", "CSRF_REJECTED", "ALREADY_SUBMITTED", "SESSION_UNAVAILABLE", "AUDIT_UNAVAILABLE"].includes(err.code)) response.code = err.code;
  res.status(statusCode).json(response);
};
module.exports = errorHandler;
