// ✅ CommonJS version (no "type": "module" needed)
const express = require('express');
const router = express.Router();
const Razorpay = require("razorpay");


const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_SECRET,
});

router.post("/create-order", async (req, res) => {
  try {
    const options =req.body
    const order = await razorpay.orders.create(options);
    res.json(order);
  } catch (error) {
    console.error("Razorpay error:", error);
    res.status(500).json({ error: "Order creation failed" });
  }
});
module.exports = router;
