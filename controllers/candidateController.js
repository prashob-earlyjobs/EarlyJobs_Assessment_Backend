const User = require('../models/User');

const axios = require("axios");
require("dotenv").config(); // load env variables

let cachedToken = null;
let tokenExpiry = null;

const getAccessToken = async () => {
  if (cachedToken && tokenExpiry && new Date() < tokenExpiry) {
    return cachedToken;
  }

  const params = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: process.env.VELOX_CLIENT_ID,
    client_secret: process.env.VELOX_CLIENT_SECRET,
    scope: process.env.VELOX_SCOPE,
  });

  const response = await axios.post(
    "https://identity.veloxhire.ai/connect/token",
    params,
    {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    }
  );

  cachedToken = response.data.access_token;
  tokenExpiry = new Date(Date.now() + (response.data.expires_in - 60) * 1000);

  return cachedToken;
};

let cachedCandidateToken = null;
let candidateTokenExpiry = null;






const getAllCandidates = async (req, res) => {
  try {
    
    const candidates = await User.find({ 
      role: 'candidate',
      assessmentsPaid: { $exists: true, $not: { $size: 0 } }
    })
      .select('-password')
      .lean();

    if (!candidates || candidates.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No candidates with paid assessments found'
      });
    }

    res.status(200).json({
      success: true,
      count: candidates.length,
      data: candidates
    });
  } catch (error) {
    console.error('Error fetching candidates:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching candidates',
      error: error.message
    });
  }
};
module.exports = { getAllCandidates };