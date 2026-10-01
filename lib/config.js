// Central config. Everything comes from env vars (see .env.example).
// Values containing "PLACEHOLDER" are intentionally fake and must be replaced before going live.
const num = (v, d) => (v === undefined || v === '' || isNaN(Number(v)) ? d : Number(v));
const bool = (v, d) => (v === undefined || v === '' ? d : ['1', 'true', 'yes', 'on'].includes(String(v).toLowerCase()));

const config = {
  port: num(process.env.PORT, 3000),
  brandName: process.env.BRAND_NAME || 'RishtaRoast',
  isProd: process.env.NODE_ENV === 'production',
  // Comma-separated list of static-site origins allowed to call the API from a browser (CORS).
  allowedOrigins: (process.env.ALLOWED_ORIGINS || 'http://localhost:8080,http://127.0.0.1:8080')
    .split(',')
    .map((o) => o.trim().replace(/\/$/, ''))
    .filter(Boolean),

  ai: {
    apiKey: process.env.AI_API_KEY || '',
    baseUrl: (process.env.AI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, ''),
    model: process.env.AI_MODEL || 'gpt-4o-mini',
    maxTokens: num(process.env.AI_MAX_TOKENS, 350),
    temperature: num(process.env.AI_TEMPERATURE, 0.95),
    timeoutMs: num(process.env.AI_TIMEOUT_MS, 9000),
    jsonMode: bool(process.env.AI_JSON_MODE, true),
    enabled: bool(process.env.AI_ENABLED, true),
  },

  limits: {
    aiPerIpHour: num(process.env.AI_PER_IP_HOUR, 5),
    aiPerIpDay: num(process.env.AI_PER_IP_DAY, 20),
    aiProPerIpDay: num(process.env.AI_PRO_PER_IP_DAY, 60),
    aiGlobalDaily: num(process.env.AI_GLOBAL_DAILY_CAP, 500),
    // hard cap on ALL generations (incl. free template ones) to stop bots hammering the server
    requestsPerIpHour: num(process.env.REQUESTS_PER_IP_HOUR, 60),
    cacheTtlMs: num(process.env.CACHE_TTL_HOURS, 24) * 3600 * 1000,
    cacheMaxEntries: num(process.env.CACHE_MAX_ENTRIES, 5000),
  },

  tip: {
    upiId: process.env.UPI_ID || 'PLACEHOLDER@upi',
    upiPayeeName: process.env.UPI_PAYEE_NAME || 'RishtaRoast',
    upiDefaultAmount: num(process.env.UPI_DEFAULT_AMOUNT, 29),
    razorpayTipLink: process.env.RAZORPAY_TIP_LINK || 'https://rzp.io/l/PLACEHOLDER',
  },

  pro: {
    enabled: bool(process.env.PRO_ENABLED, true),
    priceInr: num(process.env.PRO_PRICE_INR, 29),
    validityDays: num(process.env.PRO_VALIDITY_DAYS, 30),
    razorpayKeyId: process.env.RAZORPAY_KEY_ID || '',
    razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET || '',
    tokenSecret: process.env.PRO_TOKEN_SECRET || 'dev-only-insecure-secret-change-me',
    // Local testing only: lets you "unlock" Pro without paying. NEVER enable in production.
    demoUnlock: bool(process.env.PRO_DEMO_UNLOCK, false),
  },
};

config.isPlaceholder = (v) => /PLACEHOLDER/i.test(String(v || ''));
config.razorpayConfigured = () => !!(config.pro.razorpayKeyId && config.pro.razorpayKeySecret);

if (config.isProd && config.pro.demoUnlock) {
  console.warn('[config] PRO_DEMO_UNLOCK is ignored in production');
  config.pro.demoUnlock = false;
}

module.exports = config;
