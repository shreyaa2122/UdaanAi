// src/controllers/upload.controller.js
const multer   = require("multer");
const pdfParse = require("pdf-parse");
const User     = require("../models/User");
const KnowledgeChunk = require("../models/KnowledgeChunk");
const { processAndStoreDocument } = require("../services/rag.service");
const logger   = require("../utils/logger");

// Multer: memory storage (no disk — process in RAM, store in MongoDB)
const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: parseInt(process.env.MAX_FILE_SIZE_BYTES) || 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const name = file.originalname || "";
    const allowedMime = ["application/pdf", "application/x-pdf", "text/plain", "application/octet-stream"];
    const allowedExt = /\.(pdf|txt)$/i.test(name);
    (allowedMime.includes(file.mimetype) && allowedExt)
      ? cb(null, true)
      : cb(new Error("Only PDF and TXT files are accepted. Please upload a real .pdf or .txt file."), false);
  },
});

exports.uploadMiddleware = upload.single("document");

// POST /api/upload/document
exports.uploadDocument = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: "No file provided" });

    const { originalname, mimetype, size, buffer } = req.file;
    const userId = req.user._id;

    // Extract text
    let text = "";
    if (mimetype === "application/pdf") {
      try {
        const parsed = await pdfParse(buffer);
        text = parsed.text || "";
      } catch (err) {
        return res.status(400).json({
          success: false,
          error: "This PDF could not be read. Try downloading it again, exporting it as a text-searchable PDF, or uploading a TXT version.",
        });
      }
    } else {
      text = buffer.toString("utf-8");
    }

    if (text.trim().length < 80) {
      return res.status(400).json({
        success: false,
        error: "Could not extract readable text. Make sure the PDF is not scanned/image-only.",
      });
    }

    const source = `user_doc_${userId}_${Date.now()}`;

    const docRecord = {
      originalName: originalname,
      storageName:  source,
      mimeType:     mimetype,
      sizeBytes:    size,
      processed:    false,
      chunkCount:   0,
    };

    await User.findByIdAndUpdate(userId, { $push: { documents: docRecord } });

    // Process async — don't block response
    processAndStoreDocument(text, source, userId)
      .then(async (chunkCount) => {
        await User.findOneAndUpdate(
          { _id: userId, "documents.storageName": source },
          { $set: { "documents.$.processed": true, "documents.$.chunkCount": chunkCount } }
        );
        logger.info(`Doc processed for ${userId}: ${chunkCount} chunks`);
      })
      .catch((err) => logger.error("Doc processing error:", err.message));

    res.status(201).json({
      success: true,
      message: "Document uploaded. AI is processing it; this usually takes about 30 seconds. Then ask: 'Based on my marksheet and rank, which colleges fit me?'",
      fileName: originalname,
      preview:  text.slice(0, 200) + "...",
    });
  } catch (err) { next(err); }
};

// GET /api/upload/documents
exports.getDocuments = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select("documents");
    res.json({ success: true, documents: user.documents });
  } catch (err) { next(err); }
};

// DELETE /api/upload/documents
exports.deleteAllDocuments = async (req, res, next) => {
  try {
    await KnowledgeChunk.deleteMany({ userId: req.user._id });
    await User.findByIdAndUpdate(req.user._id, { $set: { documents: [] } });
    res.json({ success: true, message: "All documents removed from AI memory" });
  } catch (err) { next(err); }
};
