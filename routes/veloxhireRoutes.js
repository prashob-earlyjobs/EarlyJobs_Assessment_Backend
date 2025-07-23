const express = require('express');
const router = express.Router();
const { generateCandidateToken } = require('../controllers/veloxhireController');
const authMiddleware = require('../middlewares/authMiddleware');
router.post('/generate-candidate-token', authMiddleware, generateCandidateToken);

module.exports = router;