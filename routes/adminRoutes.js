const express = require('express');
const { body } = require('express-validator');
const {
    getAllUsers,
    updateUserStatus
  } = require('../controllers/adminController');
  const {
    addAssessment,
    editAssessment
  } = require('../controllers/assessmentController');


  const roleMiddleware = require('../middlewares/roleMiddleware');
const authMiddleware = require('../middlewares/authMiddleware');


const router = express.Router();

// Validation rules




// Auth routes

router.get('/getUsers', authMiddleware,roleMiddleware(['super_admin']),getAllUsers )
router.put('/users/:id/status', authMiddleware, roleMiddleware(['super_admin']),updateUserStatus)

router.post('/addAssessment', authMiddleware,roleMiddleware(['super_admin']), addAssessment)
router.put('/editAssessment/:assessmentId', authMiddleware, roleMiddleware(['super_admin']), editAssessment)

module.exports = router;
