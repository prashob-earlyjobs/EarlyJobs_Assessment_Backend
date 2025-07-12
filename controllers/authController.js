// controllers/authController.js
const User = require("../models/User");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");

const express = require("express");
const axios = require("axios");
const crypto = require("crypto");
const router = express.Router();

const { validationResult } = require("express-validator");

// Enhanced JWT Token Generation with user role and email
const generateToken = (user) => {
  return jwt.sign(
    {
      id: user._id,
      email: user.email,
      role: user.role,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRE,
    }
  );
};

// Generate refresh token
const generateRefreshToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRE,
  });
};

// Set cookie options
const cookieOptions = {
  httpOnly: true,
  secure: false, // because localhost is not HTTPS
  sameSite: "lax",
  path: "/",
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

    const { name, email, mobile, password, role, referrerId } = req.body;

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
    if (referrerId) {
      const referrerExists = await User.findOne({ franchiseId: referrerId });
      if (!referrerExists) {
        return res.status(400).json({
          success: false,
          message: "Referrer does not exist",
        });
      }
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
    res.cookie("refreshToken", refreshToken, cookieOptions);

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
    console.error(error);
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
    res.cookie("refreshToken", refreshToken, cookieOptions);

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

    const allowedTopLevelFields = ["name", "profile", "avatar", "resumeUrl"];
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
          ...(updateData.profile.address || {}),
        },
        professionalInformation: {
          ...(existingUser.profile?.professionalInformation || {}),
          ...(updateData.profile.professionalInformation || {}),
        },
      };

      // 🛠️ Fix education format if it's present
      if (
        updateData.profile?.professionalInformation?.education &&
        Array.isArray(updateData.profile.professionalInformation.education)
      ) {
        mergedProfile.professionalInformation.education =
          updateData.profile.professionalInformation.education.map((entry) => ({
            _id: entry._id
              ? new mongoose.Types.ObjectId(entry._id)
              : new mongoose.Types.ObjectId(),
            institution: entry.institution,
            degree: entry.degree,
            fieldOfStudy: entry.fieldOfStudy || "N/A", // Optional fallback
            percentage: Number(entry.percentage),
            year: Number(entry.year),
          }));
      }

      updateData.profile = mergedProfile;
    }

    const updatedUser = await User.findByIdAndUpdate(userId, updateData, {
      new: true,
      runValidators: true,
    });

    res.json({
      success: true,
      message: "Profile updated successfully for " + updatedUser.name,
      data: { user: updatedUser },
    });
  } catch (error) {
    console.error("Update profile error:", error);
    res.status(500).json({
      success: false,
      message: "Server error updating profile",
      error: error.message,
    });
  }
};

const resetPassword = async (req, res) => {
  const { userId } = req.params;
  const { newPassword } = req.body;

  try {
    const user = await User.findById(userId).select("+password"); // Include password field

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Assign the new password and let Mongoose run validations
    user.password = newPassword;

    await user.save({ validateBeforeSave: true });

    return res.status(200).json({
      success: true,
      message: "Password reset successfully",
    });
  } catch (error) {
    // Catch mongoose validation errors
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((val) => val.message);
      return res.status(400).json({
        success: false,
        message: "Password validation failed",
        errors: messages,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Server error resetting password",
      error: error.message,
    });
  }
};

const completeProfile = async (req, res) => {
  try {
    const {
      skills,
      bio,
      resume,
      PrefJobLocations,
      PreferredJobRole,
      dateOfBirth,
      gender,
    } = req.body;

    const updatedFields = {
      "profile.preferredJobRole": PreferredJobRole,
      "profile.dateOfBirth": dateOfBirth,
      "profile.gender": gender,
      "profile.skills": skills || [],
      "profile.bio": bio || "",
      "profile.resume": resume || null,
      "profile.prefJobLocations": PrefJobLocations || [],
    };

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: updatedFields },
      {
        new: true,
        runValidators: true,
      }
    );

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      user,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Server error completing profile",
      error: error.message,
    });
  }
};
const isUserLoggedIn = async (req, res) => {
  if (req.user) {
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
};

const userLogout = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
    }
    // Clear the refreshToken cookie
    res.clearCookie("refreshToken", cookieOptions);

    // Return success response
    res.status(200).json({
      success: true,
      message: "User logged out successfully",
    });
  } catch (error) {
    // Handle any unexpected errors
    res.status(500).json({
      success: false,
      message: "Server error while logging out",
      error: error.message,
    });
  }
};

