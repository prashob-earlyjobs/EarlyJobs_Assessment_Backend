const express = require('express');
const authMiddleware = require('../middlewares/authMiddleware');
const { getSkills, getRoles } = require('../controllers/staticDataController');

const router = express.Router();

router.get('/skills', getSkills);

router.get('/roles',getRoles);

module.exports = router;