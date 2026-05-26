// src/middleware/auth.middleware.js
// ─────────────────────────────────────────────────────────────────────
// JWT Authentication Middleware
//
// JWT FLOW EXPLAINED:
//
//   ACCESS TOKEN (15 minutes):
//     - Short-lived. Sent in every request header.
//     - If stolen, attacker has access for at most 15 minutes.
//     - Stored in localStorage on the client.
//
//   REFRESH TOKEN (7 days):
//     - Long-lived. Sent ONLY to /auth/refresh endpoint.
//     - Stored in httpOnly cookie (JavaScript cannot read it — XSS safe).
//     - Stored HASHED in DB (so a DB breach doesn't expose tokens).
//     - Rotated on every use (old token invalidated, new one issued).
//
//   BLACKLIST (Redis):
//     - On logout, the access token is added to Redis with its remaining TTL.
//     - Every protected request checks the blacklist.
//     - Without this, a stolen token would work until it naturally expires.
//     - Redis TTL auto-cleans old entries — no maintenance needed.
//
//   FLOW:
//     Login → get accessToken + set refreshToken cookie
//     Every request → Authorization: Bearer <accessToken>
//     After 15 min → accessToken expires → 401 TOKEN_EXPIRED
//     Client → POST /auth/refresh → sends cookie → gets new accessToken
//     Logout → blacklist accessToken in Redis + clear refreshToken
// ─────────────────────────────────────────────────────────────────────
const jwt      = require("jsonwebtoken");
const User     = require("../models/User");
const { getRedisOrNull } = require("../config/redis");
const logger   = require("../utils/logger");

// ── Generate token pair ───────────────────────────────────────────────
const generateTokens = (userId) => {
  const accessToken = jwt.sign(
    { id: userId },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: process.env.JWT_ACCESS_EXPIRES || "15m" }
  );

  const refreshToken = jwt.sign(
    { id: userId },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES || "7d" }
  );

  return { accessToken, refreshToken };
};

// ── Add token to Redis blacklist ──────────────────────────────────────
const blacklistToken = async (token) => {
  const redis = getRedisOrNull();
  if (!redis) return;

  const decoded = jwt.decode(token);
  if (!decoded?.exp) return;

  const ttlSeconds = decoded.exp - Math.floor(Date.now() / 1000);
  if (ttlSeconds > 0) {
    try {
      await redis.setex(`blacklist:${token}`, ttlSeconds, "1");
      logger.debug(`Token blacklisted for ${ttlSeconds}s`);
    } catch (err) {
      logger.warn(`Redis blacklist write skipped: ${err.message}`);
    }
  }
};

// ── Set refresh token as httpOnly cookie ──────────────────────────────
const setRefreshCookie = (res, token) => {
  res.cookie("refreshToken", token, {
    httpOnly: true,   // JS cannot read → prevents XSS token theft
    secure:   process.env.NODE_ENV === "production", // HTTPS only in prod
    sameSite: "strict", // prevents CSRF
    maxAge:   7 * 24 * 60 * 60 * 1000, // 7 days in ms
  });
};

// ── Protect middleware — verifies access token ────────────────────────
const protect = async (req, res, next) => {
  try {
    // 1. Extract token from Authorization header
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        error:   "Authentication required. Please log in.",
      });
    }

    const token = header.split(" ")[1];

    // 2. Check Redis blacklist (logout invalidation)
    const redis = getRedisOrNull();
    if (redis) {
      try {
        const isBlacklisted = await redis.get(`blacklist:${token}`);
        if (isBlacklisted) {
          return res.status(401).json({
            success: false,
            error:   "Session expired. Please log in again.",
          });
        }
      } catch (err) {
        logger.warn(`Redis blacklist check skipped: ${err.message}`);
      }
    }

    // 3. Verify signature and expiry
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);

    // 4. Confirm user still exists and is active
    const user = await User.findById(decoded.id).select("-password -refreshToken");
    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        error:   "User account not found or deactivated.",
      });
    }

    req.user = user; // attach user to request for downstream use
    next();

  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        error:   "Access token expired.",
        code:    "TOKEN_EXPIRED", // frontend intercepts this code to auto-refresh
      });
    }
    if (err.name === "JsonWebTokenError") {
      return res.status(401).json({
        success: false,
        error:   "Invalid token.",
      });
    }
    logger.error("Auth middleware error:", err);
    res.status(500).json({ success: false, error: "Authentication error" });
  }
};

module.exports = { protect, generateTokens, blacklistToken, setRefreshCookie };
