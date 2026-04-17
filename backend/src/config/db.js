const mongoose = require('mongoose');
const logger = require('../utils/logger');

const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 3000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const connectDB = async (attempt = 1) => {
    try {
        const env = require('./env');
        const uri = env.MONGODB_URI;

        // Options that work for both local MongoDB and MongoDB Atlas
        const options = {
            maxPoolSize: 50,
            serverSelectionTimeoutMS: 8000,
            socketTimeoutMS: 45000,
            connectTimeoutMS: 10000,
            retryWrites: true,
        };

        const conn = await mongoose.connect(uri, options);
        logger.info(`✅ MongoDB connected: ${conn.connection.host}`);

        // Handle connection errors after initial connect
        mongoose.connection.on('error', (err) => {
            logger.error('MongoDB runtime error:', err.message);
        });

        mongoose.connection.on('disconnected', () => {
            logger.warn('⚠️  MongoDB disconnected. Reconnecting in 5s...');
            setTimeout(() => connectDB(), 5000);
        });

        mongoose.connection.on('reconnected', () => {
            logger.info('✅ MongoDB reconnected successfully');
        });

        return conn;
    } catch (error) {
        logger.error(`❌ MongoDB connection failed (attempt ${attempt}/${MAX_RETRIES}): ${error.message}`);

        if (attempt < MAX_RETRIES) {
            const delay = RETRY_DELAY_MS * attempt; // exponential-step: 3s, 6s, 9s, 12s
            logger.info(`⏳ Retrying in ${delay / 1000}s...`);
            await sleep(delay);
            return connectDB(attempt + 1);
        }

        logger.error('🛑 All MongoDB connection attempts failed. Exiting.');
        process.exit(1);
    }
};

// Expose connection state for health checks
const getDbStatus = () => {
    const states = { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' };
    return states[mongoose.connection.readyState] || 'unknown';
};

module.exports = { connectDB, getDbStatus };
