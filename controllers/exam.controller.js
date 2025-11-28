const Exam = require("../models/Exam");
const UsedQuestion = require("../models/UsedQuestion");

const { GoogleGenerativeAI } = require("@google/generative-ai");
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Helper function to normalize department name for comparison
const normalizeDepartment = (dept) => {
  if (!dept) return null;
  const normalized = dept.toLowerCase().trim();
  // Check for IT or Computer Engineering variations
  if (
    normalized.includes("it") ||
    normalized.includes("information technology") ||
    normalized.includes("computer engineering") ||
    normalized.includes("computer science") ||
    normalized.includes("cs") ||
    normalized.includes("cse")
  ) {
    return "it";
  }
  return normalized;
};

// Helper function to get department display name for question generation
const getDepartmentDisplayName = (dept) => {
  if (!dept) return "Engineering";
  const normalized = dept.toLowerCase().trim();
  
  // Map common variations to standard names
  if (normalized.includes("human resource") || normalized.includes("hr")) {
    return "Human Resources";
  }
  if (normalized.includes("civil")) {
    return "Civil Engineering";
  }
  if (normalized.includes("business administration") || normalized.includes("bba") || normalized.includes("mba")) {
    return "Business Administration";
  }
  if (normalized.includes("mechanical")) {
    return "Mechanical Engineering";
  }
  if (normalized.includes("electrical")) {
    return "Electrical Engineering";
  }
  
  // Return capitalized version of the department
  return dept.charAt(0).toUpperCase() + dept.slice(1).toLowerCase();
};

// 1. Generate Questions - IT/Computer Engineering (3 questions)
const generateITQuestions = async (usedQuestions = []) => {
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
  const createPrompt = (
    usedQ
  ) => `Generate exactly 3 unique, beginner-to-intermediate level questions in common programming.
 Make sure that the questions are unique from the provided list of used questions.
 Question selection rules: 
 - The first 2 questions should be short-answer conceptual questions.
 - The 3rd question should be a coding/logic question that can be answered in any programming language.
 
 To ensure variety, randomly choose questions from the following categories: 
 • Variables and Data Types 
 • Operators and Expressions 
 • Conditional Statements (if/else, switch) 
 • Loops (for, while, do-while) 
 • Functions and Scope 
 • Arrays and Strings 
 • Object-Oriented Programming (classes, objects, inheritance) 
 • Data Structures (stack, queue, linked list, etc.) 
 • Algorithms (sorting, searching, recursion) 
 • Debugging and Error Handling 
 • Input/Output operations 
 • Pattern Printing 
 
 Rules for the 3rd (coding/logic) question: 
 - Randomly pick from one of these types: 
   • Array-based problem (sum, max, reverse, etc.) 
   • String manipulation (palindrome, count vowels, etc.) 
   • Loop/condition logic (factors, prime, etc.) 
   • Pattern printing (triangle, pyramid, etc.) 
   • Simple algorithm (searching, sorting, recursion).
 - If the question involves a pattern, show the expected output in proper multi-line format (not a single line). 
 
 For each question, provide: 
 1. The question text.
 2. A brief correct answer explanation (for validation later). 
 
 Exclude any questions from this list: ${JSON.stringify(usedQ)}.
 
 Respond ONLY with valid JSON array in the format: 
 [{"question": "...", "expectedAnswer": "..."}, ...]`;

  const prompt = createPrompt(usedQuestions);
  console.log("IT Questions Generation - Used questions in prompt:", {
    count: usedQuestions.length,
    included: usedQuestions.length > 0
  });

  const result = await model.generateContent(prompt);
  const response = await result.response;
  let text = response.text();

  text = text.replace(/```json|```/g, "").trim();

  try {
    return JSON.parse(text);
  } catch (err) {
    console.error("JSON Parse Error:", err);
    console.error("Gemini raw output:", text);
    throw new Error("Failed to parse questions from Gemini");
  }
};

