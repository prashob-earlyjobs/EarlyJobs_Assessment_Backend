const jobCategories = require('../data/jobCategories.json');
const popularCities = require('../data/cities.json');
const axios = require('axios');
const dotenv = require('dotenv');
dotenv.config({path: './.env'});
const User = require('../models/User');

const getDashboardData = async (req, res) => {
  try {
    // Sample dashboard data
    const dashboardData = {
      recentJobs: [],
    };

    const recentJobs = await axios.get(`${process.env.JOB_PORTAL_URL}/api/public/jobs`);
    const companies = await axios.get(`${process.env.JOB_PORTAL_URL}/api/public/companies`);
    const candidates = await User.countDocuments({ role: 'candidate' });

    dashboardData.recentJobs = recentJobs?.data?.data?.jobs?.slice(0, 5) || [];
   
    dashboardData.totalJobs = parseInt(recentJobs?.data?.totalResults || 9999)+4000;
    dashboardData.totalCompanies = parseInt(companies?.data?.length || 1000);
    dashboardData.totalCandidates = candidates || 9999;
    dashboardData.categories = jobCategories;
    dashboardData.popularCities = popularCities;
    
    return res.status(200).json({
      success: true,
      data: dashboardData,
    });
  } catch (error) {
    console.error("Error fetching dashboard data:", error);
    res.status(500).json({
      success: false,
      message: 'Internal server error. Please try again later.'
    });
  }
}

module.exports = {
  getDashboardData,
};
