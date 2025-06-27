const Assessment = require('../models/Assessment');
const User = require('../models/User');
const Result = require('../models/Result');
const { validationResult } = require('express-validator');

// @desc    Create new assessment
// @route   POST /api/admin/assessments
// @access  Private (Admin)
const createAssessment = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const assessment = await Assessment.create({
      ...req.body,
      createdBy: req.user._id
    });

    res.status(201).json({
      success: true,
      message: 'Assessment created successfully',
      data: { assessment }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error creating assessment',
      error: error.message
    });
  }
};

// @desc    Update assessment
// @route   PUT /api/admin/assessments/:id
// @access  Private (Admin)
const updateAssessment = async (req, res) => {
  try {
    const assessment = await Assessment.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!assessment) {
      return res.status(404).json({
        success: false,
        message: 'Assessment not found'
      });
    }

    res.json({
      success: true,
      message: 'Assessment updated successfully',
      data: { assessment }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating assessment',
      error: error.message
    });
  }
};

// @desc    Delete assessment
// @route   DELETE /api/admin/assessments/:id
// @access  Private (Admin)
const deleteAssessment = async (req, res) => {
  try {
    const assessment = await Assessment.findById(req.params.id);

    if (!assessment) {
      return res.status(404).json({
        success: false,
        message: 'Assessment not found'
      });
    }

    // Check if assessment has been taken by candidates
    const resultCount = await Result.countDocuments({ assessmentId: assessment._id });
    
    if (resultCount > 0) {
      // Soft delete - just deactivate
      assessment.isActive = false;
      await assessment.save();
      
      return res.json({
        success: true,
        message: 'Assessment deactivated successfully (has existing results)'
      });
    }

    // Hard delete if no results exist
    await assessment.deleteOne();

    res.json({
      success: true,
      message: 'Assessment deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error deleting assessment',
      error: error.message
    });
  }
};

// @desc    Get all assessments (admin view)
// @route   GET /api/admin/assessments
// @access  Private (Admin)
const getAllAssessments = async (req, res) => {
  try {
    const { page = 1, limit = 10, category, type, isActive } = req.query;
    
    const query = {};
    if (category) query.category = category;
    if (type) query.type = type;
    if (isActive !== undefined) query.isActive = isActive === 'true';

    const assessments = await Assessment.find(query)
      .populate('createdBy', 'name email')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 });

    // Add usage statistics
    const assessmentsWithStats = await Promise.all(
      assessments.map(async (assessment) => {
        const resultCount = await Result.countDocuments({ assessmentId: assessment._id });
        const averageScore = await Result.aggregate([
          { $match: { assessmentId: assessment._id } },
          { $group: { _id: null, avgScore: { $avg: '$score' } } }
        ]);

        return {
          ...assessment.toObject(),
          statistics: {
            totalAttempts: resultCount,
            averageScore: averageScore[0]?.avgScore || 0
          }
        };
      })
    );

    const total = await Assessment.countDocuments(query);

    res.json({
      success: true,
      data: {
        assessments: assessmentsWithStats,
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
      message: 'Error fetching assessments',
      error: error.message
    });
  }
};

