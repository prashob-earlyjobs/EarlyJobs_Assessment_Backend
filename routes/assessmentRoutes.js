const express = require('express');
const { body } = require('express-validator');
const {
  getAssessments,
  getAssessment,
  submitAssessment,
  getAssessmentsByUser,
  getUserStats,
  inviteCandidateToInterview
} = require('../controllers/assessmentController');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');
const {callVeloxhireApi} = require('../controllers/veloxhireController');


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
router.get('/', authMiddleware, roleMiddleware(['candidate', 'super_admin','franchise_admin']), getAssessments);
router.get('/:id', authMiddleware, roleMiddleware(['candidate']), getAssessment);
router.post('/submit', authMiddleware, roleMiddleware(['candidate']), submitValidation, submitAssessment);
router.get('/getAssessments/:userId', authMiddleware,getAssessmentsByUser )
router.get('/getUserStats/:userId', authMiddleware,getUserStats )
router.post('/getAssessmentLink/:assessmentId', authMiddleware, async (req, res) => {
  const body = [
    req.body
  ]
  try {
    const response = await callVeloxhireApi(`/assessment/${req.params.assessmentId}/interviews`,'POST',body);
    res.json({
      success: true,
      data:{...data[0],publicLink:`https://candidate.veloxhire.ai/interview/${response[0].interviewId}`}
    })
  } catch (error) {
    console.error("Error calling Veloxhire API:", error.message);
    res.status(500).json({ message: "Failed to fetch assessment data" });
  }
});
module.exports = router;