// 2. Generate Questions - Other Branches (10 questions, stream-specific)
const generateStreamQuestions = async (department, usedQuestions = []) => {
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
  const deptDisplayName = getDepartmentDisplayName(department);
  
  // Determine if it's an engineering field or business/HR field
  const isEngineering = 
    deptDisplayName.toLowerCase().includes("engineering") ||
    deptDisplayName.toLowerCase().includes("civil") ||
    deptDisplayName.toLowerCase().includes("mechanical") ||
    deptDisplayName.toLowerCase().includes("electrical");
  
  const isBusiness = 
    deptDisplayName.toLowerCase().includes("business") ||
    deptDisplayName.toLowerCase().includes("administration");
  
  const isHR = 
    deptDisplayName.toLowerCase().includes("human resource") ||
    deptDisplayName.toLowerCase().includes("hr");

  const createPrompt = (
    stream,
    usedQ,
    fieldType
  ) => {
    let basePrompt = `Generate exactly 10 unique, beginner-to-intermediate level questions specifically related to ${stream}.
 Make sure that the questions are unique from the provided list of used questions.
 
 Question requirements:`;

    if (isEngineering) {
      basePrompt += `
 - All 10 questions must be directly related to ${stream} concepts, principles, and applications.
 - Questions should cover fundamental topics in ${stream} such as:
   • Core concepts and principles
   • Design and analysis
   • Materials and manufacturing (if applicable)
   • Systems and applications
   • Problem-solving scenarios
   • Calculations and formulas (if applicable)
   • Industry practices and standards
   • Safety and regulations
 - Mix of question types: conceptual (short answer), analytical, and problem-solving.
 - Questions should be appropriate for undergraduate level students.`;
    } else if (isBusiness) {
      basePrompt += `
 - All 10 questions must be directly related to ${stream} concepts, principles, and practices.
 - Questions should cover fundamental topics in ${stream} such as:
   • Management principles and theories
   • Organizational behavior
   • Marketing and sales
   • Finance and accounting basics
   • Human resource management
   • Operations management
   • Business strategy and planning
   • Entrepreneurship
   • Business ethics and corporate governance
   • Case studies and real-world scenarios
 - Mix of question types: conceptual (short answer), analytical, and scenario-based problem-solving.
 - Questions should be appropriate for undergraduate level students.`;
    } else if (isHR) {
      basePrompt += `
 - All 10 questions must be directly related to ${stream} concepts, principles, and practices.
 - Questions should cover fundamental topics in ${stream} such as:
   • Recruitment and selection processes
   • Employee onboarding and training
   • Performance management
   • Compensation and benefits
   • Employee relations and engagement
   • HR policies and procedures
   • Labor laws and compliance
   • Talent management
   • Organizational development
   • HR analytics and metrics
 - Mix of question types: conceptual (short answer), analytical, and scenario-based problem-solving.
 - Questions should be appropriate for undergraduate level students.`;
    } else {
      basePrompt += `
 - All 10 questions must be directly related to ${stream} concepts, principles, and applications.
 - Questions should cover fundamental topics in ${stream} such as:
   • Core concepts and principles
   • Practical applications
   • Problem-solving scenarios
   • Industry practices and standards
 - Mix of question types: conceptual (short answer), analytical, and problem-solving.
 - Questions should be appropriate for undergraduate level students.`;
    }

    basePrompt += `
 
 For each question, provide: 
 1. The question text (clearly related to ${stream}).
 2. A brief correct answer explanation (for validation later). 
 
 Exclude any questions from this list: ${JSON.stringify(usedQ)}.
 
 Respond ONLY with valid JSON array in the format: 
 [{"question": "...", "expectedAnswer": "..."}, ...]`;

    return basePrompt;
  };

  const fieldType = isEngineering ? "engineering" : isBusiness ? "business" : isHR ? "hr" : "general";
  const prompt = createPrompt(deptDisplayName, usedQuestions, fieldType);
  console.log("Stream Questions Generation - Used questions in prompt:", {
    department: deptDisplayName,
    count: usedQuestions.length,
    included: usedQuestions.length > 0
  });

  const result = await model.generateContent(prompt);
  const response = await result.response;
  let text = response.text();

  text = text.replace(/```json|```/g, "").trim();

  try {
    return JSON.parse(text);
  } catch (err) {
    console.error("JSON Parse Error:", err);
    console.error("Gemini raw output:", text);
    throw new Error("Failed to parse questions from Gemini");
  }
};

const validateAnswer = async (question, userAnswer) => {
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
  const prompt = `Question: ${question}
User Answer: ${userAnswer}

Evaluate if the user's answer is correct. Respond ONLY with valid JSON:
{"isCorrect": true/false, "score": 0-1, "feedback": "Brief explanation"}`;

  const result = await model.generateContent(prompt);
  const response = await result.response;
  let text = response.text();

  // 🔥 Clean up possible code fences
  text = text.replace(/```json|```/g, "").trim();

  try {
    return JSON.parse(text);
  } catch (err) {
    console.error("JSON Parse Error:", err);
    console.error("Gemini raw output:", text); // log raw response for debugging
    return { isCorrect: false, score: 0, feedback: "Unable to evaluate" };
  }
};

