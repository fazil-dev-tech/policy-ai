const { z } = require('zod');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../../.env') });

const envSchema = z.object({
  PORT: z.string().default('5000'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  MONGODB_URI: z.string().default('mongodb://localhost:27017/policyai'),
  JWT_SECRET: z.string().min(10, 'JWT_SECRET must be at least 10 characters'),
  JWT_REFRESH_SECRET: z.string().min(10, 'JWT_REFRESH_SECRET must be at least 10 characters'),
  JWT_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  GEMINI_API_KEY: z.string().optional().default(''),
  PUTER_AUTH_TOKEN: z.string().optional().default(''),
  SMTP_HOST: z.string().optional().default('smtp.gmail.com'),
  SMTP_PORT: z.string().optional().default('587'),
  SMTP_USER: z.string().optional().default(''),
  SMTP_PASS: z.string().optional().default(''),
  SMTP_FROM: z.string().optional().default('noreply@policyai.com'),
  TWILIO_ACCOUNT_SID: z.string().optional().default(''),
  TWILIO_AUTH_TOKEN: z.string().optional().default(''),
  TWILIO_PHONE_NUMBER: z.string().optional().default(''),
  MAX_FILE_SIZE: z.string().optional().default('10485760'),
  UPLOAD_DIR: z.string().optional().default('uploads'),
  RATE_LIMIT_WINDOW_MS: z.string().optional().default('900000'),
  RATE_LIMIT_MAX_REQUESTS: z.string().optional().default('100'),
  CORS_ORIGIN: z.string().optional().default('http://localhost:5173'),
  LOG_LEVEL: z.string().optional().default('debug'),
  LOG_DIR: z.string().optional().default('logs'),
});

let env;
try {
  env = envSchema.parse(process.env);
} catch (error) {
  console.error('❌ Environment validation failed:');
  console.error(error.errors.map(e => `  ${e.path.join('.')}: ${e.message}`).join('\n'));
  process.exit(1);
}

module.exports = env;
