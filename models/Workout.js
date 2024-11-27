const mongoose = require('mongoose');

// Define Workout Schema
const workoutSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true
    },
    date: {
        type: String, // Storing date as string (e.g., "2024-11-22")
        required: true
    },
    time: {
        type: Number, // Store workout time in minutes
        required: true
    },
    distance: {
        type: Number, // Store workout distance in kilometers
        required: true
    }
});

// Create the Workout model
const Workout = mongoose.model('Workout', workoutSchema);

module.exports = Workout;
