// src/services/rag.service.js
// ─────────────────────────────────────────────────────────────────────
// RAG = Retrieval Augmented Generation
//
// ═══════════════════════════════════════════════════════════════════
// WHAT IS RAG AND WHY DO WE NEED IT?
// ═══════════════════════════════════════════════════════════════════
//
// Problem with plain LLMs:
//   User: "I scored 78% in PCM, can I get NIT Trichy CSE?"
//   Gemini (without RAG): "It depends on various factors..." (vague)
//   Why? Gemini was trained in 2023. It doesn't know 2024 cutoffs.
//   It also doesn't know YOUR specific marks.
//
// Solution — RAG:
//   1. We store actual cutoff data in MongoDB (our knowledge base)
//   2. When user asks, we RETRIEVE the relevant cutoff chunks
//   3. We INJECT them into the AI prompt as context
//   4. Gemini GENERATES an answer grounded in that real data
//
//   Result: "NIT Trichy CSE 2024 cutoff was ~97-99 percentile (JEE Main).
//            With 78% board marks you exceed the 75% eligibility. For JEE
//            percentile ≥97 you have a good chance. Below 90 percentile,
//            consider NIT Calicut (95-97) or state colleges via MHT-CET."
//
// ═══════════════════════════════════════════════════════════════════
// HOW EMBEDDINGS WORK (vector similarity search)
// ═══════════════════════════════════════════════════════════════════
//
// An embedding = converting text into a list of 768 numbers.
// Semantically similar texts produce similar number arrays.
//
// Example (simplified):
//   "JEE Main cutoff NIT Trichy"   → [0.23, -0.87, 0.14, ...]
//   "NIT admission score required" → [0.21, -0.85, 0.16, ...]  ← similar!
//   "How to cook biryani"          → [0.91,  0.12, -0.73, ...] ← different
//
// Cosine Similarity = angle between two vectors
//   Score 1.0  = identical meaning
//   Score 0.8+ = very similar
//   Score 0.5+ = somewhat related
//   Score 0.2  = unrelated
//
// We embed the user's QUERY, compare against all stored chunk embeddings,
// return the top-5 most similar chunks. Those chunks become AI context.
//
// ═══════════════════════════════════════════════════════════════════
// COMPLETE RAG PIPELINE (step by step)
// ═══════════════════════════════════════════════════════════════════
//
// OFFLINE (one-time setup):
//   npm run seed
//   → Each career text chunk is embedded via Gemini text-embedding-004
//   → 768-dim vector stored in MongoDB KnowledgeChunk collection
//
// ONLINE (every chat message):
//   User message → getEmbedding() → query vector
//   → Fetch 500 candidate chunks from MongoDB (global + user's)
//   → cosineSimilarity(queryVector, chunkVector) for each
//   → Sort by score, take top 5 (score > 0.5)
//   → Format as context string
//   → Inject into Gemini system prompt
//   → Gemini generates grounded answer
//   → Return answer + ragRefs (for UI indicators)
// ─────────────────────────────────────────────────────────────────────
const { GoogleGenerativeAI } = require("@google/generative-ai");
const KnowledgeChunk         = require("../models/KnowledgeChunk");
const { getRedisOrNull }     = require("../config/redis");
const logger                 = require("../utils/logger");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const tokenize = (text) =>
  String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9+\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2);

const hashToken = (token) => {
  let hash = 2166136261;
  for (let i = 0; i < token.length; i++) {
    hash ^= token.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash);
};

const localEmbedding = (text) => {
  const vector = Array(768).fill(0);
  for (const token of tokenize(text)) {
    vector[hashToken(token) % vector.length] += 1;
  }
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1;
  return vector.map((value) => value / norm);
};

const lexicalScore = (query, content) => {
  const queryTokens = new Set(tokenize(query));
  if (queryTokens.size === 0) return 0;
  const contentTokens = new Set(tokenize(content));
  let hits = 0;
  for (const token of queryTokens) {
    if (contentTokens.has(token)) hits += 1;
  }
  return hits / queryTokens.size;
};

// ── Step 1: Convert text to embedding vector ──────────────────────────
const getEmbedding = async (text) => {
  try {
    const model  = genAI.getGenerativeModel({ model: "text-embedding-004" });
    const result = await model.embedContent(text.slice(0, 2000)); // cap at 2000 chars
    return result.embedding.values; // array of 768 floats
  } catch (err) {
    logger.warn(`Gemini embedding failed; using local retrieval fallback: ${err.message || "unknown error"}`);
    return localEmbedding(text);
  }
};

