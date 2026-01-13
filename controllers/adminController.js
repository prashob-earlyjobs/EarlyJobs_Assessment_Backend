const Assessment =require("../models/Assessment");
const User = require("../models/User");
const Transactions = require("../models/transactions");
const Result = require("../models/Result");
const CollegeTieup = require("../models/collegeTieups");
const {uploadPublicFile} = require("../utils/gcpUpload");
const { validationResult } = require("express-validator");


// @desc    Create new assessment
// @route   POST /api/admin/assessments
// @access  Private (Admin)
const createAssessment = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation errors",
        errors: errors.array(),
      });
    }

    const assessment = await Assessment.create({
      ...req.body,
      createdBy: req.user._id,
    });

    res.status(201).json({
      success: true,
      message: "Assessment created successfully",
      data: { assessment },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error creating assessment",
      error: error.message,
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
        message: "Assessment not found",
      });
    }

    res.json({
      success: true,
      message: "Assessment updated successfully",
      data: { assessment },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error updating assessment",
      error: error.message,
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
        message: "Assessment not found",
      });
    }

    // Check if assessment has been taken by candidates
    const resultCount = await Result.countDocuments({
      assessmentId: assessment._id,
    });

    if (resultCount > 0) {
      // Soft delete - just deactivate
      assessment.isActive = false;
      await assessment.save();

      return res.json({
        success: true,
        message: "Assessment deactivated successfully (has existing results)",
      });
    }

    // Hard delete if no results exist
    await assessment.deleteOne();

    res.json({
      success: true,
      message: "Assessment deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error deleting assessment",
      error: error.message,
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
    if (isActive !== undefined) query.isActive = isActive === "true";

    const assessments = await Assessment.find(query)
      .populate("createdBy", "name email")
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 });

    // Add usage statistics
    const assessmentsWithStats = await Promise.all(
      assessments.map(async (assessment) => {
        const resultCount = await Result.countDocuments({
          assessmentId: assessment._id,
        });
        const averageScore = await Result.aggregate([
          { $match: { assessmentId: assessment._id } },
          { $group: { _id: null, avgScore: { $avg: "$score" } } },
        ]);

        return {
          ...assessment.toObject(),
          statistics: {
            totalAttempts: resultCount,
            averageScore: averageScore[0]?.avgScore || 0,
          },
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
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching assessments",
      error: error.message,
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
    const candidateCount = await User.countDocuments({ role: "candidate" });
    const recruiterCount = await User.countDocuments({ role: "recruiter" });
    const activeUsers = await User.countDocuments({ isActive: true });

    // Assessment statistics
    const totalAssessments = await Assessment.countDocuments();
    const activeAssessments = await Assessment.countDocuments({
      isActive: true,
    });

    // Result statistics
    const totalResults = await Result.countDocuments();
    const passedResults = await Result.countDocuments({ status: "pass" });
    const averageScore = await Result.aggregate([
      { $group: { _id: null, avgScore: { $avg: "$score" } } },
    ]);

    // Recent activity (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentRegistrations = await User.countDocuments({
      createdAt: { $gte: thirtyDaysAgo },
    });

    const recentAssessments = await Result.countDocuments({
      createdAt: { $gte: thirtyDaysAgo },
    });

    // Category-wise performance
    const categoryPerformance = await Result.aggregate([
      {
        $lookup: {
          from: "assessments",
          localField: "assessmentId",
          foreignField: "_id",
          as: "assessment",
        },
      },
      { $unwind: "$assessment" },
      {
        $group: {
          _id: "$assessment.category",
          totalAttempts: { $sum: 1 },
          averageScore: { $avg: "$score" },
          passRate: {
            $avg: { $cond: [{ $eq: ["$status", "pass"] }, 1, 0] },
          },
        },
      },
    ]);

    // Daily activity for the last 7 days
    const dailyActivity = await Result.aggregate([
      {
        $match: {
          createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          assessmentsTaken: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.json({
      success: true,
      data: {
        userStatistics: {
          totalUsers,
          candidateCount,
          recruiterCount,
          activeUsers,
          recentRegistrations,
        },
        assessmentStatistics: {
          totalAssessments,
          activeAssessments,
          totalResults,
          recentAssessments,
        },
        performanceMetrics: {
          averageScore: averageScore[0]?.avgScore || 0,
          passRate: totalResults > 0 ? (passedResults / totalResults) * 100 : 0,
          categoryPerformance: categoryPerformance.map((cat) => ({
            category: cat._id,
            totalAttempts: cat.totalAttempts,
            averageScore: Math.round(cat.averageScore),
            passRate: Math.round(cat.passRate * 100),
          })),
        },
        activityTrends: {
          dailyActivity,
        },
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching analytics",
      error: error.message,
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
        message: "Page and limit must be positive integers",
      });
    }

    // Build query object
    const query = {};
    // Only include role if it's not 'undefined' or falsy
    if (role && role !== "undefined") {
      query.role = role;
    }
    // Only include isActive if it's explicitly 'true' or 'false'
    if (isActive === "true" || isActive === "false") {
      query.isActive = isActive === "true";
    }
    // Include search if it's a non-empty string
    if (search && search.trim() !== "") {
      // Sanitize search input to prevent regex-based attacks
      const sanitizedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      query.$or = [
        { name: { $regex: sanitizedSearch, $options: "i" } },
        { email: { $regex: sanitizedSearch, $options: "i" } },
      ];
    }

    // Fetch users and total count
    const users = await User.find(query)
      .select("-password")
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
      message: "Error fetching users",
      error: error.message,
    });
  }
};

const getFranchiseUsers = async (req, res) => {
  try {
    // Extract query parameters with defaults
    const { page = 1, limit = 10, role, isActive, search } = req.query;
    // Extract id from params
    const { franchiseId } = req.params;

    // Validate page and limit
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 10;
    if (pageNum < 1 || limitNum < 1) {
      return res.status(400).json({
        success: false,
        message: "Page and limit must be positive integers",
      });
    }

    // Build query object
    const query = {};
    // Add franchiserId filter to match the id from params
    if (franchiseId) {
      console.log("franchiseId", franchiseId);
      query.referrerId = franchiseId;
    }
    // Only include role if it's not 'undefined' or falsy
    if (role && role !== "undefined") {
      query.role = role;
    }
    // Only include isActive if it's explicitly 'true' or 'false'
    if (isActive === "true" || isActive === "false") {
      query.isActive = isActive === "true";
    }
    // Include search if it's a non-empty string
    if (search && search.trim() !== "") {
      // Sanitize search input to prevent regex-based attacks
      const sanitizedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      query.$or = [
        { name: { $regex: sanitizedSearch, $options: "i" } },
        { email: { $regex: sanitizedSearch, $options: "i" } },
      ];
    }

    // Fetch users and total count
    const users = await User.find(query)
      .select("-password")
      .limit(limitNum)
      .skip((pageNum - 1) * limitNum)
      .sort({ createdAt: -1 });
    console.log("users", users);
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
      message: "Error fetching users",
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
    ).select("-password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.json({
      success: true,
      message: `User ${isActive ? "activated" : "deactivated"} successfully`,
      data: { user },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error updating user status",
      error: error.message,
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
        message: "Franchiser not found",
      });
    }

    res.json({
      success: true,
      data: { franchiser },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching franchiser",
      error: error.message,
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
        message: "Page and limit must be positive integers",
      });
    }

    // Query all transactions with pagination and populate related data
    const transactions = await Transactions.find()
      .limit(limitNum)
      .skip((pageNum - 1) * limitNum)
      .sort({ createdAt: -1 })
      .populate("userId", "name -_id") // Populate candidateName (username) from User model
      .populate("assessmentId", "title -_id") // Populate assessmentTitle from Assessment model
      .select(
        "transactionId createdAt assessmentId userId transactionAmount franchiserId offerCode"
      );

    // Get total count for pagination
    const total = await Transactions.countDocuments();

    // Fetch franchise names by matching franchiserId with User _id
    const franchiseIds = transactions
      .map((t) => t.franchiserId)
      .filter((id) => id);
    const franchiseUsers = await User.find({
      _id: { $in: franchiseIds },
    }).select("name _id");
    console.log("transactions", transactions);
    // Map transactions with populated and calculated fields
    // const apiCostPerTransaction = 307;
    const transactionsWithCommission = transactions.map((transaction) => {
      const franchiseUser = franchiseUsers.find(
        (u) => u._id === transaction.franchiserId
      );
      return {
        ...transaction.toObject(),
        candidateName: transaction.userId?.name || "Unknown",
        assessmentTitle: transaction.assessmentId?.title || "Unknown",
        franchiseCommission:
          transaction.transactionAmount > 307
            ? (
                transaction.transactionAmount  *
                0.7
              ).toFixed(2)
            : "0.00",
        franchiseName: franchiseUser ? franchiseUser.name : "Unknown",
      };
    });

    // Calculate total earnings for all franchises
    const totalTransactions = await Transactions.find();
    // const totalApiCost = apiCostPerTransaction * totalTransactions.length;
    const totalAmountResult = await Transactions.aggregate([
      { $group: { _id: null, totalAmount: { $sum: "$transactionAmount" } } },
    ]);
    const totalAmount =
      totalAmountResult.length > 0 ? totalAmountResult[0].totalAmount : 0;
    const totalCommission = totalAmount  * 0.7;

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
          totalCommission:
            totalCommission >= 0 ? parseFloat(totalCommission.toFixed(2)) : 0.0,
          totalAmount,
          apiCost: 0,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching transactions:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching transactions",
      error: error.message,
    });
  }
};

