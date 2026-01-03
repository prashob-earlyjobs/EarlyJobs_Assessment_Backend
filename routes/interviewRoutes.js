const express = require('express');
const authMiddleware = require('../middlewares/authMiddleware');

const { getUserInterviews,getInterviewReport } = require('../controllers/interviewController');

const router = express.Router();

router.use(authMiddleware);

router.get('/getUserInterviews/:id', getUserInterviews);

router.get('/getInterviewReport/:id', getInterviewReport);


module.exports = router;