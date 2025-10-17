const express = require('express');
const router = express.Router();
const { getAllTeamMembers, createTeamMember, updateTeamMember, deleteTeamMember } = require('../controllers/teamController');



router.get('/team-members',  getAllTeamMembers);
router.post('/team-members', createTeamMember);
router.put('/team-members/:id', updateTeamMember);
router.delete('/team-members/:id', deleteTeamMember);

module.exports = router;