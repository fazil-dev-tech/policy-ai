require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const fs = require('fs');
const path = require('path');
const app = require('./src/app');
const { checkSupabaseHealth } = require('./src/config/supabase');
const logger = require('./src/utils/logger');

const PORT = process.env.PORT || 5000;

const dirs = ['logs'];
dirs.forEach((dir) => {
    const dirPath = path.join(__dirname, dir);
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
});

const startServer = async () => {
    try {
        const dbHealth = await checkSupabaseHealth();
        if (dbHealth.status === 'connected') {
            logger.info(`✅ Supabase connected (${dbHealth.latencyMs}ms)`);
        } else {
            logger.warn(`⚠️ Supabase health check degraded: ${dbHealth.error || 'unknown error'}`);
        }

        const server = app.listen(PORT, () => {
            logger.info(`
╔══════════════════════════════════════════╗
║          PolicyAI Backend Server         ║
╠══════════════════════════════════════════╣
║  Status:  ✅ Running                     ║
║  Port:    ${String(PORT).padEnd(30)}║
║  Mode:    ${String(process.env.NODE_ENV || 'development').padEnd(30)}║
║  DB:      Supabase                       ║
║  Docs:    http://localhost:${PORT}/api-docs  ║
╚══════════════════════════════════════════╝
            `);
        });

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
