// src/routes/index.js

const express = require("express");
const router  = express.Router();

router.use("/auth",   require("./auth.routes"));
router.use("/chat",   require("./chat.routes"));
router.use("/upload", require("./upload.routes"));

// API info endpoint
router.get("/", (req, res) => {
  res.json({
    name:    "PathfinderAI API",
    version: "3.0.0",
    status:  "running",
    routes:  ["/api/auth", "/api/chat", "/api/upload"],
  });
});

module.exports = router;
