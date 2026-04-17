const jwt = require('jsonwebtoken');
const User = require('../models/User');
const logger = require('../utils/logger');

const authenticate = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Access denied. No token provided.' });
        }

        const token = authHeader.split(' ')[1];
        const env = require('../config/env');
        const decoded = jwt.verify(token, env.JWT_SECRET);

        const user = await User.findById(decoded.userId).select('-password_hash -refreshToken');
        if (!user) {
            return res.status(401).json({ error: 'Invalid token. User not found.' });
        }

        req.user = user;
        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Token expired', code: 'TOKEN_EXPIRED' });
        }
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ error: 'Invalid token' });
        }
        logger.error('Auth middleware error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};

const authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Not authenticated' });
        }
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }
        next();
    };
};

module.exports = { authenticate, authorize };
