const axios = require("axios");
require("dotenv").config();

// Zoho Books API configuration
// Use https://www.zohoapis.com/books/v3 for US/Global or https://books.zoho.in/api/v3 for India
// Can be configured via environment variable
const ZOHO_BOOKS_API_BASE_URL = process.env.ZOHO_BOOKS_API_BASE_URL || "https://www.zohoapis.in/books/v3";
const ZOHO_ORGANIZATION_ID = process.env.ZOHO_ORGANIZATION_ID;
const ZOHO_CLIENT_ID = process.env.ZOHO_CLIENT_ID;
const ZOHO_CLIENT_SECRET = process.env.ZOHO_CLIENT_SECRET;
const ZOHO_REFRESH_TOKEN = process.env.ZOHO_REFRESH_TOKEN;

// Cache for access token
let cachedAccessToken = null;
let tokenExpiry = null;

/**
 * Get Zoho Books access token using refresh token
 */
const getZohoAccessToken = async () => {
  // Return cached token if still valid
  if (cachedAccessToken && tokenExpiry && new Date() < tokenExpiry) {
    return cachedAccessToken;
  }

  try {
    const response = await axios.post(
      "https://accounts.zoho.in/oauth/v2/token",
      null,
      {
        params: {
          refresh_token: ZOHO_REFRESH_TOKEN,
          client_id: ZOHO_CLIENT_ID,
          client_secret: ZOHO_CLIENT_SECRET,
          grant_type: "refresh_token",
        },
      }
    );

    cachedAccessToken = response.data.access_token;
    // Set expiry to 55 minutes (tokens usually last 1 hour)
    tokenExpiry = new Date(Date.now() + 55 * 60 * 1000);

    return cachedAccessToken;
  } catch (error) {
    console.error("Error getting Zoho access token:", error.response?.data || error.message);
    throw new Error("Failed to get Zoho access token");
  }
};

/**
 * Create or get customer (contact) in Zoho Books
 */
const getOrCreateCustomer = async (customerData) => {
  try {
    const accessToken = await getZohoAccessToken();

    // First, try to find existing customer by email or phone
    const searchResponse = await axios.get(
      `${ZOHO_BOOKS_API_BASE_URL}/contacts`,
      {
        headers: {
          Authorization: `Zoho-oauthtoken ${accessToken}`,
        },
        params: {
          organization_id: ZOHO_ORGANIZATION_ID,
          search_text: customerData.email || customerData.phone || customerData.name,
        },
      }
    );

    // Check if customer exists by email or phone
    if (searchResponse.data?.contacts?.length > 0) {
      const existingCustomer = searchResponse.data.contacts.find(
        (contact) =>
          contact.email === customerData.email ||
          contact.phone === customerData.phone
      );
      
      if (existingCustomer) {
        return existingCustomer.contact_id;
      }
    }

    // Create new customer contact in Zoho Books
    const contactData = {
      contact_name: customerData.name,
      customer_name: customerData.name,
      contact_type: "customer",
    };

    // Add optional fields if provided
    if (customerData.email) {
      contactData.email = customerData.email;
    }
    if (customerData.phone) {
      contactData.phone = customerData.phone;
    }
    if (customerData.address) {
      contactData.billing_address = {
        address: customerData.address.street || "",
        city: customerData.address.city || "",
        state: customerData.address.state || "",
        country: customerData.address.country || "India",
        zip: customerData.address.zipCode || "",
      };
    }

    const createResponse = await axios.post(
      `${ZOHO_BOOKS_API_BASE_URL}/contacts`,
      contactData,
      {
        headers: {
          Authorization: `Zoho-oauthtoken ${accessToken}`,
          "Content-Type": "application/json",
        },
        params: {
          organization_id: ZOHO_ORGANIZATION_ID,
        },
      }
    );

    if (!createResponse.data?.contact?.contact_id) {
      throw new Error("Failed to create contact in Zoho Books");
    }

    return createResponse.data.contact.contact_id;
  } catch (error) {
    console.error("Error creating/getting customer in Zoho Books:", error.response?.data || error.message);
    throw new Error(
      `Failed to create/get customer in Zoho Books: ${error.response?.data?.message || error.message}`
    );
  }
};


