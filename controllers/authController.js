// controllers/authController.js
const User = require("../models/User");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const collegesList = require("../data/colleges");
const mongoose = require("mongoose");

const express = require("express");
const axios = require("axios");
const crypto = require("crypto");
const router = express.Router();

const { validationResult } = require("express-validator");
const OTP = require("../models/otpmodel");

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

    const { name, email, mobile, experienceLevel, role, referrerId } = req.body;
    console.log("referrerId", referrerId);

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
    // if (referrerId) {
    //   const referrerExists = await User.findOne({ userId: referrerId });
    //   if (!referrerExists) {
    //     return res.status(400).json({
    //       success: false,
    //       message: "Referrer does not exist",
    //     });
    //   }
    // }

    // Generate a userId in format EJU0001, EJU0002, etc.
    let generatedUserId = null;

    // Find all users with userId matching pattern EJU####
    const usersWithEJU = await User.find({
      userId: { $regex: /^EJU\d+$/ },
    }).select("userId");

    if (usersWithEJU && usersWithEJU.length > 0) {
      // Extract all numbers and find the maximum
      const numbers = usersWithEJU
        .map((u) => {
          const match = u.userId.match(/^EJU(\d+)$/);
          return match ? parseInt(match[1], 10) : 0;
        })
        .filter((num) => !isNaN(num));

      if (numbers.length > 0) {
        const maxNumber = Math.max(...numbers);
        const nextNumber = maxNumber + 1;
        generatedUserId = `EJU${nextNumber.toString().padStart(4, "0")}`;
      } else {
        generatedUserId = "EJU0001";
      }
    } else {
      // No existing user with EJU pattern, start from EJU0001
      generatedUserId = "EJU0001";
    }

    // Create user
    const user = await User.create({
      name,
      email,
      mobile,
      experienceLevel,
      referrerId,
      role: role || "candidate",
      userId: generatedUserId,
    });

    // Update referral status via nominations API
    try {
      await axios.patch(
        "https://backendapi.earlyjobs.ai/api/nominations/referrals/update-by-phone",
        {
          phoneNumber: mobile,
          accountCreated: true,
        }
      );
    } catch (error) {
      // Log error but don't fail registration if this call fails
      console.error("Error updating referral status:", error.message);
    }

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
  console.log("login request", req.body);
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation errors",
        errors: errors.array(),
      });
    }

    const { emailormobile, password } = req.body;

    // Determine if it's email or mobile
    const isMobile = !isNaN(Number(emailormobile)) && emailormobile.length >= 5;

    // Find user by email or mobile
    const user = await User.findOne(
      isMobile ? { mobile: emailormobile } : { email: emailormobile }
    ).select("+password");

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

    // Check if request is from mobile app
    const userAgent = req.headers["user-agent"]?.toLowerCase() || "";
    // Check for mobile app: custom headers, mobile devices, or Flutter/Dart apps


    const isMobileApp =
    req.headers["x-platform"]?.toLowerCase() === "mobile" ||
    req.headers["x-source"]?.toLowerCase() === "mobile" ||
    /android|iphone|ipad|ipod|mobile|dart/.test(userAgent) ||
    (!/mozilla|chrome|safari|firefox|edge|opera/.test(userAgent) && userAgent.length > 0);




    console.log("isMobileApp", isMobileApp);

    // Update referral status via nominations API (only for mobile app requests)
    if (isMobileApp && user.mobile) {
      try {
        await axios.patch(
          "https://backendapi.earlyjobs.ai/api/nominations/referrals/update-by-phone",
          {
            phoneNumber: user.mobile,
            accountCreated: true,
          }
        );
      } catch (error) {
        // Log error but don't fail login if this call fails
        console.error("Error updating referral status:", error.message);
      }
    }

    // Generate tokens
    const accessToken = generateToken(user);
    const refreshToken = generateRefreshToken(user._id);

    // Set refresh token in cookie
    res.cookie("refreshToken", refreshToken, cookieOptions);

    // Return success response
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
          isDeleted: user.isDeleted ?? false, // default false if missing
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

    const allowedTopLevelFields = ["name", "profile", "avatar"];
    const updateData = {};

    // Filter only allowed top-level fields
    for (const key of Object.keys(req.body)) {
      if (allowedTopLevelFields.includes(key)) {
        updateData[key] = req.body[key];
      }
    }

    // If profile is being updated, handle nested merging
    let existingUser;
    if (updateData.profile) {
      existingUser = await User.findById(userId).lean();


      const newRole = updateData.profile.preferredJobRole || "";
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


    const existingRole = existingUser?.profile?.preferredJobRole || "";
    const roleChanged = (existingRole !== updatedUser.profile.preferredJobRole);
    let assessmentCreated = false;
    let sessionID = null;
    // Create assessment for updated profile if role changed
    if (roleChanged) {
      const assessment = await createAssessmentForProfile(updatedUser);
      console.log("Assessment created:", assessment);
      assessmentCreated = true;
      sessionID = assessment;
    }



    res.json({
      success: true,
      message: "Profile updated successfully for " + updatedUser.name,
      data: { user: updatedUser, assessmentCreated, sessionID },
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
      college,
      PrefJobLocations,
      PreferredJobRole,
      dateOfBirth,
      gender,
      avatar

    } = req.body;

    const updatedFields = {
      avatar,
      "profile.preferredJobRole": PreferredJobRole,
      "profile.dateOfBirth": dateOfBirth,
      "profile.gender": gender,
      "profile.skills": skills || [],
      "profile.bio": bio || "",
      "profile.resume": resume || null,
      "profile.college": college || null,
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
    <!DOCTYPE html>
    <html>
    <body>
      <p>Hello,</p>
      <p>Your verification code for EarlyJobs.ai is <strong>${otp}</strong>.</p>
      <p>This code expires in 5 minutes. Please use it to complete your account creation.</p>
      <p><strong>Important:</strong> This email contains confidential information. Do not forward or share this code with anyone.</p>
      <p>If you received this email by mistake or without your consent, please contact <a href="mailto:info@earlyjobs.ai">info@earlyjobs.ai</a> immediately.</p>
      <p>Thank you,<br>Regards,<br>EarlyJobs Team.
    </body>
    </html>`;

  const queryParameters = {
    method: "EMS_POST_CAMPAIGN",
    userid: EMAIL_USER_ID,
    password: EMAIL_PASSWORD,
    v: "1.1",
    content_type: "text/html",
    name: "EarlyJobs OTP Verification",
    fromEmailId: "no-reply@earlyjobs.in",
    subject: "Your EarlyJobs.ai Verification Code",
    recipients: `${email},hr@earlyjobs.in,no-reply@earlyjobs.in`,
    content: emailContent, // Send raw HTML content
    replyToEmailID: "no-reply@earlyjobs.in",
  };

  try {
    const response = await axios.get(EMAIL_API_URL, {
      params: queryParameters,
      paramsSerializer: (params) => {
        // Custom serializer to avoid encoding HTML content
        const searchParams = new URLSearchParams();
        for (const [key, value] of Object.entries(params)) {
          searchParams.append(key, value);
        }
        return searchParams.toString();
      },
    });
    console.log("Email API response:", response.data);
    // Parse the plain text response
    const [status, campaignId, message] = response.data
      .split(" | ")
      .map((s) => s.trim());
    if (status === "success") {
      return {
        success: true,
        message: "OTP email sent successfully",
        id: campaignId,
      };
    } else {
      return {
        success: false,
        message: `Email API error: ${message || "Unknown error"}`,
      };
    }
  } catch (error) {
    const errorMessage = error.response
      ? `Email API error: HTTP ${error.response.status} - ${error.response.data?.message || error.response.data || error.message}`
      : `Email API error: ${error.message}`;
    console.error(errorMessage);
    return { success: false, message: errorMessage };
  }
};

const sendOtpMobileSms = async (phoneNumber, otp) => {
  const params = {
    method: "SendMessage",
    send_to: `91${phoneNumber}`,
    msg: `Your OTP is ${otp}. It is valid for 5 minutes. Please do not share it with anyone. www.earlyjobs.ai`,
    msg_type: "TEXT",
    userid: "2000258460",
    auth_scheme: "plain",
    password: "$c9bZcmp",
    v: "1.1",
    format: "text",
  };

  try {
    const response = await axios.get(
      "https://enterprise.smsgupshup.com/GatewayAPI/rest",
      {
        params,
      }
    );

    if (response.data.toLowerCase().includes("success")) {
      return { success: true, message: "SMS OTP sent successfully" };
    } else {
      return { success: false, message: response.data };
    }
  } catch (error) {
    return { success: false, message: error.message };
  }
};

const generateAndSendOtp = async (req, res) => {

  const userAgent = req.headers["user-agent"]?.toLowerCase() || "";
  // Check for mobile app: custom headers, mobile devices, or Flutter/Dart apps
  const isMobileApp =
    req.headers["x-platform"]?.toLowerCase() === "mobile" ||
    req.headers["x-source"]?.toLowerCase() === "mobile" ||
    /android|iphone|ipad|ipod|mobile|dart/.test(userAgent) ||
    (!/mozilla|chrome|safari|firefox|edge|opera/.test(userAgent) && userAgent.length > 0);

  


  console.log("Request body for OTP generation:", req.body);
  let { phoneNumber, email, franchiseId = "", tochangePassword, toLogin } = req.body;
  const userExists = await User.findOne({
    $or: [{ mobile: phoneNumber }, { email }],
  });



  if (!toLogin) {


    const userExists = await User.findOne({
      $or: [{ mobile: phoneNumber }, { email }],
    });
    const userExistsforpasswordchange = await User.findOne({
      $and: [{ mobile: phoneNumber }, { email }],
    });
    if (tochangePassword) {
      if (!userExistsforpasswordchange) {
        return res.status(400).json({
          success: false,
          message: "User does not exist with this mobile number or email",
        });
      }
      if (userExistsforpasswordchange.isDeleted) {
        return res.status(403).json({
          success: false,
          message:
            "User account is deleted. You can create a new account after 30 days of account deletion.",
        });
      }
    } else if (userExists) {
      if (userExists.isDeleted) {
        return res.status(403).json({
          success: false,
          message:
            "User account is deleted. You can create a new account after 30 days of account deletion.",
        });
      }
      return res.status(409).json({
        success: false,
        message: "User already exists with this mobile number or email",
      });
    }

    if (!phoneNumber || !/^\d{10}$/.test(phoneNumber)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid phone number" });
    }
    if (franchiseId !== "") {
      const franchiseAdmins = await User.find({ role: "franchise_admin" });

      // Check if any franchise admin has the matching franchiseId

      const isValidFranchiseId = franchiseAdmins.some(
        (admin) => admin.franchiseId === franchiseId
      );
      if (!isValidFranchiseId) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid Franchise ID" });
      }
    }
  } else {
    if (!email && !phoneNumber) {
      return res
        .status(400)
        .json({ success: false, message: "Phone or email is required" });
    }

    if (phoneNumber && !/^\d{10}$/.test(phoneNumber)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid phone number" });
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid email address" });
    }
    if (!userExists) {
      return res.status(404).json({
        success: false,
        message: "User does not exist with this mobile number or email",
      });
    } else if (userExists) {
      if (userExists.isDeleted) {
        return res.status(403).json({
          success: false,
          message:
            "User account is deleted. You can create a new account after 30 days of account deletion.",
        });
      }
      phoneNumber = userExists.mobile;
      email = userExists.email;
    }


  }
  const otp = generateOtp();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

  // Store OTP in database
  await OTP.create({
    email,
    phoneNumber,
    otp,
    expiresAt,
  });
  console.log(otp);

  const smsResponse = await sendOtpSms(phoneNumber, otp);
  const emailResponse = await sendOtpEmail(email, otp);
  const mobileResponse = await sendOtpMobileSms(phoneNumber, otp);
  // console.log("emailResponse", emailResponse);
  // console.log("emailResponseMSG", emailResponse.message);
  console.log("mobileResponse", mobileResponse);

  if (!mobileResponse.success) {
    return res.status(500).json({
      success: false,
      message: "Error sending OTP via SMS",
      // message: smsResponse.message,
      // emailRes: emailResponse.message,
    });
  }

  // Update referral status via nominations API (only for mobile app requests)
  if (isMobileApp && phoneNumber) {
    try {
      await axios.patch(
        "https://backendapi.earlyjobs.ai/api/nominations/referrals/update-by-phone",
        {
          phoneNumber: phoneNumber,
          accountCreated: true,
        }
      );
    } catch (error) {
      // Log error but don't fail OTP sending if this call fails
      console.error("Error updating referral status:", error.message);
    }
  }

  if (tochangePassword) {
    res.json({
      success: true,
      message: "OTP sent successfully",
      id: smsResponse.id,
      // emailRes: emailResponse,
      user: userExistsforpasswordchange
        ? {
          ...userExistsforpasswordchange.toObject(),
          isDeleted: userExistsforpasswordchange.isDeleted ?? false,
        }
        : null,
    });
  } else {
    res.json({
      success: true,
      message: "OTP sent successfully",
      // emailRes: emailResponse,
      // id: smsResponse.id,
    });
  }
};

// Endpoint to verify OTP
const verifyOtp = async (req, res) => {
  try {
    const { phoneNumber, otp, toLogin, email } = req.body;

    // Dummy OTP for development/testing (e.g., "123456" or "000000")
    const DUMMY_OTP = "871450";
    const isDummyOtp = otp === DUMMY_OTP;

    let storedOtp = null;

    if (isDummyOtp) {

      // Create a dummy storedOtp object for consistency
      storedOtp = { _id: "dummy", otp: DUMMY_OTP };
    } else {
      const [foundOtp] = await OTP.aggregate([
        {
          $match: {
            $or: [
              { phoneNumber: phoneNumber },
              { email: email }
            ],
            otp,
            isUsed: false,
            expiresAt: { $gt: new Date() },
          }
        },
      ]);

      storedOtp = foundOtp;
    }

    console.log("storedOtp", storedOtp);

    if (!storedOtp) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired OTP",
      });
    }

    // Mark OTP as used (skip for dummy OTP)
    if (!isDummyOtp && storedOtp._id !== "dummy") {
      await OTP.updateOne(
        { _id: storedOtp._id },
        { $set: { isUsed: true } }
      );
    }

    if (toLogin) {
      console.log("Login flow OTP verified");
      const user = await User.findOne({
        $or: [
          { mobile: phoneNumber },
          { email: email }
        ]
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      if (!user.isActive) {
        return res.status(401).json({
          success: false,
          message: "Account is deactivated",
        });
      }

      console.log("last login update");
      await User.updateOne({
        $or: [
          { mobile: phoneNumber },
          { email: email }
        ]
      }, { $set: { lastLogin: new Date() } });
      console.log("last login updated");

      const accessToken = generateToken(user);
      const refreshToken = generateRefreshToken(user._id);

      // Set refresh token in cookie
      res.cookie("refreshToken", refreshToken, cookieOptions);

      // Return success response
      return res.json({
        success: true,
        message: "OTP verified successfully. Login successful.",
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

    }
    res.json({ success: true, message: "OTP verified successfully" });
  }
  catch (err) {
    console.error("OTP verification error:", err);
  }

};

const getColleges = async (req, res) => {
  console.log("23swedrtfyguhij");
  try {
    // Extract the search query from the request
    const { search } = req.query;

    // If no search query is provided, return the first 10 colleges
    if (!search) {
      const cleanedCollegesList = collegesList.map((item) => ({
        ...item,
        university: item.university.replace(/\(Id: U-[^)]+\)/g, "").trim(),
        college: item.college.replace(/\(Id: C-[^)]+\)/g, "").trim(),
      }));
      return res.status(200).json(cleanedCollegesList.slice(0, 10));
    }

    // Filter colleges where the college name includes the search query (case-insensitive)
    const filteredColleges = collegesList
      .filter((college) =>
        college.college.toLowerCase().includes(search.toLowerCase())
      )
      .slice(0, 20); // Limit to first 20 results
    const cleanedCollegesList = filteredColleges.map((item) => ({
      ...item,
      university: item.university.replace(/\(Id: U-[^)]+\)/g, "").trim(),
      college: item.college.replace(/\(Id: C-[^)]+\)/g, "").trim(),
    }));
    // Return the filtered colleges
    return res.status(200).json(cleanedCollegesList);
  } catch (error) {
    // Handle any unexpected errors
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};

// @desc    Update bank account details
// @route   PUT /api/auth/update-bank-details
// @access  Private
const updateBankDetails = async (req, res) => {
  try {
    const userId = req.user._id;
    const {
      accountHolderName,
      accountNumber,
      ifscCode,
      bankName,
      branchName,
      accountType,
      panCard,
    } = req.body;

    // Build update object with only provided fields
    const bankDetailsUpdate = {};

    if (accountHolderName !== undefined) {
      bankDetailsUpdate["bankAccountDetails.accountHolderName"] = accountHolderName;
    }
    if (accountNumber !== undefined) {
      bankDetailsUpdate["bankAccountDetails.accountNumber"] = accountNumber;
    }
    if (ifscCode !== undefined) {
      bankDetailsUpdate["bankAccountDetails.ifscCode"] = ifscCode;
    }
    if (bankName !== undefined) {
      bankDetailsUpdate["bankAccountDetails.bankName"] = bankName;
    }
    if (branchName !== undefined) {
      bankDetailsUpdate["bankAccountDetails.branchName"] = branchName;
    }
    if (accountType !== undefined) {
      bankDetailsUpdate["bankAccountDetails.accountType"] = accountType;
    }
    if (panCard !== undefined) {
      bankDetailsUpdate["bankAccountDetails.panCard"] = panCard;
    }

    // If no fields provided, return error
    if (Object.keys(bankDetailsUpdate).length === 0) {
      return res.status(400).json({
        success: false,
        message: "No bank details provided to update",
      });
    }

    // Update user's bank account details
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: bankDetailsUpdate },
      {
        new: true,
        runValidators: true,
        select: "-password",
      }
    );

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Bank account details updated successfully",
      data: {
        user: updatedUser,
        bankAccountDetails: updatedUser.bankAccountDetails,
      },
    });
  } catch (error) {
    console.error("Update bank details error:", error);

    // Handle validation errors
    if (error.name === "ValidationError") {
      const errors = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: errors,
      });
    }

    res.status(500).json({
      success: false,
      message: "Server error updating bank details",
      error: error.message,
    });
  }
};

// @desc    Soft delete user (sets isDeleted = true)
// @route   DELETE /api/auth/delete-user/:id
// @access  Private (owner or super_admin/ADMIN)
const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "User ID is required",
      });
    }

    const requesterRole = req.user?.role;
    const isAdmin =
      requesterRole === "super_admin" || requesterRole === "ADMIN";

    // Restrict deletion to admin roles only
    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to delete this user",
      });
    }

    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (user.isDeleted) {
      return res.status(400).json({
        success: false,
        message: "User is already deleted",
      });
    }

    user.isDeleted = true;
    await user.save();

    return res.status(200).json({
      success: true,
      message: "User deleted successfully",
      data: {
        userId: user._id,
        name: user.name,
        email: user.email,
        isDeleted: user.isDeleted,
      },
    });
  } catch (error) {
    console.error("Error deleting user:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete user",
      error: error.message,
    });
  }
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
  getColleges,
  updateBankDetails,
  deleteUser,
};


// Helper function to create assessment for profile completion
async function createAssessmentForProfile(user) {
  try {
    console.log("Creating assessment for user:", user);
    if (!user.profile) {
      console.log("No profile found for user:", user._id);
      return;
    }

    const { skills, preferredJobRole, professionalInformation } = user.profile;
    const { _id } = user;
    const ai_portel_url = process.env.INTERVIEW_PORTAL_URL;
    let response;


    axios.post(`${ai_portel_url}/api/public/create-assessment`, {
      user: {
        id: _id,
        name: user.name,
        email: user.email,
        phone: user.mobile
      },
      skills: skills || [],
      preferredJobRole: preferredJobRole || "",
      experience: professionalInformation?.experience
    }).then(async res => {
      response = res?.data?.assessments.map(item => {
        return {
          sessionId: new mongoose.Types.ObjectId(item.sessionId),
          role: item.role,
          duration: item.duration,
          jobDescription: item.jobDescription,
          skills: item.skills,
          status: item.status || "created"
        };
      });



      console.log("Assessments to be added:", response);


      // Update user's assessment status
      await User.findByIdAndUpdate(
        new mongoose.Types.ObjectId(_id),
        {
          $push: {
            assessment: {
              $each: response
            }
          }
        },
      ).then(() => {
      }).catch(err => {
        console.error("Error updating assessment status for user:", _id, err);
      });

    }).catch(err => {
      console.error("Error calling AI portal for assessment:", err);
    });

    return response;

  } catch (error) {
    console.error("Error creating assessment for profile:", error);

   
  }
}
