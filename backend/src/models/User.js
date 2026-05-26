// src/models/User.js
// ─────────────────────────────────────────────────────────────────────
// User schema — clean, minimal, production-ready
//
// DESIGN PRINCIPLES FOR A CLEAN SCHEMA:
//   1. Only store what you QUERY or DISPLAY — nothing else
//   2. Nested objects only when fields are always used together
//   3. Arrays only for genuinely variable-length data
//   4. select: false on sensitive fields — never leak passwords/tokens
//   5. Validators at schema level — don't trust the controller
// ─────────────────────────────────────────────────────────────────────
const mongoose = require("mongoose");
const bcrypt   = require("bcryptjs");

// ── Sub-schema: Student Profile ───────────────────────────────────────
// Grouped as nested object because:
//   - These fields are always read/written together
//   - Makes the AI personalization query clean:
//     user.profile instead of user.stream, user.percentage, user.exam...
const profileSchema = new mongoose.Schema(
  {
    stream: {
      type: String,
      enum: ["PCM", "PCB", "PCMB", "Commerce", "Arts", "Other", ""],
      default: "",
    },
    boardPercentage: {
      type:    Number,
      min:     [0,   "Percentage cannot be negative"],
      max:     [100, "Percentage cannot exceed 100"],
      default: null,
    },
    targetExam: {
      type: String,
      enum: ["JEE", "NEET", "CLAT", "CUET", "VITEEE", "BITSAT", "COMEDK", "GATE", "IPMAT", "NIFT", "NID", "NATA", "NDA", "CA", "Other", ""],
      default: "",
    },
    category:          { type: String, default: "", maxlength: 30 },
    state:             { type: String, default: "", maxlength: 50 },
    preferredLocation: { type: String, default: "", maxlength: 80 },
    preferredCollege:  { type: String, default: "", maxlength: 120 },
    preferredBranch:   { type: String, default: "", maxlength: 80 },
    budget:            { type: String, default: "", maxlength: 80 },
    year12:            { type: Number, default: null }, // year student passed 12th
  },
  { _id: false } // don't create an _id for this sub-document
);

// ── Sub-schema: Uploaded Document Metadata ────────────────────────────
// Stored in an array because one user can have multiple documents.
// extractedText is here for quick preview — full text is in KnowledgeChunk.
const documentSchema = new mongoose.Schema(
  {
    originalName:  { type: String, required: true },
    storageName:   { type: String, required: true }, // internal unique filename
    mimeType:      { type: String, required: true },
    sizeBytes:     { type: Number, required: true },
    processed:     { type: Boolean, default: false }, // true after RAG chunking done
    chunkCount:    { type: Number,  default: 0 },     // how many RAG chunks created
    uploadedAt:    { type: Date,    default: Date.now },
  },
  { _id: true }
);

// ── Sub-schema: Usage Statistics ──────────────────────────────────────
// Derived counters — updated with $inc so we never do a full document read
// just to increment a number.
const statsSchema = new mongoose.Schema(
  {
    totalMessages:  { type: Number, default: 0 },
    totalSessions:  { type: Number, default: 0 },
    lastActiveAt:   { type: Date,   default: Date.now },
  },
  { _id: false }
);

// ── Main User Schema ──────────────────────────────────────────────────
const userSchema = new mongoose.Schema(
  {
    name: {
      type:      String,
      required:  [true, "Name is required"],
      trim:      true,
      maxlength: [60, "Name too long — max 60 characters"],
    },

    email: {
      type:     String,
      required: [true, "Email is required"],
      unique:   true,           // creates unique index automatically
      lowercase: true,
      trim:     true,
      match:    [/^\S+@\S+\.\S+$/, "Invalid email format"],
    },

    // select: false → NEVER included in query results by default.
    // You must explicitly write .select("+password") to get it.
    // This prevents accidental password exposure in API responses.
    password: {
      type:      String,
      required:  [true, "Password is required"],
      minlength: [6, "Password must be at least 6 characters"],
      select:    false,
    },

    // Hashed refresh token. select: false for the same security reason.
    // We hash it so that even if your DB is compromised, tokens are useless.
    refreshToken: {
      type:   String,
      select: false,
    },

    profile:   { type: profileSchema,   default: () => ({}) },
    documents: { type: [documentSchema], default: [] },
    stats:     { type: statsSchema,      default: () => ({}) },

    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true, // auto-adds createdAt and updatedAt
    // When converting to JSON (API response), strip internal fields
    toJSON: {
      transform: (doc, ret) => {
        delete ret.password;
        delete ret.refreshToken;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// ═══════════════════════════════════════════════════════════════════
// INDEXES — THE SINGLE MOST IMPORTANT PERFORMANCE OPTIMIZATION
//
// Without an index, MongoDB does a COLLECTION SCAN:
//   → reads EVERY document one by one to find matches
//   → O(n) time — with 100,000 users, checks 100,000 documents
//
// With an index, MongoDB uses a B-Tree structure:
//   → jumps directly to matching documents
//   → O(log n) time — with 100,000 users, checks ~17 documents
//   → typically 100x–1000x faster
//
// COST OF INDEXES:
//   → Extra disk space (~10-30% of collection size per index)
//   → Slower writes (every insert/update must update the index)
//   → Rule: index fields you QUERY and SORT frequently
//
// ── INDEX 1: email unique index ───────────────────────────────────
// Auto-created by unique: true on the field above.
// Used by: login (findOne({ email }))
// Type: Single field, unique — only one document per email value.
//
// ── INDEX 2: Compound index — active users by last activity ───────
//
// COMPOUND INDEX EXPLAINED:
//   A compound index covers MULTIPLE fields in one index.
//   The ORDER of fields matters — MongoDB reads left to right.
//
//   Index definition: { isActive: 1, "stats.lastActiveAt": -1 }
//
//   This powers the query:
//     User.find({ isActive: true }).sort({ "stats.lastActiveAt": -1 })
//
//   The query says: "give me all active users, newest activity first"
//   MongoDB uses the index to:
//     1. Jump to isActive = true entries (field 1, ascending = 1)
//     2. Return them sorted by lastActiveAt newest first (field 2, desc = -1)
//   → Zero in-memory sorting needed. Ultra fast.
//
//   WITHOUT the compound index:
//     → Full collection scan to find active users
//     → In-memory sort of results by date
//     → Two expensive operations instead of one index lookup
//
// ── INDEX 3: Text search on name ─────────────────────────────────
//   Text index allows: User.find({ $text: { $search: "Arjun" } })
//   Better than: User.find({ name: /arjun/i }) which can't use an index.
//
// ── INDEX 4: Sparse index on refreshToken ────────────────────────
//   Sparse = only index documents WHERE the field EXISTS.
//   Most users won't have a refreshToken (logged out).
//   Sparse index skips those documents entirely → smaller, faster index.
// ═══════════════════════════════════════════════════════════════════

userSchema.index({ isActive: 1, "stats.lastActiveAt": -1 });  // compound
userSchema.index({ name: "text" });                            // text search
userSchema.index({ refreshToken: 1 }, { sparse: true });       // sparse

// ── Pre-save hook: hash password before storing ───────────────────────
userSchema.pre("save", async function (next) {
  // Only rehash if password was changed (avoids double-hashing on other saves)
  if (!this.isModified("password")) return next();

  // Cost factor 12: ~250ms hash time — slow enough to deter brute force
  // but fast enough that login doesn't feel laggy
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// ── Instance method: verify a plain-text password against the hash ────
userSchema.methods.comparePassword = async function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

module.exports = mongoose.model("User", userSchema);
