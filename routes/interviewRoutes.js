const express = require('express');
const authMiddleware = require('../middlewares/authMiddleware');

const { getUserInterviews,getInterviewReport,checkValidUser } = require('../controllers/interviewController');

const router = express.Router();



router.get('/getUserInterviews/:id',authMiddleware, getUserInterviews);

router.get('/getInterviewReport/:id',authMiddleware, getInterviewReport);

//check if the user is valid and present in db
router.post('/isValidUser',checkValidUser);



module.exports = router;