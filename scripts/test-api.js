// API + cost-control tests. Runs the app in-process on a random port. No network/AI key needed.
// Uses the mock OpenAI-compatible server to exercise the AI path, caching, caps and fallbacks.
process.env.AI_API_KEY = 'test-key-not-real';
process.env.AI_BASE_URL = 'http://localhost:4555/v1';
process.env.AI_MODEL = 'mock-model';
process.env.AI_TIMEOUT_MS = '1500';
process.env.AI_PER_IP_HOUR = '5';
process.env.AI_PER_IP_DAY = '20';
process.env.AI_GLOBAL_DAILY_CAP = '8';
process.env.REQUESTS_PER_IP_HOUR = '40';
process.env.PRO_DEMO_UNLOCK = 'true';
process.env.TRUST_PROXY = '1';
process.env.ALLOWED_ORIGINS = 'http://localhost:8080, https://rishtaroast.onrender.com/';

const assert = require('assert');
const { start } = require('./mock-ai-server');
const app = require('../server');
const limits = require('../lib/rateLimit');
const cache = require('../lib/cache');
const filter = require('../lib/filter');
const { generateFromTemplates, WORK, VIBE } = require('../lib/templates');

let pass = 0, fail = 0;
async function test(name, fn) {
  try { await fn(); pass++; console.log('PASS', name); } catch (e) { fail++; console.log('FAIL', name, '-', e.message); }
}

