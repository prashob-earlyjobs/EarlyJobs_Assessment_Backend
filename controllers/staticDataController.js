const roles = require('../data/roles.json'); // load once
 const skills = require('../data/skills.json');

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


module.exports = {
  getSkills,
  getRoles
};