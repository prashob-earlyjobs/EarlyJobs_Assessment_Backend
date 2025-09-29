// models/UsedQuestion.js
const mongoose = require('mongoose');

const usedQuestionSchema = new mongoose.Schema({
    questions: {
        type: [String],
        default: [],
        // This array stores all unique questions that have been used.
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

module.exports = mongoose.model('UsedQuestion', usedQuestionSchema);