// 1. Register User and Generate Questions
const registerCandidate = async (req, res) => {
  try {
    console.log("=== REGISTER CANDIDATE START ===");
    const { fullName, email, phone, college, department } = req.body;
    console.log("Request body:", { fullName, email, phone, college, department });

    // Determine if IT/Computer Engineering or other branch
    const normalizedDept = normalizeDepartment(department);
    const isITBranch = normalizedDept === "it";
    const questionCount = isITBranch ? 3 : 10;
    console.log("Department analysis:", { department, normalizedDept, isITBranch, questionCount });

    // Find the single document storing all used questions
    console.log("Fetching used questions document...");
    let usedQuestionsDoc = await UsedQuestion.findOne({});
    let usedQuestions = [];
    let usedQuestionsDocId = null;
    
    if (usedQuestionsDoc) {
      usedQuestionsDocId = usedQuestionsDoc._id;
      const totalUsedQuestions = usedQuestionsDoc.questions?.length || 0;
      console.log("Found used questions document:", { 
        docId: usedQuestionsDocId, 
        version: usedQuestionsDoc.__v,
        totalUsedQuestions: totalUsedQuestions
      });
      
      // Use the last 30 added questions for uniqueness checking
      const questionsToCheck = 30;
      const allUsedQuestions = (usedQuestionsDoc.questions || []);
      
      if (allUsedQuestions.length > questionsToCheck) {
        // Use the most recent ones (last 30)
        usedQuestions = allUsedQuestions.slice(-questionsToCheck);
        console.log(`Using last ${usedQuestions.length} used questions for context (out of ${totalUsedQuestions} total)`);
      } else {
        // Use all questions if less than 30
        usedQuestions = allUsedQuestions;
        console.log(`Using all ${usedQuestions.length} used questions for context (less than ${questionsToCheck})`);
      }
    } else {
      console.log("No used questions document found, will create/upsert one");
      usedQuestions = [];
    }
    
    console.log("Used questions being passed to AI:", {
      count: usedQuestions.length,
      sample: usedQuestions.slice(0, 3) // Log first 3 as sample
    });

    // Generate new questions based on department
    console.log("Generating questions...");
    let questionsData;
    if (isITBranch) {
      questionsData = await generateITQuestions(usedQuestions);
    } else {
      // Use the department name for stream-specific questions (will be normalized in the function)
      questionsData = await generateStreamQuestions(department || "Engineering", usedQuestions);
    }
    console.log("Generated", questionsData.length, "questions");

    const newQuestions = questionsData.map((q) => q.question);
    console.log("New questions extracted:", newQuestions.length);

    // Update the used questions document atomically using findOneAndUpdate
    // This prevents version conflicts when multiple requests update simultaneously
    console.log("Updating used questions document atomically...");
    try {
      // Use $addToSet to add unique questions atomically
      // This prevents version conflicts and ensures uniqueness
      const updateResult = await UsedQuestion.findOneAndUpdate(
        usedQuestionsDocId ? { _id: usedQuestionsDocId } : {},
        {
          $addToSet: {
            questions: { $each: newQuestions }
          }
        },
        {
          upsert: true, // Create if doesn't exist
          new: true, // Return updated document
          setDefaultsOnInsert: true
        }
      );
      console.log("Used questions document updated successfully:", {
        docId: updateResult._id,
        version: updateResult.__v,
        totalQuestions: updateResult.questions?.length || 0
      });
    } catch (usedQErr) {
      console.error("Error updating used questions document:", {
        error: usedQErr.message,
        errorName: usedQErr.name,
        docId: usedQuestionsDocId
      });
      // Continue even if this fails, as it's not critical for exam registration
      // The questions will still be generated and saved to the exam
    }

    // Check if user already has an exam session
    console.log("Checking for existing exam with email:", email);
    let existingExam = await Exam.findOne({ email });
    
    if (existingExam) {
      console.log("Found existing exam:", {
        examId: existingExam._id,
        currentVersion: existingExam.__v,
        currentStatus: existingExam.status,
        currentQuestionsCount: existingExam.questions?.length || 0
      });
    } else {
      console.log("No existing exam found, will create new one");
    }

    let exam;
    if (existingExam) {
      // Use findOneAndUpdate to handle version conflicts atomically
      console.log("Updating existing exam...");
      try {
        exam = await Exam.findOneAndUpdate(
          { 
            _id: existingExam._id,
            // Optionally add version check to prevent stale updates
          },
          {
            $set: {
              questions: newQuestions,
              status: "questions_generated",
              ...(department !== undefined && { department: department }),
              fullName: fullName,
              phone: phone,
              college: college,
            }
          },
          { 
            new: true, // Return updated document
            runValidators: true,
            // Remove version check to allow updates even if version changed
            // This handles concurrent updates better
          }
        );
        console.log("Exam updated successfully:", {
          examId: exam._id,
          newVersion: exam.__v,
          questionsCount: exam.questions?.length || 0
        });
      } catch (updateErr) {
        console.error("Error updating exam:", {
          error: updateErr.message,
          errorName: updateErr.name,
          examId: existingExam._id,
          examVersion: existingExam.__v
        });
        
        // If version conflict, retry with fresh fetch
        if (updateErr.name === 'VersionError' || updateErr.message.includes('version')) {
          console.log("Version conflict detected, retrying with fresh fetch...");
          const freshExam = await Exam.findById(existingExam._id);
          if (freshExam) {
            exam = await Exam.findOneAndUpdate(
              { _id: freshExam._id },
              {
                $set: {
                  questions: newQuestions,
                  status: "questions_generated",
                  ...(department !== undefined && { department: department }),
                  fullName: fullName,
                  phone: phone,
                  college: college,
                }
              },
              { new: true, runValidators: true }
            );
            console.log("Retry successful, exam updated:", {
              examId: exam._id,
              newVersion: exam.__v
            });
          } else {
            throw new Error("Exam not found during retry");
          }
        } else {
          throw updateErr;
        }
      }
    } else {
      // Create a new exam session
      console.log("Creating new exam session...");
      exam = new Exam({
        fullName,
        email,
        phone,
        college,
        department,
        questions: newQuestions,
        status: "questions_generated",
      });
      try {
        await exam.save();
        console.log("New exam created successfully:", {
          examId: exam._id,
          version: exam.__v,
          questionsCount: exam.questions?.length || 0
        });
      } catch (saveErr) {
        console.error("Error saving new exam:", {
          error: saveErr.message,
          errorName: saveErr.name,
          email: email
        });
        throw saveErr;
      }
    }

    console.log("=== REGISTER CANDIDATE SUCCESS ===");
    res.status(201).json({
      message: "Registration successful",
      examId: exam._id,
      questions: exam.questions,
      questionCount: exam.questions.length,
    });
  } catch (err) {
    console.error("=== REGISTER CANDIDATE ERROR ===");
    console.error("Error details:", {
      message: err.message,
      name: err.name,
      stack: err.stack,
      email: req.body?.email
    });
    res.status(500).json({ 
      message: err.message,
      error: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
};

const getallusers = async (req, res) => {
  try {
    // query params
    const { page = 1, limit = 10, search = "" } = req.query;

    // search condition (modify according to your schema fields)
    let query = {};
    if (search) {
      query = {
        $or: [
          { name: { $regex: search, $options: "i" } }, // case-insensitive
          { email: { $regex: search, $options: "i" } },
        ],
      };
    }

    // pagination logic
    const skip = (Number(page) - 1) * Number(limit);

    const users = await Exam.find(query).skip(skip).limit(Number(limit));

    const total = await Exam.countDocuments(query);

    res.json({
      total, // total matching records
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / limit),
      users,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// 2. Get Questions for Exam
const getQuestions = async (req, res) => {
  try {
    const { examId } = req.params;
    console.log("examId", examId);
    const exam = await Exam.findById(examId).select("questions status");
    if (!exam) {
      return res.status(404).json({ message: "Exam session not found" });
    }
    if (exam.status !== "questions_generated") {
      return res
        .status(400)
        .json({ message: "Questions already accessed or exam completed" });
    }
    res.json({ questions: exam.questions, status: exam.status });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// 3. Submit and Validate Answers
const submitAnswers = async (req, res) => {
  try {
    const { examId } = req.params;
    const { answers } = req.body; // Array of 3 answers matching questions order

    const exam = await Exam.findById(examId);
    if (!exam) {
      return res.status(404).json({ message: "Exam session not found" });
    }
    if (exam.status !== "questions_generated") {
      return res
        .status(400)
        .json({ message: "Exam already submitted or validated" });
    }
    if (answers.length !== exam.questions.length) {
      return res
        .status(400)
        .json({ message: "Number of answers does not match questions" });
    }

    // Update answers
    exam.answers = answers;
    exam.status = "answers_submitted";

    // Validate each answer using Gemini
    const validations = [];
    let totalScore = 0;
    for (let i = 0; i < exam.questions.length; i++) {
      const validation = await validateAnswer(exam.questions[i], answers[i]);
      validations.push(validation);
      totalScore += validation.score;
    }

    // Calculate total score (scaled to 0-10)
    exam.validations = validations;
    const questionCount = exam.questions.length;
    exam.totalScore = (totalScore / questionCount) * 10; // Normalize to 0-10 based on actual question count
    exam.status = "validated";
    exam.updatedAt = new Date();
    await exam.save();

    res.json({
      message: "Answers submitted and validated",
      totalScore: exam.totalScore,
      feedback: exam.validations,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server Error" });
  }
};

module.exports = {
  registerCandidate,
  getQuestions,
  submitAnswers,
  getallusers,
};
