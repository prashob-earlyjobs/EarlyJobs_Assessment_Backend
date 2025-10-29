const mongoose = require("mongoose");
const Assessment = require("../models/Assessment");
const Result = require("../models/Result");
const { validationResult } = require("express-validator");
const User = require("../models/User");
const axios = require("axios");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

// @desc    Get all available assessments for candidates
// @route   GET /api/assessments
// @access  Private (Candidate)
const getAssessments = async (req, res) => {
  try {
    const {
      title,
      category,
      type,
      difficulty,
      page = 1,
      limit = 10,
    } = req.query;

    const query = { isActive: true };
    if (title) query.title = { $regex: title, $options: "i" }; // Case-insensitive search
    if (category) query.category = category;
    if (type) query.type = type;
    if (difficulty) query.difficulty = difficulty;

    const assessments = await Assessment.find(query)
      .select("-questions.options.isCorrect -questions.testCases")
      .populate("createdBy", "name")
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 });

    const total = await Assessment.countDocuments(query);

    // Check which assessments user has already taken

    res.json({
      success: true,
      data: {
        assessments: assessments,
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

// @desc    Get single assessment details
// @route   GET /api/assessments/:id
// @access  Private (Candidate)
const getAssessment = async (req, res) => {
  const id = req.params.id;

  const isValidObjectId = mongoose.Types.ObjectId.isValid(id);
  try {
    const assessment = await Assessment.findOne(
      isValidObjectId
        ? { $or: [{ _id: id }, { shortId: id }] }
        : { shortId: id }
    )
      .select(
        "-questions.options.isCorrect -questions.testCases.expectedOutput"
      )
      .populate("createdBy", "name");

    if (!assessment) {
      return res.status(404).json({
        success: false,
        message: "Assessment not found",
      });
    }

    if (!assessment.isActive) {
      return res.status(400).json({
        success: false,
        message: "Assessment is not active",
      });
    }

    // Check if user has already taken this assessment

    res.json({
      success: true,
      data: { assessment },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching assessment",
      error: error.message,
    });
  }
};
const getShortIdForUrl = async (req, res) => {
  try {
    const totalAssessments = await Assessment.countDocuments();

    const formattedId = "EJA" + String(totalAssessments + 1).padStart(4, "0");

    res.status(200).json({
      success: true,
      shortId: formattedId,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching assessment",
      error: error.message,
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
        message: "Validation errors",
        errors: errors.array(),
      });
    }

    const { assessmentId, answers, timeTaken } = req.body;

    // Check if assessment exists
    const assessment = await Assessment.findById(assessmentId);
    if (!assessment || !assessment.isActive) {
      return res.status(404).json({
        success: false,
        message: "Assessment not found or inactive",
      });
    }

    // Check if user has already submitted
    const existingResult = await Result.findOne({
      userId: req.user._id,
      assessmentId,
    });

    if (existingResult) {
      return res.status(400).json({
        success: false,
        message: "Assessment already submitted",
      });
    }

    // Calculate score
    const { score, totalPoints, maxPoints, processedAnswers } = calculateScore(
      assessment,
      answers
    );

    // Determine pass/fail status
    const status = score >= assessment.passingScore ? "pass" : "fail";

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
      resultDetails: generateResultDetails(assessment, processedAnswers, score),
    });

    res.status(201).json({
      success: true,
      message: "Assessment submitted successfully",
      data: {
        result: {
          _id: result._id,
          score: result.score,
          status: result.status,
          timeTaken: result.timeTaken,
          resultDetails: result.resultDetails,
        },
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error submitting assessment",
      error: error.message,
    });
  }
};

// Helper function to calculate score
const calculateScore = (assessment, userAnswers) => {
  let totalPoints = 0;
  let maxPoints = 0;
  const processedAnswers = [];

  assessment.questions.forEach((question, index) => {
    const userAnswer = userAnswers.find((a) => a.questionIndex === index);
    maxPoints += question.points;

    let isCorrect = false;
    let pointsEarned = 0;

    if (userAnswer) {
      switch (question.type) {
        case "mcq":
          isCorrect =
            question.options[userAnswer.selectedOption]?.isCorrect || false;
          pointsEarned = isCorrect ? question.points : 0;
          break;
        case "coding":
          // Simplified coding evaluation - in production, you'd run the code
          pointsEarned =
            (userAnswer.testCasesPassed / userAnswer.totalTestCases) *
            question.points;
          isCorrect = pointsEarned > 0;
          break;
        case "video":
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
      pointsEarned,
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
  const categories = [
    ...new Set(assessment.questions.map((q) => q.difficulty)),
  ];

  categories.forEach((category) => {
    const categoryQuestions = assessment.questions.filter(
      (q) => q.difficulty === category
    );
    const categoryAnswers = answers.filter((a) => {
      const question = assessment.questions.find(
        (q) => q._id.toString() === a.questionId.toString()
      );
      return question && question.difficulty === category;
    });

    const categoryScore = categoryAnswers.reduce(
      (sum, ans) => sum + ans.pointsEarned,
      0
    );
    const maxCategoryScore = categoryQuestions.reduce(
      (sum, q) => sum + q.points,
      0
    );

    categoryWiseScore.push({
      category,
      score: categoryScore,
      maxScore: maxCategoryScore,
    });

    // Determine strengths and weaknesses
    const categoryPercentage =
      maxCategoryScore > 0 ? (categoryScore / maxCategoryScore) * 100 : 0;
    if (categoryPercentage >= 70) {
      strengths.push(`Strong performance in ${category} questions`);
    } else if (categoryPercentage < 50) {
      weaknesses.push(`Needs improvement in ${category} questions`);
      recommendations.push(`Focus on practicing ${category} level problems`);
    }
  });

  // Overall recommendations based on score
  if (score >= 80) {
    recommendations.push(
      "Excellent performance! You're ready for advanced challenges."
    );
  } else if (score >= 60) {
    recommendations.push(
      "Good performance. Focus on weak areas for improvement."
    );
  } else {
    recommendations.push(
      "Consider revisiting fundamental concepts before retaking."
    );
  }

  return {
    categoryWiseScore,
    strengths,
    weaknesses,
    recommendations,
  };
};

const addAssessment = async (req, res) => {
  try {
    if (!req.user || !req.user._id) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: User not authenticated",
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
      shortId,
      isPremium,
    } = req.body;

    if (
      !title ||
      !type ||
      !category ||
      !timeLimit ||
      !pricing?.basePrice ||
      !pricing?.discountedPrice ||
      !offer?.title ||
      !offer?.type ||
      !offer?.value ||
      !offer?.validUntil ||
      !shortId
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Missing required fields: title, type, category, timeLimit, pricing (basePrice, discountedPrice), and offer (title, type, value, validUntil) are required",
      });
    }

    // Check if assessmentId already exists
    if (assessmentId) {
      const existingAssessment = await Assessment.findOne({ assessmentId });
      if (existingAssessment) {
        return res.status(400).json({
          success: false,
          message: "Assessment with this ID already exists",
        });
      }
    }

    const assessment = new Assessment({
      title: title.trim(),
      description: description?.trim() || "",
      type,
      category,
      timeLimit: parseInt(timeLimit),
      // questions: questions || [],
      shortId,
      passingScore: passingScore || 60,
      isActive: true,
      createdBy: req.user._id,
      tags: tags || [],
      difficulty: difficulty || "Intermediate",
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
        message: "Discounted price must be less than base price",
      });
    }

    if (assessment.offer.validUntil <= new Date()) {
      return res.status(400).json({
        success: false,
        message: "Offer expiration date must be in the future",
      });
    }

    const savedAssessment = await assessment.save();

    return res.status(201).json({
      success: true,
      message: "Assessment created successfully",
      data: {
        id: savedAssessment._id,
        assessmentId: savedAssessment.assessmentId,
        title: savedAssessment.title,
        description: savedAssessment.description,
        type: savedAssessment.type,
        category: savedAssessment.category,
        timeLimit: savedAssessment.timeLimit,
        shortId: savedAssessment.shortId,
        // questions: savedAssessment.questions,
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
      },
    });
  } catch (error) {
    if (error.name === "ValidationError") {
      const errors = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Internal server error",
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
        message: "Invalid assessment ID",
      });
    }

    // Find and update the assessment
    const updatedAssessment = await Assessment.findByIdAndUpdate(
      assessmentId,
      { $set: assessmentData },
      {
        new: true, // Return the updated document
        runValidators: true, // Ensure schema validation
      }
    );

    // Check if assessment exists
    if (!updatedAssessment) {
      return res.status(404).json({
        success: false,
        message: "Assessment not found",
      });
    }

    // Return success response
    res.status(200).json({
      success: true,
      message: "Assessment updated successfully",
      data: updatedAssessment,
    });
  } catch (error) {
    // Handle specific validation errors
    if (error.name === "ValidationError") {
      const errors = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors,
      });
    }

    // Handle other errors
    res.status(500).json({
      success: false,
      message: "Server error while updating assessment",
      error: error.message,
    });
  }
};

