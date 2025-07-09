const mongoose = require('mongoose');
const Assessment = require('../models/Assessment');
const Result = require('../models/Result');
const { validationResult } = require('express-validator');
const User = require('../models/User');
const axios = require('axios');

// @desc    Get all available assessments for candidates
// @route   GET /api/assessments
// @access  Private (Candidate)
const getAssessments = async (req, res) => {
  try {
    const { title,category, type, difficulty, page = 1, limit = 10 } = req.query;
    
    const query = { isActive: true };
    if (title) query.title = { $regex: title, $options: 'i' }; // Case-insensitive search
    if (category) query.category = category;
    if (type) query.type = type;
    if (difficulty) query.difficulty = difficulty;

    const assessments = await Assessment.find(query)
      .select('-questions.options.isCorrect -questions.testCases')
      .populate('createdBy', 'name')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 });

    const total = await Assessment.countDocuments(query);

    // Check which assessments user has already taken
    const takenAssessments = await Result.find({ 
      userId: req.user._id,
      assessmentId: { $in: assessments.map(a => a._id) }
    }).select('assessmentId');

    const assessmentsWithStatus = assessments.map(assessment => ({
      ...assessment.toObject(),
      isTaken: takenAssessments.some(ta => ta.assessmentId.toString() === assessment._id.toString())
    }));

    res.json({
      success: true,
      data: {
        assessments: assessmentsWithStatus,
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

// @desc    Get single assessment details
// @route   GET /api/assessments/:id
// @access  Private (Candidate)
const getAssessment = async (req, res) => {
  try {
    const assessment = await Assessment.findById(req.params.id)
      .select('-questions.options.isCorrect -questions.testCases.expectedOutput')
      .populate('createdBy', 'name');

    if (!assessment) {
      return res.status(404).json({
        success: false,
        message: 'Assessment not found'
      });
    }

    if (!assessment.isActive) {
      return res.status(400).json({
        success: false,
        message: 'Assessment is not active'
      });
    }

    // Check if user has already taken this assessment
    const existingResult = await Result.findOne({
      userId: req.user._id,
      assessmentId: assessment._id
    });

    if (existingResult) {
      return res.status(200).json({
        success: true,
        message: 'You have already taken this assessment',
        data: {assessment}
      });
    }

    res.json({
      success: true,
      data: { assessment }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching assessment',
      error: error.message
    });
  }
};

// @desc    Submit assessment answers
// @route   POST /api/assessments/submit
// @access  Private (Candidate)
const submitAssessment = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const { assessmentId, answers, timeTaken } = req.body;

    // Check if assessment exists
    const assessment = await Assessment.findById(assessmentId);
    if (!assessment || !assessment.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Assessment not found or inactive'
      });
    }

    // Check if user has already submitted
    const existingResult = await Result.findOne({
      userId: req.user._id,
      assessmentId
    });

    if (existingResult) {
      return res.status(400).json({
        success: false,
        message: 'Assessment already submitted'
      });
    }

    // Calculate score
    const { score, totalPoints, maxPoints, processedAnswers } = calculateScore(assessment, answers);

    // Determine pass/fail status
    const status = score >= assessment.passingScore ? 'pass' : 'fail';

    // Create result
    const result = await Result.create({
      userId: req.user._id,
      assessmentId,
      answers: processedAnswers,
      score,
      totalPoints,
      maxPoints,
      timeTaken,
      status,
      resultDetails: generateResultDetails(assessment, processedAnswers, score)
    });

    res.status(201).json({
      success: true,
      message: 'Assessment submitted successfully',
      data: {
        result: {
          _id: result._id,
          score: result.score,
          status: result.status,
          timeTaken: result.timeTaken,
          resultDetails: result.resultDetails
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error submitting assessment',
      error: error.message
    });
  }
};

// Helper function to calculate score
const calculateScore = (assessment, userAnswers) => {
  let totalPoints = 0;
  let maxPoints = 0;
  const processedAnswers = [];

  assessment.questions.forEach((question, index) => {
    const userAnswer = userAnswers.find(a => a.questionIndex === index);
    maxPoints += question.points;

    let isCorrect = false;
    let pointsEarned = 0;

    if (userAnswer) {
      switch (question.type) {
        case 'mcq':
          isCorrect = question.options[userAnswer.selectedOption]?.isCorrect || false;
          pointsEarned = isCorrect ? question.points : 0;
          break;
        case 'coding':
          // Simplified coding evaluation - in production, you'd run the code
          pointsEarned = userAnswer.testCasesPassed / userAnswer.totalTestCases * question.points;
          isCorrect = pointsEarned > 0;
          break;
        case 'video':
          // Video questions are typically manually reviewed
          pointsEarned = 0; // Will be updated after manual review
          isCorrect = false;
          break;
      }

      totalPoints += pointsEarned;
    }

    processedAnswers.push({
      questionId: question._id,
      type: question.type,
      ...userAnswer,
      isCorrect,
      pointsEarned
    });
  });

  const score = maxPoints > 0 ? Math.round((totalPoints / maxPoints) * 100) : 0;

  return { score, totalPoints, maxPoints, processedAnswers };
};

// Helper function to generate result details
const generateResultDetails = (assessment, answers, score) => {
  const categoryWiseScore = [];
  const strengths = [];
  const weaknesses = [];
  const recommendations = [];

  // Calculate category-wise performance
  const categories = [...new Set(assessment.questions.map(q => q.difficulty))];
  
  categories.forEach(category => {
    const categoryQuestions = assessment.questions.filter(q => q.difficulty === category);
    const categoryAnswers = answers.filter(a => {
      const question = assessment.questions.find(q => q._id.toString() === a.questionId.toString());
      return question && question.difficulty === category;
    });
    
    const categoryScore = categoryAnswers.reduce((sum, ans) => sum + ans.pointsEarned, 0);
    const maxCategoryScore = categoryQuestions.reduce((sum, q) => sum + q.points, 0);
    
    categoryWiseScore.push({
      category,
      score: categoryScore,
      maxScore: maxCategoryScore
    });

    // Determine strengths and weaknesses
    const categoryPercentage = maxCategoryScore > 0 ? (categoryScore / maxCategoryScore) * 100 : 0;
    if (categoryPercentage >= 70) {
      strengths.push(`Strong performance in ${category} questions`);
    } else if (categoryPercentage < 50) {
      weaknesses.push(`Needs improvement in ${category} questions`);
      recommendations.push(`Focus on practicing ${category} level problems`);
    }
  });

  // Overall recommendations based on score
  if (score >= 80) {
    recommendations.push('Excellent performance! You\'re ready for advanced challenges.');
  } else if (score >= 60) {
    recommendations.push('Good performance. Focus on weak areas for improvement.');
  } else {
    recommendations.push('Consider revisiting fundamental concepts before retaking.');
  }

  return {
    categoryWiseScore,
    strengths,
    weaknesses,
    recommendations
  };
};

const addAssessment = async (req, res) => {
  try {
    if (!req.user || !req.user._id) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: User not authenticated'
      });
    }

    const {
      title,
      description,
      tags,
      difficulty,
      timeLimit,
      questions,
      type,
      category,
      passingScore,
      assessmentId,
      pricing,
      offer,
      isPremium
    } = req.body;


    if (!title || !type || !category || !timeLimit || !pricing?.basePrice || !pricing?.discountedPrice || !offer?.title || !offer?.type || !offer?.value || !offer?.validUntil) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: title, type, category, timeLimit, pricing (basePrice, discountedPrice), and offer (title, type, value, validUntil) are required'
      });
    }

    // Check if assessmentId already exists
    if (assessmentId) {
      const existingAssessment = await Assessment.findOne({ assessmentId });
      if (existingAssessment) {
        return res.status(400).json({
          success: false,
          message: 'Assessment with this ID already exists'
        });
      }
    }

    const assessment = new Assessment({
      title: title.trim(),
      description: description?.trim() || '',
      type,
      category,
      timeLimit: parseInt(timeLimit),
      questions: questions || [],
      passingScore: passingScore || 60,
      isActive: true,
      createdBy: req.user._id,
      tags: tags || [],
      difficulty: difficulty || 'Intermediate',
      attempts: 0,
      averageScore: 0,
      completionRate: 0,
      createdDate: new Date(),
      assessmentId: assessmentId || null, // Optional field from API
      pricing: {
        basePrice: parseFloat(pricing.basePrice),
        discountedPrice: parseFloat(pricing.discountedPrice),
      },
      offer: {
        title: offer.title.trim(),
        type: offer.type,
        value: parseFloat(offer.value),
        validUntil: new Date(offer.validUntil),
      },
      isPremium: !!isPremium, // Ensure boolean value
    });

    if (parseFloat(pricing.discountedPrice) >= parseFloat(pricing.basePrice)) {
      return res.status(400).json({
        success: false,
        message: 'Discounted price must be less than base price'
      });
    }

    if (assessment.offer.validUntil <= new Date()) {
      return res.status(400).json({
        success: false,
        message: 'Offer expiration date must be in the future'
      });
    }

    const savedAssessment = await assessment.save();

    return res.status(201).json({
      success: true,
      message: 'Assessment created successfully',
      data: {
        id: savedAssessment._id,
        assessmentId: savedAssessment.assessmentId,
        title: savedAssessment.title,
        description: savedAssessment.description,
        type: savedAssessment.type,
        category: savedAssessment.category,
        timeLimit: savedAssessment.timeLimit,
        questions: savedAssessment.questions,
        passingScore: savedAssessment.passingScore,
        isActive: savedAssessment.isActive,
        createdBy: savedAssessment.createdBy,
        tags: savedAssessment.tags,
        difficulty: savedAssessment.difficulty,
        attempts: savedAssessment.attempts,
        averageScore: savedAssessment.averageScore,
        completionRate: savedAssessment.completionRate,
        createdDate: savedAssessment.createdDate,
        pricing: savedAssessment.pricing,
        offer: savedAssessment.offer,
        isPremium: savedAssessment.isPremium,
      }
    });

  } catch (error) {
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

const editAssessment = async (req, res) => {
  try {
    const { assessmentId } = req.params;
    const assessmentData = req.body;

    // Validate assessmentId
    if (!mongoose.Types.ObjectId.isValid(assessmentId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid assessment ID'
      });
    }

    // Find and update the assessment
    const updatedAssessment = await Assessment.findByIdAndUpdate(
      assessmentId,
      { $set: assessmentData },
      { 
        new: true, // Return the updated document
        runValidators: true // Ensure schema validation
      }
    );

    // Check if assessment exists
    if (!updatedAssessment) {
      return res.status(404).json({
        success: false,
        message: 'Assessment not found'
      });
    }

    // Return success response
    res.status(200).json({
      success: true,
      message: 'Assessment updated successfully',
      data: updatedAssessment
    });

  } catch (error) {
    
    // Handle specific validation errors
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors
      });
    }

    // Handle other errors
    res.status(500).json({
      success: false,
      message: 'Server error while updating assessment',
      error: error.message
    });
  }
};




