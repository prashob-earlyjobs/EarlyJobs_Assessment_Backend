const mongoose = require('mongoose');

/**
 * Stores ChottuLink / dynamic link data received from the Flutter app.
 * Frontend sends: link, shortLink, shortLinkRaw, isDeferred (from ChottuLink.onLinkReceivedWithMeta)
 */
const dynamicLinkSchema = new mongoose.Schema(
  {
    link: {
      type: String,
      required: [true, 'Resolved link is required'],
      trim: true,
    },
    shortLink: {
      type: String,
      trim: true,
      default: null,
    },
    shortLinkRaw: {
      type: String,
      trim: true,
      default: null,
    },
    isDeferred: {
      type: Boolean,
      default: false,
    },
    // Optional: if your app sends user/device context
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    deviceId: {
      type: String,
      trim: true,
      default: null,
    },
    source: {
      type: String,
      enum: ['chottu_link', 'other'],
      default: 'chottu_link',
    },
  },
  { timestamps: true }
);

dynamicLinkSchema.index({ createdAt: -1 });
dynamicLinkSchema.index({ userId: 1, createdAt: -1 });
dynamicLinkSchema.index({ link: 1 });

const DynamicLink = mongoose.model('DynamicLink', dynamicLinkSchema);

module.exports = DynamicLink;
