const jwt = require('jsonwebtoken');
const User = require('../models/User');
const logger = require('../utils/logger');

const generateTokens = (userId) => {
    const env = require('../config/env');

    const accessToken = jwt.sign({ userId }, env.JWT_SECRET, {
        expiresIn: env.JWT_EXPIRES_IN,
    });

    const refreshToken = jwt.sign({ userId }, env.JWT_REFRESH_SECRET, {
        expiresIn: env.JWT_REFRESH_EXPIRES_IN,
    });

    return { accessToken, refreshToken };
};

/**
 * POST /api/auth/register
 */
const register = async (req, res, next) => {
    try {
        const { name, email, password, role } = req.body;

        // Check if user exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(409).json({ error: 'Email already registered' });
        }

        // Create user
        const user = await User.create({
            name,
            email,
            password_hash: password,
            role: role === 'admin' ? 'admin' : 'user',
        });

        // Generate tokens
        const { accessToken, refreshToken } = generateTokens(user._id);
        user.refreshToken = refreshToken;
        await user.save();

        logger.info(`User registered: ${email}`);

        res.status(201).json({
            message: 'Registration successful',
            user: user.toJSON(),
            accessToken,
            refreshToken,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * POST /api/auth/login
 */
const login = async (req, res, next) => {
    try {
        const { email, password } = req.body;

        // Find user by email
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        // Verify password
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        // Generate tokens
        const { accessToken, refreshToken } = generateTokens(user._id);
        user.refreshToken = refreshToken;
        user.lastLogin = new Date();
        await user.save();

        logger.info(`User logged in: ${email}`);

        res.json({
            message: 'Login successful',
            user: user.toJSON(),
            accessToken,
            refreshToken,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * POST /api/auth/refresh
 */
const refresh = async (req, res, next) => {
    try {
        const { refreshToken } = req.body;
        if (!refreshToken) {
            return res.status(401).json({ error: 'Refresh token required' });
        }

        const env = require('../config/env');
        const decoded = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET);

        const user = await User.findById(decoded.userId);
        if (!user || user.refreshToken !== refreshToken) {
            return res.status(401).json({ error: 'Invalid refresh token' });
        }

        const tokens = generateTokens(user._id);
        user.refreshToken = tokens.refreshToken;
        await user.save();

        res.json({
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
        });
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Refresh token expired. Please login again.' });
        }
        next(error);
    }
};

/**
 * POST /api/auth/send-otp
 */
const sendOtp = async (req, res, next) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ error: 'Email is required' });

        // Find or create user
        let user = await User.findOne({ email });
        if (!user) {
            // Passwordless users get a random secure password string
            const randomPassword = require('crypto').randomBytes(16).toString('hex');
            user = await User.create({
                name: email.split('@')[0],
                email,
                password_hash: randomPassword,
                role: 'user',
            });
            logger.info(`New passwordless user created: ${email}`);
        }

        // Generate 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();

        // Save OTP and 10-minute expiry
        user.loginOtp = otp;
        user.loginOtpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
        await user.save();

        // Send Email
        const { sendOtpEmail } = require('../services/email.service');
        await sendOtpEmail(email, otp);

        res.json({ message: 'OTP sent successfully to your email' });
    } catch (error) {
        next(error);
    }
};

/**
 * POST /api/auth/verify-otp
 */
const verifyOtp = async (req, res, next) => {
    try {
        const { email, otp } = req.body;
        if (!email || !otp) return res.status(400).json({ error: 'Email and OTP are required' });

        const user = await User.findOne({ email });
        if (!user || !user.loginOtp || !user.loginOtpExpires) {
            return res.status(401).json({ error: 'Invalid or expired OTP' });
        }

        // Check expiry
        if (new Date() > user.loginOtpExpires) {
            return res.status(401).json({ error: 'OTP has expired. Please request a new one.' });
        }

        // Verify OTP
        if (user.loginOtp !== otp) {
            return res.status(401).json({ error: 'Invalid OTP' });
        }

        // Clear OTP fields
        user.loginOtp = null;
        user.loginOtpExpires = null;

        // Generate tokens
        const { accessToken, refreshToken } = generateTokens(user._id);
        user.refreshToken = refreshToken;
        user.lastLogin = new Date();
        await user.save();

        logger.info(`User logged in via OTP: ${email}`);

        res.json({
            message: 'Login successful',
            user: user.toJSON(),
            accessToken,
            refreshToken,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * GET /api/auth/me
 */
const getMe = async (req, res) => {
    res.json({ user: req.user });
};

module.exports = { register, login, refresh, getMe, sendOtp, verifyOtp };