const createInvoice = async (req, res) => {
  try {
    const body = req.body;

    // --- 🧾 Step 1: Validate customer info ---
    let customerId = body.customer_id;
    if (!customerId) {
      if (!body.customerName || !body.customerEmail) {
        return res.status(400).json({
          success: false,
          message: "Either customer_id or (customerName + customerEmail) is required",
        });
      }

      const customer = await getOrCreateCustomer({
        name: body.customerName,
        email: body.customerEmail,
        phone: body.customerPhone,
        address: body.customerAddress,
      });
      customerId = customer?.customer_id || customer;
    }

    // --- 🧾 Step 2: Prepare line items ---
    const rawItems = body.line_items || body.lineItems;
    if (!rawItems?.length) {
      return res.status(400).json({ success: false, message: "At least one line item is required" });
    }

    const line_items = rawItems.map((item, i) => {
      if (!item.rate && !item.bcy_rate) {
        throw new Error(`Missing rate for line item: ${item.name || i + 1}`);
      }

      return {
        name: item.name,
        description: item.description || item.name,
        rate: parseFloat(item.rate || item.bcy_rate),
        quantity: parseFloat(item.quantity || 1),
        item_order: item.item_order || i + 1,
        ...["item_id", "project_id", "tax_id", "tax_percentage", "discount", "discount_amount", "unit", "hsn_or_sac"]
          .reduce((acc, key) => {
            if (item[key] !== undefined) acc[key] = item[key];
            return acc;
          }, {}),
      };
    });

    // --- 🧾 Step 3: Prepare invoice data ---
    const invoiceData = {
      customer_id: customerId,
      line_items,
      date: body.date || body.invoiceDate || new Date().toISOString().split("T")[0],
      due_date: body.due_date || body.dueDate,
      // Use reference_number for tracking (not invoice_number to avoid auto-numbering conflict)
      reference_number: body.reference_number || body.referenceNumber || undefined,
      currency_code: body.currencyCode || body.currency_code || "INR",
      payment_terms: parseInt(body.payment_terms || body.paymentTerms || 0),
      payment_terms_label:
        body.payment_terms_label ||
        (parseInt(body.payment_terms || body.paymentTerms || 0) > 0
          ? `Net ${body.payment_terms || body.paymentTerms} Days`
          : "Due on Receipt"),
      place_of_supply: body.place_of_supply,
      gst_treatment: body.gst_treatment,
      gst_no: body.gst_no,
      salesperson_name: body.salesperson_name,
      custom_fields: body.custom_fields,
      is_discount_before_tax: body.is_discount_before_tax,
      discount_type: body.discount_type,
      is_inclusive_tax: body.is_inclusive_tax,
      shipping_charge: body.shipping_charge ? parseFloat(body.shipping_charge) : undefined,
      adjustment: body.adjustment ? parseFloat(body.adjustment) : undefined,
      adjustment_description: body.adjustment_description,
      notes: body.notes,
      terms: body.terms,
      status: body.status || "draft",
    };

    // Handle discountAmount from frontend
    if (body.discountAmount !== undefined) {
      invoiceData.discount = parseFloat(body.discountAmount);
    } else if (body.discount !== undefined) {
      invoiceData.discount = parseFloat(body.discount);
    }

    // Handle is_pre_gst from frontend
    if (body.is_pre_gst !== undefined) {
      invoiceData.is_pre_gst = body.is_pre_gst;
    }

    // Handle paymentOptions from frontend (convert to Zoho format)
    if (body.paymentOptions && Array.isArray(body.paymentOptions)) {
      invoiceData.payment_options = {
        payment_gateways: body.paymentOptions.map((opt) => ({
          configured: true,
          gateway_name: opt.method?.toLowerCase() || "razorpay",
          additional_field1: opt.reference || opt.additional_field1 || "standard",
        })),
      };
    } else if (body.payment_options) {
      invoiceData.payment_options = body.payment_options;
    }

    // Remove undefined fields to keep payload clean
    Object.keys(invoiceData).forEach((key) => {
      if (invoiceData[key] === undefined) {
        delete invoiceData[key];
      }
    });

    // --- 🔐 Step 4: Call Zoho API ---
    const token = await getZohoAccessToken();
    const response = await axios.post(
      `${ZOHO_BOOKS_API_BASE_URL}/invoices`,
      invoiceData,
      {
        headers: {
          Authorization: `Zoho-oauthtoken ${token}`,
          "Content-Type": "application/json", thank 
        },
        params: { organization_id: ZOHO_ORGANIZATION_ID },
      }
    );

    const invoice = response.data?.invoice;
    if (!invoice) throw new Error("Invalid response from Zoho Books API");

    // --- ✅ Step 5: Success response ---
    res.status(201).json({
      success: true,
      message: "Invoice created successfully in Zoho Books",
      data: {
        invoiceId: invoice.invoice_id,
        invoiceNumber: invoice.invoice_number,
        invoiceUrl: invoice.invoice_url,
        invoicePdfUrl: invoice.invoice_url?.replace("/invoices/", "/invoices/pdf/"),
        total: invoice.total,
        balance: invoice.balance,
        status: invoice.status,
        date: invoice.date,
        dueDate: invoice.due_date,
        customerId: invoice.customer_id,
        customerName: invoice.customer_name,
        invoice,
      },
    });
  } catch (error) {
    console.error("Error creating Zoho Books invoice:", error.response?.data || error.message);
    const apiError = error.response?.data;

    res.status(error.response?.status || 500).json({
      success: false,
      message: apiError?.message || "Failed to create invoice in Zoho Books",
      code: apiError?.code,
      details: apiError || null,
    });
  }
};


