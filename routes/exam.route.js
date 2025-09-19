const express = require("express");
const {
  registerCandidate,
  getQuestions,
  submitAnswers,
  getallusers,
} = require("../controllers/exam.controller.js");

const router = express.Router();

// 1. POST /api/exam/register - Register and generate questions
router.post("/register", registerCandidate);

// 2. GET /api/exam/questions/:candidateId - Get questions
router.get("/questions/:examId", getQuestions);

// 3. POST /api/exam/submit/:examId - Submit and validate answers
router.post("/submit/:examId", submitAnswers);

router.get("/getallusers", getallusers);
module.exports = router;
