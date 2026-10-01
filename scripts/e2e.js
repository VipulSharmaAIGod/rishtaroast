// End-to-end test (headless Chrome via puppeteer-core + system Chrome), mirroring the Render setup:
//   static site (public/) on :8080  +  API (server.js) on :3000
// Scenarios:
//   A) API running   -> cards come from the API, warm-up ping fires, share/tip/Pro(demo) flows
//   B) API stopped   -> cards still generate instantly from client-side templates (silent fallback)
//   C) API hanging   -> request aborted after ~4s, client-side templates used
// The script starts/stops the servers itself. Usage: `npm run e2e`
const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const puppeteer = require('puppeteer-core');

const ROOT = path.join(__dirname, '..');
const STATIC = 'http://localhost:8080';
const API_PORT = 3000;
const CHROME = process.env.CHROME_PATH || '/usr/bin/google-chrome';
const SHOTS = path.join(ROOT, 'screenshots');
const SAMPLES = path.join(ROOT, 'samples');
const DL = path.join(SAMPLES, 'downloads');
fs.mkdirSync(SHOTS, { recursive: true });
fs.mkdirSync(DL, { recursive: true });

const results = [];
const ok = (name, cond, extra = '') => { results.push({ name, pass: !!cond }); console.log(`${cond ? 'PASS' : 'FAIL'} ${name} ${extra}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function up(url) { try { const r = await fetch(url); return r.status < 500; } catch (_) { return false; } }
async function waitUp(url, ms = 8000) { const t = Date.now(); while (Date.now() - t < ms) { if (await up(url)) return true; await sleep(150); } return false; }
async function waitDown(url, ms = 8000) { const t = Date.now(); while (Date.now() - t < ms) { if (!(await up(url))) return true; await sleep(150); } return false; }

function spawnNode(args, env = {}) {
  const p = spawn(process.execPath, args, { cwd: ROOT, env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
  p.stdout.on('data', () => {}); p.stderr.on('data', (d) => process.env.E2E_DEBUG && process.stderr.write(d));
  return p;
}

function pngSize(file) { const b = fs.readFileSync(file); return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) }; }
async function saveCanvas(page, sel, file) {
  const data = await page.$eval(sel, (c) => c.toDataURL('image/png'));
  fs.writeFileSync(file, Buffer.from(data.split(',')[1], 'base64'));
  return pngSize(file);
}
async function tap(page, sel) {
  await page.$eval(sel, (e) => e.scrollIntoView({ block: 'center' }));
  await sleep(120);
  await page.$eval(sel, (e) => e.click()); // DOM click: synthetic mouse clicks are flaky under touch emulation
}
async function waitForDownload(before, timeout = 8000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    const now = fs.readdirSync(DL).filter((f) => f.endsWith('.png') && !before.includes(f));
    if (now.length) return path.join(DL, now[0]);
    await sleep(200);
  }
  return null;
}

async function newMobilePage(browser, errors, { allow400 = false } = {}) {
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const t = m.text();
    // Expected network noise in fallback scenarios / blocked-input test
    if (/status of 400/.test(t) && allow400) return;
    if (/ERR_CONNECTION_REFUSED|Failed to fetch|net::ERR_|signal is aborted|AbortError/.test(t)) return;
    errors.push(t);
  });
  const cdp = await page.createCDPSession();
  await cdp.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: DL });
  return page;
}

async function fillAndGenerate(page, { name = 'Vipul', city = 'Jaipur', work = 'startup', vibe = 'foodie', habit = 'late uthna' } = {}) {
  await page.$eval('#name', (e) => (e.value = ''));
  await page.type('#name', name);
  await page.$eval('input[name=city]', (e) => (e.value = ''));
  await page.type('input[name=city]', city);
  await page.select('#work', work);
  await page.$eval(`input[value=${vibe}]`, (e) => e.click());
  await page.$eval('input[name=habit]', (e) => (e.value = ''));
  await page.type('input[name=habit]', habit);
  const t0 = Date.now();
  await tap(page, '#genBtn');
  await page.waitForFunction(() => !document.getElementById('result').hidden && document.getElementById('genBtn').disabled === false, { timeout: 15000 });
  const ms = Date.now() - t0;
  await sleep(500);
  const meta = await page.$eval('#meta', (e) => ({ text: e.textContent, source: e.dataset.source }));
  return { ms, meta };
}

(async () => {
  for (const f of fs.readdirSync(DL)) fs.unlinkSync(path.join(DL, f));
  const procs = [];
  const cleanup = () => procs.forEach((p) => { try { p.kill(); } catch (_) {} });
  process.on('exit', cleanup);

  if (await up(`http://localhost:${API_PORT}/healthz`)) { console.error(`Port ${API_PORT} busy - stop the running API first.`); process.exit(2); }
  if (!(await up(STATIC + '/'))) { procs.push(spawnNode(['scripts/static-server.js', '8080'])); await waitUp(STATIC + '/'); }
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--lang=en-IN'] });

  // =================== A) API RUNNING ===================
  console.log('\n--- Scenario A: API running ---');
  const api = spawnNode(['server.js'], { PORT: String(API_PORT), PRO_DEMO_UNLOCK: 'true', ALLOWED_ORIGINS: STATIC, AI_API_KEY: '' });
  procs.push(api);
  ok('A: API started', await waitUp(`http://localhost:${API_PORT}/healthz`));
  let errors = [];
  let page = await newMobilePage(browser, errors, { allow400: true });
  const apiRequests = [];
  page.on('request', (r) => { if (r.url().startsWith(`http://localhost:${API_PORT}`)) apiRequests.push(new URL(r.url()).pathname); });
  await page.goto(STATIC + '/', { waitUntil: 'networkidle0' });
  await page.evaluate(() => localStorage.clear());
  apiRequests.length = 0;
  await page.reload({ waitUntil: 'networkidle0' });
  await sleep(500);
  ok('A: warm-up ping to /healthz fired on page load', apiRequests.includes('/healthz'), JSON.stringify(apiRequests));
  ok('A: home title has brand', (await page.title()).includes('RishtaRoast'));
  ok('A: og:image meta', await page.$eval('meta[property="og:image"]', (m) => !!m.content));
  await page.screenshot({ path: path.join(SHOTS, '01-home-mobile.png') });
  await page.screenshot({ path: path.join(SHOTS, '02-home-mobile-full.png'), fullPage: true });

  await page.type('#name', 'Rohan');
  await page.type('input[name=habit]', 'mota hai');
  await tap(page, '#genBtn');
  await page.waitForFunction(() => !document.getElementById('err').hidden, { timeout: 5000 });
  ok('A: abusive input blocked', (await page.$eval('#err', (e) => e.textContent)).includes('family-friendly'));

  let g = await fillAndGenerate(page);
  ok('A: card generated via API', g.meta.source === 'api', `${g.meta.text} (${g.ms}ms)`);
  ok('A: generate request went to API', apiRequests.includes('/api/generate'));
  const story = await saveCanvas(page, '#canvas', path.join(SAMPLES, 'sample-card-story-1080x1920.png'));
  ok('A: story card 1080x1920', story.w === 1080 && story.h === 1920);
  for (const id of ['shareBtn', 'tipBtn', 'dlBtn', 'waBtn', 'igBtn', 'xBtn']) {
    ok(`A: #${id} rendered`, await page.$eval('#' + id, (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; }));
  }
  const [sr, tr] = await Promise.all(['#shareBtn', '#tipBtn'].map((s) => page.$eval(s, (e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y }; })));
  ok('A: tip button next to share', Math.abs(sr.y - tr.y) < 2 && tr.x > sr.x);
  ok('A: WhatsApp link', (await page.$eval('#waBtn', (e) => e.href)).startsWith('https://wa.me/?text='));
  await page.$eval('#result', (e) => e.scrollIntoView());
  await page.screenshot({ path: path.join(SHOTS, '03-result-mobile.png') });
  await page.screenshot({ path: path.join(SHOTS, '04-result-mobile-full.png'), fullPage: true });

  let before = fs.readdirSync(DL);
  await tap(page, '#dlBtn');
  let dl = await waitForDownload(before);
  ok('A: download PNG 1080x1920', dl && pngSize(dl).w === 1080 && pngSize(dl).h === 1920, dl ? path.basename(dl) : '');

  await page.evaluate(() => { window.__shared = null; navigator.canShare = () => true; navigator.share = async (p) => { window.__shared = { type: p.files[0].type, size: p.files[0].size, text: p.text }; }; });
  await tap(page, '#shareBtn');
  await page.waitForFunction(() => window.__shared, { timeout: 8000 }).catch(() => {});
  const shared = await page.evaluate(() => window.__shared);
  ok('A: Web Share API gets PNG + link', shared && shared.type === 'image/png' && shared.size > 10000 && /utm_source=native/.test(shared.text));

  await tap(page, '.tab[data-format=square]');
  await sleep(300);
  const sq = await saveCanvas(page, '#canvas', path.join(SAMPLES, 'sample-card-square-1080x1080.png'));
  ok('A: square card 1080x1080', sq.w === 1080 && sq.h === 1080);

  await tap(page, '#tipBtn');
  await page.waitForSelector('#tipModal[open]');
  const mobileTip = await page.evaluate(() => ({
    qrHidden: document.getElementById('upiQrWrap').hidden,
    razorpayHidden: document.getElementById('rzpTipBtn').hidden,
    amounts: [...document.querySelectorAll('.amount-btn')].map((e) => ({ amount: e.dataset.amount, href: e.getAttribute('href') })),
    customHref: document.getElementById('customUpiBtn').getAttribute('href'),
    copyVisible: !document.getElementById('copyUpiBtn').hidden,
  }));
  ok('A: mobile hides QR', mobileTip.qrHidden);
  ok('A: Razorpay placeholder button hidden', mobileTip.razorpayHidden);
  ok('A: mobile UPI preset deep links', mobileTip.amounts.every((x) => x.href.includes(`pa=PLACEHOLDER@upi`) && x.href.includes(`am=${x.amount}`) && x.href.includes('tn=RishtaRoast%20chai')));
  ok('A: mobile custom UPI link', mobileTip.customHref.includes('pa=PLACEHOLDER@upi'));
  ok('A: Copy UPI ID button visible', mobileTip.copyVisible);
  ok('A: placeholder warning shown', await page.$eval('#tipPlaceholder', (e) => !e.hidden));
  await page.screenshot({ path: path.join(SHOTS, '05-tip-modal.png') });
  await tap(page, '#tipModal .x-close');

  await tap(page, '#proBtn');
  await page.waitForSelector('#proModal[open]');
  ok('A: Pro stub modal (checkout not configured)', (await page.$eval('#proModalText', (e) => e.textContent)).includes('STUB'));
  await page.screenshot({ path: path.join(SHOTS, '06-pro-stub-modal.png') });
  if (await page.$eval('#demoUnlockBtn', (e) => !e.hidden)) {
    await tap(page, '#demoUnlockBtn');
    await page.waitForFunction(() => !document.getElementById('proBadge').hidden, { timeout: 5000 });
    ok('A: Pro demo unlock via API', true);
    await tap(page, '.tab[data-format=story]');
    const royal = await page.$$eval('.theme', (bs) => bs.findIndex((b) => b.textContent.includes('Royal')));
    await page.evaluate((i) => document.querySelectorAll('.theme')[i].click(), royal);
    await sleep(300);
    await saveCanvas(page, '#canvas', path.join(SAMPLES, 'sample-card-story-pro-royal.png'));
    before = fs.readdirSync(DL);
    await tap(page, '#dlBtn');
    dl = await waitForDownload(before);
    ok('A: Pro HD download 2160x3840', dl && pngSize(dl).w === 2160 && pngSize(dl).h === 3840);
    await page.$eval('#result', (e) => e.scrollIntoView());
    await page.screenshot({ path: path.join(SHOTS, '07-result-pro-demo.png') });
  } else ok('A: demo unlock button visible', false);
  ok('A: no JS errors', errors.length === 0, errors.join(' | '));
  await page.close();

  const desk = await browser.newPage();
  await desk.setViewport({ width: 1366, height: 900 });
  await desk.goto(STATIC + '/', { waitUntil: 'networkidle0' });
  await desk.evaluate(() => localStorage.clear());
  await desk.reload({ waitUntil: 'networkidle0' });
  await sleep(400);
  await desk.screenshot({ path: path.join(SHOTS, '08-home-desktop.png') });
  await desk.evaluate(() => { document.getElementById('result').hidden = false; document.getElementById('tipBtn').click(); });
  await desk.waitForSelector('#tipModal[open]');
  const desktopTip = await desk.evaluate(() => ({ qrHidden: document.getElementById('upiQrWrap').hidden, qrSrc: document.getElementById('upiQr').src, text: document.querySelector('#upiQrWrap .tiny').textContent }));
  ok('A: desktop keeps QR with amount', !desktopTip.qrHidden && desktopTip.qrSrc.includes('am%3D29'));
  ok('A: desktop QR instruction', desktopTip.text.includes('Phone se scan karo'));
  await desk.close();

  // =================== B) API STOPPED ===================
  console.log('\n--- Scenario B: API stopped ---');
  api.kill();
  ok('B: API is down', await waitDown(`http://localhost:${API_PORT}/healthz`));
  errors = [];
  page = await newMobilePage(browser, errors);
  const t0 = Date.now();
  await page.goto(STATIC + '/', { waitUntil: 'load' });
  await page.waitForFunction(() => window.RRTemplates && window.RRFilter && window.RR_CONFIG);
  ok('B: page loads without API', true, `${Date.now() - t0}ms`);
  await page.evaluate(() => localStorage.clear());
  await page.type('#name', 'Rohan');
  await page.type('input[name=habit]', 'caste puchna');
  await tap(page, '#genBtn');
  await page.waitForFunction(() => !document.getElementById('err').hidden, { timeout: 3000 });
  ok('B: content filter works client-side (offline)', (await page.$eval('#err', (e) => e.textContent)).includes('family-friendly'));
  g = await fillAndGenerate(page, { name: 'Priya', city: 'Lucknow', work: 'it', vibe: 'binge', habit: 'reply na karna' });
  ok('B: card generated from client templates', g.meta.source === 'local:api_unreachable', `${g.meta.source} (${g.ms}ms)`);
  ok('B: fallback is fast (<2.5s)', g.ms < 2500, `${g.ms}ms`);
  await saveCanvas(page, '#canvas', path.join(SAMPLES, 'sample-card-story-offline-fallback.png'));
  before = fs.readdirSync(DL);
  await tap(page, '#dlBtn');
  dl = await waitForDownload(before);
  ok('B: download works offline', !!dl);
  await page.$eval('#result', (e) => e.scrollIntoView());
  await page.screenshot({ path: path.join(SHOTS, '09-result-api-stopped.png') });
  await tap(page, '#proBtn');
  await page.waitForSelector('#proModal[open]');
  ok('B: Pro shows "server waking up" when API asleep', (await page.$eval('#proModalText', (e) => e.textContent)).includes('jaag'));
  ok('B: no JS errors', errors.length === 0, errors.join(' | '));
  await page.close();

  // =================== C) API HANGING (cold start simulation) ===================
  console.log('\n--- Scenario C: API hanging (simulated cold start) ---');
  const hangs = [];
  const blackhole = http.createServer((req, res) => {
    // answer CORS preflight so the browser actually sends the POST, then never respond to it
    if (req.method === 'OPTIONS') { res.writeHead(204, { 'Access-Control-Allow-Origin': STATIC, 'Access-Control-Allow-Headers': 'Content-Type, X-Pro-Token', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' }); return res.end(); }
    hangs.push(req.url);
  });
  await new Promise((r) => blackhole.listen(API_PORT, r));
  errors = [];
  page = await newMobilePage(browser, errors);
  await page.goto(STATIC + '/', { waitUntil: 'load' });
  await page.waitForFunction(() => window.RRTemplates && window.RR_CONFIG);
  g = await fillAndGenerate(page, { name: 'Aman', city: 'Patna', work: 'sarkari', vibe: 'cricket', habit: 'overthinking' });
  ok('C: request to hanging API was made', hangs.includes('/api/generate'), JSON.stringify(hangs));
  ok('C: aborted after ~4s and used client templates', g.meta.source === 'local:api_timeout' && g.ms >= 3800 && g.ms < 6500, `${g.meta.source} (${g.ms}ms)`);
  await page.$eval('#result', (e) => e.scrollIntoView());
  await page.screenshot({ path: path.join(SHOTS, '10-result-api-hanging.png') });
  ok('C: no JS errors', errors.length === 0, errors.join(' | '));
  await page.close();
  blackhole.closeAllConnections?.();
  blackhole.close();

  await browser.close();
  cleanup();
  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  process.exit(failed.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
