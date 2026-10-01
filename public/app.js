(function () {
  const $ = (id) => document.getElementById(id);
  const state = { cfg: null, data: null, format: 'story', theme: 'marigold', variant: 0, lastInput: null, who: 'self' };
  const PRO_KEY = 'rr_pro_token';

  // ---------- Pro token (stored locally; server re-verifies HMAC for AI limits) ----------
  function proToken() {
    const t = localStorage.getItem(PRO_KEY);
    if (!t) return null;
    try {
      const p = JSON.parse(atob(t.split('.')[0].replace(/-/g, '+').replace(/_/g, '/')));
      if (p.exp > Date.now()) return t;
    } catch (_) {}
    localStorage.removeItem(PRO_KEY);
    return null;
  }
  const isPro = () => !!proToken();

  function toast(msg, ms = 2600) {
    const el = $('toast');
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => (el.hidden = true), ms);
  }

  function shareUrl(src) {
    const base = (state.cfg && state.cfg.siteUrl) || location.origin;
    return `${base}/?utm_source=${src}&utm_medium=share&utm_campaign=card`;
  }
  function shareText() {
    const n = state.data ? state.data.name : '';
    return state.who === 'friend'
      ? `😂 ${n} ka funny rishta biodata bana diya! Score dekho 💍 Apna/dost ka banao:`
      : `😂 Mera funny rishta biodata dekho! Rishta score ${state.data ? state.data.card.score : ''}/10 💍 Apna banao:`;
  }

  // ---------- Rendering ----------
  function draw() {
    if (!state.data) return;
    RRCard.render($('canvas'), state.data, { format: state.format, theme: state.theme, pro: isPro(), siteUrl: state.cfg.siteUrl, brandName: state.cfg.brandName, scale: 1 });
  }

  function hdCanvas() {
    const c = document.createElement('canvas');
    RRCard.render(c, state.data, { format: state.format, theme: state.theme, pro: isPro(), siteUrl: state.cfg.siteUrl, brandName: state.cfg.brandName, scale: isPro() ? 2 : 1 });
    return c;
  }

  function cardBlob() {
    return new Promise((res) => hdCanvas().toBlob(res, 'image/png'));
  }

  function fileName() {
    const n = (state.data.name || 'biodata').toLowerCase().replace(/[^a-z0-9]+/g, '-');
    return `rishtaroast-${n}-${state.format}${isPro() ? '-hd' : ''}.png`;
  }

  async function download() {
    const blob = await cardBlob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName();
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    toast('Card download ho gaya! 🎉');
  }

  async function share() {
    const blob = await cardBlob();
    const file = new File([blob], fileName(), { type: 'image/png' });
    const payload = { files: [file], title: 'Mera Rishta Biodata 😂', text: `${shareText()} ${shareUrl('native')}` };
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share(payload); return; } catch (e) { if (e.name === 'AbortError') return; }
    }
    if (navigator.share) {
      try { await navigator.share({ title: payload.title, text: shareText(), url: shareUrl('native') }); return; } catch (e) { if (e.name === 'AbortError') return; }
    }
    // Fallback: download + nudge to WhatsApp
    await download();
    toast('Image save ho gayi — ab WhatsApp/Instagram pe upload karo 👇', 4000);
  }

  function updateShareLinks() {
    $('waBtn').href = `https://wa.me/?text=${encodeURIComponent(`${shareText()} ${shareUrl('whatsapp')}`)}`;
    $('xBtn').href = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText())}&url=${encodeURIComponent(shareUrl('x'))}`;
  }

  function renderThemes() {
    const box = $('themes');
    box.innerHTML = '';
    for (const [key, t] of Object.entries(RRCard.THEMES)) {
      if (t.pro && !(state.cfg.pro.enabled)) continue;
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'theme' + (state.theme === key ? ' active' : '');
      b.style.background = `linear-gradient(135deg, ${t.bg[0]}, ${t.bg[1]})`;
      b.style.color = t.text;
      b.textContent = (t.pro && !isPro() ? '🔒 ' : '') + t.name;
      b.onclick = () => {
        if (t.pro && !isPro()) { openPro(); return; }
        state.theme = key;
        renderThemes();
        draw();
      };
      box.appendChild(b);
    }
  }

  // ---------- Generate ----------
  // Same validation/cleaning as the server (lib/generate.js) so offline cards follow the same rules.
  const clean = (v, n) => String(v || '').replace(/[<>{}\[\]`\\]/g, '').replace(/\s+/g, ' ').trim().slice(0, n);
  function parseInput(raw) {
    const T = window.RRTemplates;
    const input = {
      name: clean(raw.name, 24),
      city: clean(raw.city, 24),
      work: T.WORK[raw.work] ? raw.work : 'other',
      workOther: raw.work === 'other' ? clean(raw.workOther, 30) : '',
      vibe: T.VIBE[raw.vibe] ? raw.vibe : 'sanskaari',
      habit: clean(raw.habit, 40),
      variant: Math.max(0, Math.min(50, parseInt(raw.variant, 10) || 0)),
    };
    if (input.name.length < 2) return { error: 'Naam toh daalo yaar (kam se kam 2 letters) 🙂' };
    const F = window.RRFilter;
    if (!F.check(input.name, { categories: F.NAME_CATEGORIES }).ok || !F.checkAll([input.city, input.workOther, input.habit]).ok) {
      return { error: 'Arre arre! Thoda family-friendly rakho 🙏 Religion, caste, looks ya gaali wali cheezein allowed nahi hain.' };
    }
    return { input };
  }

  function localCard(input) {
    const card = window.RRTemplates.generateFromTemplates(input, input.variant);
    return { input: { name: input.name, city: input.city }, card, meta: { source: 'template', local: true } };
  }

  // Try the API (AI) with a short timeout; ANY problem -> client-side templates, silently.
  async function fetchApiCard(input) {
    const cfg = window.RR_CONFIG;
    if (!cfg.API_BASE_URL) return { fallback: 'no_api_configured' };
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), cfg.API_TIMEOUT_MS || 4000);
    try {
      const headers = { 'Content-Type': 'application/json' };
      const tok = proToken();
      if (tok) headers['x-pro-token'] = tok;
      const r = await fetch(cfg.API_BASE_URL + '/api/generate', { method: 'POST', headers, body: JSON.stringify(input), signal: ctrl.signal, mode: 'cors' });
      const j = await r.json().catch(() => ({}));
      if (r.status === 400 && j.blocked) return { blocked: j.error };
      if (!r.ok || !j.card) return { fallback: 'api_http_' + r.status };
      return { data: j };
    } catch (e) {
      return { fallback: e.name === 'AbortError' ? 'api_timeout' : 'api_unreachable' };
    } finally {
      clearTimeout(timer);
    }
  }

  async function generate(e) {
    if (e) e.preventDefault();
    const raw = Object.fromEntries(new FormData($('form')).entries());
    state.who = raw.who || 'self';
    if (e) state.variant = 0;
    raw.variant = state.variant;
    const parsed = parseInput(raw);
    if (parsed.error) return showErr(parsed.error);
    state.lastInput = parsed.input;
    showErr('');
    const btn = $('genBtn');
    btn.disabled = true;
    btn.textContent = 'Rishta aunty soch rahi hain... 🤔';
    const t0 = performance.now();
    try {
      const res = await fetchApiCard(parsed.input);
      if (res.blocked) return showErr(res.blocked);
      const j = res.data || localCard(parsed.input);
      state.lastSource = res.data ? 'api' : 'local:' + res.fallback;
      state.data = { name: j.input.name, city: j.input.city, card: j.card };
      $('result').hidden = false;
      draw();
      updateShareLinks();
      const src = j.meta.source === 'ai' ? (j.meta.cached ? 'AI (cached)' : 'AI') : 'Desi template engine';
      $('meta').textContent = `Bana: ${src}${j.meta && j.meta.pro ? ' • Pro' : ''}`;
      $('meta').dataset.source = state.lastSource;
      $('meta').dataset.ms = String(Math.round(performance.now() - t0));
      $('result').scrollIntoView({ behavior: 'smooth', block: 'start' });
    } finally {
      btn.disabled = false;
      btn.textContent = 'Biodata Banao ✨';
    }
  }

  function showErr(msg) {
    $('err').textContent = msg;
    $('err').hidden = !msg;
  }

  // ---------- Tip ----------
  function touchDevice() {
    return navigator.maxTouchPoints > 0 || (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) || /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  }

  function upiLink(amount) {
    const t = state.cfg.tip;
    const n = Math.max(1, Math.min(100000, Math.round(Number(amount) || t.defaultAmount || 29)));
    const enc = (v) => encodeURIComponent(String(v)).replace(/%40/g, '@');
    return `upi://pay?pa=${enc(t.upiId)}&pn=${enc(t.upiPayeeName)}&am=${n}&cu=INR&tn=${encodeURIComponent('RishtaRoast chai')}`;
  }

  function setTipAmount(amount) {
    const n = Math.max(1, Math.min(100000, Math.round(Number(amount) || state.cfg.tip.defaultAmount || 29)));
    state.tipAmount = n;
    const link = upiLink(n);
    $('upiBtn').href = link;
    $('upiQr').src = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(link)}`;
    document.querySelectorAll('.amount-btn').forEach((b) => {
      b.href = upiLink(b.dataset.amount);
      b.setAttribute('aria-label', `Pay ₹${b.dataset.amount}`);
      b.setAttribute('aria-pressed', String(Number(b.dataset.amount) === n));
    });
    const custom = $('customAmount');
    if (document.activeElement !== custom && Number(custom.value) !== n) custom.value = '';
    $('customUpiBtn').href = link;
  }

  function copyUpiId() {
    const id = state.cfg.tip.upiId;
    const fallback = () => {
      const input = document.createElement('textarea');
      input.value = id; input.setAttribute('readonly', ''); input.style.position = 'fixed'; input.style.opacity = '0';
      document.body.appendChild(input); input.select();
      try { document.execCommand('copy'); toast('UPI ID copy ho gaya ✅'); } catch (_) { toast(`UPI ID: ${id}`, 5000); }
      input.remove();
    };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(id).then(() => toast('UPI ID copy ho gaya ✅')).catch(fallback);
    else fallback();
  }

  function openTip() {
    const t = state.cfg.tip;
    const touch = touchDevice();
    const modal = $('tipModal');
    modal.classList.toggle('touch-tip', touch);
    $('upiChoices').hidden = false;
    $('upiQrWrap').hidden = touch;
    $('upiBtn').hidden = touch;
    $('rzpTipBtn').hidden = !t.razorpayLink || t.razorpayIsPlaceholder;
    $('rzpTipBtn').href = t.razorpayLink || '#';
    $('tipPlaceholder').hidden = !t.upiIsPlaceholder;
    setTipAmount(state.tipAmount || t.defaultAmount || 29);
    modal.showModal();
  }

  // ---------- Pro (Razorpay checkout; stub until keys configured) ----------
  function openPro() {
    const p = state.cfg.pro;
    if (!p.enabled) return;
    if (!p.apiReachable) {
      $('proModalText').textContent = 'Payment server abhi jaag raha hai 😴 — 30 second baad dobara try karo.';
      $('demoUnlockBtn').hidden = true;
      $('proModal').showModal();
      warmUp();
      refreshApiConfig();
      return;
    }
    if (!p.checkoutLive) {
      $('proModalText').textContent = 'Payments abhi setup nahi hue — Razorpay checkout STUB hai (RAZORPAY_KEY_ID / SECRET configure nahi hain).';
      $('demoUnlockBtn').hidden = !p.demoUnlock;
      $('proModal').showModal();
      return;
    }
    startCheckout();
  }

  function loadScript(src) {
    return new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = src; s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });
  }

  async function startCheckout() {
    try {
      const order = await (await fetch(apiUrl('/api/pro/order'), { method: 'POST' })).json();
      if (order.stub || !order.orderId) { toast('Payments abhi available nahi'); return; }
      if (!window.Razorpay) await loadScript('https://checkout.razorpay.com/v1/checkout.js');
      const rzp = new window.Razorpay({
        key: order.keyId, amount: order.amount, currency: order.currency, order_id: order.orderId,
        name: state.cfg.brandName, description: `Pro – ${state.cfg.pro.validityDays} din`,
        theme: { color: '#7A0C2E' },
        handler: async (resp) => {
          const v = await (await fetch(apiUrl('/api/pro/verify'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(resp) })).json();
          if (v.ok) activatePro(v.token); else toast('Payment verify nahi hua, support se baat karo');
        },
      });
      rzp.open();
    } catch (e) {
      toast('Checkout load nahi hua, baad mein try karo');
    }
  }

  async function demoUnlock() {
    try {
      const v = await (await fetch(apiUrl('/api/pro/verify'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ demo: true }) })).json();
      if (v.ok) { activatePro(v.token); $('proModal').close(); } else toast(v.error || 'Demo unlock off hai');
    } catch (_) { toast('Server abhi so raha hai 😴 thodi der baad try karo'); }
  }

  function activatePro(token) {
    localStorage.setItem(PRO_KEY, token);
    applyProUI();
    renderThemes();
    draw();
    toast('Pro unlock ho gaya! ✨ HD + no watermark');
  }

  function applyProUI() {
    $('proBadge').hidden = !isPro();
    $('proBox').hidden = !state.cfg.pro.enabled || isPro();
    $('proPrice').textContent = `₹${state.cfg.pro.priceInr}`;
    $('proNote').textContent = state.cfg.pro.checkoutLive ? `${state.cfg.pro.validityDays} din ke liye • Secure Razorpay checkout` : 'Coming soon (checkout stubbed)';
  }

  // ---------- Sample card on home ----------
  function drawSample() {
    const sample = {
      name: 'Rahul', city: 'Indore',
      card: {
        occupationTold: 'Google mein hain', occupationSach: 'Google mein nahi, Google pe sab search karte hain',
        salaryTold: '25 LPA (rishtedaaron ke liye)', salarySach: 'In-hand dekh ke HR bhi sorry bolta hai',
        hobbies: 'Shaadi mein sirf menu dekhne jaana', khoobiyan: ['Shehar ki har chaat ki dukaan ka GPS dimaag mein', 'Mood off ho toh momos se therapy'],
        redFlags: ['"Late uthna" inke liye aadat nahi, lifestyle hai', '"Thoda sa taste karaunga" — aadhi plate gayab'],
        mummyVerdict: 'Hamara bachcha laakhon mein ek hai — bas wo laakh abhi mile nahi', score: 8.4, scoreLine: 'Shortlist pakka — chai-samosa pe charcha 🫖',
        idealMatch: 'Jo 2 baje raat ko Maggi banane ko ready ho', tagline: 'Zomato follows my brother 🍕', closer: 'Real talk: jo bhi milega, lucky hoga ✨',
      },
    };
    RRCard.render($('sampleCanvas'), sample, { format: 'story', theme: 'marigold', pro: false, siteUrl: state.cfg.siteUrl, brandName: state.cfg.brandName, scale: 0.5 });
  }

  // ---------- Config / API helpers ----------
  const apiUrl = (p) => window.RR_CONFIG.API_BASE_URL + p;

  function buildConfig() {
    const c = window.RR_CONFIG;
    const enc = (v) => encodeURIComponent(v).replace(/%40/g, '@');
    const isPh = (v) => /PLACEHOLDER/i.test(String(v || ''));
    return {
      brandName: c.BRAND_NAME,
      siteUrl: c.SITE_URL,
      tip: {
        upiId: c.UPI_ID,
        upiPayeeName: c.UPI_PAYEE_NAME,
        defaultAmount: 29,
        upiIsPlaceholder: isPh(c.UPI_ID),
        razorpayLink: c.RAZORPAY_TIP_LINK || '',
        razorpayIsPlaceholder: isPh(c.RAZORPAY_TIP_LINK),
      },
      // checkoutLive / razorpayKeyId / demoUnlock come from the API (refreshApiConfig) when it is awake
      pro: { enabled: !!c.PRO_ENABLED, priceInr: c.PRO_PRICE_INR, validityDays: c.PRO_VALIDITY_DAYS, checkoutLive: false, demoUnlock: false, apiReachable: false },
    };
  }

  // Wake a sleeping Render free instance as soon as someone opens the page (fire-and-forget).
  function warmUp() {
    if (!window.RR_CONFIG.API_BASE_URL) return;
    try { fetch(apiUrl('/healthz'), { mode: 'cors', cache: 'no-store' }).then((r) => r.text()).catch(() => {}); } catch (_) {}
  }

  async function refreshApiConfig() {
    if (!window.RR_CONFIG.API_BASE_URL) return;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 60000); // cold start can take ~30-60s; never blocks the UI
    try {
      const j = await (await fetch(apiUrl('/api/config'), { mode: 'cors', signal: ctrl.signal })).json();
      Object.assign(state.cfg.pro, { checkoutLive: !!j.pro.checkoutLive, razorpayKeyId: j.pro.razorpayKeyId, demoUnlock: !!j.pro.demoUnlock, apiReachable: true });
      applyProUI();
    } catch (_) { /* API asleep/unreachable: Pro shows "server waking up" */ } finally { clearTimeout(timer); }
  }

  // ---------- Init ----------
  async function init() {
    state.cfg = buildConfig();
    warmUp();
    refreshApiConfig();
    await RRCard.loadFonts();
    applyProUI();
    renderThemes();
    drawSample();

    $('form').addEventListener('submit', generate);
    $('work').addEventListener('change', (e) => ($('workOtherWrap').hidden = e.target.value !== 'other'));
    document.querySelectorAll('.tab').forEach((b) => b.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach((x) => x.classList.remove('active'));
      b.classList.add('active');
      state.format = b.dataset.format;
      draw();
    }));
    $('dlBtn').onclick = download;
    $('shareBtn').onclick = share;
    document.querySelectorAll('.amount-btn').forEach((b) => b.onclick = () => { setTipAmount(b.dataset.amount); });
    $('customAmount').addEventListener('input', (e) => {
      if (e.target.value) setTipAmount(e.target.value);
    });
    $('customUpiBtn').onclick = (e) => {
      if (!Number($('customAmount').value)) { e.preventDefault(); toast('Amount daalo pehle 🙂'); }
    };
    $('copyUpiBtn').onclick = copyUpiId;
    $('tipBtn').onclick = openTip;
    $('igBtn').onclick = async () => { await download(); toast('Saved! Instagram kholo → Story → image select karo → link sticker mein URL daalo 📲', 5000); };
    $('againBtn').onclick = () => { state.variant = (state.variant + 1) % 50; generate(); };
    $('editBtn').onclick = () => $('formCard').scrollIntoView({ behavior: 'smooth' });
    $('proBtn').onclick = openPro;
    $('demoUnlockBtn').onclick = demoUnlock;
  }

  document.addEventListener('DOMContentLoaded', init);
})();
