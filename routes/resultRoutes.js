const express = require('express');
const {
  getMyResults,
  getResult,
  getAnalytics
} = require('../controllers/resultController');
const authMiddleware = require('../middlewares/authMiddleware');

const router = express.Router();

// Routes
router.get('/', authMiddleware, getMyResults);
router.get('/analytics', authMiddleware, getAnalytics);
router.get('/:id', authMiddleware, getResult);

module.exports = router;