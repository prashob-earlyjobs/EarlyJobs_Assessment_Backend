const TeamMember = require('../models/Team');
const mongoose = require('mongoose');

const getAllTeamMembers = async (req, res) => {
  try {
    const teamMembers = await TeamMember.find({});
    res.status(200).json(teamMembers);
  } catch (error) {
    console.error('Error fetching team members:', error);
    res.status(500).json({ error: 'Failed to fetch team members' });
  }
};

const createTeamMember = async (req, res) => {
  try {
    console.log('📥 Request body:', req.body);

    const {
      name,
      image_url,
      designation,
      experience_in_years,
      certified_by,
      linkedIn_url,
      position,
      category,
      joined_date,
    } = req.body;

    // Validate required fields
    if (!name || !designation || experience_in_years == null || position == null) {
      return res.status(400).json({
        error: 'Missing required fields: name, designation, experience_in_years, position',
      });
    }

    // Build new member object
    const newTeamMemberData = {
      name,
      image_url,
      designation,
      experience_in_years,
      certified_by,
      linkedIn_url,
      position,
      category,
    };

    // Validate joined_date
    if (joined_date) {
      const date = new Date(joined_date);
      if (isNaN(date.getTime())) {
        return res.status(400).json({ error: 'Invalid joined_date format' });
      }
      newTeamMemberData.joined_date = date;
    }

    // Create and save new member
    const newTeamMember = new TeamMember(newTeamMemberData);
    const savedMember = await newTeamMember.save();

    console.log('✅ New team member added:', savedMember);

    res.status(201).json({
      message: 'Team member added successfully',
      data: savedMember,
    });
  } catch (error) {
    console.error('❌ Error adding team member:', error);

    if (error.name === 'ValidationError') {
      return res.status(400).json({
        error: 'Validation error',
        details: error.message,
      });
    }

    res.status(500).json({
      error: 'Failed to add team member',
      details: error.message,
    });
  }
};

const updateTeamMember = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, image_url, designation, experience_in_years, certified_by, linkedIn_url, position, category, joined_date } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid ID' });
    }

    const updateData = {
      name,
      image_url,
      designation,
      experience_in_years,
      certified_by,
      linkedIn_url,
      position,
      category,
    };

    if (joined_date) {
      const date = new Date(joined_date);
      if (isNaN(date.getTime())) {
        return res.status(400).json({ error: 'Invalid joined_date format' });
      }
      updateData.joined_date = date;
    }

    const updatedTeamMember = await TeamMember.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    });

    if (!updatedTeamMember) {
      return res.status(404).json({ error: 'Team member not found' });
    }

    res.status(200).json(updatedTeamMember);
  } catch (error) {
    console.error('Error updating team member:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ error: 'Validation error', details: error.message });
    }
    res.status(500).json({ error: 'Failed to update team member' });
  }
};

const deleteTeamMember = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid ID' });
    }

    const deletedTeamMember = await TeamMember.findByIdAndDelete(id);

    if (!deletedTeamMember) {
      return res.status(404).json({ error: 'Team member not found' });
    }

    res.status(200).json({ message: 'Team member deleted successfully' });
  } catch (error) {
    console.error('Error deleting team member:', error);
    res.status(500).json({ error: 'Failed to delete team member' });
  }
};

module.exports = {
  getAllTeamMembers,
  createTeamMember,
  updateTeamMember,
  deleteTeamMember,
};