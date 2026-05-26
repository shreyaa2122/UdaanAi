// src/routes/chat.routes.js
const express = require("express");
const router  = express.Router();

const chatCtrl  = require("../controllers/chat.controller");
const { protect }  = require("../middleware/auth.middleware");
const { chatLimiter } = require("../middleware/rateLimiter.middleware");
const { sendMessageValidator, sessionIdParamValidator } = require("../validators/chat.validator");

// All chat routes require authentication
router.use(protect);

router.post  ("/session",                              chatCtrl.createSession);
router.post  ("/message",   chatLimiter, sendMessageValidator, chatCtrl.sendMessage);
router.get   ("/sessions",                             chatCtrl.getSessions);
router.get   ("/analytics",                            chatCtrl.getAnalytics);
router.get   ("/session/:sessionId", sessionIdParamValidator, chatCtrl.getSession);
router.delete("/session/:sessionId", sessionIdParamValidator, chatCtrl.deleteSession);

module.exports = router;
