const express = require('express');
const { updateProfile } = require('../controllers/profileController');
const { protect } = require('../middlewares/authMiddleware');
const { updateProfileValidation } = require('../middlewares/validateRequest');

const router = express.Router();

router.put('/update', protect, updateProfileValidation, updateProfile);

module.exports = router;