module.exports = { getTransactions };

const getFranchiseTransactionsAndEarnings = async (req, res) => {
  try {
    const { franchiseId } = req.user;
    const franchiserId = franchiseId;
    const { page = 1, limit = 10 } = req.query;

    // Validate franchiserId
    if (!franchiserId) {
      return res
        .status(400)
        .json({ success: false, message: "Franchiser ID is required" });
    }

    // Validate page and limit
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 10;
    if (pageNum < 1 || limitNum < 1) {
      return res.status(400).json({
        success: false,
        message: "Page and limit must be positive integers",
      });
    }

    console.log("franchiserId", franchiserId);
    // Query transactions where franchiserId matches or userId matches franchiserId
    const transactions = await Transactions.find({
      $or: [{ referrerId: franchiserId }],
    })
      .limit(limitNum)
      .skip((pageNum - 1) * limitNum)
      .sort({ createdAt: -1 })
      .populate("userId", "name -_id") // Populate candidateName from User model
      .populate("assessmentId", "title -_id") // Populate assessmentTitle from Assessment model
      .select(
        "transactionId createdAt assessmentId userId transactionAmount franchiserId referrerId offerCode"
      );

    // Get total count for pagination
    const total = await Transactions.countDocuments({
      $or: [{ referrerId: franchiserId }],
    });
    console.log("transactions", transactions, "total", total);

    // Fetch franchise names by matching franchiserId with User _id
    const franchiseIds = transactions
      .map((t) => t.referrerId)
      .filter((id) => id);
    const franchiseUsers = await User.find({
      referrerId: { $in: franchiseIds },
    }).select("name _id referrerId");

    console.log("franchiseUsers", franchiseUsers, "franchiseIds", franchiseIds);

    // Map transactions with populated and calculated fields
    // const apiCost = 307; // Fixed API cost per transaction
    const transactionsWithCommission = transactions.map((transaction) => {
      const franchiseUser = franchiseUsers.find(
        (u) => u.referrerId === transaction.referrerId
      );

      return {
        ...transaction.toObject(),
        candidateName: transaction.userId?.name || "Unknown",
        assessmentTitle: transaction.assessmentId?.title || "Unknown",
        franchiseCommission:
          transaction.transactionAmount > 300
            ? ((transaction.transactionAmount ) * 0.7).toFixed(2)
            : "0.00",
        franchiseName: franchiseUser ? franchiseUser.name : "Unknown",
      };
    });
    console.log("transactionsWithCommission", transactionsWithCommission);
    // Calculate total earnings (70% of total transaction amounts minus API cost)
    const totalTransactions = await Transactions.find({
      referrerId: franchiserId,
    });
    // const apiCostTotal = apiCost * totalTransactions.length; // API cost scaled by transaction count
    const totalAmountResult = await Transactions.aggregate([
      { $match: { referrerId: franchiserId } },
      { $group: { _id: null, totalAmount: { $sum: "$transactionAmount" } } },
    ]);
    const totalAmount =
      totalAmountResult.length > 0 ? totalAmountResult[0].totalAmount : 0;
    const totalCommission = (totalAmount ) * 0.7;

    console.log(
      "totalCommission",
      totalCommission,
      "totalAmount",
      totalAmount,
      "apiCostTotal",
      0
    );

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
          totalCommission:
            totalCommission >= 0 ? parseFloat(totalCommission.toFixed(2)) : 0.0,
          totalAmount,
          apiCost: 0,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching transactions and earnings:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching transactions and earnings",
      error: error.message,
    });
  }
};





