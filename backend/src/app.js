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
const { getDbStatus } = require('./config/db');

const isProd = process.env.NODE_ENV === 'production';
// In production, frontend is built into ../frontend/dist (relative to backend root)
const FRONTEND_DIST = path.join(__dirname, '..', 'frontend', 'dist');

// Route imports
const authRoutes = require('./routes/auth.routes');
const policyRoutes = require('./routes/policy.routes');
const chatRoutes = require('./routes/chat.routes');
const claimsRoutes = require('./routes/claims.routes');
const adminRoutes = require('./routes/admin.routes');
const marketRoutes = require('./routes/market.routes');
const documentRoutes = require('./routes/document.routes');

const app = express();

// ============================================
// SECURITY MIDDLEWARE
// ============================================
app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// Build allowed origins list from env
const allowedOrigins = [
    process.env.CORS_ORIGIN || 'http://localhost:5173',
    process.env.FRONTEND_URL,
    'http://localhost:5173',
    'http://localhost:5174', // Allow alternate dev port
    'http://localhost:3000',
].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i); // deduplicate

app.use(cors({
    origin: (origin, callback) => {
        // Allow no-origin (mobile apps, Postman, server-to-server)
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) return callback(null, true);
        logger.warn(`CORS blocked origin: ${origin}`);
        callback(new Error(`CORS: Origin '${origin}' not allowed`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ============================================
// BODY PARSING
// ============================================
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ============================================
// STATIC FILES
// ============================================
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// ============================================
// GLOBAL RATE LIMITING
// ============================================
app.use('/api', apiLimiter);

// ============================================
// REQUEST LOGGING
// ============================================
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

// ============================================
// SWAGGER API DOCUMENTATION
// ============================================
const swaggerOptions = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'PolicyAI API',
            version: '1.0.0',
            description: 'Enterprise Insurance AI Platform API Documentation',
            contact: { name: 'PolicyAI Team' },
        },
        servers: [
            { url: 'http://localhost:5000', description: 'Development server' },
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
    apis: ['./src/routes/*.js'],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customCss: `
    .swagger-ui .topbar { background-color: #1a1a2e; }
    .swagger-ui .topbar .download-url-wrapper .select-label { color: #e0e0e0; }
  `,
    customSiteTitle: 'PolicyAI API Docs',
}));

// ============================================
// API ROUTES
// ============================================
app.use('/api/auth', authRoutes);
app.use('/api/policy', policyRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/claims', claimsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/market', marketRoutes);
app.use('/api/documents', documentRoutes);

// ============================================
// HEALTH CHECK
// ============================================
app.get('/api/health', (req, res) => {
    const dbStatus = getDbStatus();
    const isHealthy = dbStatus === 'connected';
    res.status(isHealthy ? 200 : 503).json({
        status: isHealthy ? 'ok' : 'degraded',
        timestamp: new Date().toISOString(),
        uptime: Math.floor(process.uptime()),
        environment: process.env.NODE_ENV,
        database: dbStatus,
        version: '1.0.0',
    });
});

// ============================================
// SERVE FRONTEND IN PRODUCTION
// ============================================
if (isProd && fs.existsSync(FRONTEND_DIST)) {
    // Serve static assets (JS, CSS, images)
    app.use(express.static(FRONTEND_DIST));
    // SPA fallback — React Router handles all non-API routes
    app.get('*', (req, res) => {
        if (req.originalUrl.startsWith('/api')) {
            return res.status(404).json({ error: `Route ${req.originalUrl} not found` });
        }
        res.sendFile(path.join(FRONTEND_DIST, 'index.html'));
    });
    logger.info(`✅ Serving frontend from: ${FRONTEND_DIST}`);
} else {
    // Development 404 — API only
    app.use((req, res) => {
        res.status(404).json({ error: `Route ${req.originalUrl} not found` });
    });
}

// ============================================
// GLOBAL ERROR HANDLER
// ============================================
app.use(errorHandler);

module.exports = app;
