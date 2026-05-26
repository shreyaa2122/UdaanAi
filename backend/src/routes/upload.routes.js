// src/routes/upload.routes.js
const express = require("express");
const router  = express.Router();

const uploadCtrl = require("../controllers/upload.controller");
const { protect }       = require("../middleware/auth.middleware");
const { uploadLimiter } = require("../middleware/rateLimiter.middleware");

router.use(protect);

router.post  ("/document",  uploadLimiter, uploadCtrl.uploadMiddleware, uploadCtrl.uploadDocument);
router.get   ("/documents", uploadCtrl.getDocuments);
router.delete("/documents", uploadCtrl.deleteAllDocuments);

module.exports = router;
