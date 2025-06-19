const User = require('../models/User');
const Result = require('../models/Result');
const Assessment = require('../models/Assessment');

// @desc    Get candidates with filters
// @route   GET /api/recruiter/candidates
// @access  Private (Recruiter)
const getCandidates = async (req, res) => {
  try {
    const { 
      skills, 
      minScore, 
      maxScore, 
      experience, 
      page = 1, 
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build user query
    const userQuery = { role: 'candidate', isActive: true };
    
    if (skills) {
      const skillsArray = skills.split(',').map(s => s.trim());
      userQuery['profile.skills'] = { $in: skillsArray };
    }
    
    if (experience) {
      userQuery['profile.experience'] = { $gte: parseInt(experience) };
    }

    // Get candidates
    let candidates = await User.find(userQuery)
      .select('-password')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 });

    // If score filtering is required, get results and filter
    if (minScore || maxScore) {
      const candidateIds = candidates.map(c => c._id);
      const resultQuery = { userId: { $in: candidateIds } };
      
      if (minScore) resultQuery.score = { $gte: parseInt(minScore) };
      if (maxScore) {
        resultQuery.score = resultQuery.score ? 
          { ...resultQuery.score, $lte: parseInt(maxScore) } : 
          { $lte: parseInt(maxScore) };
      }

      const results = await Result.find(resultQuery)
        .populate('assessmentId', 'title category');
      
      const candidatesWithScores = candidates.map(candidate => {
        const candidateResults = results.filter(r => 
          r.userId.toString() === candidate._id.toString()
        );
        
        const averageScore = candidateResults.length > 0 ? 
          candidateResults.reduce((sum, r) => sum + r.score, 0) / candidateResults.length : 0;
        
        return {
          ...candidate.toObject(),
          assessmentStats: {
            totalAssessments: candidateResults.length,
            averageScore: Math.round(averageScore),
            lastAssessment: candidateResults.length > 0 ? 
              candidateResults[candidateResults.length - 1].createdAt : null
          }
        };
      });

      // Filter by score if specified
      if (minScore || maxScore) {
        candidates = candidatesWithScores.filter(c => {
          const score = c.assessmentStats.averageScore;
          if (minScore && score < parseInt(minScore)) return false;
          if (maxScore && score > parseInt(maxScore)) return false;
          return true;
        });
      } else {
        candidates = candidatesWithScores;
      }
    } else {
      // Add assessment stats without score filtering
      const candidateIds = candidates.map(c => c._id);
      const results = await Result.find({ userId: { $in: candidateIds } })
        .populate('assessmentId', 'title category');
      
      candidates = candidates.map(candidate => {
        const candidateResults = results.filter(r => 
          r.userId.toString() === candidate._id.toString()
        );
        
        const averageScore = candidateResults.length > 0 ? 
          candidateResults.reduce((sum, r) => sum + r.score, 0) / candidateResults.length : 0;
        
        return {
          ...candidate.toObject(),
          assessmentStats: {
            totalAssessments: candidateResults.length,
            averageScore: Math.round(averageScore),
            lastAssessment: candidateResults.length > 0 ? 
              candidateResults[candidateResults.length - 1].createdAt : null
          }
        };
      });
    }

    const total = await User.countDocuments(userQuery);

    res.json({
      success: true,
      data: {
        candidates,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching candidates',
      error: error.message
    });
  }
};

// @desc    Get candidate detailed profile
// @route   GET /api/recruiter/candidates/:id
// @access  Private (Recruiter)
const getCandidateProfile = async (req, res) => {
  try {
    const candidate = await User.findById(req.params.id)
      .select('-password');

    if (!candidate || candidate.role !== 'candidate') {
      return res.status(404).json({
        success: false,
        message: 'Candidate not found'
      });
    }

    // Get candidate's assessment results
    const results = await Result.find({ userId: candidate._id })
      .populate('assessmentId', 'title category type difficulty')
      .sort({ createdAt: -1 });

    // Calculate overall performance metrics
    const totalAssessments = results.length;
    const averageScore = totalAssessments > 0 ? 
      results.reduce((sum, r) => sum + r.score, 0) / totalAssessments : 0;
    const passedAssessments = results.filter(r => r.status === 'pass').length;
    const passRate = totalAssessments > 0 ? (passedAssessments / totalAssessments) * 100 : 0;

    // Category-wise performance
    const categoryPerformance = {};
    results.forEach(result => {
      const category = result.assessmentId.category;
      if (!categoryPerformance[category]) {
        categoryPerformance[category] = { scores: [], count: 0 };
      }
      categoryPerformance[category].scores.push(result.score);
      categoryPerformance[category].count += 1;
    });

    const categoryStats = Object.entries(categoryPerformance).map(([category, data]) => ({
      category,
      averageScore: Math.round(data.scores.reduce((a, b) => a + b, 0) / data.count),
      assessmentCount: data.count,
      bestScore: Math.max(...data.scores)
    }));

    res.json({
      success: true,
      data: {
        candidate,
        performanceMetrics: {
          totalAssessments,
          averageScore: Math.round(averageScore),
          passRate: Math.round(passRate),
          categoryPerformance: categoryStats
        },
        recentResults: results.slice(0, 5)
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching candidate profile',
      error: error.message
    });
  }
};

// @desc    Add feedback to result
// @route   PUT /api/recruiter/results/:id/feedback
// @access  Private (Recruiter)
const addFeedback = async (req, res) => {
  try {
    const { feedback, rating } = req.body;

    const result = await Result.findById(req.params.id);
    
    if (!result) {
      return res.status(404).json({
        success: false,
        message: 'Result not found'
      });
    }

    result.feedback.recruiterFeedback = feedback;
    result.feedback.rating = rating;
    result.isReviewed = true;
    result.reviewedBy = req.user._id;
    result.reviewedAt = new Date();

    await result.save();

    res.json({
      success: true,
      message: 'Feedback added successfully',
      data: { result }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error adding feedback',
      error: error.message
    });
  }
};

module.exports = {
  getCandidates,
  getCandidateProfile,
  addFeedback
};
