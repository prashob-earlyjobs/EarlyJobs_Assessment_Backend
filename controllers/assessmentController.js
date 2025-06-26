const Assessment = require('../models/Assessment');
const Result = require('../models/Result');
const { validationResult } = require('express-validator');

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
      return res.status(400).json({
        success: false,
        message: 'You have already taken this assessment'
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

module.exports = {
  getAssessments,
  getAssessment,
  submitAssessment
};
