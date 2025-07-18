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

const getCandidateToken = async () => {
  if (
    cachedCandidateToken &&
    candidateTokenExpiry &&
    new Date() < candidateTokenExpiry
  ) {
    return cachedCandidateToken;
  }

  const params = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: process.env.CANDIDATE_CLIENT_ID,
    client_secret: process.env.CANDIDATE_CLIENT_SECRET,
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

  cachedCandidateToken = response.data.access_token;
  candidateTokenExpiry = new Date(
    Date.now() + (response.data.expires_in - 60) * 1000
  );

  return cachedCandidateToken;
};

const callVeloxhireApi = async (
  endpoint,
  method = "GET",
  data = {},
  isGetAssessmentLink = false
) => {
  const token = await getAccessToken();
  console.log("token", token);

  const config = {
    method,
    url: `https://api.veloxhire.ai/api${endpoint}`,
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };

  if (method === "POST" || method === "PUT") {
    config.data = data;
  }

  const res = await axios(config);
  return {
    success: true,
    data: res.data,
  };
};

module.exports = { callVeloxhireApi, getCandidateToken };
