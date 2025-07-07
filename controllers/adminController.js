const Assessment = require('../models/Assessment');
const User = require('../models/User');
const Transactions = require('../models/transactions');
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

const getFranchiseUsers = async (req, res) => {
  try {
    // Extract query parameters with defaults
    const { page = 1, limit = 10, role, isActive, search } = req.query;
    // Extract id from params
    const { id } = req.params;

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
    // Add franchiserId filter to match the id from params
    if (id) {
      query.franchiserId = id;
    }
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
const getFranchiser = async (req, res) => {
  try {
    // Extract id from params
    const { franchiserId } = req.params;

    const franchiser = await User.findById(franchiserId);

    if (!franchiser) {
      return res.status(404).json({
        success: false,
        message: 'Franchiser not found'
      });
    }

    res.json({
      success: true,
      data: { franchiser }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching franchiser',
      error: error.message
    });
  }
};



// @desc    Get all transactions with populated fields, pagination, and total earnings for super_admin
// @route   GET /api/transactions
// @access  Private (Super Admin)
const getTransactions = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;

    // Validate page and limit
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 10;
    if (pageNum < 1 || limitNum < 1) {
      return res.status(400).json({
        success: false,
        message: 'Page and limit must be positive integers',
      });
    }

    // Query all transactions with pagination and populate related data
    const transactions = await Transactions.find()
      .limit(limitNum)
      .skip((pageNum - 1) * limitNum)
      .sort({ createdAt: -1 })
      .populate('userId', 'name -_id') // Populate candidateName (username) from User model
      .populate('assessmentId', 'title -_id') // Populate assessmentTitle from Assessment model
      .select('transactionId createdAt assessmentId userId transactionAmount franchiserId');

    // Get total count for pagination
    const total = await Transactions.countDocuments();

    // Fetch franchise names by matching franchiserId with User _id
    const franchiseIds = transactions.map(t => t.franchiserId).filter(id => id);
    const franchiseUsers = await User.find({ _id: { $in: franchiseIds } }).select('name _id');

    // Map transactions with populated and calculated fields
    const apiCostPerTransaction = 200;
    const transactionsWithCommission = transactions.map(transaction => {
      const franchiseUser = franchiseUsers.find(u => u._id.toString() === transaction.franchiserId.toString());
      return {
        ...transaction.toObject(),
        candidateName: transaction.userId?.name || 'Unknown',
        assessmentTitle: transaction.assessmentId?.title || 'Unknown',
        franchiseCommission: transaction.transactionAmount ? ((transaction.transactionAmount - apiCostPerTransaction) * 0.70).toFixed(2) : '0.00',
        franchiseName: franchiseUser ? franchiseUser.name : 'Unknown',
      };
    });

    // Calculate total earnings for all franchises
    const totalTransactions = await Transactions.find();
    const totalApiCost = apiCostPerTransaction * totalTransactions.length;
    const totalAmountResult = await Transactions.aggregate([
      { $group: { _id: null, totalAmount: { $sum: '$transactionAmount' } } },
    ]);
    const totalAmount = totalAmountResult.length > 0 ? totalAmountResult[0].totalAmount : 0;
    const totalCommission = (totalAmount - totalApiCost) * 0.70;

    res.json({
      success: true,
      data: {
        transactions: transactionsWithCommission,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum) || 0,
        },
        earnings: {
          totalCommission: totalCommission >= 0 ? parseFloat(totalCommission.toFixed(2)) : 0.00,
          totalAmount,
          apiCost: totalApiCost,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching transactions',
      error: error.message,
    });
  }
};

module.exports = { getTransactions };