/**
 * Create invoice in Zoho Books
 * @route   POST /api/zoho/create-invoice
 * @access  Private
 * Reference: https://www.zoho.com/books/api/v3/invoices/#create-an-invoice
 */
// const createInvoice = async (req, res) => {
//   try {
//     const {
//       // Customer fields (for auto-creation)
//       customerName,
//       customerEmail,
//       customerPhone,
//       customerAddress,
//       // Direct Zoho Books fields
//       customer_id,
//       currency_id,
//       contact_persons,
//       contact_persons_associated,

//       place_of_supply,
//       vat_treatment,
//       tax_treatment,
//       is_reverse_charge_applied,
//       gst_treatment,
//       gst_no,
//       cfdi_usage,
//       reference_number,
//       template_id,
//       date,
//       payment_terms,
//       payment_terms_label,
//       due_date,
//       discount,
//       is_discount_before_tax,
//       discount_type,
//       is_inclusive_tax,
//       exchange_rate,
//       location_id,
//       recurring_invoice_id,
//       invoiced_estimate_id,
//       salesperson_name,
//       custom_fields,
//       send,
//       line_items,
//       payment_options,
//       allow_partial_payments,
//       custom_body,
//       custom_subject,
//       notes,
//       terms,
//       shipping_charge,
//       adjustment,
//       adjustment_description,
//       reason,
//       tax_authority_id,
//       tax_exemption_id,
//       billing_address_id,
//       shipping_address_id,
//       avatax_use_code,
//       avatax_exempt_no,
//       tax_id,
//       expense_id,
//       salesorder_item_id,
//       avatax_tax_code,
//       time_entry_ids,
//       batch_payments,
//       // Legacy fields for backward compatibility
//       lineItems,
//       invoiceDate,
//       dueDate,
//       paymentTerms,
//       referenceNumber,
//       currencyCode,
//     } = req.body;

//     // Determine customer_id - use provided or create/get from customer details
//     let finalCustomerId = customer_id;
    
//     if (!finalCustomerId) {
//       // If customer_id not provided, try to get/create from customer details
//       if (!customerName || !customerEmail) {
//         return res.status(400).json({
//           success: false,
//           message: "Either customer_id or customerName with customerEmail is required",
//         });
//       }
//       finalCustomerId = await getOrCreateCustomer({
//         name: customerName,
//         email: customerEmail,
//         phone: customerPhone,
//         address: customerAddress,
//       });
//     }

