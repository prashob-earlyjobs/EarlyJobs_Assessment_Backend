const express = require("express");
const { body } = require("express-validator");
const {
  getAllUsers,
  updateUserStatus,
  getFranchiseUsers,
  getFranchiser,
  getTransactions,
  getFranchiseTransactionsAndEarnings,
  addFranchiser,
  getFranchises,
} = require("../controllers/adminController");
const {
  addAssessment,
  editAssessment,
  getAssessmentsByUser,
} = require("../controllers/assessmentController");

const { callVeloxhireApi } = require("../controllers/veloxhireController");

const roleMiddleware = require("../middlewares/roleMiddleware");
const authMiddleware = require("../middlewares/authMiddleware");

const router = express.Router();

// Validation rules

// Auth routes

router.get(
  "/getUsers",
  authMiddleware,
  roleMiddleware(["super_admin"]),
  getAllUsers
);
router.put(
  "/users/:id/status",
  authMiddleware,
  roleMiddleware(["super_admin"]),
  updateUserStatus
);
router.get(
  "/getUsersForFranchise/:franchiseId",
  authMiddleware,
  roleMiddleware(["franchise_admin"]),
  getFranchiseUsers
);

router.post(
  "/addAssessment",
  authMiddleware,
  roleMiddleware(["super_admin"]),
  addAssessment
);
router.put(
  "/editAssessment/:assessmentId",
  authMiddleware,
  roleMiddleware(["super_admin"]),
  editAssessment
);
router.get(
  "/getFranchiser/:franchiserId",
  authMiddleware,
  roleMiddleware(["super_admin", "franchise_admin"]),
  getFranchiser
);

router.get(
  "/getTransactions/",
  authMiddleware,
  roleMiddleware(["super_admin"]),
  getTransactions
);
router.get(
  "/franchise/getTransactions/",
  authMiddleware,
  roleMiddleware(["franchise_admin"]),
  getFranchiseTransactionsAndEarnings
);

router.post(
  "/addFranchiser",
  authMiddleware,
  roleMiddleware(["super_admin"]),
  addFranchiser
);
router.get(
  "/getFranchises",
  authMiddleware,
  roleMiddleware(["super_admin"]),
  getFranchises
);
router.get(
  "/getAssessmentsVelox",
  authMiddleware,
  roleMiddleware(["super_admin"]),
  async (req, res) => {
    try {
      const data = await callVeloxhireApi("/assessment");

      res.json(data.data);
    } catch (error) {
      console.error("Error calling Veloxhire API:", error.message);
      res.status(500).json({ message: "Failed to fetch assessment data" });
    }
  }
);

router.get(
  "/getCandidatesForAssessment/:assessmentId",
  authMiddleware,
  roleMiddleware(["super_admin"]),
  async (req, res) => {
    try {
      const data = await callVeloxhireApi(
        `/assessment/${req.params.assessmentId}/interviews`
      );

      res.json({
        success: true,
        data: data.data,
      });
    } catch (error) {
      console.error("Error calling Veloxhire API:", error.message);
      res.status(500).json({ message: "Failed to fetch assessment data" });
    }
  }
);
router.get(
  "/getResultForCandidateAssessment/:interviewId",
  authMiddleware,
  roleMiddleware(["candidate", "super_admin"]),
  async (req, res) => {
    try {
      const data = await callVeloxhireApi(
        `/report/new/${req.params.interviewId}`
      );

      res.json({
        success: true,
        data: data.data,
      });
    } catch (error) {
      res.json({
        success: false,
        message: "Something went wrong please try again later",
      });
    }
  }
);
router.get("/getRecording/:interviewId", authMiddleware, async (req, res) => {
  try {
    const data = await callVeloxhireApi(
      `/report/new/${req.params.interviewId}/recording`
    );
    console.log("data", data);
    res.json({
      success: true,
      data: data.data,
    });
  } catch (error) {
    res.json({
      success: false,
      message: "Something went wrong please try again later",
    });
  }
});
router.get("/getTranscript/:interviewId", authMiddleware, async (req, res) => {
  try {
    const data = await callVeloxhireApi(
      `/report/new/${req.params.interviewId}/enhanceSpeechTranscript`
    );
    console.log("data", data);
    res.json({
      success: true,
      data: data.data,
    });
  } catch (error) {
    res.json({
      success: false,
      message: "Something went wrong please try again later",
    });
  }
});
module.exports = router;
