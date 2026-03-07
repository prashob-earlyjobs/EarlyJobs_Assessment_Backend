const express = require('express');
const router = express.Router();
const roleMiddleware = require("../middlewares/roleMiddleware");
const authMiddleware = require("../middlewares/authMiddleware");

const { addCategoryForAIBuddy, deleteCategoryForAIBuddy,addSubCategoryForAIBuddy ,deleteSubCategoryForAIBuddy} = require('../controllers/interviewBuddyController');

router.post('/addCategoryForAIBuddy',authMiddleware,roleMiddleware(["super_admin", "ADMIN"]),addCategoryForAIBuddy);

router.delete('/deleteCategoryForAIBuddy', authMiddleware, roleMiddleware(["super_admin", "ADMIN"]),deleteCategoryForAIBuddy);

router.post('/addSubCategoryForAIBuddy', authMiddleware, roleMiddleware(["super_admin", "ADMIN"]), addSubCategoryForAIBuddy);

router.delete('/deleteSubCategoryForAIBuddy', authMiddleware, roleMiddleware(["super_admin", "ADMIN"]), deleteSubCategoryForAIBuddy);

module.exports = router;
