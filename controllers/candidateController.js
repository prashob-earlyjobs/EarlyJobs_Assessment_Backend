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
    // Get pagination parameters from query
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    // Build query
    const query = { 
      role: 'candidate',
      assessmentsPaid: { $exists: true, $not: { $size: 0 } }
    };

    // Get total count of all candidates
    const totalCandidatesAll = await User.countDocuments(query);
    
    // Exclude the last 7 candidates from total count
    const totalCandidates = Math.max(0, totalCandidatesAll - 7);
    
    if (totalCandidates === 0) {
      return res.status(404).json({
        success: false,
        message: 'No candidates with paid assessments found'
      });
    }

    // Check if skip is beyond available candidates
    if (skip >= totalCandidates) {
      return res.status(404).json({
        success: false,
        message: 'No candidates found for this page'
      });
    }

    // Calculate how many candidates to fetch
    // We only fetch up to (totalCandidatesAll - 7) to exclude the last 7
    const fetchLimit = Math.min(skip + limit, totalCandidates);
    
    // Fetch candidates (sorted by newest first)
    // Since we're limiting to totalCandidates, we won't fetch the excluded last 7
    const candidates = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .limit(fetchLimit)
      .lean();
    
    // Apply pagination by slicing from skip position
    const paginatedCandidates = candidates.slice(skip);

    if (paginatedCandidates.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No candidates found for this page'
      });
    }

    res.status(200).json({
      success: true,
      count: paginatedCandidates.length,
      total: totalCandidates,
      page: page,
      limit: limit,
      totalPages: Math.ceil(totalCandidates / limit),
      data: paginatedCandidates
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
const getUserIdByInterviewId = async (req, res) => {
  try {
    const { interviewId } = req.params;

    
    const candidate = await User.findOne({
      "assessmentsPaid.interviewId": interviewId,
    }).select("_id name email");

    if (!candidate) {
      return res.status(404).json({
        success: false,
        message: "No candidate found for this interview ID",
      });
    }

    res.json({
      success: true,
      userId: candidate._id, 
      name: candidate.name,
      email: candidate.email,
    });
  } catch (error) {
    console.error("Error fetching user ID by interviewId:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

module.exports = { getAllCandidates, getassessmentsByUser, getUserIdByInterviewId };