const getFranchiseTransactionsForEarlyjobs = async (req, res) => {
  try {
    const { bdeReferralId } = req.params;
    const franchiserId = bdeReferralId || req.params?.userId;
    const { page = 1, limit = 10 } = req.query;
    // Validate franchiserId
    if (!franchiserId) {
      return res
        .status(400)
        .json({ success: false, message: "Franchiser ID is required" });
    }

    // Validate page and limit
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 10;
    if (pageNum < 1 || limitNum < 1) {
      return res.status(400).json({
        success: false,
        message: "Page and limit must be positive integers",
      });
    }

    console.log("franchiserId", franchiserId);
    // Query transactions where franchiserId matches or userId matches franchiserId
    const transactions = await Transactions.find({
      $or: [{ referrerId: franchiserId }],
    })
      .limit(limitNum)
      .skip((pageNum - 1) * limitNum)
      .sort({ createdAt: -1 })
      .populate("userId", "name -_id") // Populate candidateName from User model
      .populate("assessmentId", "title -_id") // Populate assessmentTitle from Assessment model
      .select(
        "transactionId createdAt assessmentId userId transactionAmount franchiserId referrerId offerCode"
      );

    // Get total count for pagination
    const total = await Transactions.countDocuments({
      $or: [{ referrerId: franchiserId }],
    });
    console.log("transactions", transactions, "total", total);

    // Fetch franchise names by matching franchiserId with User _id
    const franchiseIds = transactions
      .map((t) => t.referrerId)
      .filter((id) => id);
    const franchiseUsers = await User.find({
      referrerId: { $in: franchiseIds },
    }).select("name _id referrerId");

    console.log("franchiseUsers", franchiseUsers, "franchiseIds", franchiseIds);

    // Map transactions with populated and calculated fields
    // const apiCost = 307; // Fixed API cost per transaction
    const transactionsWithCommission = transactions.map((transaction) => {
      const franchiseUser = franchiseUsers.find(
        (u) => u.referrerId === transaction.referrerId
      );

      return {
        ...transaction.toObject(),
        candidateName: transaction.userId?.name || "Unknown",
        assessmentTitle: transaction.assessmentId?.title || "Unknown",
        franchiseCommission:
          transaction.transactionAmount > 300
            ? ((transaction.transactionAmount) * 0.7).toFixed(2)
            : "0.00",
        franchiseName: franchiseUser ? franchiseUser.name : "Unknown",
      };
    });
    console.log("transactionsWithCommission", transactionsWithCommission);
    // Calculate total earnings (70% of total transaction amounts minus API cost)
    const totalTransactions = await Transactions.find({
      referrerId: franchiserId,
    });
    // const apiCostTotal = apiCost * totalTransactions.length; // API cost scaled by transaction count
    const totalAmountResult = await Transactions.aggregate([
      { $match: { referrerId: franchiserId } },
      { $group: { _id: null, totalAmount: { $sum: "$transactionAmount" } } },
    ]);
    const totalAmount =
      totalAmountResult.length > 0 ? totalAmountResult[0].totalAmount : 0;
    const totalCommission = (totalAmount ) * 0.7;

    console.log(
      "totalCommission",
      totalCommission,
      "totalAmount",
      totalAmount,
      "apiCostTotal",
      0
    );

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
          totalCommission:
            totalCommission >= 0 ? parseFloat(totalCommission.toFixed(2)) : 0.0,
          totalAmount,
          apiCost: 0,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching transactions and earnings:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching transactions and earnings",
      error: error.message,
    });
  }
};

