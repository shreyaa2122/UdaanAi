// src/models/Conversation.js
// ─────────────────────────────────────────────────────────────────────
// Stores the full chat history per session.
// Designed specifically around the AGGREGATION PIPELINES we run.
// Every index here was chosen to serve a specific query pattern.
// ─────────────────────────────────────────────────────────────────────
const mongoose = require("mongoose");

// ── Embedded: RAG chunk reference ─────────────────────────────────────
// Stored inside each assistant message to trace which KB chunks were used.
// Useful for debugging: "why did the AI give this answer?"
const ragRefSchema = new mongoose.Schema(
  {
    chunkId:        String,
    source:         String,
    relevanceScore: { type: Number, min: 0, max: 1 },
  },
  { _id: false }
);

// ── Embedded: Single message ───────────────────────────────────────────
const messageSchema = new mongoose.Schema(
  {
    role: {
      type:     String,
      enum:     ["user", "assistant"],
      required: true,
    },
    content: {
      type:      String,
      required:  true,
      maxlength: [5000, "Message too long"],
    },
    // User message metadata (set when role === "user")
    intent:         { type: String, default: "general" },
    stressDetected: { type: Boolean, default: false },
    // Assistant message metadata (set when role === "assistant")
    ragRefs:        { type: [ragRefSchema], default: [] },
    tokensUsed:     { type: Number, default: 0 },
  },
  {
    _id:        true,
    timestamps: { createdAt: "sentAt", updatedAt: false },
  }
);

// ── Main Conversation Schema ───────────────────────────────────────────
const conversationSchema = new mongoose.Schema(
  {
    sessionId: {
      type:     String,
      required: true,
      unique:   true,   // each session has exactly one conversation document
    },

    userId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      "User",
      required: true,
    },

    // Auto-generated from first user message (truncated to 60 chars)
    title: {
      type:      String,
      default:   "New Conversation",
      maxlength: 80,
    },

    messages: {
      type:    [messageSchema],
      default: [],
    },

    // Snapshot of student's profile at session start.
    // Stored here so analytics don't need to JOIN with User collection.
    studentContext: {
      stream:             { type: String, default: "" },
      boardPercentage:    { type: Number, default: null },
      targetExam:         { type: String, default: "" },
      category:           { type: String, default: "" },
      state:              { type: String, default: "" },
      preferredLocation:  { type: String, default: "" },
      preferredCollege:   { type: String, default: "" },
      preferredBranch:    { type: String, default: "" },
      budget:             { type: String, default: "" },
      hasUploadedDocs:    { type: Boolean, default: false },
    },

    // ── Denormalized counters ─────────────────────────────────────────
    // These are maintained by pre-save hook.
    // Why store them separately instead of computing from messages.length?
    //
    //   Aggregation pipelines often need messageCount and lastMessageAt
    //   WITHOUT loading the entire messages array.
    //   If a conversation has 200 messages, loading the array just to
    //   count them would transfer ~400KB of data per document.
    //   With denormalized fields, the aggregation touches only metadata.
    messageCount:   { type: Number, default: 0 },
    lastMessageAt:  { type: Date,   default: Date.now },
    totalTokens:    { type: Number, default: 0 },

    status: {
      type:    String,
      enum:    ["active", "archived"],
      default: "active",
    },
  },
  { timestamps: true }
);

// ═══════════════════════════════════════════════════════════════════
// COMPOUND INDEXES — EACH ONE SERVES A SPECIFIC QUERY
//
// RULE: every slow query needs an index.
// BUILD indexes around your MOST FREQUENT and MOST EXPENSIVE queries.
//
// ── INDEX 1: sessionId (unique single field) ──────────────────────
// Auto-created by unique:true above.
// Query it serves: Conversation.findOne({ sessionId })
// Used by: every chat message (load the conversation to append message)
// This is the hottest query path in the entire app.
//
// ── INDEX 2: Compound — userId + status + lastMessageAt ───────────
// Query it serves:
//   Conversation.find({ userId, status: "active" })
//               .sort({ lastMessageAt: -1 })
//
// This powers the SIDEBAR (list of user's recent conversations).
//
// Why compound and not three separate indexes?
//
//   SEPARATE indexes:
//     Index A: { userId: 1 }
//     Index B: { status: 1 }
//     Index C: { lastMessageAt: -1 }
//   MongoDB would pick ONE index and filter the rest in memory.
//   With 10,000 conversations per user, filtering in memory is slow.
//
//   COMPOUND index: { userId: 1, status: 1, lastMessageAt: -1 }
//   MongoDB uses ONE index scan to find active convos for this user,
//   already sorted by date. Zero in-memory work.
//
//   INDEX PREFIX RULE:
//   A compound index { A, B, C } also serves queries on:
//     { A } alone
//     { A, B } together
//   It does NOT serve { B } alone or { C } alone.
//   So our index also speeds up: Conversation.find({ userId }) alone.
//
// ── INDEX 3: createdAt descending ─────────────────────────────────
// Query it serves: analytics by date range
//   Conversation.find({ createdAt: { $gte: sevenDaysAgo } })
//
// ── INDEX 4: Compound — userId + messages.sentAt ──────────────────
// Query it serves: aggregation pipeline that unwinds messages
//   and groups by date. The $unwind + $group pipeline benefits from
//   having userId indexed alongside the nested field.
// ═══════════════════════════════════════════════════════════════════

conversationSchema.index({ userId: 1, status: 1, lastMessageAt: -1 }); // compound ★
conversationSchema.index({ createdAt: -1 });
conversationSchema.index({ userId: 1, "messages.sentAt": -1 });         // compound ★

// ── Pre-save: update denormalized fields ──────────────────────────────
conversationSchema.pre("save", function (next) {
  this.messageCount = this.messages.length;

  if (this.messages.length > 0) {
    const last = this.messages[this.messages.length - 1];
    this.lastMessageAt = last.sentAt || new Date();
  }

  this.totalTokens = this.messages.reduce(
    (sum, m) => sum + (m.tokensUsed || 0),
    0
  );

  next();
});

module.exports = mongoose.model("Conversation", conversationSchema);
