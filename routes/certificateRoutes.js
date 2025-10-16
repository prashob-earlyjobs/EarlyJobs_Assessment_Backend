const express = require("express");
const { body } = require("express-validator");
const {
  verifyCertificate,
  getUserCertificates,
  createCertificate,
  getCertificateById,
  deactivateCertificate,
} = require("../controllers/certificateController");
const authMiddleware = require("../middlewares/authMiddleware");
const roleMiddleware = require("../middlewares/roleMiddleware");

const router = express.Router();

// Validation rules
const createCertificateValidation = [
  body("userid").isMongoId().withMessage("Invalid user ID"),
  body("interviewid").notEmpty().withMessage("Interview ID is required"),
  body("cerficateno").notEmpty().withMessage("Certificate number is required"),
  body("assessmentid").isMongoId().withMessage("Invalid assessment ID"),
  body("cerficatelink").isURL().withMessage("Valid certificate link URL is required"),
];

// Routes

// @route   GET /api/certificates/verify/:certificateNo
// @desc    Verify certificate by certificate number (Public)
// @access  Public
router.get("/verify/:certificateNo", verifyCertificate);

// @route   GET /api/certificates/user/:userId
// @desc    Get all certificates for a user
// @access  Private
router.get("/user/:userId", authMiddleware, getUserCertificates);

// @route   GET /api/certificates/:id
// @desc    Get certificate by ID
// @access  Private
router.get("/:id", authMiddleware, getCertificateById);

// @route   POST /api/certificates
// @desc    Create a new certificate
// @access  Private (Admin)
router.post(
  "/",
  authMiddleware,
  // roleMiddleware(["super_admin", "franchise_admin"]),
  createCertificateValidation,
  createCertificate
);

// @route   PUT /api/certificates/:id/deactivate
// @desc    Deactivate a certificate
// @access  Private (Admin)
router.put(
  "/:id/deactivate",
  authMiddleware,
  roleMiddleware(["super_admin", "franchise_admin"]),
  deactivateCertificate
);

module.exports = router;
