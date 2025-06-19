const express = require('express');
const { updateProfile } = require('../controllers/profileController');
const { protect } = require('../middleware/auth');
const { updateProfileValidation } = require('../middleware/validateRequest');

const router = express.Router();

router.put('/update', protect, updateProfileValidation, updateProfile);

module.exports = router;