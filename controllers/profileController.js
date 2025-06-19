const User = require('../models/User');
const { validationResult } = require('express-validator');

exports.updateProfile = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array().map(error => ({
          field: error.param,
          message: error.msg
        }))
      });
    }

    const allowedFields = ['name', 'mobile', 'bio', 'skills', 'experience', 'education', 'socialLinks'];
    const updates = {};

    // Filter allowed fields from request body
    Object.keys(req.body).forEach(key => {
      if (allowedFields.includes(key)) {
        if (key === 'bio' || key === 'skills' || key === 'experience' || key === 'education' || key === 'socialLinks') {
          if (!updates.profile) updates.profile = {};
          updates.profile[key] = req.body[key];
        } else {
          updates[key] = req.body[key];
        }
      }
    });

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: updates },
      { 
        new: true, 
        runValidators: true,
        select: '-password'
      }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: { user }
    });

  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating profile',
      error: error.message
    });
  }
};