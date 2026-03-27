const jwt = require("jsonwebtoken");

const TOKEN_TTL = process.env.JWT_EXPIRES_IN || "7d";

function getJwtSecret() {
  const secret = String(process.env.JWT_SECRET || "").trim();
  if (!secret) throw new Error("JWT_SECRET is missing in server/.env");
  return secret;
}

function signAuthToken(payload) {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: TOKEN_TTL });
}

function verifyAuthToken(token) {
  return jwt.verify(token, getJwtSecret());
}

function authRequired(req, res, next) {
  const raw = String(req.headers.authorization || "");
  if (!raw.startsWith("Bearer ")) {
    return res.status(401).json({ ok: false, reject: { message: "Unauthorized. Missing bearer token." } });
  }
  const token = raw.slice("Bearer ".length).trim();
  if (!token) {
    return res.status(401).json({ ok: false, reject: { message: "Unauthorized. Empty bearer token." } });
  }
  try {
    const decoded = verifyAuthToken(token);
    if (!decoded?.userId) {
      return res.status(401).json({ ok: false, reject: { message: "Invalid session token." } });
    }
    req.userId = String(decoded.userId);
    req.authUser = decoded;
    return next();
  } catch (e) {
    return res.status(401).json({ ok: false, reject: { message: "Session expired, please login again." } });
  }
}

module.exports = { signAuthToken, verifyAuthToken, authRequired };
