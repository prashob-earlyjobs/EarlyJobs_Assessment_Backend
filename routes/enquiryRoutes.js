const express = require('express');
const router = express.Router();
const {
  submitEnquiry,
  getEnquiries,
  getEnquiryById,
  updateEnquiryStatus,
} = require('../controllers/enquiryController');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');

// Submit enquiry (public route)
router.post('/submit', submitEnquiry);

// Get all enquiries (admin only)
router.get(
  '/',
  authMiddleware,
  roleMiddleware(['super_admin', 'ADMIN']),
  getEnquiries
);

// Get enquiry by ID (admin only)
router.get(
  '/:id',
  authMiddleware,
  roleMiddleware(['super_admin', 'ADMIN']),
  getEnquiryById
);

// Update enquiry status (admin only)
router.put(
  '/:id/status',
  authMiddleware,
  roleMiddleware(['super_admin', 'ADMIN']),
  updateEnquiryStatus
);

module.exports = router;

