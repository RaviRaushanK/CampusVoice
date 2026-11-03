module.exports = (req, res, next) => {
  res.set({ "X-Content-Type-Options": "nosniff", "X-Frame-Options": "DENY", "Referrer-Policy": "no-referrer", "Permissions-Policy": "camera=(), microphone=(), geolocation=()", "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'" });
  if (require("../config/env").nodeEnv === "production") res.set("Strict-Transport-Security", "max-age=31536000");
  next();
};
