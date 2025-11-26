const Enquiry = require('../models/Enquiry');
const axios = require('axios')
/**
 * Submit a new enquiry
 * @route   POST /api/enquiries/submit
 * @access  Public
 */
const submitEnquiry = async (req, res) => {
  try {
    const { name, mobile, email, expectations, remarks, source } = req.body;

    // Validation
    if (!name || !mobile || !email || !expectations) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: name, mobile, email, and expectations are required'
      });
    }

    if (!Array.isArray(expectations) || expectations.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one expectation is required'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email format'
      });
    }

    // Validate and format mobile number
    const cleanMobile = mobile.replace(/\D/g, '');
    let formattedMobile = mobile;
    
    if (cleanMobile.length === 10) {
      formattedMobile = `+91${cleanMobile}`;
    } else if (!mobile.startsWith('+91') || mobile.length !== 13) {
      return res.status(400).json({
        success: false,
        message: 'Invalid mobile number format. Please provide a 10-digit number or +91XXXXXXXXXX format'
      });
    }

    // Create enquiry document
    const enquiry = new Enquiry({
      name: name.trim(),
      mobile: formattedMobile,
      email: email.trim().toLowerCase(),
      expectations: expectations,
      remarks: remarks?.trim() || null,
      submittedAt: new Date(),
      source: source || 'website',
      status: 'pending'
    });

    // Save to database
    await enquiry.save();
     sendEnquiryAcknowledgement({name, mobile, expectations}) 
    // Return success response matching your API pattern
    res.status(201).json({
      success: true,
      message: 'Enquiry submitted successfully',
      data: {
        id: enquiry._id,
        name: enquiry.name,
        email: enquiry.email,
        mobile: enquiry.mobile,
        expectations: enquiry.expectations,
        status: enquiry.status,
        submittedAt: enquiry.submittedAt
      }
    });

  } catch (error) {
    console.error('Error submitting enquiry:', error);
    
    // Handle duplicate entry (if unique constraint exists)
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'An enquiry with this email or mobile already exists'
      });
    }

    // Handle validation errors
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(e => e.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: errors
      });
    }

    // Generic error response
    res.status(500).json({
      success: false,
      message: 'Internal server error. Please try again later.'
    });
  }
};

/**
 * Get all enquiries (with pagination and filters)
 * @route   GET /api/enquiries
 * @access  Private (Admin)
 */
const getEnquiries = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, source, search } = req.query;

    // Validate page and limit
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 10;
    if (pageNum < 1 || limitNum < 1) {
      return res.status(400).json({
        success: false,
        message: 'Page and limit must be positive integers',
      });
    }

    // Build query object
    const query = {};
    
    if (status && ['pending', 'contacted', 'resolved', 'closed'].includes(status)) {
      query.status = status;
    }
    
    if (source && ['website', 'mobile', 'api'].includes(source)) {
      query.source = source;
    }

    // Add search if provided
    if (search && search.trim() !== '') {
      const sanitizedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.$or = [
        { name: { $regex: sanitizedSearch, $options: 'i' } },
        { email: { $regex: sanitizedSearch, $options: 'i' } },
        { mobile: { $regex: sanitizedSearch, $options: 'i' } },
      ];
    }

    // Fetch enquiries with pagination
    const enquiries = await Enquiry.find(query)
      .limit(limitNum)
      .skip((pageNum - 1) * limitNum)
      .sort({ submittedAt: -1 });

    const total = await Enquiry.countDocuments(query);

    res.json({
      success: true,
      data: {
        enquiries,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum) || 0,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching enquiries:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching enquiries',
      error: error.message,
    });
  }
};

/**
 * Get a single enquiry by ID
 * @route   GET /api/enquiries/:id
 * @access  Private (Admin)
 */
const getEnquiryById = async (req, res) => {
  try {
    const { id } = req.params;

    const enquiry = await Enquiry.findById(id);

    if (!enquiry) {
      return res.status(404).json({
        success: false,
        message: 'Enquiry not found',
      });
    }

    res.json({
      success: true,
      data: { enquiry },
    });
  } catch (error) {
    console.error('Error fetching enquiry:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching enquiry',
      error: error.message,
    });
  }
};

/**
 * Update enquiry status
 * @route   PUT /api/enquiries/:id/status
 * @access  Private (Admin)
 */
const updateEnquiryStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status || !['pending', 'contacted', 'resolved', 'closed'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Valid status is required (pending, contacted, resolved, closed)',
      });
    }

    const updateData = { status };

    // Update timestamps based on status
    if (status === 'contacted' && !req.body.contactedAt) {
      updateData.contactedAt = new Date();
    }
    if (status === 'resolved' && !req.body.resolvedAt) {
      updateData.resolvedAt = new Date();
    }

    const enquiry = await Enquiry.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!enquiry) {
      return res.status(404).json({
        success: false,
        message: 'Enquiry not found',
      });
    }

    res.json({
      success: true,
      message: 'Enquiry status updated successfully',
      data: { enquiry },
    });
  } catch (error) {
    console.error('Error updating enquiry status:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating enquiry status',
      error: error.message,
    });
  }
};

module.exports = {
  submitEnquiry,
  getEnquiries,
  getEnquiryById,
  updateEnquiryStatus,
};


const sendEnquiryAcknowledgement = async (data) => {
  const password = process.env.GUPSHUP_WHATSAPP_PASSWORD;
  try {
    const response = await axios.get(
      `https://mediaapi.smsgupshup.com/GatewayAPI/rest?userid=2000254194&password=${password}&send_to=${data?.mobile}&v=1.1&format=json&msg_type=TEXT&method=SENDMESSAGE&msg=Hello+%2A${data.name}%2A%21+%0A%0AThank+you+for+submitting+your+enquiry+with+EarlyJobs.+We%27re+excited+to+help+you+with%3A+${data.expectations.join(',')}%0A%0AOur+team+will+review+your+enquiry+and+reach+out+to+you+soon.%0A%0ANeed+immediate+help%3F+Call+us%3A+8217527926%0AEmail%3A+info%40earlyjobs.ai%0A%0AWe+look+forward+to+help+you&isTemplate=true&footer=EarlyJobs+Team`
    );
    console.log(response?.data)
   
  } catch (error) {
    console.log(error)
  }
};