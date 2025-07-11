// models/transaction.js
const mongoose = require("mongoose");

const transactionsSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    assessmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Assessment",
      required: true,
    },
    transactionId: {
      type: String,
      required: [true, "Transaction ID is required"],
      unique: true,
    },
    transactionDate: {
      type: Date,
      default: Date.now,
    },
    transactionAmount: {
      type: Number || String,
      required: [true, "Transaction amount is required"],
    },
    transactionStatus: {
      type: String,
      enum: ["success", "failure"],
      required: [true, "Transaction status is required"],
    },

    pricing: {
      type: Number,
      required: [true, "Pricing is required"],
      min: [0, "Pricing cannot be negative"],
    },
    referrerId: {
      type: String || null,
      default: null,
    }, // Optional field for referral tracking
    franchiserId: {
      type: mongoose.Schema.Types.ObjectId || null,
      default: null,
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
    isOfferAvailable: {
      type: Boolean,
      default: false,
    },
    isPremium: {
      type: Boolean,
      default: false,
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
// assessmentSchema.index({ category: 1, type: 1, isActive: 1 });
// assessmentSchema.index({ createdBy: 1 });

module.exports = mongoose.model("Transactions", transactionsSchema);
