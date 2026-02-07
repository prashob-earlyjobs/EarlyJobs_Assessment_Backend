const express = require('express');
const router = express.Router();
const {
  storeDynamicLink,
  getDynamicLinks,
  getDynamicLinkById,
} = require('../controllers/dynamicLinkController');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');

// Store link from Flutter app (public - no auth)
router.post('/', storeDynamicLink);

// List and get by id (admin only - optional: remove auth if you want public read)
router.get(
  '/',
  authMiddleware,
  roleMiddleware(['super_admin', 'ADMIN']),
  getDynamicLinks
);
router.get(
  '/:id',
  authMiddleware,
  roleMiddleware(['super_admin', 'ADMIN']),
  getDynamicLinkById
);

module.exports = router;
