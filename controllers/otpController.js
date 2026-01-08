const axios = require('axios');
const OTP = require('../models/otpmodel'); // Reusing OTP model from authController.js
const Interest = require('../models/Interest');

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
    console.log(otp);
    const response = await axios.get("https://enterprise.smsgupshup.com/GatewayAPI/rest", { params });
    console.log(response.data);
    if (response.data.toLowerCase().includes("success")) {
      return { success: true, message: "SMS OTP sent successfully" };
    } else {
      return { success: false, message: response.data };
    }
  } catch (error) {
    return { success: false, message: error.message };
  }
};


// Send OTP via Gupshup SMS
const sendOtpwhatsapp = async (phoneNumber, otp) => {
  const GUPHSHUP_API_URL = "https://mediaapi.smsgupshup.com/GatewayAPI/rest";

  const params = {
    userid: process.env.GUPSHUP_USER_ID,
    password: process.env.GUPSHUP_PASSWORD,
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
    const sentWhatsappResponse = await sendOtpwhatsapp(mobile, otp);

    console.log(sentWhatsappResponse);
  

    console.log(smsResponse);
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
  const { 
    name, 
    email, 
    companyName, 
    companyAddress, 
    mobile, 
    mobileOtp, 
    interviewScheduleDate, 
    interviewMode, 
    candidateName 
  } = req.body;

  // Validate required fields
  if (!name || !email || !companyName || !mobile || !mobileOtp || !interviewScheduleDate || !interviewMode || !candidateName) {
    return res.status(400).json({ 
      success: false, 
      message: "All fields are required: name, email, companyName, companyAddress, mobile, mobileOtp, interviewScheduleDate, interviewMode, and candidateName" 
    });
  }

  // Validate mobile number format
  if (!/^\+91\d{10}$/.test(mobile)) {
    return res.status(400).json({ 
      success: false, 
      message: "Valid mobile number with +91 country code and 10 digits is required" 
    });
  }

  // Validate email format
  const emailRegex = /^\S+@\S+\.\S+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ 
      success: false, 
      message: "Please enter a valid email address" 
    });
  }

  // Validate interview mode
  const validInterviewModes = ['Offline', 'Online', 'Hybrid'];
  if (!validInterviewModes.includes(interviewMode)) {
    return res.status(400).json({ 
      success: false, 
      message: "Interview mode must be one of: Offline, Online, or Hybrid" 
    });
  }

  // Validate and parse interview schedule date
  let parsedDate;
  try {
    // Handle dd/mm/yyyy format
    if (interviewScheduleDate.includes('/')) {
      const [day, month, year] = interviewScheduleDate.split('/');
      parsedDate = new Date(`${year}-${month}-${day}`);
    } else {
      parsedDate = new Date(interviewScheduleDate);
    }
    
    if (isNaN(parsedDate.getTime())) {
      return res.status(400).json({ 
        success: false, 
        message: "Invalid interview schedule date format. Please use dd/mm/yyyy format" 
      });
    }

    // Check if date is in the future
    if (parsedDate < new Date()) {
      return res.status(400).json({ 
        success: false, 
        message: "Interview schedule date cannot be in the past" 
      });
    }
  } catch (dateError) {
    return res.status(400).json({ 
      success: false, 
      message: "Invalid interview schedule date format. Please use dd/mm/yyyy format" 
    });
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

    // Save interest to database
    const interest = await Interest.create({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      companyName: companyName.trim(),
      companyAddress: companyAddress.trim(),
      mobile: mobile.trim(),
      interviewScheduleDate: parsedDate,
      interviewMode: interviewMode.trim(),
      candidateName: candidateName.trim(),
      submittedAt: new Date(),
      status: 'pending'
    });

    return res.status(201).json({ 
      success: true, 
      message: "Interest expressed successfully",
      data: {
        id: interest._id,
        name: interest.name,
        email: interest.email,
        companyName: interest.companyName,
        interviewScheduleDate: interest.interviewScheduleDate,
        interviewMode: interest.interviewMode,
        status: interest.status,
        submittedAt: interest.submittedAt
      }
    });
  } catch (error) {
    console.error("Submit interest error:", error);
    
    // Handle duplicate entry (if unique constraint exists)
    if (error.code === 11000) {
      return res.status(409).json({ 
        success: false, 
        message: "An interest submission with this email or mobile already exists" 
      });
    }

    // Handle validation errors
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(e => e.message);
      return res.status(400).json({ 
        success: false, 
        message: "Validation error", 
        errors: errors 
      });
    }

    return res.status(500).json({ 
      success: false, 
      message: "Server error submitting interest", 
      error: error.message 
    });
  }
};