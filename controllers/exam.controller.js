const Exam = require("../models/Exam");
const UsedQuestion = require("../models/UsedQuestion");

const { GoogleGenerativeAI } = require("@google/generative-ai");
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// 1. Register User and Generate Questions
const generateQuestions = async (usedQuestions = []) => {
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
  
  const createPrompt = (usedQ) => `Generate exactly 3 unique, beginner-to-intermediate level questions in common programming.
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
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
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
    const { fullName, email, phone, college } = req.body;

    // Find the single document storing all used questions
    let usedQuestionsDoc = await UsedQuestion.find({});
    let usedQuestions = [];
    if (usedQuestionsDoc.length > 0) {
      // Get the single document from the array
      usedQuestionsDoc = usedQuestionsDoc[0];
      usedQuestions = usedQuestionsDoc.questions.slice(0,24);
    } else {
      // Create a new document if one doesn't exist
      usedQuestionsDoc = new UsedQuestion({});
    }

    // Generate new questions using the list of all used questions
    const questionsData = await generateQuestions(usedQuestions);
    const newQuestions = questionsData.map((q) => q.question);

    // Update the used questions document with the new questions
    usedQuestionsDoc.questions = [...new Set([...usedQuestions, ...newQuestions])];
    await usedQuestionsDoc.save();

    // Check if user already has an exam session
    let existingExam = await Exam.findOne({ email });

    let exam;
    if (existingExam) {
      // Update the existing exam session
      existingExam.questions = newQuestions;
      existingExam.status = "questions_generated";
      exam = await existingExam.save();
    } else {
      // Create a new exam session
      exam = new Exam({
        fullName,
        email,
        phone,
        college,
        questions: newQuestions,
        status: "questions_generated",
      });
      await exam.save();
    }

    res.status(201).json({
      message: "Registration successful",
      examId: exam._id,
      questions: exam.questions,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
}

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
    exam.totalScore = (totalScore / 3) * 10; // Normalize to 0-10
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
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = {
  registerCandidate,
  getQuestions,
  submitAnswers,
  getallusers,
};