const getAssessmentsByUser = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    // Extract assessmentId from assessmentsPaid
    const assessmentIds = user.assessmentsPaid.map(
      (assessment) => assessment.assessmentId
    );

    // Fetch assessments from the Assessment collection
    const assessments = await Assessment.find({ _id: { $in: assessmentIds } });

    return res.status(200).json({ success: true, data: assessments });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};

const getUserStats = async (req, res) => {
  try {
    const { userId } = req.params;

    // Validate userId
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required",
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
      message: "Error fetching user stats",
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
    let bearerToken = "";
    if (authHeader && authHeader.startsWith("Bearer ")) {
      bearerToken = authHeader;
    }

    // Call the external API with the same data and Bearer token
    const apiUrl = `https://api.veloxhire.ai/api/assessment/${id}/interviews`;

    const response = await axios.post(apiUrl, [inviteData], {
      headers: {
        "Content-Type": "application/json",
        Authorization: bearerToken,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Candidate invited to interview successfully",
      data: response.data,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Server error while inviting candidate",
      error: error?.response?.data || error.message,
    });
  }
};

const storeAssessmentDetails = async (req, res) => {
  const { userId } = req.params;
  const {
    assessmentId,
    assessmentIdVelox,
    assessmentLink,
    interviewId,
    candidateId,
    linkExpiryTime,
  } = req.body;

  try {
    const detailsToStore = {
      assessmentId: assessmentId,
      assessmentIdVelox: assessmentIdVelox,
      assessmentLink: assessmentLink,
      interviewId: interviewId || null,
      candidateId: candidateId,
      linkExpiryTime: linkExpiryTime,
    };

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $push: { assessmentsPaid: detailsToStore } },
      { new: true, runValidators: true }
    );

    if (!updatedUser) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    return res
      .status(200)
      .json({ success: true, data: updatedUser.assessmentsPaid });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to store assessment details",
      error: error.message,
    });
  }
};

