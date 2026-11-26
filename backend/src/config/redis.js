const Redis = require('ioredis');
const logger = require('../utils/logger');

let redisClient = null;
let redisAttempted = false;

const getRedisClient = () => {
    if (redisClient) return redisClient;
    if (redisAttempted) return null;
    redisAttempted = true;

    const env = require('./env');
    if (!env.REDIS_URL) {
        return null;
    }

    try {
        const client = new Redis(env.REDIS_URL, {
            maxRetriesPerRequest: 1,
            enableOfflineQueue: false,
            lazyConnect: true,
            retryStrategy: () => null,
        });

        client.on('connect', () => {
            logger.info('Redis connected');
        });

        client.on('error', (err) => {
            logger.warn('Redis unavailable, using in-memory fallback:', err.message);
            redisClient = null;
        });

        redisClient = client;
        return redisClient;
    } catch (error) {
        logger.warn('Redis not available, using in-memory fallback');
        return null;
    }
};

module.exports = { getRedisClient };
