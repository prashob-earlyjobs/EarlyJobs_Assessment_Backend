const axios = require("axios");

let cachedToken = null;
let tokenExpiry = null;

const getAccessToken = async () => {
  // If token exists and not expired, reuse it
  if (cachedToken && tokenExpiry && new Date() < tokenExpiry) {
    return cachedToken;
  }

  const response = await axios.post(
    "https://identity.veloxhire.ai/connect/token",
    new URLSearchParams({
      grant_type: "client_credentials",
      client_id: "veloxhire.app.EarlyJobs.production",
      client_secret: "BpusD4lzGSg2hED3Mn9f",
      scope: "veloxhireapi.production",
    }),
    {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    }
  );

  cachedToken = response.data.access_token;
  tokenExpiry = new Date(Date.now() + (response.data.expires_in - 60) * 1000); // subtract 60 sec for buffer

  return cachedToken;
};

let cachedCandidateToken = null;
let candidateTokenExpiry = null;

const getCandidateToken = async () => {
  // Reuse if not expired
  if (
    cachedCandidateToken &&
    candidateTokenExpiry &&
    new Date() < candidateTokenExpiry
  ) {
    return cachedCandidateToken;
  }

  const response = await axios.post(
    "https://identity.veloxhire.ai/connect/token",
    new URLSearchParams({
      grant_type: "client_credentials",
      client_id: "veloxhire.app.candidate.EarlyJobs.production",
      client_secret: "LpveN2xzQTd1gLC4Yw8k",
      scope: "veloxhireapi.production",
    }),
    {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    }
  );

  // Cache token and expiry
  cachedCandidateToken = response.data.access_token;
  candidateTokenExpiry = new Date(
    Date.now() + (response.data.expires_in - 60) * 1000
  ); // subtract 60s as buffer

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
  console.log("res", res.data);
  return {
    success: true,
    data: res.data,
  };
};

module.exports = { callVeloxhireApi, getCandidateToken };