// @desc    Get platform analytics
// @route   GET /api/admin/analytics
// @access  Private (Admin)
const getAnalytics = async (req, res) => {
  try {
    // User statistics
    const totalUsers = await User.countDocuments();
    const candidateCount = await User.countDocuments({ role: 'candidate' });
    const recruiterCount = await User.countDocuments({ role: 'recruiter' });
    const activeUsers = await User.countDocuments({ isActive: true });

    // Assessment statistics
    const totalAssessments = await Assessment.countDocuments();
    const activeAssessments = await Assessment.countDocuments({ isActive: true });

    // Result statistics
    const totalResults = await Result.countDocuments();
    const passedResults = await Result.countDocuments({ status: 'pass' });
    const averageScore = await Result.aggregate([
      { $group: { _id: null, avgScore: { $avg: '$score' } } }
    ]);

    // Recent activity (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentRegistrations = await User.countDocuments({
      createdAt: { $gte: thirtyDaysAgo }
    });

    const recentAssessments = await Result.countDocuments({
      createdAt: { $gte: thirtyDaysAgo }
    });

    // Category-wise performance
    const categoryPerformance = await Result.aggregate([
      {
        $lookup: {
          from: 'assessments',
          localField: 'assessmentId',
          foreignField: '_id',
          as: 'assessment'
        }
      },
      { $unwind: '$assessment' },
      {
        $group: {
          _id: '$assessment.category',
          totalAttempts: { $sum: 1 },
          averageScore: { $avg: '$score' },
          passRate: {
            $avg: { $cond: [{ $eq: ['$status', 'pass'] }, 1, 0] }
          }
        }
      }
    ]);

    // Daily activity for the last 7 days
    const dailyActivity = await Result.aggregate([
      {
        $match: {
          createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          assessmentsTaken: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.json({
      success: true,
      data: {
        userStatistics: {
          totalUsers,
          candidateCount,
          recruiterCount,
          activeUsers,
          recentRegistrations
        },
        assessmentStatistics: {
          totalAssessments,
          activeAssessments,
          totalResults,
          recentAssessments
        },
        performanceMetrics: {
          averageScore: averageScore[0]?.avgScore || 0,
          passRate: totalResults > 0 ? (passedResults / totalResults) * 100 : 0,
          categoryPerformance: categoryPerformance.map(cat => ({
            category: cat._id,
            totalAttempts: cat.totalAttempts,
            averageScore: Math.round(cat.averageScore),
            passRate: Math.round(cat.passRate * 100)
          }))
        },
        activityTrends: {
          dailyActivity
        }
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

// @desc    Get all users
// @route   GET /api/admin/users
// @access  Private (Admin)
const getAllUsers = async (req, res) => {
  try {
    // Extract query parameters with defaults
    const { page = 1, limit = 10, role, isActive, search } = req.query;

    // Validate page and limit
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 10;
    if (pageNum < 1 || limitNum < 1) {
      return res.status(400).json({
        success: false,
        message: 'Page and limit must be positive integers',
      });
    }

    // Build query object
    const query = {};
    // Only include role if it's not 'undefined' or falsy
    if (role && role !== 'undefined') {
      query.role = role;
    }
    // Only include isActive if it's explicitly 'true' or 'false'
    if (isActive === 'true' || isActive === 'false') {
      query.isActive = isActive === 'true';
    }
    // Include search if it's a non-empty string
    if (search && search.trim() !== '') {
      // Sanitize search input to prevent regex-based attacks
      const sanitizedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.$or = [
        { name: { $regex: sanitizedSearch, $options: 'i' } },
        { email: { $regex: sanitizedSearch, $options: 'i' } },
      ];
    }

    // Fetch users and total count
    const users = await User.find(query)
      .select('-password')
      .limit(limitNum)
      .skip((pageNum - 1) * limitNum)
      .sort({ createdAt: -1 });

    const total = await User.countDocuments(query);

    // Return response
    res.json({
      success: true,
      data: {
        users,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum) || 0, // Ensure pages is 0 if total is 0
        },
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching users',
      error: error.message,
    });
  }
};



// @desc    Update user status
// @route   PUT /api/admin/users/:id/status
// @access  Private (Admin)
const updateUserStatus = async (req, res) => {
  try {
    const { isActive } = req.body;

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isActive },
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      message: `User ${isActive ? 'activated' : 'deactivated'} successfully`,
      data: { user }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating user status',
      error: error.message
    });
  }
};

module.exports = {
  createAssessment,
  updateAssessment,
  deleteAssessment,
  getAllAssessments,
  getAnalytics,
  getAllUsers,
  updateUserStatus
};
