const express = require('express');
const router = express.Router();
const { sendOtpController, submitInterestController } = require('../controllers/otpController');


router.post('/send-otp/mobile', sendOtpController);


router.post('/submit-interest', submitInterestController);

module.exports = router;