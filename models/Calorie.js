const mongoose = require('mongoose');

const CalorieSchema = new mongoose.Schema({
    name: { type: String, required: true },
    age: { type: Number, required: true },
    gender: { type: String, required: true },
    activityLevel: { type: String, required: true },
    weight: { type: Number, required: true },
    height: { type: Number, required: true },
    calories: { type: Number, default: 0 },
    email: { type: String, required: true },
});

module.exports = mongoose.model('Calorie', CalorieSchema);
