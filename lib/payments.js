// Payments: tip links (UPI + Razorpay payment link) and the planned "Pro" unlock.
// Everything is a STUB until real keys are set. No keys are bundled.
const crypto = require('crypto');
const config = require('./config');

function upiLink({ amount } = {}) {
  // Built by hand: many UPI apps dislike "+" for spaces and an encoded "@" in the VPA.
  const enc = (v) => encodeURIComponent(v).replace(/%40/g, '@');
  const parts = [`pa=${enc(config.tip.upiId)}`, `pn=${enc(config.tip.upiPayeeName)}`, 'cu=INR', `tn=${enc(`Chai for ${config.brandName}`)}`];
  if (amount) parts.push(`am=${enc(String(amount))}`);
  return `upi://pay?${parts.join('&')}`;
}

function publicConfig() {
  return {
    brandName: config.brandName,
    // tip values here are informational only; the static site reads its own public/config.js
    tip: {
      upiLink: upiLink(),
      upiId: config.tip.upiId,
      upiIsPlaceholder: config.isPlaceholder(config.tip.upiId),
      razorpayLink: config.tip.razorpayTipLink,
      razorpayIsPlaceholder: config.isPlaceholder(config.tip.razorpayTipLink),
      defaultAmount: config.tip.upiDefaultAmount,
    },
    pro: {
      enabled: config.pro.enabled,
      priceInr: config.pro.priceInr,
      validityDays: config.pro.validityDays,
      checkoutLive: config.razorpayConfigured(),
      razorpayKeyId: config.razorpayConfigured() ? config.pro.razorpayKeyId : null, // key_id is public by design
      demoUnlock: config.pro.demoUnlock,
    },
    ai: { configured: !!(config.ai.enabled && config.ai.apiKey) },
  };
}

// ---- Pro token: HMAC-signed, stateless (no DB needed) ----
const b64 = (s) => Buffer.from(s).toString('base64url');
function sign(payload) {
  return crypto.createHmac('sha256', config.pro.tokenSecret).update(payload).digest('base64url');
}
function issueProToken(extra = {}) {
  const payload = b64(JSON.stringify({ pro: true, exp: Date.now() + config.pro.validityDays * 86400000, ...extra }));
  return `${payload}.${sign(payload)}`;
}
function verifyProToken(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [payload, sig] = token.split('.');
  const expected = sign(payload);
  if (!sig || sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return data.exp > Date.now() ? data : null;
  } catch (_) {
    return null;
  }
}

// ---- Razorpay (only used when RAZORPAY_KEY_ID/SECRET are set; untested without real keys) ----
async function createOrder() {
  if (!config.razorpayConfigured()) return { stub: true, message: 'Razorpay keys not configured (stub mode).' };
  const auth = Buffer.from(`${config.pro.razorpayKeyId}:${config.pro.razorpayKeySecret}`).toString('base64');
  const res = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Basic ${auth}` },
    body: JSON.stringify({ amount: config.pro.priceInr * 100, currency: 'INR', receipt: `pro_${Date.now()}`, notes: { product: 'pro' } }),
  });
  if (!res.ok) throw new Error(`razorpay_order_${res.status}`);
  const order = await res.json();
  return { stub: false, orderId: order.id, amount: order.amount, currency: order.currency, keyId: config.pro.razorpayKeyId };
}

function verifyPayment({ razorpay_order_id, razorpay_payment_id, razorpay_signature }) {
  if (!config.razorpayConfigured()) return false;
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) return false;
  const expected = crypto.createHmac('sha256', config.pro.razorpayKeySecret).update(`${razorpay_order_id}|${razorpay_payment_id}`).digest('hex');
  return expected.length === razorpay_signature.length && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(razorpay_signature));
}

module.exports = { upiLink, publicConfig, issueProToken, verifyProToken, createOrder, verifyPayment };