const getAssessmentsByUser = async (req, res) => {
  try {
    const { userId } = req.params;

    // Fetch user data to get assessmentsPaid
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Extract assessmentId from assessmentsPaid
    const assessmentIds = user.assessmentsPaid.map(assessment => assessment.assessmentId);

    // Fetch assessments from the Assessment collection
    const assessments = await Assessment.find({ _id: { $in: assessmentIds } });

    return res.status(200).json({ success: true, data: assessments });
  } catch (error) {
    return res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};


const getUserStats = async (req, res) => {
  try {
    const { userId } = req.params;

    // Validate userId
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required',
      });
    }

    // Get total number of assessments
    const totalAssessments = await Assessment.countDocuments();

    // Get total number of assessments written by the user
    const userAssessments = await Result.countDocuments({ userId });

    res.json({
      success: true,
      data: {
        totalAssessments,
        userAssessments,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching user stats',
      error: error.message,
    });
  }
};

// @desc    Invite candidate to interview
// @route   POST /api/assessments/:id/interviews
// @access  Private (Admin)
exports.inviteCandidateToInterview = async (req, res) => {
  try {
    const { id } = req.params;
    const inviteData = req.body;

    // Extract Bearer token from incoming request
    const authHeader = req.headers.authorization;
    let bearerToken = '';
    if (authHeader && authHeader.startsWith('Bearer ')) {
      bearerToken = authHeader;
    }

    // Call the external API with the same data and Bearer token
    const apiUrl = `https://api.veloxhire.ai/api/assessment/${id}/interviews`;

    const response = await axios.post(apiUrl, [inviteData], {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': bearerToken
      }
    });

    return res.status(200).json({
      success: true,
      message: "Candidate invited to interview successfully",
      data: response.data
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Server error while inviting candidate",
      error: error?.response?.data || error.message
    });
  }
};

