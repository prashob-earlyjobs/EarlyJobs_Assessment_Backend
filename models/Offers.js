const mongoose = require('mongoose');

const OfferSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true
  },
  discountType: {
    type: String,
    enum: ['percentage', 'fixed'],
    required: true
  },
  discountValue: {
    type: Number,
    required: true
  },
  maxUsage: {
    type: Number,
    required: true
  },
  usedCount: {
    type: Number,
    default: 0
  },
  expiresAt: {
    type: Date,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  assignedTo: {
    type: [mongoose.Schema.Types.ObjectId],
    ref: 'User',
    default: []  // Empty means it's a public offer
  },
  minOrderValue: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Offer', OfferSchema);
