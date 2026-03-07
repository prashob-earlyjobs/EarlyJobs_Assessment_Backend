const roles = require('../data/roles.json'); // load once
const skills = require('../data/skills.json');
const Categories = require('../models/categories');


const getSkills = (req, res) => {
  try {
    const { searchQuery } = req.query;
    const limit = parseInt(req.query.limit) || 30;


    let filteredSkills = skills;

    if (searchQuery) {
      const searchLower = searchQuery.trim().toLowerCase();

      filteredSkills = skills.filter(skill =>
        skill.label.toLowerCase().includes(searchLower) ||
        skill.value.toLowerCase().includes(searchLower)
      );
    }

    res.json({
      success: true,
      data: filteredSkills.slice(0, limit)
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to load skills data',
      error: error.message
    });
  }
};




const getRoles = (req, res) => {
  try {
    const { searchQuery } = req.query;
    const limit = parseInt(req.query.limit) || 50;

    let filteredRoles = roles;

    if (searchQuery) {
      const searchLower = searchQuery.trim().toLowerCase();

      filteredRoles = roles.filter(role => {
        const name = String(role.label || "").toLowerCase();
        const id = String(role.value || "").toLowerCase();

        return (
          name.includes(searchLower) ||
          id.includes(searchLower)
        );
      });
    }

    res.json({
      success: true,
      data: filteredRoles.slice(0, limit)
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to load roles data',
      error: error.message
    });
  }
};

const getCategoriesForAIBuddy = async (req, res) => {
  try {
    const categories = await Categories.aggregate(
      [
        {
          $match: { parentId: null }
        },
        {
          $lookup: {
            from: "categories",
            localField: "_id",
            foreignField: "parentId",
            as: "domains"
          }
        },
        {
          $project: {
            _id: 0,
            id: { $toString: "$_id" },
            category: "$name",
            subCategory: "$domains.name",
            createdAt: "$createdAt",
            updatedAt: "$updatedAt"
          }
        }
      ]
    );


    res.json({
      success: true,
      data: categories
    });
  } catch (error) {
    console.error('Error fetching categories for AI Buddy:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to load categories',
      error: error.message
    });
  }
}


module.exports = {
  getSkills,
  getRoles,
  getCategoriesForAIBuddy
};