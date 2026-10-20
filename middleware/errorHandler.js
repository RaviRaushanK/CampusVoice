const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || err.status || 500;
  const message = err.type === "entity.parse.failed" ? "Invalid JSON request body." : err.type === "entity.too.large" ? "Request body too large." : statusCode >= 500 ? "Internal server error" : err.message || "Request failed";
  const response = { success: false, message };
  if (err.code === "PASSWORD_CHANGE_REQUIRED" || err.code === "CSRF_REJECTED") response.code = err.code;
  res.status(statusCode).json(response);
};
module.exports = errorHandler;
