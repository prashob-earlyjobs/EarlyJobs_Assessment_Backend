const express = require('express');
const router = express.Router();
const upload = require('../utils/s3Upload');
const { uploadFile } = require('../controllers/uploadController');

// POST /api/upload/:folderId
router.post('/:folderId', upload.single('file'), uploadFile);

module.exports = router;