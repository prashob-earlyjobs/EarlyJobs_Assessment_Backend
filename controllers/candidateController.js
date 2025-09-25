const User = require('../models/User');
const Assessment = require("../models/Assessment");

const getassessmentsByUser = async (req, res) => {
  try {
    const { userId } = req.params;

    // Find the user
    const user = await User.findById(userId);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    // Extract all assessmentIds from the user's paid assessments
    const assessmentIds = user.assessmentsPaid.map(
      (assessment) => assessment.assessmentId
    );

    // Fetch the corresponding assessments
    const assessments = await Assessment.find({ _id: { $in: assessmentIds } });

    return res.status(200).json({
      success: true,
      data: assessments,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

const getAllCandidates = async (req, res) => {
  try {
    const candidates = await User.find({ 
      role: 'candidate',
      assessmentsPaid: { $exists: true, $not: { $size: 0 } }
    })
      .select('-password')
      .sort({ createdAt: -1 })
      .lean();

    if (!candidates || candidates.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No candidates with paid assessments found'
      });
    }

    // Exclude the last 7 candidates
    const filteredCandidates = candidates.slice(0, -7);

    if (filteredCandidates.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No candidates remain after excluding the last 7'
      });
    }

    res.status(200).json({
      success: true,
      count: filteredCandidates.length,
      data: filteredCandidates
    });
  } catch (error) {
    console.error('Error fetching candidates:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching candidates',
      error: error.message
    });
  }
};

module.exports = { getAllCandidates, getassessmentsByUser };