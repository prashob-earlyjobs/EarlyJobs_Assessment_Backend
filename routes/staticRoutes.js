const express = require('express');
const authMiddleware = require('../middlewares/authMiddleware');
const { getSkills, getRoles, getCategoriesForAIBuddy    } = require('../controllers/staticDataController');

const router = express.Router();

router.get('/skills', getSkills);

router.get('/roles',getRoles);

router.get('/categoriesForAIBuddy', getCategoriesForAIBuddy);

module.exports = router;