
// ═══════════════════════════════════════════════════════
// HOW WE USE REDIS IN THIS PROJECT (4 distinct purposes):
// ═══════════════════════════════════════════════════════
//
// 1. RATE LIMITING
//    Each user/IP gets a counter in Redis:
//      Key:   "rl:chat:user_abc123"
//      Value: 12  (messages sent this minute)
//      TTL:   60 seconds (auto-deletes after 1 minute)
//    On each request: INCR the counter. If > 30, block the request.
//    Why Redis (not just in-memory)?
//      → Works across MULTIPLE server instances (horizontal scaling)
//      → Survives server restarts
//
// 2. JWT TOKEN BLACKLISTING
//    When user logs out, their access token is added to Redis:
//      Key:   "blacklist:eyJhbGciOiJIUzI1NiJ9..."
//      Value: "1"
//      TTL:   same as token expiry (15 min)
//    On every protected request: check if token is blacklisted.
//    Why not just delete from DB?
//      → JWTs are stateless. DB has no record of issued tokens.
//      → Redis is the only way to invalidate a JWT before it expires.
//
// 3. AI RESPONSE CACHING
//    Common questions are cached so we don't hit Gemini API repeatedly:
//      Key:   "ai:cache:base64(questionText)"
//      Value: "{reply: '...', intent: '...', ...}"
//      TTL:   30 minutes
//    Benefit: saves API quota, responses are instant for repeated questions
//
// 4. EMBEDDING VECTOR CACHING
//    Converting text to embeddings costs API calls.
//    Same query text always produces the same embedding, so we cache it:
//      Key:   "rag:embed:base64(queryText)"
//      Value: "[0.23, -0.87, 0.14, ...]"  (768 numbers as JSON)
//      TTL:   1 hour
//

const Redis  = require("ioredis");
const logger = require("../utils/logger");

let client;

const cleanRedisUrl = (url) => {
  const raw = url || "redis://localhost:6379";
  let cleaned = raw.trim();
  for (let i = 0; i < 5; i += 1) {
    try {
      const decoded = decodeURIComponent(cleaned);
      if (decoded === cleaned) break;
      cleaned = decoded;
    } catch (_) {
      break;
    }
  }
  cleaned = cleaned.trim().replace(/%22/g, "").replace(/["']/g, "");
  if (cleaned.startsWith("REDIS_URL=")) {
    cleaned = cleaned.slice("REDIS_URL=".length);
  }
  return cleaned;
};

const connectRedis = () => {
  const redisUrl = cleanRedisUrl(process.env.REDIS_URL);
  client = new Redis(redisUrl, {
    // Retry connecting up to 3 times with exponential backoff
    maxRetriesPerRequest: 3,
    retryStrategy: (times) => {
      if (times > 3) return null; // stop retrying after 3 attempts
      return Math.min(times * 200, 2000); // wait 200ms, 400ms, 600ms...
    },
    // Don't throw if Redis is unavailable — degrade gracefully
    lazyConnect: true,
    // Keep-alive ping every 30 seconds (prevents idle disconnection)
    keepAlive: 30000,
    ...(redisUrl.startsWith("rediss://") ? { tls: {} } : {}),
  });

  client.on("connect",      ()    => logger.info("Redis connected ✓"));
  client.on("ready",        ()    => logger.info("Redis ready to accept commands"));
  client.on("error",        (err) => logger.warn(`Redis error (non-fatal): ${err.message}`));
  client.on("reconnecting", ()    => logger.info("Redis reconnecting..."));
  client.on("close",        ()    => logger.warn("Redis connection closed"));

  client.connect().catch((err) => {
    logger.warn(`Redis unavailable, continuing without cache/rate-store: ${err.message}`);
  });

  return client;
};

// Getter — called in middleware and services
const getRedis = () => {
  if (!client) {
    throw new Error("Redis not initialized. Call connectRedis() first.");
  }
  return client;
};

// Safe getter: Redis is optional, so only expose it when it can accept commands.
const getRedisOrNull = () => (client?.status === "ready" ? client : null);

module.exports = { connectRedis, getRedis, getRedisOrNull };
