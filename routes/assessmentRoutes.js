const express = require('express');
const { body } = require('express-validator');
const {
  getAssessments,
  getAssessment,
  submitAssessment,
} = require('../controllers/assessmentController');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');

const router = express.Router();

// Validation rules
const submitValidation = [
  body('assessmentId')
    .isMongoId()
    .withMessage('Invalid assessment ID'),
  body('answers')
    .isArray({ min: 1 })
    .withMessage('Answers array is required'),
  body('timeTaken')
    .isNumeric()
    .withMessage('Time taken must be a number')
];

// Routes
router.get('/', authMiddleware, roleMiddleware(['candidate', 'super_admin']), getAssessments);
router.get('/:id', authMiddleware, roleMiddleware(['candidate']), getAssessment);
router.post('/submit', authMiddleware, roleMiddleware(['candidate']), submitValidation, submitAssessment);

module.exports = router;
