const express = require('express');
const router = express.Router();
const { createOffer, getOffers, editOffer, redeemOfferByCode } = require('../controllers/offerController');

// POST /api/offers
router.post('/', createOffer);

// GET /api/offers
router.get('/', getOffers);

// PUT /api/offers/:id
router.put('/:id', editOffer);

// PATCH /api/offers/:code/redeem
router.patch('/:code/redeem', redeemOfferByCode);

module.exports = router;