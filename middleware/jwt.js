const jwt = require("jsonwebtoken");
const env = require("../config/env");
const signToken = (user) => jwt.sign({ tokenVersion: user.tokenVersion, role: user.role }, env.jwtSecret, {
  subject: String(user._id), expiresIn: env.jwtExpiresIn, algorithm: "HS256", issuer: "campusvoice", audience: "campusvoice-web",
});
const verifyToken = (token) => jwt.verify(token, env.jwtSecret, { algorithms: ["HS256"], issuer: "campusvoice", audience: "campusvoice-web" });
module.exports = { signToken, verifyToken };