const addFranchiser = async (req, res) => {
  const {
    name,
    email,
    password,
    street,
    city,
    state,
    country,
    zipCode,
    mobile,
    franchiseId,
  } = req.body;

  try {
    // Validate required fields
    if (
      !name ||
      !email ||
      !password ||
      !street ||
      !city ||
      !state ||
      !country ||
      !zipCode ||
      !mobile ||
      !franchiseId
    ) {
      return res.status(400).json({ error: "All fields are required" });
    }

    // Check for existing franchiser with the same name, email, or mobile
    const existingFranchiser = await User.findOne({
      $or: [
        {
          name: { $regex: new RegExp(`^${name}$`, "i") },
          role: "franchise_admin",
        },
        { email: { $regex: new RegExp(`^${email}$`, "i") } },
        { mobile },
        { franchiseId },
      ],
    });

    if (existingFranchiser) {
      if (
        existingFranchiser.name.toLowerCase() === name.toLowerCase() &&
        existingFranchiser.role === "franchise_admin"
      ) {
        return res
          .status(400)
          .json({ error: "Franchiser name already exists" });
      }
      if (existingFranchiser.email.toLowerCase() === email.toLowerCase()) {
        return res.status(400).json({ error: "Email already exists" });
      }
      if (existingFranchiser.mobile === mobile) {
        return res
          .status(400)
          .json({ error: "Contact mobile number already exists" });
      }
    }

    // Prepare user data with nested address
    const newFranchiserData = {
      name,
      email,
      password, // Will be hashed in pre-save middleware
      role: "franchise_admin",
      authProvider: "local",
      mobile,
      franchiseId,
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
    console.error("Error creating franchiser:", error);
    if (error.name === "ValidationError") {
      return res.status(400).json({ error: error.message });
    }
    if (error.code === 11000) {
      // Duplicate key error (e.g., email uniqueness)
      return res.status(400).json({ error: "Email already exists" });
    }
    res.status(500).json({ error: "Failed to create franchiser" });
  }
};

const getFranchises = async (req, res) => {
  try {
    const franchises = await User.find({ role: "franchise_admin" }).select(
      "_id name email mobile createdAt franchiseId isActive profile.address.street profile.address.city profile.address.state profile.address.country profile.address.zipCode"
    );
    console.log("franchises", franchises);
    const franchiseData = await Promise.all(
      franchises.map(async (franchise) => {
        // Calculate activeUsers (users with matching referrerId)
        const activeUsers = await User.countDocuments({
          referrerId: franchise.franchiseId,
        });

        return {
          name: franchise.name,
          contactEmail: franchise.email,
          contactPhone: franchise.mobile || "+1-555-0789", // Default if not provided
          activeUsers,
          location: {
            street: franchise.profile.address.street,
            city: franchise.profile.address.city,
            state: franchise.profile.address.state,
            country: franchise.profile.address.country,
            zipCode: franchise.profile.address.zipCode,
          },
          joinDate: franchise.createdAt
            ? franchise.createdAt.toISOString().split("T")[0]
            : "2024-03-10",
          status: franchise.isActive || "inactive",
        };
      })
    );

    res.json(franchiseData);
  } catch (error) {
    console.error("Error fetching franchises:", error);
    res
      .status(500)
      .json({ error: "Failed to fetch franchises", details: error.message });
  }
};

// @desc    Add a new user (admin action)
// @route   POST /api/admin/addUser
// @access  Private (Super Admin)

const addUser = async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      mobile,
      role,
      referrerId,
      profile,
      userId,
    } = req.body;

    if (!name || !email || !password || !mobile) {
      return res.status(400).json({
        success: false,
        message: "name, email, password and mobile are required",
      });
    }

    // Normalize and validate role; default to 'candidate'
    const roleInput = (role || "candidate").toString();
    const lower = roleInput.toLowerCase();
    const aliasMap = { admin: "ADMIN", fbde: "FBDE", creater: "creator" };
    const mapped = aliasMap[lower] || lower;
    const allowedRoles = [
      "candidate",
      "recruiter",
      "franchise",
      "super_admin",
      "franchise_admin",
      "ADMIN",
      "FBDE",
      "creator",
    ];
    const normalizedRole = allowedRoles.includes(mapped) ? mapped : "candidate";

    // Uniqueness checks for email, mobile, userId
    const existing = await User.findOne({
      $or: [
        { email: email.toLowerCase() },
        { mobile },
        ...(userId ? [{ userId }] : []),
      ],
    });
    if (existing) {
      return res.status(400).json({
        success: false,
        message:
          existing.email?.toLowerCase() === email.toLowerCase()
            ? "Email already exists"
            : existing.mobile === mobile
            ? "Mobile already exists"
            : "UserId already exists",
      });
    }

    // Generate a userId in format EJU0001, EJU0002, etc.
    let generatedUserId = userId && typeof userId === "string" && userId.trim() !== ""
      ? userId.trim()
      : null;

    if (!generatedUserId) {
      // Find all users with userId matching pattern EJU####
      const usersWithEJU = await User.find({
        userId: { $regex: /^EJU\d+$/ },
      }).select("userId");

      if (usersWithEJU && usersWithEJU.length > 0) {
        // Extract all numbers and find the maximum
        const numbers = usersWithEJU
          .map((u) => {
            const match = u.userId.match(/^EJU(\d+)$/);
            return match ? parseInt(match[1], 10) : 0;
          })
          .filter((num) => !isNaN(num));

        if (numbers.length > 0) {
          const maxNumber = Math.max(...numbers);
          const nextNumber = maxNumber + 1;
          generatedUserId = `EJU${nextNumber.toString().padStart(4, "0")}`;
        } else {
          generatedUserId = "EJU0001";
        }
      } else {
        // No existing user with EJU pattern, start from EJU0001
        generatedUserId = "EJU0001";
      }
    }

    const user = await User.create({
      name,
      email: email.toLowerCase(),
      password, // hashed by pre-save hook
      mobile,
      role: normalizedRole,
      referrerId: referrerId || null,
      createdBy: req.user?._id || null,
      authProvider: "local",
      profile: profile || {},
      userId: generatedUserId,
    });

    return res.status(201).json({ success: true, data: { user: user.toJSON() } });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: "Duplicate key" });
    }
    return res.status(500).json({
      success: false,
      message: "Failed to create user",
      error: error.message,
    });
  }
};

