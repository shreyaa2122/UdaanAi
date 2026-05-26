// src/utils/logger.js
// ─────────────────────────────────────────────────────────────────────
// Winston structured logger
//
// WHY: console.log is fine in development but terrible in production.
//   - No log levels (you can't filter errors from debug noise)
//   - No timestamps
//   - No file output (logs disappear when server restarts)
//   - No log rotation (log files would grow forever)
//
// Winston gives us all of that. We use it everywhere instead of console.log
//
// LEVELS (lowest to highest severity):
//   debug → info → warn → error
//   In production we only log 'warn' and above to reduce noise.
// ─────────────────────────────────────────────────────────────────────
const { createLogger, format, transports } = require("winston");
const DailyRotateFile = require("winston-daily-rotate-file");
const path = require("path");
const util = require("util");

const { combine, timestamp, printf, colorize, errors, json } = format;

// ── Human-readable format for development ────────────────────────────
const devFormat = printf((info) => {
  const { level, message, timestamp, stack, ...meta } = info;
  const renderedMessage = typeof message === "object"
    ? util.inspect(message, { depth: 5, colors: false })
    : message;
  const metaText = Object.keys(meta).length
    ? ` ${util.inspect(meta, { depth: 5, colors: false })}`
    : "";

  return `${timestamp} [${level}] ${stack || renderedMessage}${metaText}`;
});

// ── Transport: rotate log file daily, keep 14 days, compress old ─────
const fileTransport = new DailyRotateFile({
  dirname:     path.join(__dirname, "../../logs"),
  filename:    "pathfinderAI-%DATE%.log",
  datePattern: "YYYY-MM-DD",
  zippedArchive: true,   // compress old log files
  maxSize:     "20m",    // rotate when file hits 20MB
  maxFiles:    "14d",    // delete logs older than 14 days
  level:       "info",
});

const errorFileTransport = new DailyRotateFile({
  dirname:     path.join(__dirname, "../../logs"),
  filename:    "errors-%DATE%.log",
  datePattern: "YYYY-MM-DD",
  zippedArchive: true,
  maxFiles:    "30d",
  level:       "error",  // only errors go here
});

const logger = createLogger({
  level: process.env.NODE_ENV === "production" ? "warn" : "debug",
  format: combine(
    errors({ stack: true }),          // capture stack traces on Error objects
    timestamp({ format: "YYYY-MM-DD HH:mm:ss" })
  ),
  transports: [
    // Console: pretty in dev, JSON in prod
    new transports.Console({
      format: process.env.NODE_ENV === "production"
        ? combine(json())
        : combine(colorize(), devFormat),
    }),
    fileTransport,
    errorFileTransport,
  ],
  // Don't crash the process on uncaught logger errors
  exitOnError: false,
});

module.exports = logger;