// ── Step 2: Cosine similarity between two vectors ─────────────────────
// Returns value from -1 (opposite) to 1 (identical)
// Formula: (A · B) / (|A| × |B|)
const cosineSimilarity = (a, b) => {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length === 0 || b.length === 0 || a.length !== b.length) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot   += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
};

// ── Step 3: Retrieve top-k most relevant chunks ───────────────────────
const retrieveRelevantChunks = async (query, userId, topK = 5) => {
  const redis = getRedisOrNull();

  // Cache embedding: same query → same vector → don't hit API twice
  const cacheKey = `rag:embed:${Buffer.from(query.toLowerCase().trim()).toString("base64").slice(0, 60)}`;
  let queryVector;

  if (redis) {
    const cached = await redis.get(cacheKey);
    if (cached) {
      queryVector = JSON.parse(cached);
      logger.debug("RAG: embedding cache hit");
    }
  }

  if (!queryVector) {
    queryVector = await getEmbedding(query);
    if (redis) {
      await redis.setex(cacheKey, 3600, JSON.stringify(queryVector)); // cache 1 hour
    }
  }

  // Fetch candidate chunks from MongoDB
  // MongoDB Aggregation: filter user's chunks + global KB
  // We limit to 500 to bound the similarity computation time
  const chunks = await KnowledgeChunk.aggregate([
    {
      $match: {
        $or: [
          { userId: null },                                         // global KB
          { userId: new (require("mongoose").Types.ObjectId)(userId) }, // user's docs
        ],
      },
    },
    {
      $project: {
        content:   1,
        embedding: 1,
        source:    1,
        metadata:  1,
      },
    },
    { $limit: 500 },
  ]);

  if (chunks.length === 0) return [];

  // Compute cosine similarity for each chunk
  const scored = chunks.map((chunk) => ({
    _id:     chunk._id,
    content: chunk.content,
    source:  chunk.source,
    score:   Math.max(
      cosineSimilarity(queryVector, chunk.embedding || []),
      lexicalScore(query, chunk.content)
    ),
  }));

  // Sort descending, filter above threshold, take top-k
  const topChunks = scored
    .filter((c) => c.score > 0.18)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  // Fire-and-forget: increment retrieval counters for analytics
  if (topChunks.length > 0) {
    KnowledgeChunk.updateMany(
      { _id: { $in: topChunks.map((c) => c._id) } },
      { $inc: { retrievalCount: 1 } }
    ).exec().catch(() => {});
  }

  return topChunks;
};

// ── Add a single chunk to the knowledge base ──────────────────────────
const addChunk = async ({ content, source, userId = null, metadata = {} }) => {
  const embedding = await getEmbedding(content);
  return KnowledgeChunk.create({ userId, source, content, embedding, metadata });
};

// ── Process an uploaded document (PDF text) into chunks ───────────────
// Splits into ~300-word chunks with 50-word overlap.
// Overlap ensures context isn't lost at chunk boundaries.
//
// Example with overlap:
//   Chunk 1: words 0-299
//   Chunk 2: words 250-549  ← starts 50 words before chunk 1 ends
//   Chunk 3: words 500-799
// This means a sentence that straddles two chunks appears in both → better retrieval.
const processAndStoreDocument = async (text, source, userId) => {
  const words     = text.split(/\s+/).filter(Boolean);
  const chunkSize = 300;
  const overlap   = 50;
  const rawChunks = [];

  for (let i = 0; i < words.length; i += chunkSize - overlap) {
    const chunk = words.slice(i, i + chunkSize).join(" ");
    if (chunk.trim().length > 100) rawChunks.push(chunk);
  }

  logger.info(`Processing ${source}: ${rawChunks.length} chunks`);

  // Delete existing chunks for this source (handles re-uploads)
  await KnowledgeChunk.deleteMany({ userId, source });

  // Embed and store in batches of 3 (respect Gemini rate limit)
  const batchSize = 3;
  for (let i = 0; i < rawChunks.length; i += batchSize) {
    const batch = rawChunks.slice(i, i + batchSize);
    await Promise.all(
      batch.map((content, j) =>
        addChunk({
          content,
          source,
          userId,
          metadata: { chunkIndex: i + j, totalChunks: rawChunks.length },
        })
      )
    );
    if (i + batchSize < rawChunks.length) {
      await new Promise((r) => setTimeout(r, 400)); // pause between batches
    }
  }

  return rawChunks.length;
};

module.exports = { retrieveRelevantChunks, addChunk, processAndStoreDocument, getEmbedding };
