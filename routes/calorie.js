const express = require('express');
const router = express.Router();
const Calorie = require('../models/Calorie');

// Function to generate an exercise plan
function getexercisePlan(calories) {
    if (calories < 1500) {
        return 'Light exercises: Yoga, walking (30 minutes)';
    } else if (calories >= 1500 && calories <= 2500) {
        return 'Moderate exercises: Running (30 minutes), strength training (15 minutes)';
    } else {
        return 'Intense exercises: HIIT (30 minutes), weight lifting (20 minutes)';
    }
}

// Function to generate a nutrition plan
function getnutritionPlan(calories) {
    if (calories < 1500) {
        return 'High-protein diet with vegetables and minimal carbs.';
    } else if (calories >= 1500 && calories <= 2500) {
        return 'Balanced diet: Proteins, carbs, and healthy fats.';
    } else {
        return 'High-calorie diet: Whole grains, lean meats, and healthy fats.';
    }
}

// Show the form
router.get('/', (req, res) => {
    res.render('calorieForm');
});

// Calculate, store calories, and generate plans
router.post('/result', async (req, res) => {
    try {
        const { name, age, gender, activityLevel, weight, height } = req.body;
        const email = req.session.email;

        console.log('Received data:', { name, age, gender, activityLevel, weight, height, email }); // Debug log

        if (!email) {
            return res.status(401).json({ error: 'Please log in first' });
        }

        if (!name || !age || !gender || !activityLevel || !weight || !height) {
            return res.status(400).render('calorieForm', { error: 'All fields are required' });
        }

        // BMR Calculation
        let bmr;
        if (gender === 'male') {
            bmr = 10 * weight + 6.25 * height - 5 * age + 5;
        } else {
            bmr = 10 * weight + 6.25 * height - 5 * age - 161;
        }

        const activityMultiplier = {
            sedentary: 1.2,
            lightly_active: 1.375,
            moderately_active: 1.55,
            very_active: 1.725,
        };

        const calories = Math.round(bmr * activityMultiplier[activityLevel]);

        const exercisePlan = getexercisePlan(calories);
        const nutritionPlan = getnutritionPlan(calories);

        const calorieData = new Calorie({
            name,
            age: Number(age),
            gender,
            activityLevel,
            weight: Number(weight),
            height: Number(height),
            calories,
            email,
        });

        console.log('Saving calorie data:', calorieData); // Debug log

        await calorieData.save();

        res.render('result', { 
            name, 
            calories, 
            exercisePlan, 
            nutritionPlan,
            error: null 
        });
    } catch (error) {
        console.error('Error in calorie calculation:', error);
        res.status(500).render('calorieForm', { 
            error: 'An error occurred while saving your data' 
        });
    }
});

module.exports = router;
