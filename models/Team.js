const mongoose = require('mongoose');

const teamMemberSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
  },
  image_url: {
    type: String,
    trim: true,
  },
  designation: {
    type: String,
    required: [true, 'Designation is required'],
    trim: true,
  },
  experience_in_years: {
    type: Number,
    required: [true, 'Experience in years is required'],
    min: [0, 'Experience cannot be negative'],
  },
  certified_by: {
    type: String,
    trim: true,
  },
  linkedIn_url: {
    type: String,
    trim: true,
  },
  position: {
    type: Number,
    required: [true, 'Position is required'],
  },
  category: {
    type: String,
    trim: true,
  },
  joined_date: {
    type: Date,
  },
}, { timestamps: true });

const TeamMember = mongoose.model('TeamMember', teamMemberSchema);

module.exports = TeamMember;