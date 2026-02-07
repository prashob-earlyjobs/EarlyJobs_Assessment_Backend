const DynamicLink = require('../models/DynamicLink');

/**
 * Store ChottuLink / dynamic link data from Flutter app
 * @route   POST /api/dynamic-links
 * @access  Public (called from frontend when link is received)
 */
const storeDynamicLink = async (req, res) => {
  try {
    const { link, shortLink, shortLinkRaw, isDeferred, userId, deviceId, source } = req.body;

    if (!link || typeof link !== 'string' || !link.trim()) {
      return res.status(400).json({
        success: false,
        message: 'link (resolved link) is required',
      });
    }

    const doc = new DynamicLink({
      link: link.trim(),
      shortLink: shortLink != null ? String(shortLink).trim() : null,
      shortLinkRaw: shortLinkRaw != null ? String(shortLinkRaw).trim() : null,
      isDeferred: Boolean(isDeferred),
      userId: userId || null,
      deviceId: deviceId ? String(deviceId).trim() : null,
      source: source === 'other' ? 'other' : 'chottu_link',
    });

    await doc.save();

    res.status(201).json({
      success: true,
      message: 'Dynamic link stored successfully',
      data: {
        id: doc._id,
        link: doc.link,
        shortLink: doc.shortLink,
        shortLinkRaw: doc.shortLinkRaw,
        isDeferred: doc.isDeferred,
        createdAt: doc.createdAt,
      },
    });
  } catch (error) {
    console.error('Error storing dynamic link:', error);
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors,
      });
    }
    res.status(500).json({
      success: false,
      message: 'Failed to store dynamic link',
      error: error.message,
    });
  }
};

/**
 * List stored dynamic links (with pagination)
 * @route   GET /api/dynamic-links
 * @access  Private (Admin) or Public based on your choice
 */
const getDynamicLinks = async (req, res) => {
  try {
    const { page = 1, limit = 20, userId, isDeferred } = req.query;
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));

    const query = {};
    if (userId) query.userId = userId;
    if (isDeferred !== undefined && isDeferred !== '') {
      query.isDeferred = isDeferred === 'true' || isDeferred === true;
    }

    const [links, total] = await Promise.all([
      DynamicLink.find(query)
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .lean(),
      DynamicLink.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: {
        links,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum) || 0,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching dynamic links:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching dynamic links',
      error: error.message,
    });
  }
};

/**
 * Get a single dynamic link by ID
 * @route   GET /api/dynamic-links/:id
 * @access  Private (Admin) or Public
 */
const getDynamicLinkById = async (req, res) => {
  try {
    const { id } = req.params;
    const link = await DynamicLink.findById(id).lean();

    if (!link) {
      return res.status(404).json({
        success: false,
        message: 'Dynamic link not found',
      });
    }

    res.json({
      success: true,
      data: { link },
    });
  } catch (error) {
    console.error('Error fetching dynamic link:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching dynamic link',
      error: error.message,
    });
  }
};

module.exports = {
  storeDynamicLink,
  getDynamicLinks,
  getDynamicLinkById,
};
