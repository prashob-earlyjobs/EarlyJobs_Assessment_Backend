
// models/Result.js
const mongoose = require('mongoose');

const answerSchema = new mongoose.Schema({
  questionId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  type: {
    type: String,
    enum: ['mcq', 'coding', 'video'],
    required: true
  },
  // MCQ answer
  selectedOption: Number,
  // Coding answer
  code: String,
  language: String,
  executionTime: Number,
  testCasesPassed: Number,
  totalTestCases: Number,
  // Video answer
  videoUrl: String,
  videoDuration: Number,
  // Common fields
  timeSpent: Number,
  isCorrect: Boolean,
  pointsEarned: {
    type: Number,
    default: 0
  }
});
// answers: [answerSchema],


const resultSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  assessmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Assessment',
    required: true
  },
  score: {
    type: Number,
    required: true,
    min: 0,
    max: 100
  },
  totalPoints: Number,
  maxPoints: Number,
  timeTaken: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['pass', 'fail'],
    required: true
  },
  resultDetails: {
    categoryWiseScore: [{
      category: String,
      score: Number,
      maxScore: Number
    }],
    strengths: [String],
    weaknesses: [String],
    recommendations: [String]
  },
  feedback: {
    recruiterFeedback: String,
    systemFeedback: String,
    rating: {
      type: Number,
      min: 1,
      max: 5
    }
  },
  isReviewed: {
    type: Boolean,
    default: false
  },
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  reviewedAt: Date
}, {
  timestamps: true
});

// Compound index for efficient queries
resultSchema.index({ userId: 1, assessmentId: 1 }, { unique: true });
resultSchema.index({ score: -1, createdAt: -1 });
resultSchema.index({ status: 1, isReviewed: 1 });

module.exports = mongoose.model('Result', resultSchema);
