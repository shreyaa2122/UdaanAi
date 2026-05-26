// src/controllers/chat.controller.js
const { v4: uuidv4 }       = require("uuid");
const Conversation          = require("../models/Conversation");
const User                  = require("../models/User");
const { generateResponse }  = require("../services/ai.service");
const logger                = require("../utils/logger");
const mongoose              = require("mongoose");

// POST /api/chat/session
exports.createSession = async (req, res, next) => {
  try {
    const sessionId = uuidv4();
    const user      = req.user;

    const conversation = await Conversation.create({
      sessionId,
      userId: user._id,
      studentContext: {
        stream:            user.profile?.stream            || "",
        boardPercentage:   user.profile?.boardPercentage   || null,
        targetExam:        user.profile?.targetExam        || "",
        category:          user.profile?.category          || "",
        state:             user.profile?.state             || "",
        preferredLocation: user.profile?.preferredLocation || "",
        preferredCollege:  user.profile?.preferredCollege  || "",
        preferredBranch:   user.profile?.preferredBranch   || "",
        budget:            user.profile?.budget            || "",
        hasUploadedDocs:   (user.documents || []).some((d) => d.processed),
      },
    });

    await User.findByIdAndUpdate(user._id, { $inc: { "stats.totalSessions": 1 } });

    res.status(201).json({ success: true, sessionId, conversationId: conversation._id });
  } catch (err) { next(err); }
};

// POST /api/chat/message
exports.sendMessage = async (req, res, next) => {
  try {
    const { message, sessionId } = req.body;
    const userId = req.user._id;

    const conversation = await Conversation.findOne({ sessionId, userId });
    if (!conversation) {
      return res.status(404).json({ success: false, error: "Session not found. Please start a new conversation." });
    }

    // Last 18 messages as history for AI context
    const history = conversation.messages.slice(-18).map((m) => ({
      role:    m.role,
      content: m.content,
    }));

    const aiResult = await generateResponse({
      message,
      history,
      userId,
      studentContext: conversation.studentContext,
    });

    // Auto-title from first message
    if (conversation.messages.length === 0) {
      conversation.title = message.length > 70 ? message.slice(0, 70) + "…" : message;
    }

    conversation.messages.push({ role: "user",      content: message,           intent: aiResult.intent, stressDetected: aiResult.stressDetected });
    conversation.messages.push({ role: "assistant", content: aiResult.content,  ragRefs: aiResult.ragRefs, tokensUsed: aiResult.tokensUsed });

    await conversation.save();

    await User.findByIdAndUpdate(userId, {
      $inc: { "stats.totalMessages": 2 },
      $set: { "stats.lastActiveAt": new Date() },
    });

    res.json({
      success:        true,
      reply:          aiResult.content,
      intent:         aiResult.intent,
      stressDetected: aiResult.stressDetected,
      ragUsed:        aiResult.ragRefs.length > 0,
      fromCache:      aiResult.fromCache,
    });
  } catch (err) {
    if (err.message?.includes("QUOTA") || err.message?.includes("quota")) {
      return res.status(429).json({ success: false, error: "AI quota exceeded for today. Try again tomorrow." });
    }
    if (err.message?.includes("not found for API version") || err.message?.includes("is not supported for generateContent")) {
      return res.status(502).json({
        success: false,
        error: "The configured Gemini chat model is unavailable. Set GEMINI_CHAT_MODEL to a supported model such as gemini-2.5-flash and restart the backend.",
      });
    }
    next(err);
  }
};

// GET /api/chat/sessions
exports.getSessions = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const [conversations, total] = await Promise.all([
      Conversation.find(
        { userId: req.user._id, status: "active" },
        { title: 1, sessionId: 1, messageCount: 1, lastMessageAt: 1, studentContext: 1, createdAt: 1 }
      )
        .sort({ lastMessageAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      Conversation.countDocuments({ userId: req.user._id, status: "active" }),
    ]);

    res.json({ success: true, conversations, total, page: Number(page) });
  } catch (err) { next(err); }
};

// GET /api/chat/session/:sessionId
exports.getSession = async (req, res, next) => {
  try {
    const conversation = await Conversation.findOne({
      sessionId: req.params.sessionId,
      userId:    req.user._id,
    });
    if (!conversation) return res.status(404).json({ success: false, error: "Session not found" });
    res.json({ success: true, conversation });
  } catch (err) { next(err); }
};

// DELETE /api/chat/session/:sessionId
exports.deleteSession = async (req, res, next) => {
  try {
    await Conversation.findOneAndUpdate(
      { sessionId: req.params.sessionId, userId: req.user._id },
      { status: "archived" }
    );
    res.json({ success: true, message: "Conversation archived" });
  } catch (err) { next(err); }
};

// GET /api/chat/analytics
exports.getAnalytics = async (req, res, next) => {
  try {
    const userId       = req.user._id;
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [intentBreakdown, activityByDay, stressStats, recentStress, total] = await Promise.all([
      // Pipeline 1: group user messages by intent
      Conversation.aggregate([
        { $match: { userId, status: "active" } },
        { $unwind: "$messages" },
        { $match: { "messages.role": "user", "messages.intent": { $ne: null } } },
        { $group: { _id: "$messages.intent", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]),

      // Pipeline 2: sessions + messages per day last 7 days
      Conversation.aggregate([
        { $match: { userId, createdAt: { $gte: sevenDaysAgo } } },
        {
          $group: {
            _id:      { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            sessions: { $sum: 1 },
            messages: { $sum: "$messageCount" },
          },
        },
        { $sort: { _id: 1 } },
      ]),

      // Pipeline 3: stress detection ratio
      Conversation.aggregate([
        { $match: { userId } },
        { $unwind: "$messages" },
        { $match: { "messages.role": "user" } },
        {
          $group: {
            _id:     null,
            total:   { $sum: 1 },
            stressed: { $sum: { $cond: ["$messages.stressDetected", 1, 0] } },
          },
        },
      ]),

      // Pipeline 4: latest stress/support moments for dashboard context
      Conversation.aggregate([
        { $match: { userId, status: "active" } },
        { $unwind: "$messages" },
        { $match: { "messages.role": "user", "messages.stressDetected": true } },
        { $sort: { "messages.sentAt": -1 } },
        { $limit: 5 },
        { $project: { content: "$messages.content", sentAt: "$messages.sentAt", intent: "$messages.intent" } },
      ]),

      Conversation.countDocuments({ userId, status: "active" }),
    ]);

    const stressRatio = stressStats[0]
      ? Math.round((stressStats[0].stressed / stressStats[0].total) * 100)
      : 0;

    res.json({
      success: true,
      analytics: {
        totalConversations: total,
        totalMessages:      req.user.stats?.totalMessages || 0,
        intentBreakdown,
        activityByDay,
        stressRatio,
        stressMessages: stressStats[0]?.stressed || 0,
        recentStress,
      },
    });
  } catch (err) { next(err); }
};
