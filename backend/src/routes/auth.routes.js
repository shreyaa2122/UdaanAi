// src/routes/auth.routes.js

const express = require("express");
const router  = express.Router();

const authCtrl = require("../controllers/auth.controller");
const { protect }                              = require("../middleware/auth.middleware");
const { authLimiter }                          = require("../middleware/rateLimiter.middleware");
const { registerValidator, loginValidator, profileValidator } = require("../validators/auth.validator");

// ── Public ────────────────────────────────────────────────────────────
router.post("/register", authLimiter, registerValidator, authCtrl.register);
router.post("/login",    authLimiter, loginValidator,    authCtrl.login);
router.post("/refresh",  authLimiter,                   authCtrl.refresh);

// ── Protected ─────────────────────────────────────────────────────────
router.post  ("/logout",  protect, authCtrl.logout);
router.get   ("/me",      protect, authCtrl.getMe);
router.patch ("/profile", protect, profileValidator, authCtrl.updateProfile);

module.exports = router;
