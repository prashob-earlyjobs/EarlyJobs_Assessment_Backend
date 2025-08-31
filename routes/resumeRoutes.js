const express = require("express");
const Resume = require("../models/Resume");
const authMiddleware = require("../middlewares/authMiddleware");
const multer = require('multer');
const router = express.Router();

const storage = multer.memoryStorage();
const upload = multer({ storage });

router.get("/resumes", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const resumes = await Resume.find({ created_by: userId });
    if (resumes.length === 0) {
      return res.status(404).json({ success: false, message: "No resumes found" });
    }
    res.json({ success: true, data: resumes });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post(
  "/resumes/fromForm",
  authMiddleware,
  upload.single("pdf"), 
  async (req, res) => {
    try {
      const userId = req.user.id || req.user._id;

      // resumeData comes as string, need to parse it
      const resumeData = JSON.parse(req.body.resumeData);

      // handle pdf file (optional)
      let pdfBuffer = null;
      let pdfContentType = "application/pdf";
      if (req.file) {
        pdfBuffer = req.file.buffer;
        pdfContentType = req.file.mimetype;
      }

      const resume = new Resume({
        created_by: userId,
        sector: "Normal",
        ...resumeData,
        pdfBuffer,
        pdfContentType,
      });

      await resume.save();
      res.json({ success: true, data: resume });
    } catch (error) {
      console.error("Error saving resume:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

router.post("/resumes/fromPDF", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const resumeData = req.body;
    const resume = new Resume({ created_by: userId, sector: "FromPDF", ...resumeData });
    await resume.save();
    res.json({ success: true, data: resume });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post("/resumes/fromJDE", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const resumeData = req.body;
    const resume = new Resume({ created_by: userId, sector: "JDE", ...resumeData });
    await resume.save();
    res.json({ success: true, data: resume });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/resumes/:id', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const resume = await Resume.findOne({ _id: req.params.id, created_by: userId });
    if (!resume) {
      return res.status(404).json({ success: false, message: 'Resume not found or access denied' });
    }
    res.json({ success: true, data: resume });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/resumes/:id', authMiddleware, upload.single('pdf'), async (req, res) => {
  try {
    const userId = req.user.id;
    const resumeData = JSON.parse(req.body.resumeData || '{}');
    const pdfFile = req.file;

    // Validate resumeData
    if (!resumeData || typeof resumeData !== 'object') {
      return res.status(400).json({ success: false, message: 'Invalid resume data' });
    }

    // Ensure required fields are present
    if (!resumeData.personalInfo || !resumeData.personalInfo.fullName || !resumeData.personalInfo.email || !resumeData.personalInfo.phone) {
      return res.status(400).json({ success: false, message: 'Missing required fields: fullName, email, or phone' });
    }

    // Fetch existing resume to preserve sector
    const existingResume = await Resume.findOne({ _id: req.params.id, created_by: userId });
    if (!existingResume) {
      return res.status(404).json({ success: false, message: 'Resume not found or access denied' });
    }

    // Update resume with provided data, preserving sector
    const resume = await Resume.findOneAndUpdate(
      { _id: req.params.id, created_by: userId },
      {
        $set: {
          personalInfo: resumeData.personalInfo,
          professionalSummary: resumeData.professionalSummary,
          education: resumeData.education,
          workExperience: resumeData.workExperience,
          skills: resumeData.skills,
          certifications: resumeData.certifications,
          projects: resumeData.projects,
          achievements: resumeData.achievements,
          extracurriculars: resumeData.extracurriculars,
          template: resumeData.template,
          sectionOrder: resumeData.sectionOrder,
          pdfBuffer: pdfFile ? pdfFile.buffer : existingResume.pdfBuffer, // Preserve existing PDF if none provided
          updated_at: new Date(),
        },
      },
      { new: true, runValidators: true }
    );

    if (!resume) {
      return res.status(404).json({ success: false, message: 'Resume not found or access denied' });
    }

    res.json({ success: true, data: resume });
  } catch (error) {
    console.error('Error updating resume:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

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

// router.get('/resumes/:id/pdf', authMiddleware, async (req, res) => {
//   try {
//     const userId = req.user.id;
//     const resume = await Resume.findOne({ _id: req.params.id, created_by: userId });

//     if (!resume || !resume.pdfBuffer) {
//       return res.status(404).json({ success: false, message: 'Resume or PDF not found' });
//     }

//     res.set({
//       'Content-Type': 'application/pdf',
//       'Content-Disposition': `attachment; filename="${resume.personalInfo?.fullName || 'resume'}.pdf"`,
//     });
//     res.send(resume.pdfBuffer);
//   } catch (error) {
//     res.status(500).json({ success: false, message: error.message });
//   }
// });

module.exports = router;