// @desc    Get referred users for a specific user
// @route   GET /api/admin/getReferredUsers/:userId
// @access  Private
const getReferredUsers = async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 10, searchQuery = "", role = "candidate" } = req.query;

    // Validate userId
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required",
      });
    }

    // Find the user by userId field (EJU####) - not MongoDB _id
    const referrerUser = await User.findOne({
      userId: userId,
    });

    if (!referrerUser) {
      return res.status(404).json({
        success: false,
        message: "User not found with the provided userId",
      });
    }

    // Use userId (EJU####) as referrerId for querying candidates
    // The referrerId in candidates should match this userId
    const referrerId = referrerUser.userId;
    
    if (!referrerId) {
      return res.status(400).json({
        success: false,
        message: "Referrer user does not have a userId assigned",
      });
    }

    // Validate page and limit
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 10;
    if (pageNum < 1 || limitNum < 1) {
      return res.status(400).json({
        success: false,
        message: "Page and limit must be positive integers",
      });
    }

    // Build query object - find candidates where referrerId matches the user's userId
    const query = {
      referrerId: referrerId, // Match candidates with referrerId = referrerUser.userId (EJU####)
    };

    // Add role filter
    if (role && role !== "undefined") {
      query.role = role;
    }

    // Add search query if provided
    if (searchQuery && searchQuery.trim() !== "") {
      const sanitizedSearch = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      query.$or = [
        { name: { $regex: sanitizedSearch, $options: "i" } },
        { email: { $regex: sanitizedSearch, $options: "i" } },
        { mobile: { $regex: sanitizedSearch, $options: "i" } },
      ];
    }

    console.log(`Finding referred users for userId: ${referrerId}, query:`, query);

    // Fetch referred users (candidates where referrerId = this user's userId)
    const users = await User.find(query)
      .select("-password")
      .limit(limitNum)
      .skip((pageNum - 1) * limitNum)
      .sort({ createdAt: -1 });

    const total = await User.countDocuments(query);

    res.json({
      success: true,
      data: {
        users,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum) || 0,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching referred users:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching referred users",
      error: error.message,
    });
  }
};

