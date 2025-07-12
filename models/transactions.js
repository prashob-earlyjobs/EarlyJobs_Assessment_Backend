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
      // Remove unique: true
    },
    transactionDate: {
      type: Date,
      default: Date.now,
    },
    transactionAmount: {
      type: Number || String, // Fix: Use Number instead of Number || String
      required: [true, "Transaction amount is required"],
    },
    transactionStatus: {
      type: String,
      enum: ["success", "failure"],
      required: [true, "Transaction status is required"],
    },
    pricing: {
      // Note: You have two 'pricing' fields; the second one overwrites the first
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
    referrerId: {
      type: String, // Fix: Use String instead of String || null
      default: null,
    },
    franchiserId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
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
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Create a partial unique index for transactionId (excluding "FREE-OFFER")
transactionsSchema.index(
  { transactionId: 1 },
  {
    unique: true,
    partialFilterExpression: { transactionId: { $ne: "FREE-OFFER" } },
  }
);

module.exports = mongoose.model("Transactions", transactionsSchema);