const storeAssessmentDetails = async (req, res) => {
  const { userId } = req.params;
  const {assessmentId,assessmentIdVelox,assessmentLink,interviewId,candidateId,linkExpiryTime} = req.body;

  try {
    const detailsToStore = {
      assessmentId: assessmentId,
      assessmentIdVelox: assessmentIdVelox,
      assessmentLink: assessmentLink,
      interviewId: interviewId || null,
      candidateId: candidateId,
      linkExpiryTime: linkExpiryTime
    };

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $push: { assessmentsPaid: detailsToStore } },
      { new: true, runValidators: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    return res.status(200).json({ success: true, data: updatedUser.assessmentsPaid });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to store assessment details', error: error.message });
  }
};

const matchAssessmentsDetails = async (req, res) => {
  const { userId, assessmentId } = req.params;

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const assessment = user.assessmentsPaid.find(
      (item) => item.assessmentIdVelox === assessmentId
    );

    if (!assessment) {
      return res.status(404).json({ success: false, message: 'Assessment not found for this user' });
    }
    const currentDate = new Date(); // 02:53 PM IST, July 09, 2025 (UTC: 2025-07-09T09:23:00Z)
    const linkExpiryTime = assessment.linkExpiryTime;

    // Debug the raw linkExpiryTime value

    // Validate and create expiryDate
    let expiryDate;
    if (linkExpiryTime && typeof linkExpiryTime === 'string' && !isNaN(Date.parse(linkExpiryTime))) {
      expiryDate = new Date(linkExpiryTime);
    } else if (linkExpiryTime instanceof Date && !isNaN(linkExpiryTime.getTime())) {
      expiryDate = linkExpiryTime;
    } else {
      return res.status(400).json({ success: false, message: 'Invalid or missing expiry time for assessment' });
    }

    // Log for debugging

    if (expiryDate < currentDate) {
      return res.status(400).json({ success: false, message: 'Assessment link has expired' });
    }

    return res.status(200).json({ success: true, data: assessment });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
  }
};

const getPaidAssessments = async (req, res) => {
  const { userId } = req.params;
  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    const paidAssessments = user.assessmentsPaid;
    return res.status(200).json({ success: true, data: paidAssessments });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
  }
};

module.exports = {
  getAssessments,
  getAssessment,
  submitAssessment,
  addAssessment,
  editAssessment,
  getAssessmentsByUser,
  getUserStats,
  storeAssessmentDetails,
  matchAssessmentsDetails,
  getPaidAssessments
};
