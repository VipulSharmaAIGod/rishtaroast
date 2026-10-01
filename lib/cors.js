// Strict CORS: only origins listed in ALLOWED_ORIGINS may call the API from a browser.
// Requests from other origins get no CORS headers and API POSTs are rejected with 403,
// so other websites can't burn our AI quota from their users' browsers.
// Requests with no Origin header (curl, health checks, server-to-server) are allowed but still rate limited.
const config = require('./config');

function isAllowed(origin) {
  return config.allowedOrigins.includes('*') || config.allowedOrigins.includes(origin);
}

function cors(req, res, next) {
  const origin = req.get('origin');
  res.setHeader('Vary', 'Origin');
  if (origin) {
    if (!isAllowed(origin)) {
      if (req.method === 'OPTIONS') return res.status(403).end();
      // allow harmless GETs (health) without CORS headers; block everything else
      if (req.method !== 'GET') return res.status(403).json({ error: 'origin_not_allowed' });
      return next();
    }
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Pro-Token');
    res.setHeader('Access-Control-Max-Age', '86400');
  }
  if (req.method === 'OPTIONS') return res.status(204).end();
  next();
}

module.exports = { cors, isAllowed };
