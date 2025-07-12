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

const callVeloxhireApi = async (endpoint, method = "GET", data = {}) => {
  const token = await getAccessToken();

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
    access_token: token,
  };
};

module.exports = { callVeloxhireApi };
