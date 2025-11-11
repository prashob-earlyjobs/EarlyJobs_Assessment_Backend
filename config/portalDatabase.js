const mongoose = require("mongoose");

let portalConnection;

const connectPortalDB = async () => {
  if (portalConnection) return portalConnection;

  portalConnection = await mongoose.createConnection(process.env.PORTAL_MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

  const client = portalConnection.getClient();
  const host =
    client?.options?.srvHost ||
    client?.options?.hosts?.[0]?.host ||
    "Unknown host";

  console.log(`Portal MongoDB Connected: ${host}`);
  return portalConnection;
};

module.exports = { connectPortalDB, getPortalDB: () => portalConnection };