// @desc    Get referred transactions for a specific user
// @route   GET /api/admin/getReferredTransactions/:userId
// @access  Private
const getReferredTransactions = async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    // Validate userId
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required",
      });
    }

    // Find the user by userId field (EJU####) - not MongoDB _id
    const referrerUser = await User.findOne({
      userId: userId,
    });

    if (!referrerUser) {
      return res.status(404).json({
        success: false,
        message: "User not found with the provided userId",
      });
    }

    // Use userId (EJU####) as referrerId for querying transactions
    // The referrerId in transactions should match this userId
    const referrerId = referrerUser.userId;
    
    if (!referrerId) {
      return res.status(400).json({
        success: false,
        message: "Referrer user does not have a userId assigned",
      });
    }

    // Validate page and limit
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 10;
    if (pageNum < 1 || limitNum < 1) {
      return res.status(400).json({
        success: false,
        message: "Page and limit must be positive integers",
      });
    }

    console.log(`Finding referred transactions for userId: ${referrerId}`);

    // Query transactions where referrerId matches the user's userId
    const transactions = await Transactions.find({
      referrerId: referrerId, // Match transactions with referrerId = referrerUser.userId (EJU####)
    })
      .limit(limitNum)
      .skip((pageNum - 1) * limitNum)
      .sort({ createdAt: -1 })
      .populate("userId", "name email -_id")
      .populate("assessmentId", "title -_id")
      .select(
        "transactionId createdAt assessmentId userId transactionAmount referrerId offerCode transactionStatus"
      );

    const total = await Transactions.countDocuments({
      referrerId: referrerId,
    });

    res.json({
      success: true,
      data: {
        transactions,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum) || 0,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching referred transactions:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching referred transactions",
      error: error.message,
    });
  }
};


