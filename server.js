// RishtaRoast API (Render free Web Service). API routes ONLY.
// The website itself is a separate Render Static Site (public/) that works even when this API sleeps.
require('dotenv').config();
const express = require('express');
const config = require('./lib/config');
const limits = require('./lib/rateLimit');
const { parseInput, generate } = require('./lib/generate');
const payments = require('./lib/payments');
const { cors } = require('./lib/cors');

const app = express();
// correct client IP behind Render's proxy (1 hop). Spoof-resistant vs. `true`.
app.set('trust proxy', Number(process.env.TRUST_PROXY ?? 1));
app.disable('x-powered-by');

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Cache-Control', 'no-store');
  next();
});
app.use(cors);
app.use(express.json({ limit: '10kb' }));

const clientIp = (req) => (req.ip || req.socket?.remoteAddress || 'unknown').replace(/^::ffff:/, '');

// Health / warm-up ping (also Render's healthCheckPath). Keep it cheap.
app.get('/healthz', (req, res) => res.json({ ok: true, uptimeSec: Math.round(process.uptime()) }));
app.get('/api/health', (req, res) => res.json({ ok: true, ...limits.stats() }));

// Runtime flags the static site can't know at build time (Pro checkout live? demo unlock?)
app.get('/api/config', (req, res) => res.json(payments.publicConfig()));

app.post('/api/generate', async (req, res) => {
  const ip = clientIp(req);
  const hit = limits.hitRequest(ip);
  if (!hit.ok) {
    res.setHeader('Retry-After', String(hit.retryAfterSec));
    return res.status(429).json({ error: 'Itni jaldi? Thoda saans le lo 😅 Ek ghante baad try karo.' });
  }
  const parsed = parseInput(req.body);
  if (parsed.error) return res.status(400).json({ error: parsed.error, blocked: !!parsed.blocked });

  const pro = !!payments.verifyProToken(req.get('x-pro-token'));
  try {
    const { card, meta } = await generate(parsed.input, { ip, pro });
    res.json({ input: { name: parsed.input.name, city: parsed.input.city }, card, meta: { source: meta.source, cached: meta.cached, fallbackReason: meta.reason, pro } });
  } catch (e) {
    console.error('[generate] unexpected', e);
    res.status(500).json({ error: 'Kuch gadbad ho gayi, dobara try karo 🙏' });
  }
});

// ---- Pro (stubbed until Razorpay keys exist) ----
app.post('/api/pro/order', async (req, res) => {
  if (!config.pro.enabled) return res.status(404).json({ error: 'pro_disabled' });
  try {
    res.json(await payments.createOrder());
  } catch (e) {
    console.error('[pro/order]', e.message);
    res.status(502).json({ error: 'Payment abhi start nahi ho paaya, thodi der baad try karo.' });
  }
});

app.post('/api/pro/verify', (req, res) => {
  if (!config.pro.enabled) return res.status(404).json({ error: 'pro_disabled' });
  const body = req.body || {};
  if (body.demo === true) {
    if (!config.pro.demoUnlock) return res.status(403).json({ error: 'Demo unlock disabled' });
    return res.json({ ok: true, demo: true, token: payments.issueProToken({ demo: true }) });
  }
  if (!payments.verifyPayment(body)) return res.status(400).json({ ok: false, error: 'Payment verify nahi hua' });
  res.json({ ok: true, token: payments.issueProToken({ pid: body.razorpay_payment_id }) });
});

app.get('/', (req, res) => res.json({ ok: true, service: `${config.brandName} API`, docs: 'see README.md' }));
app.use((req, res) => res.status(404).json({ error: 'not_found' }));

if (require.main === module) {
  // Render injects PORT; bind 0.0.0.0
  app.listen(config.port, '0.0.0.0', () => {
    console.log(`${config.brandName} API on :${config.port}`);
    console.log(`AI: ${config.ai.apiKey ? `enabled (${config.ai.model} @ ${config.ai.baseUrl})` : 'NO KEY -> template mode'} | Pro checkout: ${config.razorpayConfigured() ? 'live keys' : 'stub'} | CORS: ${config.allowedOrigins.join(', ')}`);
    if (config.isProd && config.pro.tokenSecret.startsWith('dev-only')) console.warn('[WARN] PRO_TOKEN_SECRET not set!');
  });
}

module.exports = app;
