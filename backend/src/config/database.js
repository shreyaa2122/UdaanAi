// src/config/database.js
// ─────────────────────────────────────────────────────────────────────
// MongoDB connection with production-tuned settings
//
// CONNECTION POOLING EXPLAINED:
//   Without pooling, every database operation opens a new TCP connection:
//     Request 1 → open connection → query → close connection
//     Request 2 → open connection → query → close connection
//   This is extremely slow. With pooling:
//     Startup: open 5 connections, keep them alive
//     Request 1 → borrow connection from pool → query → return to pool
//     Request 2 → borrow different connection → query → return
//   Result: 10x faster queries, handles concurrent users efficiently
//
// SETTINGS:
//   minPoolSize: 5  → always keep 5 connections warm (ready instantly)
//   maxPoolSize: 10 → never open more than 10 (protects Atlas free tier)
//   serverSelectionTimeoutMS: 5000 → fail fast if DB is unreachable
//   socketTimeoutMS: 45000 → drop connections idle for 45 seconds
// ─────────────────────────────────────────────────────────────────────
const mongoose = require("mongoose");
const logger   = require("../utils/logger");

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      minPoolSize:               5,
      maxPoolSize:               10,
      serverSelectionTimeoutMS:  5000,
      socketTimeoutMS:           45000,
    });

    logger.info(`MongoDB connected → ${conn.connection.host}`);

    // In dev, log every query + how long it took (helps find slow queries)
    if (process.env.NODE_ENV === "development") {
      mongoose.set("debug", (collection, method, query) => {
        logger.debug(`DB: ${collection}.${method}(${JSON.stringify(query)})`);
      });
    }

    // Handle unexpected disconnections
    mongoose.connection.on("disconnected", () => {
      logger.warn("MongoDB disconnected — retrying...");
    });

    mongoose.connection.on("error", (err) => {
      logger.error("MongoDB connection error:", err);
    });

  } catch (err) {
    logger.error(`MongoDB failed to connect: ${err.message}`);
    process.exit(1); // crash fast — better than running without a DB
  }
};

module.exports = connectDB;
