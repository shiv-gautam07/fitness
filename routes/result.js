const express = require('express');
const router = express.Router();
const Exercise = require('../models/Exercise');
const User = require('../models/User');

// Route to render the result page with dynamic data
router.get('/', async (req, res) => {
    try {
        // Check if user exists
        if (!req.user || !req.user._id) {
            return res.status(400).send('User not found');
        }

        const user = await User.findById(req.user._id);  // Get user data from DB
        if (!user) {
            return res.status(400).send('User data not found');
        }

        const exercises = await Exercise.find({ user: req.user._id }).sort({ date: -1 });  // Get user's exercises
        const totalExerciseMinutes = exercises.reduce((total, ex) => total + ex.minutes, 0);  // Calculate total exercise minutes

        // Dynamically calculate calories (can adjust this formula as needed)
        const bmr = user.bmr;  // Assuming bmr is stored in the user model
        const activityFactor = user.activityLevel;  // Activity factor stored in user model
        const calories = bmr * activityFactor;

        // Generate exercise plan based on calories
        let exercisePlan = '';
        if (calories < 1500) {
            exercisePlan = 'Focus on lighter exercises like walking or cycling.';
        } else if (calories >= 1500 && calories <= 2000) {
            exercisePlan = 'Try running, swimming, or strength training.';
        } else {
            exercisePlan = 'Consider HIIT, intense weight training, or sprints.';
        }

        // Static nutrition plan (can be enhanced later)
        const nutritionPlan = 'Balanced diet: Proteins, carbs, and healthy fats.';

        // Render the result page with dynamic data
        res.render('result', {
            name: req.user.name,
            calories,  // Display the dynamically calculated calories
            exercisePlan,  // Display the dynamically generated exercise plan
            nutritionPlan,
            totalExerciseMinutes,
            exercises  // List of exercises for the user
        });

    } catch (error) {
        console.error('Error fetching exercise data:', error);
        res.status(500).send('Error fetching exercise data');
    }
});

module.exports = router;