const addCollegeTieUps = async (req, res) => {
  try {
    // Support both JSON (base64 in `logoUrl`) and multipart/form-data (file buffer in `req.file`)
    const { collegeName, location, order } = req.body || {};

    if (!collegeName || !location || order === undefined) {
      return res.status(400).json({
        success: false,
        message: "collegeName, location and order are required",
      });
    }

    let url;
    if (req.file) {
      // Multer memory storage provides file.buffer
      url = await uploadPublicFile({ file: req.file, folder: "college_tieups" });
    } else if (req.body && req.body.logoUrl) {
      // Accept base64 string in logoUrl
      url = await uploadPublicFile({ base64: req.body.logoUrl, fileName: `${collegeName}_logo`, folder: "college_tieups" });
    } else {
      return res.status(400).json({ success: false, message: "logo file or logoUrl (base64) is required" });
    }

    const tieup = await CollegeTieup.create({
      collegeName:collegeName,
      logoUrl: url,
      location,
      order,
    });

    res.status(201).json({ success: true, data: { tieup } });
  } catch (error) {
    console.log("Error adding college tie-up:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching college tie-ups",
      error: error.message,
    });
  }
}


const getCollegeTieUps = async (req, res) => {
  try {
    const tieups = await CollegeTieup.find().sort({ order: 1 });

    res.json({ success: true, data: tieups  });
  } catch (error) {
    console.log("Error fetching college tie-ups:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching college tie-ups",
      error: error.message,
    });
  }
}