//     // Prepare line items - support both formats
//     const finalLineItems = line_items || lineItems;
    
//     if (!finalLineItems || !Array.isArray(finalLineItems) || finalLineItems.length === 0) {
//       return res.status(400).json({
//         success: false,
//         message: "At least one line item is required",
//       });
//     }

//     // Validate and prepare line items according to Zoho Books API format
//     const zohoLineItems = finalLineItems.map((item, index) => {
//       const lineItem = {
//         name: item.name,
//         description: item.description || item.name,
//         rate: parseFloat(item.rate || item.bcy_rate || 0),
//         quantity: parseFloat(item.quantity || 1),
//         item_order: item.item_order || index + 1,
    
//       };

//       // Add all optional line item fields if provided
//       if (item.item_id) lineItem.item_id = item.item_id;
//       if (item.project_id) lineItem.project_id = item.project_id;
//       if (item.time_entry_ids) lineItem.time_entry_ids = item.time_entry_ids;
//       if (item.product_type) lineItem.product_type = item.product_type;
//       if (item.hsn_or_sac) lineItem.hsn_or_sac = item.hsn_or_sac;
//       if (item.sat_item_key_code) lineItem.sat_item_key_code = item.sat_item_key_code;
//       if (item.unitkey_code) lineItem.unitkey_code = item.unitkey_code;
//       if (item.location_id) lineItem.location_id = item.location_id;
//       if (item.expense_id) lineItem.expense_id = item.expense_id;
//       if (item.bill_id) lineItem.bill_id = item.bill_id;
//       if (item.bill_item_id) lineItem.bill_item_id = item.bill_item_id;
//       if (item.expense_receipt_name) lineItem.expense_receipt_name = item.expense_receipt_name;
//       if (item.bcy_rate) lineItem.bcy_rate = parseFloat(item.bcy_rate);
//       if (item.unit) lineItem.unit = item.unit;
//       if (item.discount_amount) lineItem.discount_amount = parseFloat(item.discount_amount);
//       if (item.discount) lineItem.discount = parseFloat(item.discount);
//       if (item.tags) lineItem.tags = item.tags;
//       if (item.tax_id) lineItem.tax_id = item.tax_id;
//       if (item.tds_tax_id) lineItem.tds_tax_id = item.tds_tax_id;
//       if (item.tax_name) lineItem.tax_name = item.tax_name;
//       if (item.tax_type) lineItem.tax_type = item.tax_type;
//       if (item.tax_percentage) lineItem.tax_percentage = parseFloat(item.tax_percentage);
//       if (item.tax_treatment_code) lineItem.tax_treatment_code = item.tax_treatment_code;
//       if (item.header_name) lineItem.header_name = item.header_name;
//       if (item.salesorder_item_id) lineItem.salesorder_item_id = item.salesorder_item_id;

//       return lineItem;
//     });

//     // Prepare invoice data according to Zoho Books API format
//     const invoiceData = {
//       customer_id: finalCustomerId,
//       line_items: zohoLineItems,
//       date: date || invoiceDate || new Date().toISOString().split("T")[0],
//       status: "paid",
//       is_pre_gst: true,
//       is_pre_tax: true,
//     };

//     // Add all optional fields if provided
//     if (currency_id) invoiceData.currency_id = currency_id;
//     if (currencyCode) invoiceData.currency_code = currencyCode;
//     if (contact_persons) invoiceData.contact_persons = contact_persons;
//     if (contact_persons_associated) invoiceData.contact_persons_associated = contact_persons_associated;

