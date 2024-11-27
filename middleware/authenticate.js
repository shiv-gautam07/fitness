// middleware/authenticate.js
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const authenticate = (req, res, next) => {
    const token = req.headers['authorization']?.split(' ')[1]; // Token comes from Authorization header

    if (!token) {
        return res.status(403).json({ message: 'Authentication required' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET); // Verify the token using a secret key
        req.user = decoded; // Attach decoded user information to the request
        next(); // Proceed to the next middleware/route
    } catch (error) {
        return res.status(401).json({ message: 'Invalid or expired token' });
    }
};

module.exports = authenticate;
