// src/middleware/rateLimiter.middleware.js
// ─────────────────────────────────────────────────────────────────────
// Redis-backed rate limiting
//
// HOW RATE LIMITING WORKS (with Redis):
//
//   User sends request → middleware checks Redis:
//     Key:   "rl:chat:userId_abc123"   (or IP if not logged in)
//     Value: 12  (requests in this window)
//     TTL:   48 seconds (time remaining in 1-min window)
//
//   If value < limit (30): INCR the key, allow the request
//   If value >= limit (30): return 429 Too Many Requests
//   When TTL expires (window ends): key auto-deletes, counter resets
//
// WHY REDIS OVER IN-MEMORY:
//   In-memory rate limiting resets when your server restarts.
//   With multiple server instances (horizontal scaling), each instance
//   has its own in-memory counter — a user can send 30 * N requests
//   where N = number of servers.
//   Redis is a single shared store — all instances see the same counters.
//
// DIFFERENT LIMITS FOR DIFFERENT ROUTES:
//   auth    → 5/15min  (prevent brute force login attacks)
//   chat    → 30/min   (protect free Gemini API quota)
//   upload  → 10/hour  (prevent storage abuse)
//   general → 200/15min (baseline protection)
// ─────────────────────────────────────────────────────────────────────
const rateLimit       = require("express-rate-limit");
const { RedisStore }  = require("rate-limit-redis");
const { getRedisOrNull } = require("../config/redis");

// Factory function: create a rate limiter with Redis store if available,
// fall back to in-memory if Redis is down (graceful degradation)
const createLimiter = ({ windowMs, max, message, prefix }) => {
  const redis = getRedisOrNull();

  const options = {
    windowMs,
    max,
    standardHeaders: true,   // sends RateLimit-Limit, RateLimit-Remaining headers
    legacyHeaders:   false,   // disable deprecated X-RateLimit-* headers
    message: {
      success: false,
      error:   message,
      retryAfter: Math.ceil(windowMs / 1000),
    },

    // Key by user ID (authenticated) or IP (unauthenticated)
    // This prevents a single user from hammering even across IP changes
    keyGenerator: (req) => {
      return req.user?.id
        ? `user:${req.user.id}`
        : `ip:${req.ip}`;
    },

    skip: () => process.env.NODE_ENV === "test",
  };

  // Use Redis store if Redis is available
  if (redis) {
    options.store = new RedisStore({
      sendCommand: (...args) => redis.call(...args),
      prefix:      `rl:${prefix}:`,
    });
  }
  // else: falls back to default in-memory store (works for single instance)

  return rateLimit(options);
};

// ── Exported limiters ─────────────────────────────────────────────────

// Strict: prevents brute-force password attacks
const authLimiter = createLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max:      5,
  message:  "Too many login attempts. Please wait 15 minutes and try again.",
  prefix:   "auth",
});

// Moderate: protects Gemini API free quota
const chatLimiter = createLimiter({
  windowMs: 60 * 1000, // 1 minute
  max:      30,
  message:  "Message limit reached. Please wait a moment before sending more.",
  prefix:   "chat",
});

// Loose: prevents storage abuse
const uploadLimiter = createLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max:      10,
  message:  "Upload limit reached. You can upload 10 documents per hour.",
  prefix:   "upload",
});

// General: baseline for all API routes
const generalLimiter = createLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max:      200,
  message:  "Too many requests. Please slow down.",
  prefix:   "general",
});

module.exports = { authLimiter, chatLimiter, uploadLimiter, generalLimiter };