const matchAssessmentsDetails = async (req, res) => {
  const { userId, assessmentId } = req.params;

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    const assessment = user.assessmentsPaid.find(
      (item) => item.assessmentIdVelox === assessmentId
    );

    if (!assessment) {
      return res.status(404).json({
        success: false,
        message: "Assessment not found for this user",
      });
    }
    const currentDate = new Date(); // 02:53 PM IST, July 09, 2025 (UTC: 2025-07-09T09:23:00Z)
    const linkExpiryTime = assessment.linkExpiryTime;

    // Debug the raw linkExpiryTime value

    // Validate and create expiryDate
    let expiryDate;
    if (
      linkExpiryTime &&
      typeof linkExpiryTime === "string" &&
      !isNaN(Date.parse(linkExpiryTime))
    ) {
      expiryDate = new Date(linkExpiryTime);
    } else if (
      linkExpiryTime instanceof Date &&
      !isNaN(linkExpiryTime.getTime())
    ) {
      expiryDate = linkExpiryTime;
    } else {
      return res.status(400).json({
        success: false,
        message: "Invalid or missing expiry time for assessment",
      });
    }

    // Log for debugging

    if (expiryDate < currentDate) {
      return res.status(404).json({
        success: false,
        message: "Assessment not found for this user",
      });
      // return res
      //   .status(400)
      //   .json({ success: false, message: "Assessment link has expired" });
    }

    return res.status(200).json({ success: true, data: assessment });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

const getPaidAssessments = async (req, res) => {
  const { userId } = req.params;
  try {
    const user = await User.findById(userId);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }
    const paidAssessments = user.assessmentsPaid;
    return res.status(200).json({ success: true, data: paidAssessments });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

const getAssessmentSuggestions = async (req, res) => {
  try {
    const user = req.user;
    const userProfile = await User.findById(user.id);
    const { page = 1 } = req.query; // Get page from query

    // Validate profile completeness
    if (
      userProfile?.profile?.skills?.length === 0 ||
      userProfile?.professionalInformation?.experience === null ||
      userProfile?.professionalInformation?.experience === undefined
      // !userProfile?.preferredJobRole
    ) {
      return res.status(400).json({
        success: false,
        needsProfile: true,
        message:
          "Please complete your profile (skills, experience, preferred role) to get personalized suggestions",
      });
    }

    // Fetch all active assessments
    const allAssessments = await Assessment.find({ isActive: true });

    // STEP 1: Filter Categories using User Profile (Gemini AI)
    const categoryResult = await filterCategoriesByUserProfile(userProfile);

    // STEP 2: Filter Assessments by Filtered Categories
    const categoryFiltered = allAssessments.filter((assessment) =>
      categoryResult.relevantCategories.includes(assessment.category)
    );

    // STEP 3: Filter Assessments by User Experience vs Assessment Difficulty
    const difficultyFiltered = filterByDifficultyAndExperience(
      userProfile,
      categoryFiltered
    );
    console.log("difficultyFiltered", difficultyFiltered.length);

    // STEP 4: Filter and Sort Assessments by User Skills vs Assessment Tags (Fast Rule-based)
    const skillsFiltered = filterBySkillsAndTagsFast(
      userProfile,
      difficultyFiltered
    );
    console.log("skillsFiltered", skillsFiltered.length);

    // Apply pagination (simple and fast)
    const pageNumber = parseInt(page);
    const pageSize = 10;
    const startIdx = (pageNumber - 1) * pageSize;
    const endIdx = startIdx + pageSize;
    const paginatedResults = skillsFiltered.slice(startIdx, endIdx);

    // Sort paginated results by category priority
    const sortedFinalAssessments = paginatedResults.sort((a, b) => {
      const indexA = categoryResult.relevantCategories.indexOf(a.category);
      const indexB = categoryResult.relevantCategories.indexOf(b.category);
      if (indexA !== -1 && indexB !== -1) {
        return indexA - indexB;
      }
      return 0;
    });

    res.status(200).json({
      success: true,

      suggestions: sortedFinalAssessments,
      insights: {
        relevantCategories: categoryResult.relevantCategories,
        categoryReasoning: categoryResult.reasoning,
        categoryPriority: categoryResult.priorityLevel,
      },
      filteringStats: {
        total: allAssessments.length,
        step1_relevantCategories: categoryResult.relevantCategories.length,
        step2_afterCategoryFilter: categoryFiltered.length,
        step3_afterDifficultyFilter: difficultyFiltered.length,
        step4_afterSkillsFilter: skillsFiltered.length,
        finalAssessments: sortedFinalAssessments.length,
      },
      pagination: {
        currentPage: pageNumber,
        totalPages: Math.ceil(skillsFiltered.length / pageSize),
        pageSize: pageSize,
        totalResults: skillsFiltered.length,
        hasMore: endIdx < skillsFiltered.length,
      },
    });
  } catch (error) {
    console.error("Suggestion API error:", error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// ============================================
// STEP 1: Filter Categories using User Profile (Gemini AI)
// ============================================
async function filterCategoriesByUserProfile(userProfile) {
  console.log("userProfile", userProfile);
  const allCategories = [
    "Aptitude & Reasoning",
    "Sales & Marketing",
    "Customer Support & BPO",
    "Data Entry & Back Office",
    "Operations & Admin",
    "Human Resources & Recruitment",
    "Finance & Accounts",
    "IT & Technical Support",
    "Technical",
    "Non-Technical",
    "Retail & E-commerce",
    "Hospitality & Front Desk",
    "Healthcare (Non-Clinical)",
    "Internship & Fresher Readiness",
    "Behavioral & Soft Skills",
    "Others",
  ];
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
  console.log(`${userProfile?.profile?.skills?.join(", ")}`);
  const prompt = `
You are an expert at matching job roles and user backgrounds with assessment categories.

USER PROFILE:
- Preferred Job Role: ${userProfile.preferredJobRole || "Not specified"}
- Current Job Title: ${userProfile.professionalInformation?.currentJobTitle || "Not specified"}
- Education: ${JSON.stringify(userProfile.professionalInformation?.education || [])}
- Bio: ${userProfile.bio || "Not specified"}
- Skills: ${userProfile?.profile?.skills?.join(", ") || "Not specified"}
- Experience: ${userProfile.professionalInformation?.experience || 0} years

AVAILABLE ASSESSMENT CATEGORIES:
${allCategories.map((cat, idx) => `${idx + 1}. ${cat}`).join("\n")}

TASK:
Analyze the user's profile and identify which assessment CATEGORIES are most relevant for their career profile, background, and goals.

Consider:
1. Their preferred job role or current job title
2. Their educational background
3. Their stated skills
4. Career progression path
5. Industry standards for their role
6. Experience level

IMPORTANT: 
- Only return CATEGORIES, not specific assessments
- Be generous in category matching (select 4-8 relevant categories)
- Consider adjacent/related categories for career growth
- Sort categories by relevance (most relevant first)

Return ONLY valid JSON (no markdown, no code blocks):
{
  "relevantCategories": ["Category 1", "Category 2", "Category 3"],
  "reasoning": "Brief explanation of why these categories match the user profile",
  "priorityLevel": {
    "high": ["Category 1"],
    "medium": ["Category 2", "Category 3"]
  }
}
`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response.text();
    const cleanResponse = response
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();
    const aiResult = JSON.parse(cleanResponse);
    console.log("aiResult", aiResult);
    // Return only categories, no assessments
    return aiResult;
  } catch (error) {
    console.error("Category filtering error:", error);
    // Fallback: return basic categories
    return {
      relevantCategories: ["Aptitude & Reasoning", "Behavioral & Soft Skills"],
      reasoning: "Default categories suitable for all profiles",
      priorityLevel: {
        high: ["Aptitude & Reasoning"],
        medium: ["Behavioral & Soft Skills"],
      },
    };
  }
}

// ============================================
// STEP 3: Filter Assessments by User Experience vs Difficulty
// ============================================
function filterByDifficultyAndExperience(userProfile, assessments) {
  const experience = userProfile.professionalInformation?.experience || 0;

  return assessments.filter((assessment) => {
    const difficulty = assessment.difficulty?.toLowerCase() || "";

    // Fresher/0-1 year: Beginner and Intermediate
    if (experience <= 1) {
      return difficulty === "beginner" || difficulty === "intermediate";
    }

    // 1-3 years: Beginner, Intermediate, and some Advanced
    if (experience > 1 && experience <= 3) {
      return (
        difficulty === "beginner" ||
        difficulty === "intermediate" ||
        difficulty === "advanced"
      );
    }

    // 3+ years: All levels (Intermediate and Advanced prioritized)
    if (experience > 3) {
      return true; // Include all difficulty levels
    }

    return true; // Default: include all
  });
}

// ============================================
// STEP 4: Fast Rule-Based Filter by User Skills vs Assessment Tags
// ============================================
function filterBySkillsAndTagsFast(userProfile, assessments) {
  const userSkills = userProfile?.profile?.skills || [];

  // If no skills, return all assessments
  if (userSkills.length === 0) {
    return assessments;
  }

  // Normalize skills for better matching
  const normalizedUserSkills = userSkills.map((skill) =>
    skill.toLowerCase().trim()
  );

  // Common skill synonyms and related terms for semantic matching
  const skillSynonyms = {
    js: ["javascript", "js", "node", "nodejs"],
    javascript: ["javascript", "js", "node", "nodejs", "frontend", "web"],
    react: ["react", "reactjs", "frontend", "javascript", "web"],
    python: ["python", "django", "flask", "backend", "data"],
    java: ["java", "spring", "backend"],
    ml: ["machine learning", "ml", "ai", "data science"],
    "machine learning": ["machine learning", "ml", "ai", "data science"],
    ai: ["ai", "artificial intelligence", "ml", "machine learning"],
    sql: ["sql", "database", "mysql", "postgresql"],
    html: ["html", "css", "frontend", "web"],
    css: ["css", "html", "frontend", "web"],
  };

  // Score each assessment based on skill match
  const scoredAssessments = assessments.map((assessment) => {
    const assessmentTags = (assessment.tags || []).map((tag) =>
      tag.toLowerCase().trim()
    );
    const assessmentTitle = assessment.title?.toLowerCase() || "";
    const assessmentCategory = assessment.category?.toLowerCase() || "";

    let matchScore = 0;

    normalizedUserSkills.forEach((userSkill) => {
      // Direct match in tags
      if (assessmentTags.includes(userSkill)) {
        matchScore += 10; // High score for direct match
      }

      // Check if skill appears in title
      if (assessmentTitle.includes(userSkill)) {
        matchScore += 8;
      }

      // Check if skill appears in category
      if (assessmentCategory.includes(userSkill)) {
        matchScore += 5;
      }

      // Semantic/synonym matching
      const relatedSkills = skillSynonyms[userSkill] || [];
      assessmentTags.forEach((tag) => {
        if (relatedSkills.includes(tag)) {
          matchScore += 6; // Medium score for related match
        }
      });

      // Partial match (contains)
      assessmentTags.forEach((tag) => {
        if (tag.includes(userSkill) || userSkill.includes(tag)) {
          matchScore += 3; // Lower score for partial match
        }
      });
    });

    return {
      ...(assessment._doc || assessment), // Handle mongoose document
      matchScore,
    };
  });

  // Filter out assessments with score 0 and sort by score (highest first)
  const filteredAndSorted = scoredAssessments
    .filter((a) => a.matchScore > 0)
    .sort((a, b) => b.matchScore - a.matchScore);

  // If no matches found, return all assessments (fallback)
  if (filteredAndSorted.length === 0) {
    return assessments;
  }

  return filteredAndSorted;
}

// ============================================
// (OLD - NOT USED) Filter Assessments by User Skills vs Assessment Tags (Gemini AI) with Batching
// ============================================
async function filterBySkillsAndTagsWithBatching(
  userProfile,
  assessments,
  startIndex = 0
) {
  const BATCH_SIZE = 20; // Process 20 assessments at a time
  const TARGET_MATCHES = 10; // Stop when we have 10 matches per page

  let currentIndex = startIndex; // Start from where previous page left off
  let matchedAssessments = [];

  console.log(
    `Starting batch processing from index ${startIndex} out of ${assessments.length} total assessments`
  );

  // Process batches until we have TARGET_MATCHES or run out of assessments
  while (
    currentIndex < assessments.length &&
    matchedAssessments.length < TARGET_MATCHES
  ) {
    const batchEnd = Math.min(currentIndex + BATCH_SIZE, assessments.length);
    const batch = assessments.slice(currentIndex, batchEnd);

    console.log(
      `Processing batch: assessments ${currentIndex}-${batchEnd} (${batch.length} items)`
    );
    console.log(
      `Matches so far: ${matchedAssessments.length}/${TARGET_MATCHES}`
    );

    // Send this batch to Gemini AI for filtering
    const batchMatches = await filterBySkillsAndTags(userProfile, batch);

    console.log(`Batch returned ${batchMatches.length} matches`);

    // Add matched assessments to our results
    matchedAssessments = matchedAssessments.concat(batchMatches);

    // Move to next batch
    currentIndex = batchEnd;

    // If we have enough matches, we can stop
    if (matchedAssessments.length >= TARGET_MATCHES) {
      console.log(`Target of ${TARGET_MATCHES} matches reached!`);
      break;
    }
  }

  // Return only up to TARGET_MATCHES (in case we got more)
  const finalResults = matchedAssessments.slice(0, TARGET_MATCHES);

  return {
    filteredAssessments: finalResults,
    nextStartIndex: currentIndex, // Frontend will send this for next page
    hasMore:
      currentIndex < assessments.length ||
      matchedAssessments.length > TARGET_MATCHES,
    totalProcessed: currentIndex,
    totalMatches: finalResults.length,
  };
}

// ============================================
// STEP 4 Helper: Filter Assessments by User Skills vs Assessment Tags (Gemini AI)
// ============================================
async function filterBySkillsAndTags(userProfile, assessments) {
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const prompt = `
You are an expert at matching user skills with assessment tags and content.

USER SKILLS:
${userProfile.skills?.join(", ") || "Not specified"}

USER PROFILE CONTEXT:
- Job Role: ${userProfile.preferredJobRole || "Not specified"}
- Experience: ${userProfile.professionalInformation?.experience || 0} years
- Current Role: ${userProfile.professionalInformation?.currentJobTitle || "Not specified"}
- Bio: ${userProfile.bio || "Not specified"}

ASSESSMENTS TO EVALUATE:
${JSON.stringify(
  assessments.map((a) => ({
    id: a._id,
    title: a.title,
    category: a.category,
    tags: a.tags,
    difficulty: a.difficulty,
  })),
  null,
  2
)}

TASK:
Intelligently match user skills with assessment tags and content. Filter assessments that align with the user's skillset.

Matching Logic:
1. DIRECT MATCH: User skill directly matches assessment tags (Highest priority)
2. RELATED SKILLS: User skill is semantically related to assessment tags
   Examples: "React" relates to "Frontend", "JavaScript", "Web Development"
             "Python" relates to "Data Science", "Machine Learning", "Backend"
3. COMPLEMENTARY: Skills that complement user's existing skillset (for skill growth)
4. FOUNDATIONAL: Core assessments for the user's domain/role

IMPORTANT:
- Be intelligent about semantic matching (e.g., "JS" = "JavaScript", "ML" = "Machine Learning")
- Consider synonyms and related technologies
- Include assessments that help fill skill gaps for their target role
- Return assessments sorted by relevance (best matches first)

Return ONLY valid JSON (no markdown, no code blocks):
{
  "selectedAssessmentIds": ["id1", "id2", "id3", ...],
  "skillMatchAnalysis": {
    "directMatches": ["assessmentId1"],
    "relatedMatches": ["assessmentId2"],
    "complementary": ["assessmentId3"]
  },
  "reasoning": "Brief explanation of the skill matching logic applied"
}
`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response.text();
    const cleanResponse = response
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();
    const aiResult = JSON.parse(cleanResponse);

    // Filter and sort assessments based on AI selection
    const selectedAssessments = assessments.filter((a) =>
      aiResult.selectedAssessmentIds.includes(a._id.toString())
    );

    // Sort by the order returned by AI (which prioritizes best matches)
    return selectedAssessments.sort((a, b) => {
      const indexA = aiResult.selectedAssessmentIds.indexOf(a._id.toString());
      const indexB = aiResult.selectedAssessmentIds.indexOf(b._id.toString());
      return indexA - indexB;
    });
  } catch (error) {
    console.error("Skills filtering error:", error);
    // Fallback: return all assessments (no filtering)
    return assessments;
  }
}

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
  getPaidAssessments,
  getShortIdForUrl,
  getAssessmentSuggestions,
};
