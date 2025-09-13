const User = require('../models/User');


exports.getAllCandidates = async (req, res) => {
  try {
    
    const candidates = await User.find({ 
      role: 'candidate',
      assessmentsPaid: { $exists: true, $not: { $size: 0 } }
    })
      .select('-password')
      .lean();

    if (!candidates || candidates.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No candidates with paid assessments found'
      });
    }

    res.status(200).json({
      success: true,
      count: candidates.length,
      data: candidates
    });
  } catch (error) {
    console.error('Error fetching candidates:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching candidates',
      error: error.message
    });
  }
};