// models/Certificate.js
const mongoose = require("mongoose");

const certificateSchema = new mongoose.Schema(
  {
    userid: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User ID is required"],
    },
    interviewid: {
      type: String,
      required: [true, "Interview ID is required"],
      trim: true,
    },
    cerficateno: {
      type: String,
      required: [true, "Certificate number is required"],
      unique: true,
      trim: true,
      uppercase: true,
    },
    assessmentid: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Assessment",
      required: [true, "Assessment ID is required"],
    },
    cerficatelink: {
      type: String,
      required: [true, "Certificate link is required"],
      trim: true,
      match: [/^https?:\/\/.+/, "Please provide a valid URL for certificate link"],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    issuedDate: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Index for better query performance
certificateSchema.index({ userid: 1 });
certificateSchema.index({ assessmentid: 1 });
certificateSchema.index({ interviewid: 1 });
certificateSchema.index({ cerficateno: 1 });

module.exports = mongoose.model("Certificate", certificateSchema);
