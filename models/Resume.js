// models/Resume.js
const mongoose = require("mongoose")

const resumeSchema = new mongoose.Schema(
  {
    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    personalInfo: {
      fullName: String,
      email: String,
      phone: String,
      location: String,
      linkedin: String,
      website: String,
      github: String,
    },
    professionalSummary: String,
    education: [
      {
        id: String,
        school: String,
        degree: String,
        field: String,
        startDate: String,
        endDate: String,
        gpa: String,
      },
    ],
    workExperience: [
      {
        id: String,
        company: String,
        position: String,
        startDate: String,
        endDate: String,
        description: [String],
        index: Number,
      },
    ],
    skills: [String],
    certifications: [String],
    projects: [
      {
        id: String,
        name: String,
        description: String,
        technologies: String,
        link: String,
      },
    ],
    achievements: [
      {
        id: String,
        title: String,
        description: String,
        date: String,
      },
    ],
    extracurriculars: [
      {
        id: String,
        activity: String,
        role: String,
        description: String,
        startDate: String,
        endDate: String,
      },
    ],
    profilePicture: String, // Base64 string
    template: String,
    sectionOrder: [
      {
        id: String,
        name: String,
        visible: Boolean,
      },
    ],
    atsScore: Object,
    pdfBuffer: Buffer, // Store PDF binary
    pdfContentType: { type: String, default: "application/pdf" },
  },
  { timestamps: true },
)

module.exports = mongoose.model("Resume", resumeSchema)
