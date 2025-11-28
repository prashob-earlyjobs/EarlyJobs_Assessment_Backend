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
const User = require('../models/User');

const router = express.Router();

// Validation rules
const createCertificateValidation = [
  body("userid").isMongoId().withMessage("Invalid user ID"),
  body("interviewid").notEmpty().withMessage("Interview ID is required"),
  body("certificateno").notEmpty().withMessage("Certificate number is required"),
  body("assessmentid").isMongoId().withMessage("Invalid assessment ID"),
  body("certificatelink").isURL().withMessage("Valid certificate link URL is required"),
];

// Routes

// @route   GET /api/certificates/verify/:certificateNo
// @desc    Verify certificate by certificate number (Public)
// @access  Public
router.get("/verify/:certificateNo", verifyCertificate);

// @route   GET /api/certificates/user/:userId
// @desc    Get all certificates for a user
// @access  Private
router.get("/user/:userId", getUserCertificates);

// @route   GET /api/certificates/:id
// @desc    Get certificate by ID
// @access  Private
router.get("/:id", getCertificateById);

// @route   POST /api/certificates
// @desc    Create a new certificate
// @access  Private (Admin)
router.post(
  "/",
  // authMiddleware,
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

router.put("/update-certificate", async (req, res) => {
  try {
    const { userId, interviewId, certificateId } = req.body;
    console.log("Request body:", { userId, interviewId, certificateId });

    // Validate input
    if (!userId || !interviewId || !certificateId) {
      return res.status(400).json({
        success: false,
        message: "userId, interviewId, and certificateId are required",
      });
    }

   

    // Find the user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }
    console.log("User certificates before:", user.certificates);

    // Verify the interviewId exists in user's assessmentsPaid
    const assessment = user.assessmentsPaid.find(
      (assessment) => assessment.interviewId === interviewId
    );
    if (!assessment) {
      return res.status(404).json({
        success: false,
        message: "Interview not found in user's assessments",
      });
    }

    // Initialize certificates array if it doesn't exist
    if (!user.certificates) {
      user.certificates = [];
    }

    
    if (!user.certificates.includes(certificateId)) {
      user.certificates.push(certificateId);
      await user.save();
      console.log("User certificates after:", user.certificates);
    } else {
      console.log("Certificate already exists, no update needed");
    }

    return res.status(200).json({
      success: true,
      message: "Certificate ID updated successfully",
      data: { certificateId },
    });
  } catch (error) {
    console.error("Error updating certificate link:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
});

module.exports = router;
