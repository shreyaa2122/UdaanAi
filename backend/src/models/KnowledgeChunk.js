// src/models/KnowledgeChunk.js
// ─────────────────────────────────────────────────────────────────────
// Stores embedded text chunks for RAG (Retrieval Augmented Generation).
//
// Each document (marksheet, career guide) is split into chunks of ~300
// words, each chunk is embedded into a 768-dim vector, stored here.
// At query time, we compute cosine similarity against stored vectors.
//
// userId = null  → global knowledge base (career data, exam cutoffs)
// userId = <id>  → user-uploaded marksheet (personal RAG context)
// ─────────────────────────────────────────────────────────────────────
const mongoose = require("mongoose");

const knowledgeChunkSchema = new mongoose.Schema(
  {
    // null for global KB, user ObjectId for personal docs
    userId: {
      type:    mongoose.Schema.Types.ObjectId,
      ref:     "User",
      default: null,
      index:   true,
    },

    // Source identifier, e.g. "jee_guide" or "user_marksheet_<userId>"
    source: {
      type:     String,
      required: true,
      maxlength: 100,
    },

    // The raw text of this chunk (~300 words)
    content: {
      type:      String,
      required:  true,
      maxlength: 3000,
    },

    // 768-dimension float array from Gemini text-embedding-004
    // This is what we use for cosine similarity search
    embedding: {
      type:     [Number],
      required: true,
    },

    metadata: {
      topic:       String, // "engineering" | "medical" | "commerce" etc.
      subtopic:    String, // "JEE Main"    | "NEET UG"  etc.
      chunkIndex:  Number, // 0, 1, 2, ... position in original doc
      totalChunks: Number, // total number of chunks in source doc
    },

    // Track which chunks are most useful (for future fine-tuning)
    retrievalCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// ── Indexes ───────────────────────────────────────────────────────────
// Filter by user + source (used when deleting old chunks on re-upload)
knowledgeChunkSchema.index({ userId: 1, source: 1 });

// Filter by topic (scoped search — only retrieve engineering chunks for JEE questions)
knowledgeChunkSchema.index({ "metadata.topic": 1 });

// Combined: find global chunks or user-specific chunks by topic
knowledgeChunkSchema.index({ userId: 1, "metadata.topic": 1 });

// NOTE ON VECTOR SEARCH:
// MongoDB Atlas Search supports native vector search with an HNSW index.
// For production with many users, create an Atlas Search index like:
//
// {
//   "fields": [{
//     "type": "vector",
//     "path": "embedding",
//     "numDimensions": 768,
//     "similarity": "cosine"
//   }]
// }
//
// Then use: $vectorSearch aggregation stage for O(log n) ANN search.
// For this project (free tier), we do brute-force cosine similarity
// in ragService.js which works fine up to ~5,000 chunks.

module.exports = mongoose.model("KnowledgeChunk", knowledgeChunkSchema);
