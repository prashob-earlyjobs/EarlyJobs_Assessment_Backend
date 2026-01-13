
const mongoose = require("mongoose");

const collegeTieupSchema = new mongoose.Schema({
   collegeName: {
    type: String,
    required: true,
    trim: true,
  },
  logoUrl: {
    type: String,
    required: true,
    trim: true,
  },
  location: {
    type: String,
    required: true,
    trim: true,
  },
  order: {
    type: Number,
    required: true,
  },
},{ timestamps: true});

module.exports = mongoose.model("CollegeTieup", collegeTieupSchema);
