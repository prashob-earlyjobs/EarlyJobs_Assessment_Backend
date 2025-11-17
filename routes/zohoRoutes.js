const express = require("express");
const router = express.Router();
const {
  createInvoice,
  getInvoice,
  listInvoices,
} = require("../controllers/zohoController");
const authMiddleware = require("../middlewares/authMiddleware");

// Create invoice
router.post("/create-invoice", authMiddleware, createInvoice);

// Get invoice by ID
router.get("/invoice/:invoiceId", authMiddleware, getInvoice);

// List invoices
router.get("/invoices", authMiddleware, listInvoices);

module.exports = router;

