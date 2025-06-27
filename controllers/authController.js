// controllers/authController.js
const User = require("../models/User");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const mongoose = require('mongoose');

const { validationResult } = require("express-validator");

// Enhanced JWT Token Generation with user role and email
const generateToken = (user) => {
  return jwt.sign(
    { 
      id: user._id,
      email: user.email,
      role: user.role 
    }, 
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRE,
    }
  );
};

// Generate refresh token
const generateRefreshToken = (userId) => {
  return jwt.sign(
    { id: userId },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRE }
  );
};

// Set cookie options
const cookieOptions = {
  httpOnly: true,
  secure: false,        // because localhost is not HTTPS
  sameSite: 'lax',
  path: '/',
  expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
};



// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
const register = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation errors",
        errors: errors.array(),
      });
    }

    const { name, email, mobile, password, role,referrerId } = req.body;

    // Check if user exists
    const userExists = await User.findOne({
      $or: [{ email }, { mobile }],
    });

    if (userExists) {
      return res.status(400).json({
        success: false,
        message: "User already exists with this email or mobile number",
      });
    }

    // Create user
      const user = await User.create({
        name,
        email,
        mobile,
        password,
        referrerId,
        role: role || "candidate",
      });
    // Generate tokens
    const accessToken = generateToken(user);
    const refreshToken = generateRefreshToken(user._id);

    // Set refresh token in cookie
    res.cookie('refreshToken', refreshToken, cookieOptions);

    res.status(201).json({
      success: true,
      message: "User registered successfully",
      data: {
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          referrerId: user.referrerId,
          mobile: user.mobile,
          role: user.role,
        },
        accessToken,
      },
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
      error: error.message,
    });
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
const login = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation errors",
        errors: errors.array(),
      });
    }

    const { email, password } = req.body;

    // Check for user
    const user = await User.findOne({ email }).select("+password");

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    // Check password
    const isMatch = await user.matchPassword(password);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: "Account is deactivated",
      });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate tokens
    const accessToken = generateToken(user);
    const refreshToken = generateRefreshToken(user._id);

    // Set refresh token in cookie
    res.cookie('refreshToken', refreshToken, cookieOptions);


    res.json({
      success: true,
      message: "Login successful",
      data: {
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          mobile: user.mobile,
          role: user.role,
          profile: user.profile,
          isEmailVerified: user.isEmailVerified,
          isPhoneVerified: user.isPhoneVerified,
        },
        accessToken,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error during login",
      error: error.message,
    });
  }
};

// Add refresh token endpoint
const refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.cookies;

    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        message: "No refresh token provided",
      });
    }

    // Verify refresh token
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid refresh token",
      });
    }

    // Generate new access token
    const accessToken = generateToken(user);

    res.json({
      success: true,
      data: { accessToken },
    });
  } catch (error) {
    res.status(401).json({
      success: false,
      message: "Invalid refresh token",
    });
  }
};

// @desc    Get current user
// @route   GET /api/auth/me
// @access  Private
const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    res.json({
      success: true,
      data: { user },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// @desc    Update user profile
// @route   PUT /api/auth/profile
// @access  Private

const updateProfile = async (req, res) => {
  try {
    const userId = req.user._id;

    const allowedTopLevelFields = ['name', 'profile'];
    const updateData = {};

    // Filter only allowed top-level fields
    for (const key of Object.keys(req.body)) {
      if (allowedTopLevelFields.includes(key)) {
        updateData[key] = req.body[key];
      }
    }

    // If profile is being updated, handle nested merging
    if (updateData.profile) {
      const existingUser = await User.findById(userId).lean();

      const mergedProfile = {
        ...existingUser.profile,
        ...updateData.profile,
        address: {
          ...(existingUser.profile?.address || {}),
          ...(updateData.profile.address || {})
        },
        professionalInformation: {
          ...(existingUser.profile?.professionalInformation || {}),
          ...(updateData.profile.professionalInformation || {})
        }
      };

      // 🛠️ Fix education format if it's present
      if (
        updateData.profile?.professionalInformation?.education &&
        Array.isArray(updateData.profile.professionalInformation.education)
      ) {
        mergedProfile.professionalInformation.education = updateData.profile.professionalInformation.education.map(entry => ({
          _id: entry._id ? new mongoose.Types.ObjectId(entry._id) : new mongoose.Types.ObjectId(),
          institution: entry.institution,
          degree: entry.degree,
          fieldOfStudy: entry.fieldOfStudy || 'N/A', // Optional fallback
          percentage: Number(entry.percentage),
          year: Number(entry.year)
        }));
      }

      updateData.profile = mergedProfile;
    }

    const updatedUser = await User.findByIdAndUpdate(userId, updateData, {
      new: true,
      runValidators: true
    });

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: { user: updatedUser }
    });

  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error updating profile',
      error: error.message
    });
  }
};

module.exports = updateProfile;



const completeProfile = async (req, res) => {
  console.log("Complete profile request body:", req.body);
  try {
    const {
      skills,
      bio,
      resume,
      PrefJobLocations,
      PreferredJobRole,
      dateOfBirth,
      gender
    } = req.body;

    const updatedFields = {
      'profile.preferredJobRole': PreferredJobRole,
      'profile.dateOfBirth': dateOfBirth,
      'profile.gender': gender,
      'profile.skills': skills || [],
      'profile.bio': bio || '',
      'profile.resume': resume || null,
      'profile.prefJobLocations': PrefJobLocations || [],
    };

    const user = await User.findByIdAndUpdate(req.user._id, { $set: updatedFields }, {
      new: true,
      runValidators: true,
    });

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      user,
    });
  } catch (error) {
    console.error("Error completing profile:", error);
    return res.status(500).json({
      success: false,
      message: "Server error completing profile",
      error: error.message,
    });
  }
};
const isUserLoggedIn = async(req,res)=>{
  if(req.user){
    console.log("User is logged in:", req.user);
    return res.status(200).json({
      success: true,
      message: "User is logged in",
      user: req.user,
    });
  }
  return res.status(401).json({
    success: false,
    message: "User is not logged in",
  });
}

const userLogout = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }
    // Clear the refreshToken cookie
    res.clearCookie('refreshToken', cookieOptions);

    // Return success response
    res.status(200).json({
      success: true,
      message: 'User logged out successfully'
    });
  } catch (error) {
    console.error('Failed to logout user:', error);
    
    // Handle any unexpected errors
    res.status(500).json({
      success: false,
      message: 'Server error while logging out',
      error: error.message
    });
  }
};

module.exports = { userLogout };

module.exports = {
  register,
  login,
  userLogout,
  getMe,
  updateProfile,
  completeProfile,
  isUserLoggedIn,
  refreshToken,
};
