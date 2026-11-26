const logger = require('../utils/logger');

const errorHandler = (err, req, res, _next) => {
    logger.error('Unhandled error:', {
        message: err.message,
        stack: err.stack,
        url: req.originalUrl,
        method: req.method,
        ip: req.ip,
    });

    if (err.code === '23505') {
        return res.status(409).json({ error: 'Duplicate record already exists' });
    }

    if (['22P02', '22007', '23514', '23502', '23503'].includes(err.code)) {
        return res.status(400).json({ error: 'Invalid input or identifier format' });
    }

    if (err.code === 'LIMIT_FILE_SIZE') {
        const limitMb = Math.round((parseInt(process.env.MAX_FILE_SIZE, 10) || 10 * 1024 * 1024) / (1024 * 1024));
        return res.status(413).json({ error: `File too large. Maximum size is ${limitMb}MB.` });
    }

    if (err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE' || err.code === 'LIMIT_PART_COUNT') {
        return res.status(400).json({ error: err.message || 'Too many files or invalid upload field' });
    }

    if (
        err.message === 'Only PDF files are allowed' ||
        err.message === 'Only PDF, JPG, PNG, and WEBP files are allowed' ||
        err.message === 'Only JPG, PNG, and WEBP image files are allowed'
    ) {
        return res.status(400).json({ error: err.message });
    }

    if (err instanceof SyntaxError && err.type === 'entity.parse.failed') {
        return res.status(400).json({ error: 'Malformed JSON request body' });
    }

    if (err.name === 'JsonWebTokenError') {
        return res.status(401).json({ error: 'Invalid token' });
    }

    if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Token expired' });
    }

    const upstreamRateLimit =
        err.status === 429 ||
        err.statusCode === 429 ||
        /429\s*Rate limit|free-models-per-day/i.test(String(err.message || ''));

    if (upstreamRateLimit) {
        return res.status(429).json({
            error: 'Upstream AI quota/rate limit reached temporarily. Please retry shortly or verify provider credits.',
        });
    }

    const statusCode = err.statusCode || err.status || 500;
    const message =
        process.env.NODE_ENV === 'production' && statusCode >= 500
            ? 'Internal server error'
            : err.message || 'Internal server error';

    res.status(statusCode).json({ error: message });
};

module.exports = errorHandler;
