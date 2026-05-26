// src/validators/chat.validator.js
const { body, param, validationResult } = require("express-validator");

const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error:   "Validation failed",
      details: errors.array().map((e) => ({ field: e.path, message: e.msg })),
    });
  }
  next();
};

const sendMessageValidator = [
  body("message")
    .trim()
    .notEmpty().withMessage("Message cannot be empty")
    .isLength({ max: 1000 }).withMessage("Message cannot exceed 1000 characters"),

  body("sessionId")
    .trim()
    .notEmpty().withMessage("Session ID is required")
    .isUUID().withMessage("Invalid session ID format"),

  handleValidation,
];

const sessionIdParamValidator = [
  param("sessionId")
    .trim()
    .notEmpty().withMessage("Session ID required")
    .isUUID().withMessage("Invalid session ID format"),

  handleValidation,
];

module.exports = { sendMessageValidator, sessionIdParamValidator };
