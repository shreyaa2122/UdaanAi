// src/validators/auth.validator.js

const { body, validationResult } = require("express-validator");

// ── Run after validator chains — sends 400 if any errors ──────────────
const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error:   "Validation failed",
      details: errors.array().map((e) => ({
        field:   e.path,
        message: e.msg,
      })),
    });
  }
  next();
};

// ── Register ──────────────────────────────────────────────────────────
const registerValidator = [
  body("name")
    .trim()
    .notEmpty().withMessage("Name is required")
    .isLength({ max: 60 }).withMessage("Name max 60 characters")
    .escape(), // sanitize HTML entities

  body("email")
    .isEmail().withMessage("Valid email required")
    .normalizeEmail(),

  body("password")
    .isLength({ min: 6 }).withMessage("Password must be at least 6 characters")
    .matches(/\d/).withMessage("Password must contain at least one number"),

  handleValidation,
];

// ── Login ─────────────────────────────────────────────────────────────
const loginValidator = [
  body("email")
    .isEmail().withMessage("Valid email required")
    .normalizeEmail(),

  body("password")
    .notEmpty().withMessage("Password is required"),

  handleValidation,
];

// ── Profile update ────────────────────────────────────────────────────
const profileValidator = [
  body("name")
    .optional()
    .trim()
    .isLength({ max: 60 }).withMessage("Name max 60 characters")
    .escape(),

  body("profile.stream")
    .optional()
    .isIn(["PCM", "PCB", "PCMB", "Commerce", "Arts", "Other", ""])
    .withMessage("Invalid stream value"),

  body("profile.boardPercentage")
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage("Percentage must be between 0 and 100"),

  body("profile.targetExam")
    .optional()
    .isIn(["JEE", "NEET", "CLAT", "CUET", "VITEEE", "BITSAT", "COMEDK", "GATE", "IPMAT", "NIFT", "NID", "NATA", "NDA", "CA", "Other", ""])
    .withMessage("Invalid exam value"),

  body("profile.category")
    .optional()
    .trim()
    .isLength({ max: 30 })
    .escape(),

  body("profile.state")
    .optional()
    .trim()
    .isLength({ max: 50 })
    .escape(),

  body("profile.preferredLocation")
    .optional()
    .trim()
    .isLength({ max: 80 })
    .escape(),

  body("profile.preferredCollege")
    .optional()
    .trim()
    .isLength({ max: 120 })
    .escape(),

  body("profile.preferredBranch")
    .optional()
    .trim()
    .isLength({ max: 80 })
    .escape(),

  body("profile.budget")
    .optional()
    .trim()
    .isLength({ max: 80 })
    .escape(),

  handleValidation,
];

module.exports = { registerValidator, loginValidator, profileValidator };
