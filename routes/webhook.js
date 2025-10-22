const express = require('express');
const router = express.Router();
const Result = require('../models/Result');
const Assessment = require('../models/Assessment');
const User = require('../models/User');



router.post("/assessment-result", async (req, res) => {
  try {
    const resultData = req.body;
    const { userId, assessmentId } = resultData;

    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check if assessment exists
    const assessment = await Assessment.findById(assessmentId);
    if (!assessment) {
      return res.status(404).json({ message: "Assessment not found" });
    }

    // Proceed to create result
    const newResult = await Result.create(resultData);
    res.status(201).json({ message: "Result stored successfully", resultId: newResult._id });
  } catch (error) {
    console.error("Webhook error:", error);
    res.status(500).json({ message: "Error storing result" });
  }
});
router.put("/update-certificate", async (req, res) => {
  try {
    const { userId, interviewId, certificateLink } = req.body;
    console.log("Request body:", { userId, interviewId, certificateLink });

    // Validate input
    if (!userId || !interviewId || !certificateLink) {
      return res.status(400).json({
        success: false,
        message: "userId, interviewId, and certificateLink are required",
      });
    }

    const urlRegex = /^https?:\/\/.+/;
    if (!urlRegex.test(certificateLink)) {
      return res.status(400).json({
        success: false,
        message: "Invalid certificateLink URL",
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

    
    if (!user.certificates.includes(certificateLink)) {
      user.certificates.push(certificateLink);
      await user.save();
      console.log("User certificates after:", user.certificates);
    } else {
      console.log("Certificate already exists, no update needed");
    }

    return res.status(200).json({
      success: true,
      message: "Certificate link updated successfully",
      data: { certificateLink },
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