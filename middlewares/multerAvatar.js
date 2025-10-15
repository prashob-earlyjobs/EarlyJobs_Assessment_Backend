const multer = require("multer");
const aws = require("aws-sdk");
const multerS3 = require("multer-s3");

const s3 = new aws.S3();

const uploadAvatar = multer({
  storage: multerS3({
    s3: s3,
    bucket: process.env.AWS_S3_BUCKET,
   
    metadata: (req, file, cb) => {
      cb(null, { fieldName: file.fieldname });
    },
    key: (req, file, cb) => {
      const fileName = file.originalname.replace(/\s+/g, "-");
      const filePath = `users/${req.body.email || Date.now()}/avatar-${Date.now()}-${fileName}`;
      cb(null, filePath);
    },
  }),
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(file.originalname.toLowerCase());

    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error("Only JPEG and PNG images are allowed"));
  },
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
});

module.exports = { uploadAvatar };