const { Storage } = require("@google-cloud/storage");
const { randomUUID } = require("crypto");
const path = require("path");

/* =========================================================
   GCS CONFIG
========================================================= */

const gcpCredentialsJson = process.env.GCP_CREDENTIALS_JSON;

if (!gcpCredentialsJson) {
  throw new Error("GCP_CREDENTIALS_JSON environment variable is not set");
}

let credentials;
try {
  credentials = JSON.parse(gcpCredentialsJson);
} catch (err) {
  throw new Error("Invalid GCP_CREDENTIALS_JSON format");
}

const storage = new Storage({
  projectId: credentials.project_id,
  credentials,
});

const bucketName = process.env.GCS_BUCKET_NAME;
if (!bucketName) {
  throw new Error("GCS_BUCKET_NAME environment variable is not set");
}

const gcsBucket = storage.bucket(bucketName);

/* =========================================================
   UPLOAD FUNCTION (req.file OR base64)
========================================================= */

const uploadPublicFile = async ({
  file,
  base64,
  fileName,
  folder = "General_Uploads",
}) => {
  try {
    console.log("Uploading to GCS...");

    if (!file && !base64) {
      throw new Error("Either file or base64 must be provided");
    }

    // sanitize folder
    const safeFolder = folder.trim().replace(/^\/|\/$/g, "");
    if (safeFolder.includes("..")) {
      throw new Error("Invalid folder path");
    }

    let buffer;
    let mimetype;
    let originalName;

    // CASE 1: Multer file
    if (file) {
      buffer = file.buffer;
      mimetype = file.mimetype;
      originalName = file.originalname;
    }
    // CASE 2: Base64
    else {
      if (!fileName) {
        throw new Error("fileName is required when using base64");
      }

      const base64Data = base64.includes(",")
        ? base64.split(",")[1]
        : base64;

      buffer = Buffer.from(base64Data, "base64");
      mimetype = getMimeTypeFromBase64(base64);
      originalName = fileName;
    }

    const uniqueFilename = `${randomUUID()}${path.extname(originalName)}`;
    const destination = `${safeFolder}/${uniqueFilename}`;

    const blob = gcsBucket.file(destination);

    return await new Promise((resolve, reject) => {
      const blobStream = blob.createWriteStream({
        resumable: false,
        contentType: mimetype,
      });

      blobStream.on("error", (err) => {
        reject(new Error(`GCS upload failed: ${err.message}`));
      });

      blobStream.on("finish", () => {
        const publicUrl = `https://storage.googleapis.com/${gcsBucket.name}/${blob.name}`;
        resolve(publicUrl);
      });

      blobStream.end(buffer);
    });
  } catch (err) {
    console.error("GCS Upload Error:", err.message);
    throw err; // important: rethrow for controller/worker to handle
  }
};

/* =========================================================
   HELPERS
========================================================= */

const getMimeTypeFromBase64 = (base64) => {
  const match = base64.match(/^data:(.+);base64,/);
  return match ? match[1] : "application/octet-stream";
};

module.exports = {
  uploadPublicFile,
};
