const dotenv = require("dotenv");
dotenv.config();
const nodeEnv = process.env.NODE_ENV || "development";
const jwtExpiresIn = process.env.JWT_EXPIRES_IN || "8h";
const duration = /^(\d+)(s|m|h|d)$/.exec(jwtExpiresIn);
if (!duration || Number(duration[1]) <= 0) throw new Error("JWT_EXPIRES_IN must be a positive duration, e.g. 8h.");
const jwtMaxAge = Number(duration[1]) * { s: 1000, m: 60000, h: 3600000, d: 86400000 }[duration[2]];
const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret || Buffer.byteLength(jwtSecret) < 32) throw new Error("Set JWT_SECRET to a random secret of at least 32 bytes.");
const frontendOrigin = process.env.FRONTEND_ORIGIN || "http://localhost:5173";
if (new URL(frontendOrigin).origin !== frontendOrigin) throw new Error("FRONTEND_ORIGIN must be an exact HTTP(S) origin without a trailing slash.");
if (!/^https?:/.test(frontendOrigin)) throw new Error("FRONTEND_ORIGIN must use HTTP(S).");
const cookieSecure = nodeEnv === "production" || process.env.COOKIE_SECURE === "true";
const cookieSameSite = process.env.COOKIE_SAME_SITE || "lax";
if (!["strict", "lax", "none"].includes(cookieSameSite) || (cookieSameSite === "none" && !cookieSecure)) throw new Error("Invalid cookie SameSite/secure configuration.");
const trustProxy = Number(process.env.TRUST_PROXY_HOPS || 0);
if (!Number.isInteger(trustProxy) || trustProxy < 0) throw new Error("TRUST_PROXY_HOPS must be a non-negative integer.");
module.exports = {
  nodeEnv, port: Number(process.env.PORT) || 5000,
  mongoUri: process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/campusvoice",
  frontendOrigin, jwtSecret, jwtExpiresIn, jwtMaxAge, cookieSecure, cookieSameSite,
  cookieName: "cv_auth", trustProxy,
};
