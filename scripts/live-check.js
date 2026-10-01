// Headless check against the LIVE deployment (read-only: generates cards in the browser, no posting).
// Usage: SITE=https://rishtaroast.onrender.com API=https://rishtaroast-api.onrender.com node scripts/live-check.js
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const SITE = process.env.SITE || 'https://rishtaroast.onrender.com';
const API = process.env.API || 'https://rishtaroast-api.onrender.com';
const ROOT = path.join(__dirname, '..');
fs.mkdirSync(path.join(ROOT, 'screenshots'), { recursive: true });
fs.mkdirSync(path.join(ROOT, 'samples'), { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fails = 0;
const ok = (n, c, x = '') => { if (!c) fails++; console.log(`${c ? 'PASS' : 'FAIL'} ${n} ${x}`); };

async function generate(page, name) {
  await page.$eval('#name', (e) => (e.value = ''));
  await page.type('#name', name);
  await page.type('input[name=city]', 'Jaipur');
  await page.select('#work', 'startup');
  await page.$eval('input[value=foodie]', (e) => e.click());
  await page.type('input[name=habit]', 'late uthna');
  const t0 = Date.now();
  await page.$eval('#genBtn', (e) => e.click());
  await page.waitForFunction(() => !document.getElementById('result').hidden && !document.getElementById('genBtn').disabled, { timeout: 20000 });
  await sleep(600);
  return { ms: Date.now() - t0, source: await page.$eval('#meta', (e) => e.dataset.source), text: await page.$eval('#meta', (e) => e.textContent) };
}

(async () => {
  const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] });
  const errors = [];
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  const apiHits = [];
  page.on('response', (r) => { if (r.url().startsWith(API)) apiHits.push(`${new URL(r.url()).pathname} ${r.status()}`); });

  const t0 = Date.now();
  await page.goto(SITE + '/', { waitUntil: 'networkidle0', timeout: 90000 });
  ok('live: page loaded', (await page.title()).includes('RishtaRoast'), `${Date.now() - t0}ms`);
  ok('live: config points at API', (await page.evaluate(() => window.RR_CONFIG.API_BASE_URL)) === API);
  await sleep(800);
  ok('live: warm-up /healthz answered', apiHits.some((h) => h.startsWith('/healthz 200')), JSON.stringify(apiHits));
  await page.screenshot({ path: path.join(ROOT, 'screenshots', 'live-home.png') });

  const g = await generate(page, 'Vipul');
  ok('live: card generated', !!g.source, `${g.source} - ${g.text} (${g.ms}ms)`);
  ok('live: card came through the API (CORS ok)', g.source === 'api' && apiHits.some((h) => h.startsWith('/api/generate 200')));
  const data = await page.$eval('#canvas', (c) => c.toDataURL('image/png'));
  fs.writeFileSync(path.join(ROOT, 'samples', 'live-card.png'), Buffer.from(data.split(',')[1], 'base64'));
  const b = fs.readFileSync(path.join(ROOT, 'samples', 'live-card.png'));
  ok('live: card PNG is 1080x1920', b.readUInt32BE(16) === 1080 && b.readUInt32BE(20) === 1920);
  await page.$eval('#result', (e) => e.scrollIntoView());
  await page.screenshot({ path: path.join(ROOT, 'screenshots', 'live-result.png') });

  // Simulate the API being asleep/unreachable: block requests to the API host -> client templates
  const p2 = await browser.newPage();
  await p2.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await p2.setRequestInterception(true);
  p2.on('request', (r) => (r.url().startsWith(API) ? r.abort('connectionrefused') : r.continue()));
  await p2.goto(SITE + '/', { waitUntil: 'load', timeout: 90000 });
  await p2.waitForFunction(() => window.RRTemplates && window.RR_CONFIG);
  const g2 = await generate(p2, 'Priya');
  ok('live: API blocked -> client-side fallback card', g2.source === 'local:api_unreachable' && g2.ms < 3000, `${g2.source} (${g2.ms}ms)`);

  ok('live: no JS errors', errors.length === 0, errors.join(' | '));
  await browser.close();
  console.log(fails ? `${fails} check(s) failed` : 'all live checks passed');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
