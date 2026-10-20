const env = require("../config/env");
const getCookieOptions = () => ({ httpOnly: true, secure: env.cookieSecure, sameSite: env.cookieSameSite, path: "/" });
const setAuthCookie = (res, token) => res.cookie(env.cookieName, token, { ...getCookieOptions(), maxAge: env.jwtMaxAge });
const clearAuthCookie = (res) => res.clearCookie(env.cookieName, getCookieOptions());
module.exports = { getCookieOptions, setAuthCookie, clearAuthCookie };
