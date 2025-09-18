const express = require('express');
const router = express.Router();
const { getAllCandidates ,getassessmentsByUser} = require('../controllers/candidateController');
const {callVeloxhireApi} = require('../controllers/veloxhireController')


router.get('/candidates', getAllCandidates);
router.get('/assessments/:userId',getassessmentsByUser);
router.get(
  "/getResultForCandidateAssessment/:interviewId",
  
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
router.get("/getRecording/:interviewId",  async (req, res) => {
  try {
    const data = await callVeloxhireApi(
      `/report/new/${req.params.interviewId}/recording`
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
});
router.get("/getTranscript/:interviewId",async (req, res) => {
  try {
    const data = await callVeloxhireApi(
      `/report/new/${req.params.interviewId}/enhanceSpeechTranscript`
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
});
module.exports = router;

