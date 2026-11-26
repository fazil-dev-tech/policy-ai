const fs = require('fs');
const winston = require('winston');
const path = require('path');

const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.LAMBDA_TASK_ROOT);
const logDir = process.env.LOG_DIR || 'logs';

const transports = [
    new winston.transports.Console({
        format:
            process.env.NODE_ENV === 'production'
                ? winston.format.json()
                : winston.format.combine(
                      winston.format.colorize(),
                      winston.format.printf(({ level, message, timestamp, stack }) => {
                          return `${timestamp} [${level}]: ${stack || message}`;
                      })
                  ),
    }),
];

if (!isServerless) {
    try {
        if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
        transports.push(
            new winston.transports.File({
                filename: path.join(logDir, 'error.log'),
                level: 'error',
                maxsize: 5242880,
                maxFiles: 5,
            }),
            new winston.transports.File({
                filename: path.join(logDir, 'combined.log'),
                maxsize: 5242880,
                maxFiles: 5,
            })
        );
    } catch {
        // Fallback to console-only logging cleanly on read-only filesystems
    }
}

const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'debug',
    format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.errors({ stack: true }),
        winston.format.json()
    ),
    defaultMeta: { service: 'policyai-backend' },
    transports,
});

module.exports = logger;
