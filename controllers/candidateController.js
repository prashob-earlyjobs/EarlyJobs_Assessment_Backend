const User = require('../models/User');
const Assessment = require("../models/Assessment");
const Result = require("../models/Result");
const { callVeloxhireApi } = require("../controllers/veloxhireController");

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
    
    // Get score filter from query (e.g., "1-4", "5-7", "7+")
    const scoreFilter = req.query.scoreFilter;

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

    // Fetch all candidates (we need to calculate scores first, then filter and sort)
    // We only fetch up to (totalCandidatesAll - 7) to exclude the last 7
    const candidates = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .limit(totalCandidates)
      .lean();

    if (candidates.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No candidates found'
      });
    }

    // Calculate highest score and collect interview skills for each candidate using Veloxhire API
    const highestScoresMap = {};
    const interviewSkillsMap = {};
    
    // Process each candidate to get their highest score and skills
    for (const candidate of candidates) {
      if (!candidate.assessmentsPaid || candidate.assessmentsPaid.length === 0) {
        highestScoresMap[candidate._id.toString()] = null;
        interviewSkillsMap[candidate._id.toString()] = [];
        continue;
      }

      // Extract all assessmentIds from the candidate's paid assessments
      const assessmentIds = candidate.assessmentsPaid.map(
        (assessment) => assessment.assessmentId
      );

      // Fetch the corresponding assessments
      const assessments = await Assessment.find({ _id: { $in: assessmentIds } });

      // Get all interviewIds from assessmentsPaid
      const interviewIds = candidate.assessmentsPaid
        .map((assessment) => assessment.interviewId)
        .filter((id) => id); // Filter out null/undefined

      // Fetch scores and skills from Veloxhire API for each interviewId
      const scores = [];
      const allSkills = [];
      for (const interviewId of interviewIds) {
        // console.log('interviewId', interviewId);
        try {
          const result = await callVeloxhireApi(`/report/new/${interviewId}`);
          // console.log('result', result);
          if (result.success && result.data) {
            // console.log('result.data', result.data);
            // Check for score in different possible locations
            // console.log('result.data.report', result.data.report);
            const score = result.data.report?.score;
            if (score !== undefined && score !== null) {
              scores.push(Number(score));
            }
            
            // Collect skills from reportSkills - extract only skill names
            if (result.data.report?.reportSkills && Array.isArray(result.data.report.reportSkills)) {
              result.data.report.reportSkills.forEach(skillObj => {
                if (skillObj && skillObj.skill) {
                  const skillName = skillObj.skill;
                  if (!allSkills.includes(skillName)) {
                    allSkills.push(skillName);
                  }
                }
              });
            }
          }
        } catch (error) {
          console.error(`Error fetching score for interviewId ${interviewId}:`);
          // Continue with other interviewIds even if one fails
        }
      }

      // Find the highest score
      const highestScore = scores.length > 0 ? Math.max(...scores) : 0;

      console.log('highestScore', highestScore);
      highestScoresMap[candidate._id.toString()] = highestScore;
      interviewSkillsMap[candidate._id.toString()] = allSkills;

    }

    // Add highestScore and interviewSkills to each candidate
    let candidatesWithScores = candidates.map(candidate => {
      const candidateId = candidate._id.toString();
      return {
        ...candidate,
        highestScore: highestScoresMap[candidateId] || null,
        interviewSkills: interviewSkillsMap[candidateId] || []
      };
    });

    // Apply score filter if provided
    if (scoreFilter) {
      candidatesWithScores = candidatesWithScores.filter(candidate => {
        const score = candidate.highestScore || 0;
        switch (scoreFilter) {
          case '1-3':
            return score >= 1 && score <= 3;
          case '4-6':
            return score >= 4 && score <= 6;
          case '7+':
            return score >= 7;
          default:
            return true; // Invalid filter, return all
        }
      });
    }

    // Sort by highestScore (descending - highest first)
    candidatesWithScores.sort((a, b) => {
      const scoreA = a.highestScore || 0;
      const scoreB = b.highestScore || 0;
      return scoreB - scoreA; // Descending order
    });

    // Get total count after filtering
    const totalAfterFilter = candidatesWithScores.length;

    // Apply pagination after filtering and sorting
    const paginatedCandidates = candidatesWithScores.slice(skip, skip + limit);

    if (paginatedCandidates.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No candidates found for this page'
      });
    }

    res.status(200).json({
      success: true,
      count: paginatedCandidates.length,
      total: totalAfterFilter,
      page: page,
      limit: limit,
      totalPages: Math.ceil(totalAfterFilter / limit),
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