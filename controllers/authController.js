const service = require("../services/authService");
const { signToken } = require("../middleware/jwt");
const { setAuthCookie, clearAuthCookie } = require("../middleware/cookieOptions");
const respondWithSession = (res, user, message) => {
  setAuthCookie(res, signToken(user));
  return res.json({ success: true, data: user.toSafeProfile(), message });
};
const login = async (req, res, next) => {
  try { respondWithSession(res, await service.login(req.body), "Logged in successfully."); } catch (err) { next(err); }
};
const changePassword = async (req, res, next) => {
  try { respondWithSession(res, await service.changePassword(req.user, req.body), "Password changed successfully."); } catch (err) { next(err); }
};
const logout = async (req, res, next) => {
  try { await service.logout(req.user); clearAuthCookie(res); res.sendStatus(204); } catch (err) { next(err); }
};
const me = (req, res) => res.json({ success: true, data: req.user.toSafeProfile() });
module.exports = { login, logout, me, changePassword };
