// src/middleware/errorHandler.middleware.js

const logger = require("../utils/logger");

const errorHandler = (err, req, res, next) => {
  logger.error({
    message: err.message,
    stack:   err.stack,
    path:    req.path,
    method:  req.method,
    userId:  req.user?.id || "unauthenticated",
  });

  // ── Mongoose validation error ─────────────────────────────────────
  if (err.name === "ValidationError") {
    const details = Object.values(err.errors).map((e) => ({
      field:   e.path,
      message: e.message,
    }));
    return res.status(400).json({ success: false, error: "Validation failed", details });
  }

  // ── Mongoose duplicate key (e.g., duplicate email) ────────────────
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    return res.status(409).json({
      success: false,
      error:   `${field} already exists`,
    });
  }

  // ── Mongoose invalid ObjectId ─────────────────────────────────────
  if (err.name === "CastError") {
    return res.status(400).json({ success: false, error: "Invalid ID format" });
  }

  // ── Multer file too large ─────────────────────────────────────────
  if (err.code === "LIMIT_FILE_SIZE") {
    const mb = Math.round((parseInt(process.env.MAX_FILE_SIZE_BYTES) || 10 * 1024 * 1024) / (1024 * 1024));
    return res.status(400).json({ success: false, error: `File too large. Maximum size is ${mb}MB.` });
  }

  // ── JWT errors ────────────────────────────────────────────────────
  if (err.name === "JsonWebTokenError") {
    return res.status(401).json({ success: false, error: "Invalid token" });
  }
  if (err.name === "TokenExpiredError") {
    return res.status(401).json({ success: false, error: "Token expired", code: "TOKEN_EXPIRED" });
  }

  // ── Default ───────────────────────────────────────────────────────
  const statusCode = err.statusCode || 500;
  const message    = process.env.NODE_ENV === "production" && statusCode === 500
    ? "Internal server error"
    : err.message;

  res.status(statusCode).json({ success: false, error: message });
};

// 404 handler for unknown routes
const notFound = (req, res) => {
  res.status(404).json({
    success: false,
    error:   `Route ${req.method} ${req.path} not found`,
  });
};

module.exports = { errorHandler, notFound };
