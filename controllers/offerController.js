const Offer = require('../models/Offers');

exports.createOffer = async (req, res) => {
  try {
    const offer = new Offer(req.body);
    await offer.save();
    res.status(201).json({
      success: true,
      message: 'Offer created successfully',
      data: offer
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Error creating offer',
      error: error.message
    });
  }
};

exports.getOffers = async (req, res) => {
  try {
    const offers = await Offer.find();
    res.status(200).json({
      success: true,
      data: offers
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching offers',
      error: error.message
    });
  }
};

exports.editOffer = async (req, res) => {
  try {
    const offer = await Offer.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!offer) {
      return res.status(404).json({
        success: false,
        message: 'Offer not found',
      });
    }
    res.status(200).json({
      success: true,
      message: 'Offer updated successfully',
      data: offer,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Error updating offer',
      error: error.message,
    });
  }
};

exports.redeemOffer = async (req, res) => {
  try {
    const { id } = req.params;
    const offer = await Offer.findById(id);

    if (!offer) {
      return res.status(404).json({
        success: false,
        message: 'Offer not found',
      });
    }

    if (offer.usedCount >= offer.maxUsage) {
      return res.status(400).json({
        success: false,
        message: 'Offer usage limit reached',
      });
    }

    offer.usedCount += 1;
    await offer.save();

    res.status(200).json({
      success: true,
      message: 'Offer redeemed successfully',
      data: offer,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Error redeeming offer',
      error: error.message,
    });
  }
};

exports.redeemOfferByCode = async (req, res) => {
  try {
    const { code } = req.params;
    const offer = await Offer.findOne({ code: code.toUpperCase() });

    if (!offer) {
      return res.status(404).json({
        success: false,
        message: 'Offer not found',
      });
    }

    if (offer.usedCount >= offer.maxUsage) {
      return res.status(400).json({
        success: false,
        message: 'Offer usage limit reached',
      });
    }

    offer.usedCount += 1;
    await offer.save();

    res.status(200).json({
      success: true,
      message: 'Offer redeemed successfully',
      data: offer,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Error redeeming offer',
      error: error.message,
    });
  }
};