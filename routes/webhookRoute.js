const express = require('express');
const { updateInterviewSession } = require('../controllers/webhookController');


const router = express.Router();


router.post('/session/update', updateInterviewSession);



module.exports = router;