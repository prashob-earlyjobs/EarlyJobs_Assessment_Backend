const mongoose = require('mongoose');

const interestSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    maxlength: [100, 'Name cannot exceed 100 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    trim: true,
    lowercase: true,
    match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email address'],
    maxlength: [255, 'Email cannot exceed 255 characters']
  },
  companyName: {
    type: String,
    required: [true, 'Company name is required'],
    trim: true,
    maxlength: [200, 'Company name cannot exceed 200 characters']
  },
  companyAddress: {
    type: String,
    trim: true,
    maxlength: [500, 'Company address cannot exceed 500 characters']
  },
  mobile: {
    type: String,
    required: [true, 'Mobile number is required'],
    trim: true,
    match: [/^\+91\d{10}$/, 'Mobile number must be in format +91XXXXXXXXXX']
  },

    candidateName: {
    type: String,
    trim: true,
    maxlength: [100, 'Candidate name cannot exceed 100 characters']
  },
  submittedAt: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['pending', 'contacted', 'scheduled', 'completed', 'cancelled'],
    default: 'pending'
  }
}, {
  timestamps: true // Adds createdAt and updatedAt automatically
});

// Create indexes for faster queries
interestSchema.index({ email: 1 });
interestSchema.index({ mobile: 1 });
interestSchema.index({ submittedAt: -1 });
interestSchema.index({ status: 1 });
interestSchema.index({ interviewScheduleDate: 1 });

module.exports = mongoose.model('Interest', interestSchema);