//     if (place_of_supply) invoiceData.place_of_supply = place_of_supply;
//     if (vat_treatment) invoiceData.vat_treatment = vat_treatment;
//     if (tax_treatment) invoiceData.tax_treatment = tax_treatment;
//     if (is_reverse_charge_applied !== undefined) invoiceData.is_reverse_charge_applied = is_reverse_charge_applied;
//     if (gst_treatment) invoiceData.gst_treatment = gst_treatment;
//     if (gst_no) invoiceData.gst_no = gst_no;
//     if (cfdi_usage) invoiceData.cfdi_usage = cfdi_usage;
//     if (reference_number) invoiceData.reference_number = reference_number;
//     if (template_id) invoiceData.template_id = template_id;
//     if (payment_terms !== undefined || paymentTerms !== undefined) {
//       invoiceData.payment_terms = parseInt(payment_terms || paymentTerms || 0);
//     }
//     if (payment_terms_label) {
//       invoiceData.payment_terms_label = payment_terms_label;
//     } else if (payment_terms !== undefined || paymentTerms !== undefined) {
//       const terms = parseInt(payment_terms || paymentTerms || 0);
//       invoiceData.payment_terms_label = terms > 0 ? `Net ${terms} Days` : "Due on Receipt";
//     }
//     if (due_date || dueDate) invoiceData.due_date = due_date || dueDate;
//     if (discount !== undefined) invoiceData.discount = parseFloat(discount);
//     if (is_discount_before_tax !== undefined) invoiceData.is_discount_before_tax = is_discount_before_tax;
//     if (discount_type) invoiceData.discount_type = discount_type;
//     if (is_inclusive_tax !== undefined) invoiceData.is_inclusive_tax = is_inclusive_tax;
//     if (exchange_rate) invoiceData.exchange_rate = parseFloat(exchange_rate);
//     if (location_id) invoiceData.location_id = location_id;
//     if (recurring_invoice_id) invoiceData.recurring_invoice_id = recurring_invoice_id;
//     if (invoiced_estimate_id) invoiceData.invoiced_estimate_id = invoiced_estimate_id;
//     if (salesperson_name) invoiceData.salesperson_name = salesperson_name;
//     if (custom_fields) invoiceData.custom_fields = custom_fields;
//     if (send !== undefined) invoiceData.send = send;
//     if (payment_options) invoiceData.payment_options = payment_options;
//     if (allow_partial_payments !== undefined) invoiceData.allow_partial_payments = allow_partial_payments;
//     if (custom_body) invoiceData.custom_body = custom_body;
//     if (custom_subject) invoiceData.custom_subject = custom_subject;
//     if (notes) invoiceData.notes = notes;
//     if (terms) invoiceData.terms = terms;
//     if (shipping_charge !== undefined) invoiceData.shipping_charge = parseFloat(shipping_charge);
//     if (adjustment !== undefined) invoiceData.adjustment = parseFloat(adjustment);
//     if (adjustment_description) invoiceData.adjustment_description = adjustment_description;
//     if (reason) invoiceData.reason = reason;
//     if (tax_authority_id) invoiceData.tax_authority_id = tax_authority_id;
//     if (tax_exemption_id) invoiceData.tax_exemption_id = tax_exemption_id;
//     if (billing_address_id) invoiceData.billing_address_id = billing_address_id;
//     if (shipping_address_id) invoiceData.shipping_address_id = shipping_address_id;
//     if (avatax_use_code) invoiceData.avatax_use_code = avatax_use_code;
//     if (avatax_exempt_no) invoiceData.avatax_exempt_no = avatax_exempt_no;
//     if (tax_id) invoiceData.tax_id = tax_id;
//     if (expense_id) invoiceData.expense_id = expense_id;
//     if (salesorder_item_id) invoiceData.salesorder_item_id = salesorder_item_id;
//     if (avatax_tax_code) invoiceData.avatax_tax_code = avatax_tax_code;
//     if (time_entry_ids) invoiceData.time_entry_ids = time_entry_ids;
//     if (batch_payments) invoiceData.batch_payments = batch_payments;

//     // Get access token
//     const accessToken = await getZohoAccessToken();

//     // Create invoice in Zoho Books
//     const response = await axios.post(
//       `${ZOHO_BOOKS_API_BASE_URL}/invoices`,
//       invoiceData,
//       {
//         headers: {
//           Authorization: `Zoho-oauthtoken ${accessToken}`,
//           "Content-Type": "application/json",
//         },
//         params: {
//           organization_id: ZOHO_ORGANIZATION_ID,
//         },
//       }
//     );

