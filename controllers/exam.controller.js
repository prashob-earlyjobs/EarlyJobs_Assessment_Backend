const Exam = require("../models/Exam");

const { GoogleGenerativeAI } = require("@google/generative-ai");
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// 1. Register User and Generate Questions
const generateQuestions = async () => {
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
  const prompt = `Generate exactly 3 unique, beginner-to-intermediate level questions in common programming.  

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

Respond ONLY with valid JSON array in the format:  
[{"question": "...", "expectedAnswer": "..."}, ...]`;

  const result = await model.generateContent(prompt);
  const response = await result.response;
  let text = response.text();

  // 🔥 Strip code fences if Gemini adds them
  text = text.replace(/```json|```/g, "").trim();

  try {
    return JSON.parse(text);
  } catch (err) {
    console.error("JSON Parse Error:", err);
    console.error("Gemini raw output:", text); // debug output
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

    // Check if user exists
    const existingExam = await Exam.findOne({ email });
    if (existingExam) {
      return res.status(400).json({ message: "User already registered" });
    }

    // Generate 3 Python questions using Gemini
    const questionsData = await generateQuestions();
    const questions = questionsData.map((q) => q.question);

    // Create new exam session
    const exam = new Exam({
      fullName,
      email,
      phone,
      college,
      questions,
      status: "questions_generated",
    });
    await exam.save();

    res.status(201).json({
      message: "Registration successful",
      examId: exam._id,
      questions: exam.questions,
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
};
