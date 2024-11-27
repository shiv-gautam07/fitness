const express = require('express');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const session = require('express-session');
const router = express.Router();
const sendgridMail = require('@sendgrid/mail');
const path = require('path');
const { checkPasswordStrength, generateOTP, verifyOTP } = require('./utils');
const User = require('./models/User');
const Workout = require('./models/Workout'); 
const authenticate = require('./middleware/authenticate'); 
const calorieRoutes = require('./routes/calorie');
const Calorie = require('./models/Calorie');

// Assuming you have some middleware to verify user authentication

// Middleware to check if the user is authenticated
router.use(authenticate);

const app = express();
const PORT = 3000;

// Set your SendGrid API Key
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
    secret: 'your_secret_key',
    resave: false,
    saveUninitialized: true
}));

// Add this middleware to check authentication for /calorie routes
app.use('/calorie', (req, res, next) => {
    if (!req.session.isAuthenticated) {
        return res.redirect('/login');
    }
    next();
});

// Then use the calorie routes (keep this after the middleware)
app.use('/calorie', calorieRoutes);

// MongoDB Connection
mongoose.connect('mongodb://localhost:27017/Pollos', { 
    useNewUrlParser: true, 
    useUnifiedTopology: true 
})
.then(() => {
    console.log('MongoDB connected successfully');
})
.catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1); // Exit if database connection fails
});

// Add this to monitor DB connection
mongoose.connection.on('error', err => {
    console.error('MongoDB connection error:', err);
});

mongoose.connection.on('disconnected', () => {
    console.log('MongoDB disconnected');
});

// Routes
app.get('/', (req, res) => {
    res.render('index', { message: null });
});
app.get('/signup', (req, res) => {
    res.render('signup', { messageType: null });
});




// Route: POST /send-otp
app.post('/send-otp', async (req, res) => {
    const { name, email } = req.body;

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return res.render('signup', { 
            message: 'Invalid email format. Please enter a valid email.',
            messageType: 'error'
        });
    }

    try {
        const userExists = await User.findOne({ email });

        if (userExists) {
            return res.render('signup', { 
                message: 'User already exists. Please log in.',
                messageType: 'error'
            });
        }

        // Generate OTP and store in session
        const otp = Math.floor(100000 + Math.random() * 900000); // 6-digit OTP
        req.session.otp = otp;
        req.session.email = email;
        req.session.name = name;

        // Send OTP email
        const msg = {
            to: email,
            from: 'sahilarya5796@gmail.com',
            subject: 'OTP Verification',
            text: `Hello ${name}, Your OTP code is ${otp}.`
        };

        await sendgridMail.send(msg);

        // Render OTP verification page
        res.render('verify-otp', { 
            email, 
            message: 'OTP sent successfully.',
            messageType: 'success'
        });

    } catch (error) {
        console.error('Error sending OTP:', error);
        res.render('signup', { 
            message: 'Error sending OTP. Please try again later.',
            messageType: 'error'
        });
    }
});

app.post('/verify-otp', (req, res) => {
    const { otp } = req.body;

    // Check if OTP is correct
    if (String(req.session.otp) === String(otp)) { // Ensure both are strings for comparison
        // Reset attempts after successful verification
        req.session.attempts = 0;
        req.session.otp = null; // Clear OTP after successful use
        res.render('set-password', { message: null });
    } else {
        // Increment the attempt counter
        req.session.attempts = (req.session.attempts || 0) + 1;

        // Check if attempts have reached the limit
        if (req.session.attempts >= 3) {
            // Reset session data and redirect to the signup page after 3 failed attempts
            req.session.destroy(() => {
                res.redirect('/signup'); // Redirect to signup after attempts are exhausted
            });
        } else {
            // Render the OTP verification page with an error message if attempts are below the limit
            res.render('verify-otp', { 
                email: req.session.email, // Preserve email in the rendered view
                message: 'OTP is incorrect. Try again. You will be redirected to signup after 3 failed attempts.', 
                messageType: 'error' 
            });
        }
    }
});



