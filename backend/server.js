// ⚠️ Load env FIRST — before any other module that reads process.env
require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const app = require('./src/app');
const { connectDB } = require('./src/config/db');
const logger = require('./src/utils/logger');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 5000;

// Create required directories
const dirs = ['uploads', 'logs'];
dirs.forEach((dir) => {
    const dirPath = path.join(__dirname, dir);
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
});

// Start server
const startServer = async () => {
    try {
        // Connect to MongoDB
        await connectDB();

        // Start Express
        const server = app.listen(PORT, () => {
            logger.info(`
╔══════════════════════════════════════════╗
║          PolicyAI Backend Server         ║
╠══════════════════════════════════════════╣
║  Status:  ✅ Running                     ║
║  Port:    ${String(PORT).padEnd(30)}║
║  Mode:    ${String(process.env.NODE_ENV || 'development').padEnd(30)}║
║  Docs:    http://localhost:${PORT}/api-docs  ║
╚══════════════════════════════════════════╝
      `);
        });

        // Graceful shutdown
        const gracefulShutdown = (signal) => {
            logger.info(`${signal} received. Shutting down gracefully...`);
            server.close(() => {
                logger.info('HTTP server closed');
                process.exit(0);
            });

            setTimeout(() => {
                logger.error('Forced shutdown due to timeout');
                process.exit(1);
            }, 10000);
        };

        process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
        process.on('SIGINT', () => gracefulShutdown('SIGINT'));

        // Handle unhandled rejections
        process.on('unhandledRejection', (reason, promise) => {
            logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
        });

        process.on('uncaughtException', (error) => {
            logger.error('Uncaught Exception:', error);
            gracefulShutdown('uncaughtException');
        });
    } catch (error) {
        logger.error('Failed to start server:', error);
        process.exit(1);
    }
};

startServer();
