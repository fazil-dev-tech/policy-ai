const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const { apiLimiter } = require('./middleware/rateLimiter');
const errorHandler = require('./middleware/errorHandler');
const logger = require('./utils/logger');
const { checkSupabaseHealth } = require('./config/supabase');
const { getActiveAiMetadata } = require('./services/ai.service');

const isProd = process.env.NODE_ENV === 'production';
const FRONTEND_DIST = path.join(__dirname, '..', '..', 'frontend', 'dist');

const authRoutes = require('./routes/auth.routes');
const policyRoutes = require('./routes/policy.routes');
const chatRoutes = require('./routes/chat.routes');
const claimsRoutes = require('./routes/claims.routes');
const adminRoutes = require('./routes/admin.routes');
const marketRoutes = require('./routes/market.routes');
const documentRoutes = require('./routes/document.routes');
const incidentsRoutes = require('./routes/incidents.routes');
const { securityRouter, platformRouter } = require('./routes/platform.routes');

const app = express();
app.set('trust proxy', 1);

app.use(
    helmet({
        crossOriginResourcePolicy: { policy: 'cross-origin' },
    })
);

const allowedOrigins = [
    process.env.CORS_ORIGIN || 'http://localhost:5173',
    process.env.FRONTEND_URL,
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:3000',
]
    .filter(Boolean)
    .filter((v, i, a) => a.indexOf(v) === i);

const isAllowedCorsOrigin = (origin) => {
    if (!origin) return true;
    if (allowedOrigins.includes(origin)) return true;
    if (origin.startsWith('chrome-extension://')) return true;
    if (/^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(origin)) return true;
    return false;
};

app.use(
    cors({
        origin: (origin, callback) => {
            if (isAllowedCorsOrigin(origin)) return callback(null, true);
            logger.warn(`CORS blocked origin: ${origin}`);
            const err = new Error(`CORS: Origin '${origin}' not allowed`);
            err.statusCode = 403;
            callback(err);
        },
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
    })
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Mount Chrome Extension threat shield BEFORE global apiLimiter so DOM scans never throttle user dashboard
app.use('/api/security', securityRouter);

app.use('/api', apiLimiter);

app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        if (req.originalUrl !== '/api/health') {
            logger.info(`${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`);
        }
    });
    next();
});

const swaggerOptions = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'PolicyAI API',
            version: '1.1.0',
            description: 'Enterprise Insurance AI Platform API Documentation (Supabase-backed)',
            contact: { name: 'PolicyAI Team' },
        },
        servers: [
            { url: '/', description: 'Current Server' },
            { url: `http://localhost:${process.env.PORT || 5000}`, description: 'Local Development Server' },
        ],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                },
            },
        },
    },
    apis: [path.join(__dirname, 'routes/*.js')],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use(
    '/api-docs',
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec, {
        customCss: `
            .swagger-ui .topbar { background-color: #1a1a2e; }
            .swagger-ui .topbar .download-url-wrapper .select-label { color: #e0e0e0; }
        `,
        customSiteTitle: 'PolicyAI API Docs',
    })
);

app.use('/api/auth', authRoutes);
app.use('/api/policy', policyRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/claims', claimsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/market', marketRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api', incidentsRoutes);
app.use('/api', platformRouter);

app.get('/api/health', async (req, res) => {
    const db = await checkSupabaseHealth();
    const isHealthy = db.status === 'connected';
    res.status(isHealthy ? 200 : 503).json({
        status: isHealthy ? 'ok' : 'degraded',
        timestamp: new Date().toISOString(),
        uptime: Math.floor(process.uptime()),
        environment: process.env.NODE_ENV,
        database: db.status,
        databaseProvider: 'supabase',
        latencyMs: db.latencyMs,
        ai: getActiveAiMetadata(),
        version: '1.1.0',
    });
});

if (isProd && fs.existsSync(FRONTEND_DIST)) {
    app.use(express.static(FRONTEND_DIST));
    app.get('*', (req, res) => {
        if (req.originalUrl.startsWith('/api')) {
            return res.status(404).json({ error: `Route ${req.originalUrl} not found` });
        }
        res.sendFile(path.join(FRONTEND_DIST, 'index.html'));
    });
    logger.info(`✅ Serving frontend from: ${FRONTEND_DIST}`);
} else {
    app.use((req, res) => {
        res.status(404).json({ error: `Route ${req.originalUrl} not found` });
    });
}

app.use(errorHandler);

module.exports = app;
