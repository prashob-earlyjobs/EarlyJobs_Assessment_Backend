 const User =  require('../models/User');
 const axios = require('axios');

 const getUserInterviews = async (req, res) => {
  try {

      const {id} = req.params;
      console.log("Received request to get interviews for user ID:", id);  
  
      const interviews = await User.findById(id).select('assessment');


      return res.status(200).json({
        success: true,
        interviews: interviews.assessment || []
      });
    

  } catch (error) {
    console.error("Error fetching user interviews:", error);
    // Generic error response
    res.status(500).json({
      success: false,
      message: 'Internal server error. Please try again later.'
    });
  }
};


const getInterviewReport = async (req, res)=>{
  try{
    const {id} = req.params
    const sessionId = id;
    console.log("report url :",`${process.env.INTERVIEW_PORTAL_URL}/api/public/interviews/report/${sessionId}`);

    const response = await axios.get(`${process.env.INTERVIEW_PORTAL_URL}/api/public/interviews/report/${sessionId}`);
    return res.status(200).json(response.data);
  }catch(error){
    console.error("Error fetching interview report:", error);
     res.status(500).json({
      success: false,
      message: 'Internal server error. Please try again later.'
    });
  }
}


module.exports = {
  getUserInterviews,
  getInterviewReport
};