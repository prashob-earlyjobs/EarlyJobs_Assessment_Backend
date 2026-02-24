const express = require('express');
const authMiddleware = require('../middlewares/authMiddleware');

const { getUserInterviews,getInterviewReport,checkValidUser,getAllCandidates } = require('../controllers/interviewController');

const router = express.Router();



router.get('/getUserInterviews/:id',authMiddleware, getUserInterviews);

router.get('/getInterviewReport/:id', getInterviewReport);

router.get('/getAllCandidates', getAllCandidates);

//check if the user is valid and present in db
router.post('/isValidUser',checkValidUser);



module.exports = router;