const express = require('express');
const {
  getMyResults,
  getResult,
  getAnalytics,
  createResult
} = require('../controllers/resultController');
const authMiddleware = require('../middlewares/authMiddleware');
const { getPublicResults } = require('../controllers/resultPublicController');

const router = express.Router();

// Routes
router.get('/public', getPublicResults);
router.get('/', authMiddleware, getMyResults);
router.get('/analytics', authMiddleware, getAnalytics);
router.get('/:id', authMiddleware, getResult);
router.post('/results', authMiddleware, createResult);

module.exports = router;