const verifyFranchiseId = async (req, res) => {
  try {
    const { franchiseId } = req.params;

    // Query users with role 'franchise_admin'
    const franchiseAdmins = await User.find({ role: "franchise_admin" });

    // Check if any franchise admin has the matching franchiseId

    const isValidFranchiseId = franchiseAdmins.some(
      (admin) => admin.franchiseId === franchiseId
    );

    if (isValidFranchiseId) {
      return res
        .status(200)
        .json({ success: true, message: "Franchise ID is valid" });
    } else {
      return res
        .status(200)
        .json({ success: false, message: "Invalid Franchise ID" });
    }
  } catch (error) {
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

// In-memory store for OTPs (use Redis or database in production)
const otpStore = new Map();

// Generate 6-digit OTP
const generateOtp = () => {
  return crypto.randomInt(100000, 999999).toString();
};

// Gupshup SMS API configuration
const GUPHSHUP_API_URL = "https://mediaapi.smsgupshup.com/GatewayAPI/rest";
const EMAIL_API_URL = "https://enterprise.webaroo.com/GatewayAPI/rest";

const USER_ID = process.env.GUPSHUP_USER_ID;
const PASSWORD = process.env.GUPSHUP_PASSWORD; // Store in environment variable
const EMAIL_USER_ID = process.env.GUPSHUP_EMAIL_USER_ID;
const EMAIL_PASSWORD = process.env.GUPSHUP_EMAIL_PASSWORD;

// Send OTP via Gupshup SMS
const sendOtpSms = async (phoneNumber, otp) => {
  const params = {
    userid: USER_ID,
    password: PASSWORD,
    send_to: phoneNumber,
    v: "1.1",
    format: "json",
    msg_type: "TEXT",
    method: "SENDMESSAGE",
    msg: `${otp} is your verification code.`,
    isTemplate: true,
    footer: "This code expires in 5 minute.",
  };

  try {
    const response = await axios.get(GUPHSHUP_API_URL, { params });
    if (response.data.response.status === "success") {
      return {
        success: true,
        message: "OTP sent successfully",
        id: response.data.response.id,
      };
    } else {
      return { success: false, message: response.data.response.details };
    }
  } catch (error) {
    return { success: false, message: error.message };
  }
};

const sendOtpEmail = async (email, otp) => {
  const emailContent = `
    <p>Hi,</p>
    <p>Your verification code for EarlyJobs.in is <strong>${otp}</strong>.</p>
    <p>This code expires in 5 minutes. Please use it to complete your account creation.</p>
    <p><strong>Important:</strong> This email contains confidential information. Do not forward or share this code with anyone.</p>
    <p>If you received this email by mistake or without your consent, please contact <a href="mailto:hr@earlyjobs.in">hr@earlyjobs.in</a> immediately.</p>
    <p>Thank you,<br>Regards,<br>EarlyJobs.in Team<br>Victaman Enterprises</p>
  `;
  const encodedContent = encodeURIComponent(emailContent);
  const queryParameters = {
    method: "EMS_POST_CAMPAIGN",
    userid: EMAIL_USER_ID,
    password: EMAIL_PASSWORD,
    v: "1.1",
    contentType: "text/html",
    name: "EarlyJobs OTP Verification",
    fromEmailId: "no-reply@earlyjobs.in",
    subject: "Your EarlyJobs.in Verification Code",
    recipients: `${email},hr@earlyjobs.in,no-reply@earlyjobs.in`,
    content: encodedContent,
    replyToEmailID: "no-reply@earlyjobs.in",
  };

  try {
    const response = await axios.get(EMAIL_API_URL, {
      params: queryParameters,
    });
    console.log("Email API response:", response);
    if (response.data.response?.status === "success") {
      return {
        success: true,
        message: "OTP email sent successfully",
        id: response.data.response.id,
      };
    } else {
      return {
        success: false,
        message: `Email API error: ${response.data.response?.details || response.data?.message || "Unknown error"}`,
      };
    }
  } catch (error) {
    const errorMessage = error.response
      ? `Email API error: HTTP ${error.response.status} - ${error.response.data?.message || error.response.data?.details || error.message}`
      : `Email API error: ${error.message}`;
    console.error(errorMessage);
    return { success: false, message: errorMessage };
  }
};

// Endpoint to generate and send OTP
const generateAndSendOtp = async (req, res) => {
  const { phoneNumber, email, tochangePassword } = req.body;
  const userExists = await User.findOne({
    $or: [{ mobile: phoneNumber }, { email }],
  });
  if (tochangePassword) {
    if (!userExists) {
      return res.status(400).json({
        success: false,
        message: "User does not exist with this mobile number or email",
      });
    }
  } else if (userExists) {
    return res.status(400).json({
      success: false,
      message: "User already exists with this mobile number or email",
    });
  }

  if (!phoneNumber || !/^\d{10}$/.test(phoneNumber)) {
    return res
      .status(400)
      .json({ success: false, message: "Invalid phone number" });
  }

  const otp = generateOtp();
  const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes expiration

  // Store OTP with phone number and expiration
  otpStore.set(phoneNumber, { otp, expiresAt });

  const smsResponse = await sendOtpSms(phoneNumber, otp);
  const emailResponse = await sendOtpEmail(email, otp);
  console.log("smsResponse:", smsResponse, "emailResponse:", emailResponse);

  if (!smsResponse.success || !emailResponse) {
    return res
      .status(500)
      .json({ success: false, message: smsResponse.message });
  }

  res.json({
    success: true,
    message: "OTP sent successfully",
    id: smsResponse.id,
  });
};

// Endpoint to verify OTP
const verifyOtp = async (req, res) => {
  const { phoneNumber, otp } = req.body;

  if (!phoneNumber || !otp) {
    return res
      .status(400)
      .json({ success: false, message: "Phone number and OTP are required" });
  }

  const storedOtpData = otpStore.get(phoneNumber);

  if (!storedOtpData) {
    return res
      .status(400)
      .json({ success: false, message: "No OTP found for this phone number" });
  }

  if (Date.now() > storedOtpData.expiresAt) {
    otpStore.delete(phoneNumber);
    return res.status(400).json({ success: false, message: "OTP has expired" });
  }

  if (storedOtpData.otp !== otp) {
    return res.status(400).json({ success: false, message: "Invalid OTP" });
  }

  // OTP is valid, clear it from store
  otpStore.delete(phoneNumber);
  res.json({ success: true, message: "OTP verified successfully" });
};

module.exports = {
  register,
  login,
  userLogout,
  getMe,
  updateProfile,
  verifyFranchiseId,
  completeProfile,
  isUserLoggedIn,
  refreshToken,
  generateAndSendOtp,
  resetPassword,
  verifyOtp,
};
