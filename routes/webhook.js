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



module.exports = router;