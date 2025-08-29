const express = require("express")
const puppeteer = require("puppeteer")
const Resume = require("../models/Resume")
const authMiddleware = require("../middlewares/authMiddleware")

const router = express.Router()


router.get("/resumes", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id

    const resumes = await Resume.find({ created_by: userId })
    if (resumes.length === 0) {
      return res.status(404).json({ success: false, message: "No resumes found" })
    }
    res.json({ success: true, data: resumes }) // Return all resumes
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

router.post("/resumes", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const resumeData = req.body

    const resume = new Resume({ created_by: userId, ...resumeData })
    await resume.save()
    res.json({ success: true, data: resume })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})


router.put("/resumes/:id", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id
    const resumeData = req.body

    const resume = await Resume.findOneAndUpdate(
      { _id: req.params.id, created_by: userId }, 
      resumeData,
      { new: true, runValidators: true },
    )

    if (!resume) {
      return res.status(404).json({ success: false, message: "Resume not found or access denied" })
    }
    res.json({ success: true, data: resume })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})


router.delete("/resumes/:id", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const resume = await Resume.findOneAndDelete({
      _id: req.params.id,
      created_by: userId,
    });

    if (!resume) {
      return res.status(404).json({
        success: false,
        message: "Resume not found or access denied",
      });
    }

    res.json({ success: true, message: "Resume deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});







module.exports = router