const getFranchiseTransactionsAndEarnings = async (req, res) => {
  try {
    const { _id } = req.user;
    const franchiserId = _id;
    console.log("franchiserId", _id);
    console.log("franchiserId", req.user);
    const { page = 1, limit = 10 } = req.query;

    // Validate franchiserId
    if (!franchiserId) {
      return res.status(400).json({ success: false, message: 'Franchiser ID is required' });
    }

    // Validate page and limit
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 10;
    if (pageNum < 1 || limitNum < 1) {
      return res.status(400).json({
        success: false,
        message: 'Page and limit must be positive integers',
      });
    }

    // Query transactions where franchiserId matches or userId matches franchiserId
    const transactions = await Transactions.find({
      $or: [{ franchiserId }, { userId: franchiserId }],
    })
      .limit(limitNum)
      .skip((pageNum - 1) * limitNum)
      .sort({ createdAt: -1 })
      .populate('userId', 'name -_id') // Populate candidateName from User model
      .populate('assessmentId', 'title -_id') // Populate assessmentTitle from Assessment model
      .select('transactionId createdAt assessmentId userId transactionAmount franchiserId');

    // Get total count for pagination
    const total = await Transactions.countDocuments({
      $or: [{ franchiserId }, { userId: franchiserId }],
    });

    // Fetch franchise names by matching franchiserId with User _id
    const franchiseIds = transactions.map(t => t.franchiserId).filter(id => id);
    const franchiseUsers = await User.find({ _id: { $in: franchiseIds } }).select('name _id');

    // Map transactions with populated and calculated fields
    const transactionsWithCommission = transactions.map(transaction => {
      const franchiseUser = franchiseUsers.find(u => u._id.toString() === transaction.franchiserId.toString());
      const apiCost = 200; // Fixed API cost per transaction
      return {
        ...transaction.toObject(),
        candidateName: transaction.userId?.name || 'Unknown',
        assessmentTitle: transaction.assessmentId?.title || 'Unknown',
        franchiseCommission: transaction.transactionAmount ? ((transaction.transactionAmount - apiCost) * 0.70).toFixed(2) : '0.00',
        franchiseName: franchiseUser ? franchiseUser.name : 'Unknown',
      };
    });

    // Calculate total earnings (70% of total transaction amounts minus API cost)
    const totalTransactions = await Transactions.find({ franchiserId });
    const apiCostTotal = 200 * totalTransactions.length; // API cost scaled by transaction count
    const totalAmountResult = await Transactions.aggregate([
      { $match: { franchiserId } },
      { $group: { _id: null, totalAmount: { $sum: '$transactionAmount' } } },
    ]);
    const totalAmount = totalAmountResult.length > 0 ? totalAmountResult[0].totalAmount : 0;
    const totalCommission = (totalAmount - apiCostTotal) * 0.70;

    res.json({
      success: true,
      data: {
        transactions: transactionsWithCommission,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum) || 0,
        },
        earnings: {
          totalCommission: totalCommission >= 0 ? parseFloat(totalCommission.toFixed(2)) : 0.00,
          totalAmount,
          apiCost: apiCostTotal,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching transactions and earnings:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching transactions and earnings',
      error: error.message,
    });
  }
};


const addFranchiser = async (req, res) => {
  const { name, email, password, street, city, state, country, zipCode, mobile } = req.body;

  try {
    // Validate required fields
    if (!name || !email || !password || !street || !city || !state || !country || !zipCode || !mobile) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Check for existing franchiser with the same name, email, or mobile
    const existingFranchiser = await User.findOne({
      $or: [
        { name: { $regex: new RegExp(`^${name}$`, 'i') }, role: 'franchise_admin' },
        { email: { $regex: new RegExp(`^${email}$`, 'i') } },
        { mobile },
      ],
    });

    if (existingFranchiser) {
      if (existingFranchiser.name.toLowerCase() === name.toLowerCase() && existingFranchiser.role === 'franchise_admin') {
        return res.status(400).json({ error: 'Franchiser name already exists' });
      }
      if (existingFranchiser.email.toLowerCase() === email.toLowerCase()) {
        return res.status(400).json({ error: 'Email already exists' });
      }
      if (existingFranchiser.mobile === mobile) {
        return res.status(400).json({ error: 'Contact mobile number already exists' });
      }
    }

    // Prepare user data with nested address
    const newFranchiserData = {
      name,
      email,
      password, // Will be hashed in pre-save middleware
      role: 'franchise_admin',
      authProvider: 'local',
      mobile,
      profile: {
        address: {
          street,
          city,
          state,
          country,
          zipCode,
        },
      },
    };

    // Create new franchiser
    const franchiser = await User.create(newFranchiserData);

    res.status(201).json({ franchiser: franchiser.toJSON() });
  } catch (error) {
    console.error('Error creating franchiser:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ error: error.message });
    }
    if (error.code === 11000) { // Duplicate key error (e.g., email uniqueness)
      return res.status(400).json({ error: 'Email already exists' });
    }
    res.status(500).json({ error: 'Failed to create franchiser' });
  }
};

module.exports = { addFranchiser };

module.exports = {
  createAssessment,
  updateAssessment,
  deleteAssessment,
  getAllAssessments,
  getAnalytics,
  getAllUsers,
  updateUserStatus,
  getFranchiseUsers,
  getFranchiser,
  getTransactions,
  addFranchiser,
  getFranchiseTransactionsAndEarnings
};
