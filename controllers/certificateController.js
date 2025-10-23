// controllers/certificateController.js
const Certificate = require("../models/Certificate");
const User = require("../models/User");
const Assessment = require("../models/Assessment");
const mongoose = require("mongoose");

// @desc    Verify certificate by certificate number
// @route   GET /api/certificates/verify/:certificateNo
// @access  Public
const verifyCertificate = async (req, res) => {
  try {
    const { certificateNo } = req.params;

    if (!certificateNo) {
      return res.status(400).json({
        success: false,
        message: "Certificate number is required",
      });
    }

    // Find certificate by certificate number
    const certificate = await Certificate.findOne({ 
      certificateno: certificateNo.toUpperCase(),
      isActive: true 
    })
      .populate('userid', 'name email mobile')
      .populate('assessmentid', 'title category type shortId');

    if (!certificate) {
      return res.status(404).json({
        success: false,
        message: "Certificate not found or invalid",
      });
    }

    // Return certificate details for verification
    res.json({
      success: true,
      message: "Certificate verified successfully",
      data: {
        certificate: {
          _id: certificate._id,
          certificateNumber: certificate.certificateno,
          interviewId: certificate.interviewid,
          issuedDate: certificate.issuedDate,
          certificateLink: certificate.certificatelink,
          user: {
            name: certificate.userid?.name,
            email: certificate.userid?.email,
            mobile: certificate.userid?.mobile,
          },
          assessment: {
            title: certificate.assessmentid?.title,
            category: certificate.assessmentid?.category,
            type: certificate.assessmentid?.type,
            shortId: certificate.assessmentid?.shortId,
          },
        },
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error verifying certificate",
      error: error.message,
    });
  }
};

// @desc    Get all certificates for a user
// @route   GET /api/certificates/user/:userId
// @access  Private
const getUserCertificates = async (req, res) => {
  try {
    const { userId } = req.params;

    // Validate userId
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID",
      });
    }

    // Find all certificates for the user
    const certificates = await Certificate.find({ 
      userid: userId,
      isActive: true 
    })
      .populate('assessmentid', 'title category type shortId')
      .sort({ issuedDate: -1 });

    res.json({
      success: true,
      data: {
        certificates: certificates.map(cert => ({
          _id: cert._id,
          certificateNumber: cert.certificateno,
          interviewId: cert.interviewid,
          issuedDate: cert.issuedDate,
          certificateLink: cert.certificatelink,
          assessment: {
            title: cert.assessmentid?.title,
            category: cert.assessmentid?.category,
            type: cert.assessmentid?.type,
            shortId: cert.assessmentid?.shortId,
          },
        })),
        total: certificates.length,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching user certificates",
      error: error.message,
    });
  }
};

// @desc    Create a new certificate
// @route   POST /api/certificates
// @access  Private (Admin)
const createCertificate = async (req, res) => {
  try {
    const { userid, interviewid, certificateno, assessmentid, certificatelink } = req.body;

    // Validate required fields
    if (!userid || !interviewid || !certificateno || !assessmentid || !certificatelink) {
      return res.status(400).json({
        success: false,
        message: "All fields are required: userid, interviewid, certificateno, assessmentid, certificatelink",
      });
    }

    // Validate ObjectIds
    if (!mongoose.Types.ObjectId.isValid(userid) || !mongoose.Types.ObjectId.isValid(assessmentid)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID or assessment ID",
      });
    }

    // Check if user exists
    const user = await User.findById(userid);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Check if assessment exists
    const assessment = await Assessment.findById(assessmentid);
    if (!assessment) {
      return res.status(404).json({
        success: false,
        message: "Assessment not found",
      });
    }

    // Check if certificate number already exists
    const existingCertificate = await Certificate.findOne({ certificateno: certificateno.toUpperCase() });
    if (existingCertificate) {
      return res.status(400).json({
        success: false,
        message: "Certificate number already exists",
      });
    }

    // Create new certificate
    const certificate = await Certificate.create({
      userid,
      interviewid,
      certificateno: certificateno.toUpperCase(),
      assessmentid,
      certificatelink,
    });

    // Populate the created certificate
    await certificate.populate('userid', 'name email');
    await certificate.populate('assessmentid', 'title category type shortId');

    res.status(201).json({
      success: true,
      message: "Certificate created successfully",
      data: {
        certificate: {
          _id: certificate._id,
          certificateNumber: certificate.certificateno,
          interviewId: certificate.interviewid,
          issuedDate: certificate.issuedDate,
          certificateLink: certificate.certificatelink,
          user: {
            name: certificate.userid?.name,
            email: certificate.userid?.email,
          },
          assessment: {
            title: certificate.assessmentid?.title,
            category: certificate.assessmentid?.category,
            type: certificate.assessmentid?.type,
            shortId: certificate.assessmentid?.shortId,
          },
        },
      },
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }
    
    res.status(500).json({
      success: false,
      message: "Error creating certificate",
      error: error.message,
    });
  }
};

// @desc    Get certificate by ID
// @route   GET /api/certificates/:id
// @access  Private
const getCertificateById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid certificate ID",
      });
    }

    const certificate = await Certificate.findOne({ 
      _id: id,
      isActive: true 
    })
      .populate('userid', 'name email')
      .populate('assessmentid', 'title category type shortId');

    if (!certificate) {
      return res.status(404).json({
        success: false,
        message: "Certificate not found",
      });
    }

    res.json({
      success: true,
      data: {
        certificate: {
          _id: certificate._id,
          certificateNumber: certificate.certificateno,
          interviewId: certificate.interviewid,
          issuedDate: certificate.issuedDate,
          certificateLink: certificate.certificatelink,
          user: {
            name: certificate.userid?.name,
            email: certificate.userid?.email,
          },
          assessment: {
            title: certificate.assessmentid?.title,
            category: certificate.assessmentid?.category,
            type: certificate.assessmentid?.type,
            shortId: certificate.assessmentid?.shortId,
          },
        },
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching certificate",
      error: error.message,
    });
  }
};

// @desc    Deactivate certificate
// @route   PUT /api/certificates/:id/deactivate
// @access  Private (Admin)
const deactivateCertificate = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid certificate ID",
      });
    }

    const certificate = await Certificate.findByIdAndUpdate(
      id,
      { isActive: false },
      { new: true }
    );

    if (!certificate) {
      return res.status(404).json({
        success: false,
        message: "Certificate not found",
      });
    }

    res.json({
      success: true,
      message: "Certificate deactivated successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error deactivating certificate",
      error: error.message,
    });
  }
};

module.exports = {
  verifyCertificate,
  getUserCertificates,
  createCertificate,
  getCertificateById,
  deactivateCertificate,
};
