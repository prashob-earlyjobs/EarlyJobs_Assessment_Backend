const express = require('express');
const { body } = require('express-validator');
const {
    getAllUsers,
    updateUserStatus,
    getFranchiseUsers,
    getFranchiser,
    getTransactions,
    getFranchiseTransactionsAndEarnings,
    addFranchiser
  } = require('../controllers/adminController');
  const {
    addAssessment,
    editAssessment,
    getAssessmentsByUser
  } = require('../controllers/assessmentController');


  const roleMiddleware = require('../middlewares/roleMiddleware');
const authMiddleware = require('../middlewares/authMiddleware');


const router = express.Router();

// Validation rules




// Auth routes

router.get('/getUsers', authMiddleware,roleMiddleware(['super_admin']),getAllUsers )
router.put('/users/:id/status', authMiddleware, roleMiddleware(['super_admin']),updateUserStatus)
router.get('/getUsersForFranchise/:id', authMiddleware,roleMiddleware(['franchise_admin']),getFranchiseUsers )

router.post('/addAssessment', authMiddleware,roleMiddleware(['super_admin']), addAssessment)
router.put('/editAssessment/:assessmentId', authMiddleware, roleMiddleware(['super_admin']), editAssessment)
router.get('/getFranchiser/:franchiserId',authMiddleware,roleMiddleware(['super_admin','franchise_admin']),getFranchiser)

router.get('/getTransactions/',authMiddleware,roleMiddleware(['super_admin']),getTransactions)
router.get('/franchise/getTransactions/',authMiddleware,roleMiddleware(['franchise_admin']),getFranchiseTransactionsAndEarnings)

router.post('/addFranchiser', authMiddleware,roleMiddleware(['super_admin']), addFranchiser)
module.exports = router;
