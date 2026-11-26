const { z } = require('zod');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../../.env') });

const envSchema = z.object({
    PORT: z.string().default('5000'),
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

    // Supabase Configuration
    SUPABASE_URL: z.string().url('SUPABASE_URL must be a valid URL'),
    SUPABASE_ANON_KEY: z.string().min(10, 'SUPABASE_ANON_KEY is required'),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(10, 'SUPABASE_SERVICE_ROLE_KEY is required'),
    SUPABASE_STORAGE_BUCKET: z.string().default('policy-files'),

    // Optional Legacy / Cache
    REDIS_URL: z.string().optional().default(''),

    // AI Provider Configuration (ready for replacement API in next phase)
    AI_PROVIDER: z.enum(['auto', 'gemini', 'openai', 'openrouter', 'groq', 'grok', 'puter']).default('auto'),
    AI_MODEL: z.string().optional().default(''),
    AI_BASE_URL: z.string().optional().default(''),
    GEMINI_API_KEY: z.string().optional().default(''),
    OPENAI_API_KEY: z.string().optional().default(''),
    OPENROUTER_API_KEY: z.string().optional().default(''),
    GROQ_API_KEY: z.string().optional().default(''),
    GROK_API_KEY: z.string().optional().default(''),
    GROK_API_BASE_URL: z.string().optional().default('https://api.x.ai/v1'),
    PUTER_AUTH_TOKEN: z.string().optional().default(''),

    // Live Search, Threat Intel & Optional Local ML Sidecar
    TAVILY_API_KEY: z.string().optional().default(''),
    SERPER_API_KEY: z.string().optional().default(''),
    VIRUSTOTAL_API_KEY: z.string().optional().default(''),
    ML_SERVICE_URL: z.string().optional().default('http://127.0.0.1:8000'),

    // SMTP / Email Notifications
    SMTP_HOST: z.string().optional().default('smtp.gmail.com'),
    SMTP_PORT: z.string().optional().default('587'),
    SMTP_USER: z.string().optional().default(''),
    SMTP_PASS: z.string().optional().default(''),
    SMTP_FROM: z.string().optional().default(''),
    SMTP_SENDER_NAME: z.string().optional().default('Team_WIE_Quantum_Coders'),

    // SMS (Twilio)
    TWILIO_ACCOUNT_SID: z.string().optional().default(''),
    TWILIO_AUTH_TOKEN: z.string().optional().default(''),
    TWILIO_PHONE_NUMBER: z.string().optional().default(''),

    // Uploads & Limits
    MAX_FILE_SIZE: z.string().optional().default('10485760'),
    UPLOAD_DIR: z.string().optional().default('uploads'),
    RATE_LIMIT_WINDOW_MS: z.string().optional().default('900000'),
    RATE_LIMIT_MAX_REQUESTS: z.string().optional().default('100'),

    // CORS & URLs
    CORS_ORIGIN: z.string().optional().default('http://localhost:5173'),
    FRONTEND_URL: z.string().optional().default(''),

    // Logging
    LOG_LEVEL: z.string().optional().default('debug'),
    LOG_DIR: z.string().optional().default('logs'),
});

let env;
try {
    env = envSchema.parse(process.env);
} catch (error) {
    console.error('❌ Environment validation failed:');
    console.error(error.errors.map((e) => `  ${e.path.join('.')}: ${e.message}`).join('\n'));
    process.exit(1);
}

module.exports = env;
