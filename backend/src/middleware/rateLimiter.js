const rateLimit = require('express-rate-limit');

const createRateLimiter = (windowMs = 900000, max = 100, message = 'Too many requests') => {
    return rateLimit({
        windowMs,
        max,
        message: { error: message },
        standardHeaders: true,
        legacyHeaders: false,
        handler: (req, res) => {
            res.status(429).json({
                error: message,
                retryAfter: Math.ceil(windowMs / 1000),
            });
        },
    });
};

// Pre-configured limiters
const authLimiter = createRateLimiter(
    15 * 60 * 1000,
    20,
    'Too many authentication attempts. Please try again later.'
);

const apiLimiter = createRateLimiter(
    15 * 60 * 1000,
    100,
    'Too many API requests. Please try again later.'
);

const chatLimiter = createRateLimiter(
    60 * 1000,
    30,
    'Too many chat messages. Please slow down.'
);

const uploadLimiter = createRateLimiter(
    60 * 60 * 1000,
    20,
    'Too many file uploads. Please try again later.'
);

module.exports = { createRateLimiter, authLimiter, apiLimiter, chatLimiter, uploadLimiter };
