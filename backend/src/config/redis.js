const Redis = require('ioredis');
const logger = require('../utils/logger');

let redisClient = null;
let lastRedisFailureAt = 0;
const REDIS_RETRY_COOLDOWN_MS = 60 * 1000;

const getRedisClient = () => {
    if (redisClient) return redisClient;
    if (lastRedisFailureAt && Date.now() - lastRedisFailureAt < REDIS_RETRY_COOLDOWN_MS) {
        return null;
    }

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
            lastRedisFailureAt = 0;
            logger.info('Redis connected');
        });

        client.on('error', (err) => {
            logger.warn('Redis unavailable, using in-memory fallback:', err.message);
            lastRedisFailureAt = Date.now();
            redisClient = null;
            try { client.disconnect(false); } catch {}
        });

        redisClient = client;
        return redisClient;
    } catch (error) {
        lastRedisFailureAt = Date.now();
        logger.warn('Redis not available, using in-memory fallback');
        return null;
    }
};

module.exports = { getRedisClient };