//     // Validate response from Zoho Books
//     if (!response.data || !response.data.invoice) {
//       throw new Error("Invalid response from Zoho Books API");
//     }

//     const invoice = response.data.invoice;

//     res.status(201).json({
//       success: true,
//       message: "Invoice created successfully in Zoho Books",
//       data: {
//         invoiceId: invoice.invoice_id,
//         invoiceNumber: invoice.invoice_number,
//         invoiceUrl: invoice.invoice_url,
//         invoicePdfUrl: invoice.invoice_url?.replace("/invoices/", "/invoices/pdf/"),
//         total: invoice.total,
//         balance: invoice.balance,
//         status: invoice.status,
//         date: invoice.date,
//         dueDate: invoice.due_date,
//         customerId: invoice.customer_id,
//         customerName: invoice.customer_name,
//         invoice: invoice,
//       },
//     });
//   } catch (error) {
//     console.error("Error creating Zoho Books invoice:", error.response?.data || error.message);
    
//     // Handle Zoho Books API specific errors
//     if (error.response?.data?.code) {
//       return res.status(error.response.status || 500).json({
//         success: false,
//         message: `Zoho Books API Error: ${error.response.data.message || "Failed to create invoice"}`,
//         error: error.response.data.message,
//         code: error.response.data.code,
//         details: error.response.data,
//       });
//     }

//     res.status(500).json({
//       success: false,
//       message: "Failed to create invoice in Zoho Books",
//       error: error.response?.data?.message || error.message,
//       details: error.response?.data || null,
//     });
//   }
// };

/**
 * Get invoice by ID from Zoho Books
 * @route   GET /api/zoho/invoice/:invoiceId
 * @access  Private
 */
const getInvoice = async (req, res) => {
  try {
    const { invoiceId } = req.params;

    if (!invoiceId) {
      return res.status(400).json({
        success: false,
        message: "Invoice ID is required",
      });
    }

    const accessToken = await getZohoAccessToken();

    const response = await axios.get(
      `${ZOHO_BOOKS_API_BASE_URL}/invoices/${invoiceId}`,
      {
        headers: {
          Authorization: `Zoho-oauthtoken ${accessToken}`,
        },
        params: {
          organization_id: ZOHO_ORGANIZATION_ID,
        },
      }
    );

    res.json({
      success: true,
      data: {
        invoice: response.data.invoice,
      },
    });
  } catch (error) {
    console.error("Error fetching Zoho Books invoice:", error.response?.data || error.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch invoice from Zoho Books",
      error: error.response?.data?.message || error.message,
      details: error.response?.data || null,
    });
  }
};

/**
 * List invoices from Zoho Books
 * @route   GET /api/zoho/invoices
 * @access  Private
 */
const listInvoices = async (req, res) => {
  try {
    const { page = 1, per_page = 25, sort_column = "invoice_date", sort_order = "D" } = req.query;

    const accessToken = await getZohoAccessToken();

    const response = await axios.get(
      `${ZOHO_BOOKS_API_BASE_URL}/invoices`,
      {
        headers: {
          Authorization: `Zoho-oauthtoken ${accessToken}`,
        },
        params: {
          organization_id: ZOHO_ORGANIZATION_ID,
          page: parseInt(page),
          per_page: parseInt(per_page),
          sort_column,
          sort_order,
        },
      }
    );

    res.json({
      success: true,
      data: {
        invoices: response.data.invoices || [],
        page_context: response.data.page_context || {},
      },
    });
  } catch (error) {
    console.error("Error listing Zoho Books invoices:", error.response?.data || error.message);
    res.status(500).json({
      success: false,
      message: "Failed to list invoices from Zoho Books",
      error: error.response?.data?.message || error.message,
      details: error.response?.data || null,
    });
  }
};

module.exports = {
  createInvoice,
  getInvoice,
  listInvoices,
};