const deleteCollegeTieUps = async (req, res) => {
  try {
    const { tieupId } = req.params;
    console.log("tieupId to delete:", tieupId);
    if (!tieupId) {
      return res.status(400).json({
        success: false,
        message: "tieupId parameter is required",
      });
    }
    const deletedTieup = await CollegeTieup.findByIdAndDelete(tieupId);

    if (!deletedTieup) {
      return res.status(404).json({
        success: false,
        message: "College tie-up not found",
      });
    }

    res.json({
      success: true,
      message: "College tie-up deleted successfully",
    });
  } catch (error) {
    console.log("Error deleting college tie-up:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting college tie-up",
      error: error.message,
    });
  }
}

const updateCollegeTieUp = async (req, res) => {
  try {
    const { tieupId } = req.params;
    const { collegeName, location, order,logoUrl } = req.body || {};
    console.log("tieupId to update:", req.body?.logoUrl);
    let imagaeUrl = req.body?.logoUrl;

 

    if (!collegeName || !location || order === undefined) {
      return res.status(400).json({
        success: false,
        message:
          "collegeName, imagaeUrl (or file), location and order are required",
      });
    }

    if(req.file && !imagaeUrl?.startsWith("https://")){
      imagaeUrl = await uploadPublicFile({ file: req.file, folder: "college_tieups" });
    }

    const updatedData = {
      collegeName,
      location,
      order,
    };

    

    if (imagaeUrl) {
      updatedData.logoUrl = imagaeUrl;
    }

    console.log("updatedData", updatedData);

   
    if(logoUrl){
     let url = await uploadPublicFile({
        base64: logoUrl,
        fileName: `${collegeName}_${Date.now()}_logo.png`,
        folder: "college_tieups",
      })
      updatedData.logoUrl = url;
    }

    const updatedTieup = await CollegeTieup.findByIdAndUpdate(
      tieupId,
      updatedData,
      { new: true }
    );

    if (!updatedTieup) {
      return res.status(404).json({
        success: false,
        message: "College tie-up not found",
      });
    }

    res.json({ success: true, data: { tieup: updatedTieup } });
  } catch (error) {
    console.log("Error updating college tie-up:", error);
    res.status(500).json({
      success: false,
      message: "Error updating college tie-up",
      error: error.message,
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
  updateUserStatus,
  getFranchiseUsers,
  getFranchiser,
  getFranchises,
  getTransactions,
  addFranchiser,
  getFranchiseTransactionsAndEarnings,
  getFranchiseTransactionsForEarlyjobs,
  addUser,
  getReferredUsers,
  getReferredTransactions,
  addCollegeTieUps,
  getCollegeTieUps,
  deleteCollegeTieUps,
  updateCollegeTieUp
};
