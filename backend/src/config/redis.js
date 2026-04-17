const Redis = require('ioredis');
const logger = require('../utils/logger');

let redisClient = null;

const getRedisClient = () => {
    if (redisClient) return redisClient;

    try {
        const env = require('./env');
        redisClient = new Redis(env.REDIS_URL, {
            maxRetriesPerRequest: 3,
            retryDelayOnFailover: 100,
            lazyConnect: true,
            reconnectOnError(err) {
                const targetError = 'READONLY';
                if (err.message.includes(targetError)) return true;
                return false;
            },
        });

        redisClient.on('connect', () => {
            logger.info('Redis connected');
        });

        redisClient.on('error', (err) => {
            logger.error('Redis error:', err.message);
        });

        redisClient.on('close', () => {
            logger.warn('Redis connection closed');
        });

        return redisClient;
    } catch (error) {
        logger.warn('Redis not available, falling back to in-memory cache');
        return null;
    }
};

module.exports = { getRedisClient };