app.post('/set-password', async (req, res) => {
    const { name, email, password } = req.body;

    if (!email || !name || !password) {
        return res.status(400).send('All fields are required.');
    }

    try {
        const existingUser = await User.findOne({ email: email });
        if (existingUser) {
            return res.status(400).send('User already exists. Please login.');
        }

        const hashedPassword = await bcrypt.hash(password, 12);

        const newUser = new User({
            name: name,
            email: email,
            password: hashedPassword,
            username: email
        });

        await newUser.save();
        res.redirect('/login?message=User created successfully');
    } catch (error) {
        console.error('Error saving user:', error);
        res.status(500).send('Error creating user. Please try again later.');
    }
});
// Route to render the forgot password page
app.get('/forgot-password', (req, res) => {
    res.render('forgot-password', { message: null });
});

// Route to send OTP for password reset
app.post('/send-reset-otp', async (req, res) => {
    const { email } = req.body;

    // Check if user exists
    const user = await User.findOne({ email });

    if (!user) {
        return res.render('forgot-password', { message: 'User does not exist. Please sign up.' });
    }

    // Generate OTP and save it to the session
    const otp = generateOTP();
    req.session.resetOtp = otp;
    req.session.resetEmail = email;

    // Send OTP via email
    const msg = {
        to: email,
        from: 'sahilarya5796@gmail.com',
        subject: 'Password Reset OTP',
        text: `Hi , Your OTP for password reset is ${otp}`,
    };

    try {
        await sendgridMail.send(msg);
        res.render('verify-reset-otp', { message: 'OTP sent successfully.' });
    } catch (error) {
        console.error('Error sending OTP:', error);
        res.render('forgot-password', { message: 'Error sending OTP. Try again later.' });
    }
});

// Route to verify OTP
app.post('/verify-reset-otp', (req, res) => {
    const { otp } = req.body;

    if (verifyOTP(req.session.resetOtp, otp)) {
        res.render('reset-password', { message: null }); // Redirect to reset password form
    } else {
        res.render('verify-reset-otp', { message: 'Invalid OTP. Try again.' });
    }
});

// Route to reset the password
app.post('/reset-password', async (req, res) => {
    const { password } = req.body;
    const email = req.session.resetEmail;

    if (!email) {
        return res.redirect('/forgot-password');
    }

    try {
        // Hash the new password
        const hashedPassword = await bcrypt.hash(password, 12);

        // Update the user's password in the database
        await User.findOneAndUpdate({ email }, { password: hashedPassword });

        // Clear session variables
        req.session.resetOtp = null;
        req.session.resetEmail = null;

        res.redirect('/login?message=Password reset successful. Please log in.');
    } catch (error) {
        console.error('Error resetting password:', error);
        res.render('reset-password', { message: 'Error resetting password. Try again later.' });
    }
});











// Example route to handle login and show messages
app.get('/login', (req, res) => {
    const message = req.query.message;
    res.render('login', { message }); // Adjust according to your rendering engine
});
app.post('/login', async (req, res) => {
    const { email, password } = req.body;

    // Step 1: Check if email and password are provided
    if (!email || !password) {
        return res.render('login', { message: 'Email and password are required.' });
    }

    try {
        // Step 2: Find the user by email
        const user = await User.findOne({ email });

        if (!user) {
            return res.render('login', { message: 'User not found. Please sign up.' });
        }

        // Step 3: Compare the provided password with the stored password
        const isPasswordCorrect = await bcrypt.compare(password, user.password);

        if (!isPasswordCorrect) {
            return res.render('login', { message: 'Incorrect password. Please try again.' });
        }

        // Step 4: Generate a new OTP
        const otp = Math.floor(100000 + Math.random() * 900000); // 6-digit OTP
        req.session.otp = otp;  // Store OTP in session
        req.session.email = email;  // Store email in session for later use

        // Step 5: Send OTP to the user's email via SendGrid
        const msg = {
            to: email,
            from: 'sahilarya5796@gmail.com', // Replace with your email
            subject: 'OTP Verification',
            text: `Your OTP code for login is ${otp}.`
        };

        // Send OTP email
        await sendgridMail.send(msg);

        // Step 6: Render OTP verification page
        res.render('login-verify', { email, message: 'OTP sent successfully. Please verify it.' });

    } catch (error) {
        console.error('Error during login process:', error);
        res.render('login', { message: 'Error logging in. Please try again later.' });
    }
});



