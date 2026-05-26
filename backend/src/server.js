// src/server.js
require("dotenv").config();
const express      = require("express");
const cors         = require("cors");
const helmet       = require("helmet");
const morgan       = require("morgan");
const cookieParser = require("cookie-parser");
const mongoSanitize = require("express-mongo-sanitize");
const hpp          = require("hpp");

const connectDB    = require("./config/database");
const { connectRedis } = require("./config/redis");
const routes       = require("./routes/index");
const { errorHandler, notFound } = require("./middleware/errorHandler.middleware");
const { generalLimiter }         = require("./middleware/rateLimiter.middleware");
const logger       = require("./utils/logger");

const app = express();

// ── Security headers ──────────────────────────────────────────────────
app.use(helmet());

// ── CORS ──────────────────────────────────────────────────────────────
app.use(cors({
  origin:      process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true,
  methods:     ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
}));

// ── Body parsing ──────────────────────────────────────────────────────
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ── Security: sanitize MongoDB operators in user input ────────────────
// Prevents NoSQL injection: { "$gt": "" } in request body
app.use(mongoSanitize());

// ── Security: prevent HTTP parameter pollution ────────────────────────
app.use(hpp());

// ── Request logging ───────────────────────────────────────────────────
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev", {
  stream: { write: (msg) => logger.info(msg.trim()) },
}));

// ── Global rate limit ─────────────────────────────────────────────────
app.use("/api", generalLimiter);

// ── All routes ────────────────────────────────────────────────────────
app.use("/api", routes);

// ── Health check ──────────────────────────────────────────────────────
app.get("/health", (req, res) => {
  res.json({
    status:      "healthy",
    uptime:      Math.round(process.uptime()) + "s",
    environment: process.env.NODE_ENV,
    timestamp:   new Date().toISOString(),
  });
});

// ── Error handling ────────────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

// ── Start ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;

(async () => {
  await connectDB();
  connectRedis();
  app.listen(PORT, () => {
    logger.info(`
╔══════════════════════════════════════════╗
║   UdaanAI v3 — Backend Running      ║
║   http://localhost:${PORT}                  ║
║   Health: http://localhost:${PORT}/health   ║
╚══════════════════════════════════════════╝`);
  });

  process.on("SIGTERM", () => {
    logger.info("SIGTERM — shutting down");
    process.exit(0);
  });
})();

module.exports = app;
