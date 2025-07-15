const Transactions = require("../models/transactions");
const Assessment = require("../models/Assessment");
const User = require("../models/User");

const addTransaction = async (req, res) => {
  const { userId, assessmentId } = req.params;
  try {
    const {
      transactionId,
      transactionAmount,
      transactionStatus,
      pricing,
      isOfferAvailable,
      isPremium,
      offerCode,
      franchiserId,
      referrerId,
    } = req.body;
    // Validate required fields
    if (
      !userId ||
      !assessmentId ||
      !transactionId ||
      !transactionAmount ||
      !transactionStatus ||
      !pricing
    ) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // Validate user and assessment existence
    const user = await User.findById(userId);
    if (!user) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    const assessment = await Assessment.findById(assessmentId);
    if (!assessment) {
      return res.status(400).json({ message: "Invalid assessment ID" });
    }

    // Validate pricing structure
    if (!pricing.basePrice || !pricing.discountedPrice) {
      return res
        .status(400)
        .json({ message: "Pricing details are incomplete" });
    }

    // Validate transaction status
    if (!["success", "failure"].includes(transactionStatus)) {
      return res.status(400).json({ message: "Invalid transaction status" });
    }

    // Create new transaction
    const transaction = await Transactions.create({
      userId,
      assessmentId,
      transactionId,
      transactionAmount,
      transactionStatus,
      pricing: {
        basePrice: pricing.basePrice,
        discountedPrice: pricing.discountedPrice,
      },
      offerCode,
      isOfferAvailable: isOfferAvailable || false,
      isPremium: isPremium || false,
      franchiserId: franchiserId || null,
      referrerId: referrerId || null,
    });

    // Save to database
    const savedTransaction = await transaction.save();

    res.status(201).json(savedTransaction);
  } catch (error) {
    console.error("Error adding transaction:", error);
    res.status(500).json({
      message: "Server error while adding transaction",
      error: error.message,
    });
  }
};
const getTransactions = async (req, res) => {
  try {
    // Extract userId from params and pagination query parameters
    const { userId } = req.params;

    // Validate userId
    if (!userId) {
      return res
        .status(400)
        .json({ success: false, message: "User ID is required" });
    }

    // Query transactions for the user
    const transactions = await Transactions.find({ userId });

    // Get total count for pagination
    const total = await Transactions.countDocuments({ userId });

    // Return response
    res.json({
      success: true,
      data: {
        transactions,
        total,
      },
    });
  } catch (error) {
    console.error("Error fetching transactions:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching transactions",
      error: error.message,
    });
  }
};

module.exports = { addTransaction, getTransactions };
