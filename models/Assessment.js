
// models/Assessment.js
const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  questionText: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['mcq', 'coding', 'video'],
    required: true
  },
  // MCQ specific fields
  options: [{
    text: String,
    isCorrect: Boolean
  }],
  // Coding specific fields
  codeTemplate: String,
  testCases: [{
    input: String,
    expectedOutput: String,
    isHidden: {
      type: Boolean,
      default: false
    }
  }],
  // Video specific fields
  videoPrompt: String,
  maxDuration: {
    type: Number,
    default: 120 // seconds
  },
  // Common fields
  points: {
    type: Number,
    default: 1
  },
  difficulty: {
    type: String,
    enum: ['easy', 'medium', 'hard'],
    default: 'medium'
  }
});

const assessmentSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Assessment title is required'],
    trim: true,
    maxLength: [100, 'Title cannot exceed 100 characters']
  },
  
  description: {
    type: String,
    maxLength: [500, 'Description cannot exceed 500 characters']
  },
  type: {
    type: String,
    enum: ['mcq', 'coding', 'video', 'mixed'],
    required: true
  },
  category: {
    type: String,
    enum: ['technical', 'aptitude', 'personality', 'communication'],
    required: true
  },
  timeLimit: {
    type: Number,
    required: [true, 'Time limit is required'],
    min: [1, 'Time limit must be at least 1 minute']
  },
  questions: [questionSchema],
  passingScore: {
    type: Number,
    default: 60,
    min: 0,
    max: 100
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  tags: [String],
  difficulty: {
    type: String,
    enum: ["Beginner", "Intermediate", "Advanced"],
    default: 'medium'
  }
}, {
  timestamps: true
});

// Index for better query performance
assessmentSchema.index({ category: 1, type: 1, isActive: 1 });
assessmentSchema.index({ createdBy: 1 });

module.exports = mongoose.model('Assessment', assessmentSchema);
