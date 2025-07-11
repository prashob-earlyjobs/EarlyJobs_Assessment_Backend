// exports.uploadFile = (req, res) => {
//   if (!req.file) {
//     return res.status(400).json({ success: false, message: 'No file uploaded' });
//   }
//   res.status(200).json({
//     success: true,
//     message: 'File uploaded successfully',
//     fileUrl: req.file.location,
//   });
// };

const aws = require("aws-sdk");

const s3 = new aws.S3();

exports.uploadFile = async (req, res) => {
  if (!req.file) {
    return res
      .status(400)
      .json({ success: false, message: "No file uploaded" });
  }

  const { folderId } = req.params;
  const fileName = req.file.originalname.replace(/\s+/g, "-");
  const filePath = `${folderId}/${fileName}`;

  try {
    // Check if the file already exists in S3
    await s3
      .headObject({
        Bucket: process.env.AWS_S3_BUCKET,
        Key: filePath,
      })
      .promise();

    // File exists, return its URL
    const fileUrl = `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${filePath}`;
    return res.status(200).json({
      success: true,
      message: "File already exists",
      fileUrl,
    });
  } catch (error) {
    // If error is 404 (NotFound), proceed with upload
    if (error.code === "NotFound") {
      // File doesn't exist, upload was handled by multer-s3
      return res.status(200).json({
        success: true,
        message: "File uploaded successfully",
        fileUrl: req.file.location,
      });
    }
    // Other errors (e.g., permission issues)
    console.error("Error checking file existence:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to check file existence or upload file",
    });
  }
};
