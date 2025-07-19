const express = require("express");
const { body } = require("express-validator");
const {
  getAssessments,
  getAssessment,
  submitAssessment,
  getAssessmentsByUser,
  getUserStats,
  storeAssessmentDetails,
  matchAssessmentsDetails,
  getPaidAssessments,
} = require("../controllers/assessmentController");
const authMiddleware = require("../middlewares/authMiddleware");
const roleMiddleware = require("../middlewares/roleMiddleware");
const {
  callVeloxhireApi,
  getCandidateToken,
} = require("../controllers/veloxhireController");

const router = express.Router();

// Validation rules
const submitValidation = [
  body("assessmentId").isMongoId().withMessage("Invalid assessment ID"),
  body("answers").isArray({ min: 1 }).withMessage("Answers array is required"),
  body("timeTaken").isNumeric().withMessage("Time taken must be a number"),
];

// Routes
router.get(
  "/",
  authMiddleware,
  roleMiddleware(["candidate", "super_admin", "franchise_admin"]),
  getAssessments
);
router.get("/:id", authMiddleware, getAssessment);
router.post(
  "/submit",
  authMiddleware,
  roleMiddleware(["candidate"]),
  submitValidation,
  submitAssessment
);
router.get("/getAssessments/:userId", authMiddleware, getAssessmentsByUser);
router.get("/getUserStats/:userId", authMiddleware, getUserStats);
router.post(
  "/getAssessmentLink/:assessmentId",
  authMiddleware,
  async (req, res) => {
    const body = [{ ...req.body, ShouldSendInvitationEmail: false }];
    console.log("bodyArray", body);
    try {
      const response = await callVeloxhireApi(
        `/assessment/${req.params.assessmentId}/interviews`,
        "POST",
        body,
        true
      );
      const candidateToken = await getCandidateToken();
      if (!candidateToken)
        return res
          .status(400)
          .json({ message: "Failed to fetch candidate token" });

      if (response.length === 0)
        return res.status(400).json({ message: "You are already interviewed" });
      res.json({
        success: true,
        data: {
          ...response.data[0],
          publicLink: `https://platform.earlyjobs.ai/auth/?session_key=${candidateToken}&interview_id=${response.data[0].interviewId}&full_name=${req.body.firstName}&first_name=${req.body.firstName}&last_name=${req.body.lastName}&avatar_url=${req.body.avatar_url}&email_address=${req.body.email}`,
        },
      });
    } catch (error) {
      console.error("Error calling Veloxhire API:", error);
      res.status(500).json({ message: "Failed to fetch assessment data" });
    }
  }
);

router.post(
  "/storeAssessmentDetails/:userId",
  authMiddleware,
  storeAssessmentDetails
);
router.get(
  "/matchAssessmentsDetails/:userId/:assessmentId",
  authMiddleware,
  matchAssessmentsDetails
);
router.get("/getPaidAssessments/:userId", authMiddleware, getPaidAssessments);
module.exports = router;
