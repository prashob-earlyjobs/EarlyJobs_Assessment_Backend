const crypto = require("crypto");

function verifySignature({
  rawBody,
  signature,
  timestamp,
  secret,
  tolerance = 300
}) {
  console.log(rawBody , signature , timestamp , secret," Verifying signature with:")  
  if (!rawBody || !signature || !timestamp || !secret) {
    return false;
  }

  console.log("Verifying webhook signature...(payload success)");
  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return false;

    console.log("Verifying webhook signature...(timetsamp success)");
  // 🔁 Replay protection
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - ts) > tolerance) {
    return false;
  }

  console.log("Verifying webhook signature...(replay protection success)");

  // 🔐 Rebuild EXACT signed payload
  const payloadString = rawBody.toString(); // must match source payload
  const signedPayload = `${timestamp}.${payloadString}`;
console.log("DEST rawBody >>>");
console.log(rawBody.toString());

console.log("DEST signedPayload >>>");
console.log(`${timestamp}.${rawBody.toString()}`);

  // 🔐 Generate expected signature
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(signedPayload)
    .digest("hex");

  // 🔐 Timing-safe comparison
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature, "hex"),
      Buffer.from(signature, "hex")
    );
  } catch (e) {
    console.error("Error in timing-safe comparison:", e);
    return false;
  }
}

module.exports = {
  verifySignature
};