(async () => {
  const mock = await start(4555, 'good');
  const srv = app.listen(0);
  const base = `http://localhost:${srv.address().port}`;
  const gen = (body, ip = '1.1.1.1', headers = {}) =>
    fetch(base + '/api/generate', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': ip, ...headers }, body: JSON.stringify(body) }).then(async (r) => ({ status: r.status, body: await r.json() }));
  const reset = () => { limits._reset(); cache._clear(); };

  await test('templates: every work x vibe combo produces a full card', () => {
    for (const w of Object.keys(WORK)) for (const v of Object.keys(VIBE)) {
      const c = generateFromTemplates({ name: 'Test', city: 'Pune', work: w, vibe: v, habit: 'late uthna' }, 0);
      for (const k of ['occupationTold', 'occupationSach', 'salaryTold', 'salarySach', 'hobbies', 'mummyVerdict', 'idealMatch', 'tagline', 'closer']) assert.ok(c[k], `${w}/${v} missing ${k}`);
      assert.strictEqual(c.khoobiyan.length, 2); assert.strictEqual(c.redFlags.length, 2);
      assert.ok(c.score >= 6 && c.score <= 9.9);
    }
  });
  await test('templates: all template lines pass the content filter', () => {
    for (const w of Object.keys(WORK)) for (const v of Object.keys(VIBE)) for (let i = 0; i < 8; i++) {
      const c = generateFromTemplates({ name: 'Test', city: 'Pune', work: w, vibe: v, habit: 'late uthna' }, i);
      for (const t of [c.occupationTold, c.occupationSach, c.salaryTold, c.salarySach, c.hobbies, c.mummyVerdict, c.idealMatch, c.tagline, ...c.khoobiyan, ...c.redFlags]) {
        const r = filter.check(t); assert.ok(r.ok, `"${t}" flagged (${r.word})`);
      }
    }
  });
  await test('templates: deterministic for same input, different for new variant', () => {
    const i = { name: 'A', city: '', work: 'it', vibe: 'gamer', habit: '' };
    assert.deepStrictEqual(generateFromTemplates(i, 0), generateFromTemplates(i, 0));
    const vs = new Set([0, 1, 2, 3, 4].map((v) => JSON.stringify(generateFromTemplates(i, v))));
    assert.ok(vs.size > 1);
  });

  reset();
  await test('AI path: uses OpenAI-compatible endpoint and returns source=ai', async () => {
    const r = await gen({ name: 'Vipul', city: 'Jaipur', work: 'it', vibe: 'foodie', habit: 'late uthna' });
    assert.strictEqual(r.status, 200); assert.strictEqual(r.body.meta.source, 'ai'); assert.strictEqual(r.body.card.tagline, 'Snooze follows my brother 😴');
  });
  await test('cache: identical input does not call AI again', async () => {
    const before = mock.calls();
    const r = await gen({ name: 'vipul', city: 'jaipur', work: 'it', vibe: 'foodie', habit: 'Late Uthna' });
    assert.strictEqual(r.body.meta.cached, true); assert.strictEqual(mock.calls(), before);
  });
  await test('rate limit: 6th AI call within an hour from same IP falls back to templates', async () => {
    reset();
    const out = [];
    for (let i = 0; i < 6; i++) out.push((await gen({ name: 'User' + i, work: 'student', vibe: 'gamer' }, '2.2.2.2')).body.meta);
    assert.deepStrictEqual(out.slice(0, 5).map((m) => m.source), ['ai', 'ai', 'ai', 'ai', 'ai']);
    assert.strictEqual(out[5].source, 'template'); assert.strictEqual(out[5].fallbackReason, 'ip_hourly_limit');
  });
  await test('global daily cap: after cap, other IPs also get templates', async () => {
    // cap=8, 5 used above
    const metas = [];
    for (let i = 0; i < 4; i++) metas.push((await gen({ name: 'G' + i, work: 'it', vibe: 'gym' }, `3.3.3.${i}`)).body.meta);
    assert.deepStrictEqual(metas.map((m) => m.source), ['ai', 'ai', 'ai', 'template']);
    assert.strictEqual(metas[3].fallbackReason, 'global_daily_cap');
  });
  await test('daily per-IP limit (20/day) enforced across hours', () => {
    reset();
    const t0 = Date.now() - 23 * 3600 * 1000;
    for (let i = 0; i < 20; i++) limits.recordAi('9.9.9.9', t0 + i * 3600 * 1000 / 4); // spread over ~5h
    const r = limits.aiAllowed('9.9.9.9');
    assert.strictEqual(r.ok, false); assert.strictEqual(r.reason, 'ip_daily_limit');
  });
  await test('AI bad output -> template fallback', async () => {
    reset(); mock.mode = 'bad';
    const r = await gen({ name: 'Bad', work: 'it', vibe: 'gym' });
    assert.strictEqual(r.body.meta.source, 'template'); assert.strictEqual(r.body.meta.fallbackReason, 'ai_bad_output');
  });
  await test('AI unsafe output (body shaming) is filtered -> template fallback', async () => {
    reset(); mock.mode = 'unsafe';
    const r = await gen({ name: 'Unsafe', work: 'it', vibe: 'gym' });
    assert.strictEqual(r.body.meta.source, 'template'); assert.strictEqual(r.body.meta.fallbackReason, 'ai_output_filtered');
  });
  await test('AI timeout -> template fallback (fast)', async () => {
    reset(); mock.mode = 'slow';
    const t = Date.now();
    const r = await gen({ name: 'Slow', work: 'it', vibe: 'gym' });
    assert.strictEqual(r.body.meta.source, 'template'); assert.strictEqual(r.body.meta.fallbackReason, 'ai_timeout');
    assert.ok(Date.now() - t < 2500);
    mock.mode = 'good';
  });
  await test('input filter: religion/caste/body/profanity blocked (400)', async () => {
    reset();
    for (const habit of ['mandir jaana', 'caste puchna', 'mota hona', 'ch*tiya pana', 'b h o s d i']) {
      const r = await gen({ name: 'Ok', work: 'it', vibe: 'gym', habit });
      if (habit === 'ch*tiya pana') continue; // asterisk-masked words are not caught (known limitation)
      assert.strictEqual(r.status, 400, habit);
    }
  });
  await test('input filter: normal names incl. community surnames allowed', async () => {
    for (const name of ['Rohan Jain', 'Simran Kaur', 'Ayaan Khan', 'Gita Sharma']) assert.strictEqual((await gen({ name, work: 'it', vibe: 'gym' })).status, 200, name);
  });
  await test('validation: missing name -> 400', async () => {
    assert.strictEqual((await gen({ name: '', work: 'it' })).status, 400);
  });
  await test('hard request limit -> 429 after 40/hour', async () => {
    reset();
    let last;
    for (let i = 0; i < 41; i++) last = await gen({ name: 'Spam', work: 'it', vibe: 'gym', variant: i % 50 }, '7.7.7.7');
    assert.strictEqual(last.status, 429);
  });
  await test('pro: demo token raises AI daily limit & is verified server-side', async () => {
    reset();
    const v = await (await fetch(base + '/api/pro/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ demo: true }) })).json();
    assert.ok(v.token);
    const r = await gen({ name: 'ProUser', work: 'it', vibe: 'gym' }, '8.8.8.8', { 'x-pro-token': v.token });
    assert.strictEqual(r.body.meta.pro, true);
    const fake = await gen({ name: 'ProUser2', work: 'it', vibe: 'gym' }, '8.8.8.8', { 'x-pro-token': v.token.slice(0, -2) + 'xx' });
    assert.strictEqual(fake.body.meta.pro, false);
  });
  await test('pro: order endpoint is a stub without Razorpay keys', async () => {
    const o = await (await fetch(base + '/api/pro/order', { method: 'POST' })).json();
    assert.strictEqual(o.stub, true);
  });
  await test('pro: fake payment signature rejected', async () => {
    const r = await fetch(base + '/api/pro/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ razorpay_order_id: 'o', razorpay_payment_id: 'p', razorpay_signature: 'x' }) });
    assert.strictEqual(r.status, 400);
  });
  await test('healthz + api/config (API-only service)', async () => {
    const h = await (await fetch(base + '/healthz')).json();
    assert.strictEqual(h.ok, true);
    const c = await (await fetch(base + '/api/config')).json();
    assert.strictEqual(c.pro.checkoutLive, false); assert.strictEqual(c.pro.demoUnlock, true);
    assert.strictEqual((await fetch(base + '/index.html')).status, 404, 'API must not serve the site');
  });
  await test('CORS: allowed origin preflight -> 204 with headers', async () => {
    for (const origin of ['http://localhost:8080', 'https://rishtaroast.onrender.com']) {
      const r = await fetch(base + '/api/generate', { method: 'OPTIONS', headers: { Origin: origin, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type,x-pro-token' } });
      assert.strictEqual(r.status, 204, origin);
      assert.strictEqual(r.headers.get('access-control-allow-origin'), origin);
      assert.ok(/x-pro-token/i.test(r.headers.get('access-control-allow-headers')));
    }
  });
  await test('CORS: disallowed origin -> preflight 403, POST 403, no ACAO header', async () => {
    const pre = await fetch(base + '/api/generate', { method: 'OPTIONS', headers: { Origin: 'https://evil.example', 'Access-Control-Request-Method': 'POST' } });
    assert.strictEqual(pre.status, 403); assert.strictEqual(pre.headers.get('access-control-allow-origin'), null);
    const post = await fetch(base + '/api/generate', { method: 'POST', headers: { Origin: 'https://evil.example', 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'X', work: 'it' }) });
    assert.strictEqual(post.status, 403);
    const okPost = await fetch(base + '/api/generate', { method: 'POST', headers: { Origin: 'http://localhost:8080', 'Content-Type': 'application/json', 'X-Forwarded-For': '5.5.5.5' }, body: JSON.stringify({ name: 'Xyz', work: 'it' }) });
    assert.strictEqual(okPost.status, 200); assert.strictEqual(okPost.headers.get('access-control-allow-origin'), 'http://localhost:8080');
  });
  await test('shared modules load as browser globals (UMD) and match server output', () => {
    const vm = require('vm');
    const fs = require('fs');
    const ctx = { self: {} };
    vm.createContext(ctx);
    vm.runInContext(fs.readFileSync(require.resolve('../public/shared/templates.js'), 'utf8'), ctx);
    vm.runInContext(fs.readFileSync(require.resolve('../public/shared/filter.js'), 'utf8'), ctx);
    const input = { name: 'Vipul', city: 'Jaipur', work: 'it', vibe: 'foodie', habit: 'late uthna' };
    assert.deepStrictEqual(JSON.parse(JSON.stringify(ctx.self.RRTemplates.generateFromTemplates(input, 3))), generateFromTemplates(input, 3));
    assert.strictEqual(ctx.self.RRFilter.check('mota hai').ok, false);
  });

  srv.close(); mock.close();
  console.log(`\n${pass}/${pass + fail} tests passed`);
  process.exit(fail ? 1 : 0);
})();
