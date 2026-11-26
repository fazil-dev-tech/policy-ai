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

    if (err.code === '22P02') {
        return res.status(400).json({ error: 'Invalid identifier format' });
    }

    if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ error: 'File too large. Maximum size is 10MB.' });
    }

    if (err.message === 'Only PDF files are allowed') {
        return res.status(400).json({ error: err.message });
    }

    if (err.name === 'JsonWebTokenError') {
        return res.status(401).json({ error: 'Invalid token' });
    }

    if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Token expired' });
    }

    const statusCode = err.statusCode || 500;
    const message =
        process.env.NODE_ENV === 'production'
            ? 'Internal server error'
            : err.message || 'Internal server error';

    res.status(statusCode).json({ error: message });
};

module.exports = errorHandler;
