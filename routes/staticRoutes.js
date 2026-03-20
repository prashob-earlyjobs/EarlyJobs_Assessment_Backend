const express = require('express');
const authMiddleware = require('../middlewares/authMiddleware');
const { getSkills, getRoles, getCategoriesForAIBuddy ,getCountries, getTools  } = require('../controllers/staticDataController');

const router = express.Router();

router.get('/skills', getSkills);

router.get('/roles',getRoles);

router.get('/categoriesForAIBuddy', getCategoriesForAIBuddy);

router.get('/countries', getCountries);

router.get('/tools', getTools);

module.exports = router;