// OTP verification route
// OTP verification route
app.post('/verify-login-otp', (req, res) => {
    const { otp } = req.body;  // Capture the OTP entered by the user
    const sessionOtp = req.session.otp;  // OTP stored in the session

    // console.log('Entered OTP:', otp);
    // console.log('Session OTP:', sessionOtp);

    // Check if the OTP entered by the user matches the stored OTP
    if (otp === sessionOtp.toString()) {  // Ensure OTP comparison is between strings
        // OTP is valid, mark the user as authenticated
        req.session.isAuthenticated = true;
        req.session.email = req.session.email;  // Store email in session (if not already stored)

        // Redirect to the dashboard
        return res.redirect('/dashboard');
    } else {
        // OTP is incorrect, render the login-verify page with an error message
        return res.render('login-verify', { email: req.session.email, message: 'Invalid OTP. Please try again.' });
    }
});

app.use('/calorie', calorieRoutes);  // Calorie routes
 // Exercise routes













 app.get('/dashboard', async (req, res) => {
    // Ensure user is authenticated (OTP verified)
    if (!req.session.isAuthenticated) {
        return res.redirect('/login'); // Redirect to login if not authenticated
    }

    // Disable caching for the dashboard to prevent access via the back button
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');

    try {
        // Retrieve the user's ID and email from session
        const userId = req.session.userId; // Assuming user ID is stored in session
        const userEmail = req.session.email;

        // Retrieve the user's saved BMI and calorie data from the database
        const userBMI = await BMI.findOne({ userId });
        const calorieData = await Calorie.findOne({ email: userEmail });

        // Render the dashboard with the user's email, BMI data, and calorie data
        res.render('dashboard', { 
            email: userEmail, 
            userBMI: userBMI ? userBMI.bmi : null,
            calorieData 
        });
    } catch (err) {
        console.error('Error retrieving user data:', err);
        res.render('dashboard', { 
            email: req.session.email, 
            userBMI: null,
            calorieData: null 
        });
    }
});
let workoutData = [
    { date: '2024-11-20', time: 30, distance: 5 },
    { date: '2024-11-19', time: 45, distance: 8 },
]; 
app.use(express.json());

app.post('/api/save-workout', async (req, res) => {
    try {
        const { date, time, distance } = req.body;

        if (!date || !time || !distance) {
            return res.status(400).json({
                success: false,
                error: 'All fields are required.',
            });
        }

        const userEmail = req.session.email;
        if (!userEmail) {
            return res.status(401).json({ error: 'Unauthorized. Please log in.' });
        }

        const newWorkout = new Workout({ date, time, distance, email: userEmail });
        await newWorkout.save();

        res.status(200).json({
            success: true,
            message: 'Workout added successfully!'
        });
    } catch (err) {
        console.error('Error saving workout:', err);
        res.status(500).json({
            success: false,
            error: 'Failed to save workout.'
        });
    }
});


// Get workouts route
// Get workouts route
app.get('/api/get-workouts', (req, res) => {
    res.json(workoutData);
});

app.post('/api/save-workout', (req, res) => {
    const { date, time, distance } = req.body;
    if (date && time && distance) {
        workoutData.unshift({ date, time: parseInt(time), distance: parseFloat(distance) });
        res.json({ message: 'Workout saved!', data: workoutData });
    } else {
        res.status(400).json({ error: 'Invalid data' });
    }
});
// Example calculation logic for daily calories
app.get('/api/get-calories', (req, res) => {
    const user = req.user;  // Assuming user data is stored in the session or database
    if (user) {
        const calories = calculateCalories(user);
        res.json({ calories: calories });
    } else {
        res.status(404).json({ error: 'User not found' });
    }
});

