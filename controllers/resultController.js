const Result = require('../models/Result');
const Assessment = require('../models/Assessment');
const User = require('../models/User');

// @desc    Get user's assessment results
// @route   GET /api/results
// @access  Private (Candidate)
const getMyResults = async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    
    const query = { userId: req.user._id };
    if (status) query.status = status;

    const results = await Result.find(query)
      .populate('assessmentId', 'title category type difficulty')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 });

    const total = await Result.countDocuments(query);

    res.json({
      success: true,
      data: {
        results,
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
      message: 'Error fetching results',
      error: error.message
    });
  }
};

// @desc    Get specific result details
// @route   GET /api/results/:id
// @access  Private (Candidate)
const getResult = async (req, res) => {
  try {
    const result = await Result.findById(req.params.id)
      .populate('assessmentId', 'title category type difficulty questions')
      .populate('userId', 'name email');

    if (!result) {
      return res.status(404).json({
        success: false,
        message: 'Result not found'
      });
    }

    // Check if user owns this result or is admin/recruiter
    if (result.userId._id.toString() !== req.user._id.toString() && 
        !['admin', 'recruiter'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    res.json({
      success: true,
      data: { result }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching result',
      error: error.message
    });
  }
};

// @desc    Get analytics for user's performance
// @route   GET /api/results/analytics
// @access  Private (Candidate)
const getAnalytics = async (req, res) => {
  try {
    const results = await Result.find({ userId: req.user._id })
      .populate('assessmentId', 'category type');

    if (results.length === 0) {
      return res.json({
        success: true,
        data: {
          totalAssessments: 0,
          averageScore: 0,
          passRate: 0,
          categoryPerformance: [],
          recentTrend: []
        }
      });
    }

    const totalAssessments = results.length;
    const averageScore = results.reduce((sum, r) => sum + r.score, 0) / totalAssessments;
    const passedAssessments = results.filter(r => r.status === 'pass').length;
    const passRate = (passedAssessments / totalAssessments) * 100;

    // Category-wise performance
    const categoryPerformance = {};
    results.forEach(result => {
      const category = result.assessmentId.category;
      if (!categoryPerformance[category]) {
        categoryPerformance[category] = { total: 0, count: 0 };
      }
      categoryPerformance[category].total += result.score;
      categoryPerformance[category].count += 1;
    });

    const categoryStats = Object.entries(categoryPerformance).map(([category, data]) => ({
      category,
      averageScore: Math.round(data.total / data.count),
      assessmentCount: data.count
    }));

    // Recent trend (last 10 assessments)
    const recentResults = results
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 10)
      .reverse();

    const recentTrend = recentResults.map(result => ({
      date: result.createdAt,
      score: result.score,
      assessmentTitle: result.assessmentId.title
    }));

    res.json({
      success: true,
      data: {
        totalAssessments,
        averageScore: Math.round(averageScore),
        passRate: Math.round(passRate),
        categoryPerformance: categoryStats,
        recentTrend
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching analytics',
      error: error.message
    });
  }
};


const createResult = async (req, res) => {
  const {
    userId,
    assessmentId,
    answers,
    score,
    totalPoints,
    maxPoints,
    timeTaken,
    status,
    resultDetails,
    feedback
  } = req.body;

  // Validate required fields
  if (!userId || !assessmentId || !score || !timeTaken || !status) {
    res.status(400);
    throw new Error('Please provide all required fields');
  }

  // Check if result already exists for this user and assessment
  const resultExists = await Result.findOne({ userId, assessmentId });
  if (resultExists) {
    res.status(400);
    throw new Error('Result already exists for this user and assessment');
  }

  // Check for franchiseId in User model
  const user = await User.findById(userId).select('franchiserId');
  if (user && user.franchiserId) {
    console.log(`User ${userId} has franchiseId: ${user.franchiserId}`);
  }

  // Create new result
  const result = await Result.create({
    userId,
    assessmentId,
    answers: answers || [],
    score,
    totalPoints: totalPoints || 0,
    maxPoints: maxPoints || 0,
    timeTaken,
    status,
    resultDetails: resultDetails || {
      categoryWiseScore: [],
      strengths: [],
      weaknesses: [],
      recommendations: []
    },
    feedback: feedback || {
      recruiterFeedback: '',
      systemFeedback: '',
      rating: 0
    },
    isReviewed: false
  });

  if (result) {
    res.status(201).json({
      success: true,
      data: {
        _id: result._id,
        userId: result.userId,
        assessmentId: result.assessmentId,
        score: result.score,
        status: result.status,
        createdAt: result.createdAt
      }
    });
  } else {
    res.status(400);
    throw new Error('Invalid result data');
  }
};



module.exports = {
  getMyResults,
  getResult,
  getAnalytics,
  createResult
};