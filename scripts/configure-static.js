#!/usr/bin/env node
// Static-site build step (Render Static Site buildCommand). Zero risk to run locally too.
// Reads env vars and writes them into the static files, because a static site has no server to read env at runtime:
//   - public/config.js  (the @generated block: API_BASE_URL, SITE_URL, UPI_ID, UPI_PAYEE_NAME, RAZORPAY_TIP_LINK, PRO_*)
//   - public/index.html + privacy.html canonical/OG domain (SITE_URL)
//   - public/robots.txt, public/sitemap.xml (SITE_URL)
//   - public/upi-qr.svg (UPI QR for desktop tip flow; needs the `qrcode` package -> run `npm ci --omit=dev` first)
// Env vars that are not set leave the current values untouched.
const fs = require('fs');
const path = require('path');

const PUB = path.join(__dirname, '..', 'public');
const DEFAULT_SITE = 'https://rishtaroast.onrender.com';
const env = (k) => (process.env[k] !== undefined && process.env[k] !== '' ? process.env[k].trim() : undefined);
const read = (f) => fs.readFileSync(path.join(PUB, f), 'utf8');
const write = (f, s) => fs.writeFileSync(path.join(PUB, f), s);
const strip = (u) => u.replace(/\/$/, '');

// ---- config.js ----
let cfg = read('config.js');
const current = (key) => {
  const m = cfg.match(new RegExp(`\\n\\s*${key}: ([^\\n]*?),(?: //.*)?\\n`));
  return m ? m[1] : undefined;
};
const setKey = (key, val, isString = true) => {
  const lit = isString ? JSON.stringify(val) : String(val); // JSON string literal = valid, safely-escaped JS
  cfg = cfg.replace(new RegExp(`(\\n\\s*${key}: )[^\\n]*\\n`), `$1${lit},\n`);
  console.log(`config.js: ${key} = ${lit}`);
};
const map = { API_BASE_URL: 's', SITE_URL: 's', UPI_ID: 's', UPI_PAYEE_NAME: 's', RAZORPAY_TIP_LINK: 's', PRO_ENABLED: 'b', PRO_PRICE_INR: 'n', PRO_VALIDITY_DAYS: 'n' };
for (const [k, type] of Object.entries(map)) {
  const v = env(k);
  if (v === undefined) continue;
  if (type === 's') setKey(k, k.endsWith('_URL') ? strip(v) : v);
  if (type === 'b') setKey(k, ['1', 'true', 'yes', 'on'].includes(v.toLowerCase()), false);
  if (type === 'n') setKey(k, Number(v) || 0, false);
}
write('config.js', cfg);

const val = (k) => {
  const raw = current(k) || '';
  try { return raw.startsWith('"') ? JSON.parse(raw) : raw.replace(/^'|'$/g, ''); } catch (_) { return raw; }
};
const siteUrl = strip(env('SITE_URL') || val('SITE_URL') || DEFAULT_SITE);
for (const k of ['API_BASE_URL', 'SITE_URL', 'UPI_ID', 'RAZORPAY_TIP_LINK']) {
  if (/PLACEHOLDER/i.test(cfg.match(new RegExp(`${k}: [^\\n]*`))[0]) || (k === 'API_BASE_URL' && !env(k))) console.warn(`[warn] ${k} still uses the default/placeholder value`);
}

// ---- HTML canonical / OG domain ----
for (const f of ['index.html', 'privacy.html']) {
  let html = read(f);
  const before = html;
  html = html.replace(/https:\/\/[a-z0-9.-]+(?=\/(?:og\.png)?["'])/gi, (m) => (m === 'https://fonts.googleapis.com' ? m : siteUrl)); // canonical, og:url, og:image
  if (html !== before) console.log(`${f}: domain -> ${siteUrl}`);
  write(f, html);
}

// ---- robots + sitemap ----
write('robots.txt', `User-agent: *\nAllow: /\nSitemap: ${siteUrl}/sitemap.xml\n`);
write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${siteUrl}/</loc><changefreq>weekly</changefreq></url>\n  <url><loc>${siteUrl}/privacy.html</loc></url>\n</urlset>\n`);
console.log('robots.txt + sitemap.xml written');

// ---- UPI QR ----
(async () => {
  let QRCode;
  try { QRCode = require('qrcode'); } catch (_) {
    console.warn('[warn] `qrcode` not installed - keeping existing public/upi-qr.svg');
    return;
  }
  const enc = (v) => encodeURIComponent(v).replace(/%40/g, '@');
  const upi = `upi://pay?pa=${enc(val('UPI_ID'))}&pn=${enc(val('UPI_PAYEE_NAME'))}&cu=INR&tn=${enc('Chai for RishtaRoast')}`;
  write('upi-qr.svg', await QRCode.toString(upi, { type: 'svg', margin: 1, width: 240 }));
  console.log(`upi-qr.svg written for ${upi}`);
})();
