const roles = require('../data/roles.json'); // load once
const skills = require('../data/skills.json');
const Categories = require('../models/categories');
const Fuse = require("fuse.js");

const getSkills = (req, res) => {
  try {
    const { searchQuery } = req.query;

    let filteredSkills = skills;

     const fuse = new Fuse(filteredSkills, {
      keys: ['label', 'value'],
      threshold: 0.3
    });
    const result = searchQuery ? fuse.search(searchQuery).map(r => r.item) : filteredSkills.slice(0, 30);

   res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error fetching skills data:', error);
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

const getCountries = (req, res) => {
  try {
    const countries = require('../data/countries.json');
    res.json({
      success: true,
      data: countries
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to load countries data',
      error: error.message
    });
  } 
}

const getTools = (req, res) => {
  try {
    const {searchQuery} = req.query;

    const tools = require('../data/familiarTools.json');
    const fuse = new Fuse(tools, {
      keys: ['label', 'value'],
      threshold: 0.3
    });
    const result = searchQuery ? fuse.search(searchQuery).map(r => r.item) : tools.slice(0, 30);
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error fetching tools data:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to load tools data',
      error: error.message
    });
  }
}


module.exports = {
  getSkills,
  getTools,
  getRoles,
  getCategoriesForAIBuddy,
  getCountries,

};