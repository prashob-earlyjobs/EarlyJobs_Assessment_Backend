// models/Assessment.js
const mongoose = require("mongoose");

const assessmentSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Assessment title is required"],
      trim: true,
      minLength: [5, "Title must be at least 5 characters long"],
      maxLength: [100, "Title cannot exceed 100 characters"],
    },
    assessmentId: {
      type: String,
      required: [true, "Assessment ID is required"],
      unique: true,
    },
    shortId: {
      type: String,
      required: [true, "Short ID is required"],
      unique: true,
    },
    description: {
      type: String,
      maxLength: [500, "Description cannot exceed 500 characters"],
    },
    type: {
      type: String,
      enum: ["mcq", "coding", "video", "mixed"],
      required: true,
    },
    category: {
      type: String,
      required: true,
    },
    timeLimit: {
      type: Number,
      required: [true, "Time limit is required"],
      min: [1, "Time limit must be at least 1 minute"],
    },

    pricing: {
      basePrice: {
        type: Number,
        required: [true, "Base price is required"],
        min: [0, "Base price cannot be negative"],
      },
      discountedPrice: {
        type: Number,
        required: [true, "Discounted price is required"],
        min: [0, "Discounted price cannot be negative"],
      },
    },
    offer: {
      title: {
        type: String,
        required: [true, "Offer title is required"],
        trim: true,
        minLength: [5, "Offer title must be at least 5 characters long"],
        maxLength: [25, "Offer title cannot exceed 100 characters"],
      },
      type: {
        type: String,
        enum: ["percentage", "flat"],
        required: [true, "Offer type is required"],
      }, // or "flat"
      value: {
        type: Number,
        required: [true, "Offer value is required"],
        min: [0, "Offer value cannot be negative"],
      },
      validUntil: {
        type: Date,
        required: [true, "Offer expiration date is required"],
        validate: {
          validator: function (value) {
            return value > Date.now();
          },
          message: "Offer expiration date must be in the future",
        },
      },
    },
    isPremium: {
      type: Boolean,
      default: false,
    },
    passingScore: {
      type: Number,
      default: 60,
      min: 0,
      max: 100,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    tags: [String],
    difficulty: {
      type: String,
      enum: ["Beginner", "Intermediate", "Advanced"],
      default: "medium",
    },
    attempts: {
      type: Number,
      default: 0,
      min: 0,
    },
    averageScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    completionRate: {
      type: Number,
      default: 100,
      min: 0,
      max: 100,
    },
    createdDate: {
      type: Date,
      default: Date.now(),
    },
  },
  {
    timestamps: true,
  }
);

// Index for better query performance
assessmentSchema.index({ category: 1, type: 1, isActive: 1 });
assessmentSchema.index({ createdBy: 1 });

module.exports = mongoose.model("Assessment", assessmentSchema);
