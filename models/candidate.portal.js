const mongoose = require('mongoose');

const CandidateAddressSchema = new mongoose.Schema(
  {
    street: { type: String, trim: true },
    area: { type: String, trim: true },
    city: { type: String, trim: true },
    pincode: { type: String, trim: true },
    fullAddress: { type: String, trim: true },
  },
  { _id: false }
);

const ExamScoreSchema = new mongoose.Schema(
  {
    examId: { type: mongoose.Schema.Types.ObjectId },
    examName: { type: String, required: true, trim: true },
    score: { type: Number, required: true },
    maxScore: { type: Number },
    percentage: { type: Number },
    takenAt: { type: Date, required: true },
  },
  { _id: false }
);

const RecommendedJobForCandidateSchema = new mongoose.Schema(
  {
    jobId: { type: mongoose.Schema.Types.ObjectId, required: true },
    jobType: { type: String, enum: ['main', 'sub'], required: true },
    recommendedAt: { type: Date, default: Date.now },
    reason: { type: String, trim: true },
  },
  { _id: false }
);

const AvailabilityStatusHistorySchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: ['Available', 'Placed', 'Do Not Contact'],
      required: true,
    },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    timestamp: { type: Date, default: Date.now },
    comments: { type: String, trim: true },
  },
  { _id: false }
);

const CandidateSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, trim: true, lowercase: true },
    phone: { type: String, required: true, unique: true, trim: true },

    // 🔹 Removed password and comparePassword
    // 🔹 Added source field
    source: { type: String, default: 'assessment' },

    resumeUrl: { type: String, trim: true },
    fatherName: { type: String, trim: true },
    dateOfBirth: { type: Date },
    gender: { type: String, enum: ['Male', 'Female', 'Other'] },
    aadharNumber: { type: String, trim: true },
    highestQualification: { type: String, trim: true },
    currentLocationDetails: CandidateAddressSchema,
    spokenLanguages: [{ type: String, trim: true }],
    totalExperienceYears: { type: Number, min: 0 },
    totalExperienceMonths: { type: Number, min: 0, max: 11 },
    skills: [{ type: String, trim: true }],
    preferredJobCategories: [{ type: String, trim: true }],
    preferredEmploymentTypes: [{ type: String, trim: true }],
    preferredWorkTypes: [{ type: String, enum: ['remote', 'hybrid', 'on-site'] }],
    candidateProfileStrength: { type: Number },
    aiResumeSummary: { type: String, trim: true },
    profileCreatedAt: { type: Date, default: Date.now },
    profileCreatedByUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    profileSource: {
      type: String,
      enum: ['self_applied', 'internal_upload', 'referral', 'talent_pool', 'assessment_platform' ],
    },
    availabilityStatus: {
      type: String,
      enum: ['Available', 'Placed', 'Do Not Contact'],
      default: 'Available',
    },
    availabilityStatusHistory: [AvailabilityStatusHistorySchema],
    jobRecommendations: [RecommendedJobForCandidateSchema],
    lastLoginAt: { type: Date },
    emailVerified: { type: Boolean, default: false },
    phoneVerified: { type: Boolean, default: false },
    optInJobRecommendationEmails: { type: Boolean, default: true },
    resumeS3Key: { type: String, trim: true },

    // 🔹 New field for experience level
    experienceLevel: {
      type: String,
      enum: ['Experienced', 'Fresher'],
      default: 'Fresher',
    },
  },
  { timestamps: true }
);

module.exports = CandidateSchema;
