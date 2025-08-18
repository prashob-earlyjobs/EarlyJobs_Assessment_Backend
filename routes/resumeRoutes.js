const express = require("express")
const puppeteer = require("puppeteer")
const Resume = require("../models/Resume")
const authMiddleware = require("../middlewares/authMiddleware")

const router = express.Router()

// GET all resumes for the logged-in user
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
    const userId = req.user.id
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
      { _id: req.params.id, created_by: userId }, // Ensure user owns the resume
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

// ATS analysis route (unchanged)
router.post("/ats/analyze", authMiddleware, async (req, res) => {
  try {
    const data = req.body

    let contactInfoScore = 0
    if (data.personalInfo.fullName) contactInfoScore += 20
    if (data.personalInfo.email) contactInfoScore += 20
    if (data.personalInfo.phone) contactInfoScore += 20
    if (data.personalInfo.location) contactInfoScore += 20
    if (data.personalInfo.linkedin || data.personalInfo.website || data.personalInfo.github) contactInfoScore += 20

    const keywordsScore = Math.min(data.skills.length * 10, 100)
    const formatScore = data.template ? 80 : 50
    const experienceScore = Math.min(data.workExperience.length * 20 + data.projects.length * 10, 100)
    const skillsScore = Math.min(data.skills.length * 10 + data.certifications.length * 5, 100)

    const totalScore = Math.round((contactInfoScore + keywordsScore + formatScore + experienceScore + skillsScore) / 5)

    const suggestions = []
    if (contactInfoScore < 80) suggestions.push("Complete all contact information fields.")
    if (keywordsScore < 50) suggestions.push("Add more relevant skills and keywords.")
    if (experienceScore < 50) suggestions.push("Include more work experience or projects.")
    if (skillsScore < 50) suggestions.push("Add more skills or certifications.")
    if (data.professionalSummary.length < 50) suggestions.push("Expand your professional summary for better impact.")

    if (suggestions.length === 0) suggestions.push("Your resume is well-optimized!")

    const atsScore = {
      totalScore,
      contactInfoScore,
      keywordsScore,
      formatScore,
      experienceScore,
      skillsScore,
      suggestions,
      lastUpdated: new Date().toISOString(),
    }

    res.json({ success: true, data: { atsScore } })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})


router.post("/resumes/:id/generate-pdf", authMiddleware, async (req, res) => {
  const { html } = req.body
  const userId = req.user.id

  if (!html) {
    return res.status(400).json({ success: false, message: "HTML content required" })
  }

  try {
    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    })
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: "networkidle0" })

    const pdf = await page.pdf({
  format: "Letter",
  printBackground: true,
  margin: { top: "0.5in", right: "0.5in", bottom: "0.5in", left: "0.5in" },
})

await browser.close()

const resume = await Resume.findById(req.params.id)
if (!resume) {
  return res.status(404).json({ success: false, message: "Resume not found" })
}

// ✅ force proper Buffer
resume.pdfBuffer = Buffer.from(pdf)
resume.pdfContentType = "application/pdf"
await resume.save()

    const filename = `${resume.personalInfo.fullName.replace(/\s+/g, "_") || "Resume"}.pdf`
    res.setHeader("Content-Type", "application/pdf")
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`)
    res.send(pdf)
  } catch (error) {
    console.error("PDF generation error:", error)
    res.status(500).json({ success: false, message: error.message })
  }
})

module.exports = router
