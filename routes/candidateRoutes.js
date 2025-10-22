const express = require('express');
const router = express.Router();

// Destructure the function from the exported object
const { getUserIdByInterviewId } = require('../controllers/candidateController');

// ✅ Pass the function directly
router.get("/id-by-interview/:interviewId", getUserIdByInterviewId);

module.exports = router;
