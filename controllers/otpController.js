const axios = require('axios');
const OTP = require('../models/otpmodel'); // Reusing OTP model from authController.js

// Gupshup SMS API configuration (from authController.js)
const sendOtpMobileSms = async (phoneNumber, otp) => {
  const params = {
    method: "SendMessage",
    send_to: phoneNumber, // Expects +91xxxxxxxxxx
    msg: `Your OTP is ${otp}. It is valid for 5 minutes. Please do not share it with anyone. www.earlyjobs.ai`,
    msg_type: "TEXT",
    userid: "2000258460",
    auth_scheme: "plain",
    password: "$c9bZcmp",
    v: "1.1",
    format: "text",
  };

  try {
    const response = await axios.get("https://enterprise.smsgupshup.com/GatewayAPI/rest", { params });
    if (response.data.toLowerCase().includes("success")) {
      return { success: true, message: "SMS OTP sent successfully" };
    } else {
      return { success: false, message: response.data };
    }
  } catch (error) {
    return { success: false, message: error.message };
  }
};

// Generate 6-digit OTP
const generateOtp = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Controller for sending OTP via Gupshup
exports.sendOtpController = async (req, res) => {
  const { mobile } = req.body;

  // Validate mobile number format (+91 followed by 10 digits)
  if (!mobile || !/^\+91\d{10}$/.test(mobile)) {
    return res.status(400).json({ success: false, message: "Valid mobile number with +91 country code and 10 digits is required" });
  }

  // Generate OTP
  const otp = generateOtp();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5-minute expiry

  try {
    // Store OTP in database
    await OTP.create({
      phoneNumber: mobile,
      otp,
      expiresAt,
      isUsed: false,
    });

    // Send OTP via Gupshup
    const smsResponse = await sendOtpMobileSms(mobile, otp);
    if (!smsResponse.success) {
      return res.status(500).json({ success: false, message: `Error sending OTP via SMS: ${smsResponse.message}` });
    }

    return res.status(200).json({ success: true, message: "OTP sent successfully" });
  } catch (error) {
    console.error("Send OTP error:", error);
    return res.status(500).json({ success: false, message: "Server error sending OTP", error: error.message });
  }
};

// Controller for submitting interest with OTP validation
exports.submitInterestController = async (req, res) => {
  const { name, companyName, mobile, mobileOtp, candidateName } = req.body;

  // Validate required fields
  if (!name || !companyName || !mobile || !mobileOtp || !candidateName) {
    return res.status(400).json({ success: false, message: "All fields are required" });
  }

  // Validate mobile number format
  if (!/^\+91\d{10}$/.test(mobile)) {
    return res.status(400).json({ success: false, message: "Valid mobile number with +91 country code and 10 digits is required" });
  }

  try {
    // Verify OTP
    const storedOtp = await OTP.findOne({
      phoneNumber: mobile,
      otp: mobileOtp,
      isUsed: false,
      expiresAt: { $gt: new Date() },
    });

    if (!storedOtp) {
      return res.status(400).json({ success: false, message: "Invalid or expired OTP" });
    }

    // Mark OTP as used
    storedOtp.isUsed = true;
    await storedOtp.save();

    // TODO: Add business logic (e.g., save interest to database, send notifications, etc.)
    // For now, simulate success
    return res.status(200).json({ success: true, message: "Interest expressed successfully" });
  } catch (error) {
    console.error("Submit interest error:", error);
    return res.status(500).json({ success: false, message: "Server error submitting interest", error: error.message });
  }
};