// src/controllers/auth.controller.js
const User     = require("../models/User");
const bcrypt   = require("bcryptjs");
const { generateTokens, blacklistToken, setRefreshCookie } = require("../middleware/auth.middleware");
const logger   = require("../utils/logger");
const jwt      = require("jsonwebtoken");

// POST /api/auth/register
exports.register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    const exists = await User.findOne({ email });
    if (exists) {
      return res.status(409).json({ success: false, error: "Email already registered. Please log in." });
    }

    const user = await User.create({ name, email, password });
    const { accessToken, refreshToken } = generateTokens(user._id);

    user.refreshToken = await bcrypt.hash(refreshToken, 10);
    await user.save({ validateBeforeSave: false });

    setRefreshCookie(res, refreshToken);
    logger.info(`New user registered: ${email}`);

    res.status(201).json({
      success: true,
      accessToken,
      user: { id: user._id, name: user.name, email: user.email, profile: user.profile, stats: user.stats },
    });
  } catch (err) { next(err); }
};

// POST /api/auth/login
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select("+password +refreshToken");
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ success: false, error: "Invalid email or password" });
    }
    if (!user.isActive) {
      return res.status(403).json({ success: false, error: "Account deactivated. Contact support." });
    }

    const { accessToken, refreshToken } = generateTokens(user._id);
    user.refreshToken        = await bcrypt.hash(refreshToken, 10);
    user.stats.lastActiveAt  = new Date();
    await user.save({ validateBeforeSave: false });

    setRefreshCookie(res, refreshToken);

    res.json({
      success: true,
      accessToken,
      user: { id: user._id, name: user.name, email: user.email, profile: user.profile, stats: user.stats },
    });
  } catch (err) { next(err); }
};

// POST /api/auth/refresh
exports.refresh = async (req, res, next) => {
  try {
    const token = req.cookies?.refreshToken;
    if (!token) return res.status(401).json({ success: false, error: "No refresh token" });

    const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    const user    = await User.findById(decoded.id).select("+refreshToken");
    if (!user) return res.status(401).json({ success: false, error: "User not found" });

    const valid = await bcrypt.compare(token, user.refreshToken || "");
    if (!valid) return res.status(401).json({ success: false, error: "Refresh token invalid or reused" });

    const { accessToken, refreshToken: newRefresh } = generateTokens(user._id);
    user.refreshToken = await bcrypt.hash(newRefresh, 10);
    await user.save({ validateBeforeSave: false });

    setRefreshCookie(res, newRefresh);
    res.json({ success: true, accessToken });
  } catch (err) {
    res.status(401).json({ success: false, error: "Session expired. Please log in again." });
  }
};

// POST /api/auth/logout
exports.logout = async (req, res, next) => {
  try {
    const header = req.headers.authorization;
    if (header?.startsWith("Bearer ")) {
      await blacklistToken(header.split(" ")[1]);
    }
    await User.findByIdAndUpdate(req.user._id, { refreshToken: "" });
    res.clearCookie("refreshToken");
    res.json({ success: true, message: "Logged out successfully" });
  } catch (err) { next(err); }
};

// GET /api/auth/me
exports.getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    res.json({ success: true, user });
  } catch (err) { next(err); }
};

// PATCH /api/auth/profile
exports.updateProfile = async (req, res, next) => {
  try {
    const { name, profile } = req.body;
    const update = {};
    if (name)    update.name    = name;
    if (profile) update.profile = { ...req.user.profile?.toObject?.() || {}, ...profile };

    const user = await User.findByIdAndUpdate(req.user._id, update, { new: true, runValidators: true });
    res.json({ success: true, user });
  } catch (err) { next(err); }
};
