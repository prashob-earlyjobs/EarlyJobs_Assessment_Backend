const express = require('express');
const router = express.Router();
const { getAllCandidates } = require('../controllers/candidateController');


router.get('/candidates', getAllCandidates);

module.exports = router;