// Function to calculate calories based on BMI or other factors
function calculateCalories(user) {
    // Example: BMR calculation using Mifflin-St Jeor Equation (for men)
    const bmr = 10 * user.weight + 6.25 * user.height - 5 * user.age + 5; // For male
    // Apply an activity factor, e.g., sedentary = 1.2, moderate = 1.55, active = 1.9
    const activityFactor = 1.55; 
    const dailyCalories = bmr * activityFactor;
    return dailyCalories;
}





app.get('/logout', (req, res) => {
    // Destroy the session to log out the user
    req.session.destroy((err) => {
        if (err) {
            console.error("Error destroying session:", err);
            return res.status(500).send("Error logging out");
        }

        // Prevent cached access to dashboard after logout
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.setHeader('Surrogate-Control', 'no-store');

        // Redirect to login page after successful logout
        res.redirect('/login');
    });
});

// Add these routes after your existing routes
app.get('/workouts', (req, res) => {
    if (!req.session.isAuthenticated) {
        return res.redirect('/login');
    }
    res.render('workouts');
});

app.get('/tutorials', (req, res) => {
    if (!req.session.isAuthenticated) {
        return res.redirect('/login');
    }
    res.render('tutorials');
});
app.use('/uploads', express.static('uploads'));


app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
const multer = require('multer');
const blogSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true
    },
    content: {
        type: String,
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

const Blog = mongoose.model('Blog', blogSchema);
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, "public/uploads"); // Destination folder for uploads
    },
    filename: (req, file, cb) => {
      cb(null, Date.now() + path.extname(file.originalname)); // Add timestamp to the filename
    },
  });
  
  // Initialize Multer
  const upload = multer({ storage: storage });


// Route to handle adding a blog
app.get('/blogs', async (req, res) => {
    if (!req.session.isAuthenticated) {
        return res.redirect('/login');
    }
    const blogs = await Blog.find();
    res.render('blogs', { blogs });
});

// Add Blog Route
app.post('/blogs/add', async (req, res) => {
    const { title, content } = req.body;

    try {
        const newBlog = new Blog({ title, content });
        await newBlog.save();
        res.redirect('/blogs'); // Redirect to blogs page after adding
    } catch (err) {
        console.error(err);
        res.status(500).send('Error adding blog');
    }
});

// Route to delete a blog
app.post('/blogs/delete/:id', async (req, res) => {
    const { id } = req.params;

    try {
        await Blog.findByIdAndDelete(id);
        res.redirect('/blogs'); // Redirect to blogs page after deletion
    } catch (err) {
        console.error(err);
        res.status(500).send('Error deleting blog');
    }
});
// Render a single blog in expanded view
app.get('/blogs/:id', async (req, res) => {
    try {
        const blog = await Blog.findById(req.params.id);
        res.render('blogDetails', { blog });
    } catch (err) {
        console.error(err);
        res.status(500).send('Unable to fetch blog details');
    }
});


const bmiSchema = new mongoose.Schema({
    userId: mongoose.Schema.Types.ObjectId,
    bmi: Number,
    date: { type: Date, default: Date.now }
});
const BMI = mongoose.model('BMI', bmiSchema);

// Route to display BMI calculator
app.get('/bmi-calculator', (req, res) => {
    res.render('bmi-calculator');
});

// Route to handle BMI calculation and form submission
app.post('/calculate-bmi', async (req, res) => {
    const { height, weight } = req.body;
    const heightInMeters = height / 100;
    const bmi = (weight / (heightInMeters * heightInMeters)).toFixed(2);

    // Save the BMI to the database
    try {
        const userId = req.session.userId; // Assuming user ID is stored in session
        await BMI.findOneAndUpdate(
            { userId },
            { bmi },
            { upsert: true, new: true }
        );
    } catch (err) {
        console.error('Error saving BMI:', err);
    }

    // Render the calculator page with the new BMI
    res.render('bmi-calculator', { bmi });
});
// Helper function to categorize BMI
function getBMICategory(bmi) {
    if (bmi < 18.5) return 'Underweight';
    if (bmi >= 18.5 && bmi < 24.9) return 'Normal weight';
    if (bmi >= 25 && bmi < 29.9) return 'Overweight';
    return 'Obesity';
}




// Start Server
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});