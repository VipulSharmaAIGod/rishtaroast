/* RishtaRoast card renderer: draws the biodata card on a <canvas>, fully client-side (zero server cost).
   Formats: story 1080x1920, square 1080x1080. scale=2 gives HD (Pro). */
(function () {
  const THEMES = {
    marigold: { name: 'Marigold', pro: false, bg: ['#FFF6E5', '#FFE1B0'], panel: 'rgba(255,255,255,0.78)', primary: '#7A0C2E', accent: '#E08E0B', text: '#3B1F0E', soft: '#8A5A3B', flower: ['#FF8C00', '#FFC107'], leaf: '#3E8E41', band: '#7A0C2E', bandText: '#FFFFFF', bandAccent: '#FFD166' },
    rani: { name: 'Rani Pink', pro: false, bg: ['#FFF0F6', '#FFD1E3'], panel: 'rgba(255,255,255,0.8)', primary: '#B0105A', accent: '#FF7A00', text: '#3A0D22', soft: '#8C4A68', flower: ['#FF6F00', '#FFB300'], leaf: '#2E7D32', band: '#B0105A', bandText: '#FFFFFF', bandAccent: '#FFE082' },
    royal: { name: 'Royal Night', pro: true, bg: ['#0E1A3A', '#22356E'], panel: 'rgba(255,255,255,0.07)', primary: '#F5C451', accent: '#F5C451', text: '#FFF8E7', soft: '#C9D3F0', flower: ['#F5A623', '#FFD54F'], leaf: '#66BB6A', band: '#F5C451', bandText: '#0E1A3A', bandAccent: '#7A0C2E' },
    neon: { name: 'Sangeet Neon', pro: true, bg: ['#14002E', '#3A0CA3'], panel: 'rgba(255,255,255,0.08)', primary: '#FF4FA3', accent: '#4CC9F0', text: '#FFFFFF', soft: '#D7C8FF', flower: ['#FF4FA3', '#FFD60A'], leaf: '#4CC9F0', band: '#FF4FA3', bandText: '#FFFFFF', bandAccent: '#FFD60A' },
  };

  const F = {
    body: (w, s) => `${w} ${s}px Poppins, "Noto Color Emoji", "Apple Color Emoji", sans-serif`,
    hand: (s) => `700 ${s}px Kalam, Poppins, "Noto Color Emoji", sans-serif`,
    deva: (s) => `800 ${s}px Mukta, "Noto Sans Devanagari", sans-serif`,
  };

  async function loadFonts() {
    if (!document.fonts) return;
    await Promise.all([
      document.fonts.load(F.body(400, 30)), document.fonts.load(F.body(600, 30)), document.fonts.load(F.body(700, 30)), document.fonts.load(F.body(800, 30)),
      document.fonts.load(F.hand(30)), document.fonts.load(F.deva(30), 'रिश्ता बायोडाटा'),
    ]).catch(() => {});
  }

  function wrap(ctx, text, maxW) {
    const words = String(text).split(/\s+/);
    const lines = [];
    let line = '';
    for (const w of words) {
      const t = line ? line + ' ' + w : w;
      if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t;
    }
    if (line) lines.push(line);
    return lines;
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function fitFont(ctx, text, maxW, start, min, mk) {
    let s = start;
    ctx.font = mk(s);
    while (ctx.measureText(text).width > maxW && s > min) { s -= 2; ctx.font = mk(s); }
    return s;
  }

  function marigold(ctx, x, y, r, t) {
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.fillStyle = i % 2 ? t.flower[1] : t.flower[0];
      ctx.arc(x, y, r * (1 - i * 0.28), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    for (let a = 0; a < 8; a++) {
      const ang = (a / 8) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(x + Math.cos(ang) * r * 0.62, y + Math.sin(ang) * r * 0.62, r * 0.1, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function leaf(ctx, x, y, s, t, rot) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.fillStyle = t.leaf;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(s * 0.5, s * 0.5, 0, s * 1.4);
    ctx.quadraticCurveTo(-s * 0.5, s * 0.5, 0, 0);
    ctx.fill();
    ctx.restore();
  }

  // Toran (marigold garland) across the top
  function toran(ctx, W, t, k) {
    const n = 9, seg = W / n;
    ctx.strokeStyle = t.leaf;
    ctx.lineWidth = 4 * k;
    for (let i = 0; i < n; i++) {
      const x0 = i * seg, x1 = x0 + seg;
      // scallop of flowers
      for (let j = 0; j <= 6; j++) {
        const u = j / 6;
        const x = x0 + u * seg;
        const y = 18 * k + Math.sin(u * Math.PI) * 46 * k;
        marigold(ctx, x, y, 17 * k, t);
      }
      // hanging strand from middle of each scallop
      if (i % 2 === 0) {
        const cx = (x0 + x1) / 2;
        for (let d = 1; d <= 3; d++) marigold(ctx, cx, 64 * k + d * 28 * k, 12 * k, t);
        leaf(ctx, cx, 64 * k + 3 * 28 * k + 8 * k, 16 * k, t, 0);
      } else {
        const cx = (x0 + x1) / 2;
        leaf(ctx, cx - 10 * k, 66 * k, 18 * k, t, 0.5);
        leaf(ctx, cx + 10 * k, 66 * k, 18 * k, t, -0.5);
      }
    }
  }

  function background(ctx, W, H, t) {
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, t.bg[0]);
    g.addColorStop(1, t.bg[1]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    // soft mandala circles
    ctx.save();
    ctx.globalAlpha = 0.07;
    ctx.strokeStyle = t.primary;
    for (const [cx, cy] of [[W * 0.95, H * 0.35], [W * 0.05, H * 0.7]]) {
      for (let r = 40; r < 320; r += 34) {
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    ctx.restore();
    // double border
    ctx.strokeStyle = t.accent;
    ctx.lineWidth = 6;
    roundRect(ctx, 26, 26, W - 52, H - 52, 28);
    ctx.stroke();
    ctx.lineWidth = 2;
    roundRect(ctx, 40, 40, W - 80, H - 80, 22);
    ctx.stroke();
  }

  function header(ctx, W, y, t, s) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = t.primary;
    ctx.font = F.deva(96 * s);
    ctx.fillText('रिश्ता बायोडाटा', W / 2, y + 80 * s);
    ctx.fillStyle = t.soft;
    ctx.font = F.body(600, 26 * s);
    ctx.fillText('★  RISHTA BIODATA • 100% MUMMY APPROVED*  ★', W / 2, y + 124 * s);
    return y + 124 * s;
  }

  function nameBlock(ctx, W, y, data, t, s) {
    ctx.textAlign = 'center';
    ctx.fillStyle = t.text;
    const name = data.name;
    const fs = fitFont(ctx, name, W - 200, 92 * s, 44, (z) => F.body(800, z));
    ctx.fillText(name, W / 2, y + fs);
    y += fs + 10;
    if (data.city) {
      ctx.fillStyle = t.soft;
      ctx.font = F.body(600, 32 * s);
      ctx.fillText('📍 ' + data.city, W / 2, y + 34 * s);
      y += 44 * s;
    }
    return y;
  }

  function ribbon(ctx, W, y, text, t, s, maxW) {
    maxW = maxW || W - 160;
    ctx.font = F.body(700, 34 * s);
    const fs = fitFont(ctx, text, maxW - 70, 34 * s, 18, (z) => F.body(700, z));
    const w = Math.min(maxW, ctx.measureText(text).width + 70);
    const h = fs + 34;
    ctx.fillStyle = t.primary;
    roundRect(ctx, (W - w) / 2, y, w, h, h / 2);
    ctx.fill();
    ctx.fillStyle = t.primary === '#F5C451' ? '#0E1A3A' : '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.fillText(text, W / 2, y + h / 2 + fs * 0.36);
    return y + h;
  }

  // Build list of rows; each row: {label, items:[{prefix, text}]}
  function rowsFor(card, format) {
    if (format === 'square') {
      return [
        { label: '💼 KAAM', items: [{ p: 'Sach:', t: card.occupationSach }] },
        { label: '💰 SALARY', items: [{ p: 'Sach:', t: card.salarySach }] },
        { label: '🚩 RED FLAG', items: [{ p: '', t: card.redFlags[0] }] },
      ];
    }
    return [
      { label: '💼 KAAM', items: [{ p: 'Mummy ke hisaab se:', t: card.occupationTold }, { p: 'Asli sach:', t: card.occupationSach }] },
      { label: '💰 SALARY', items: [{ p: 'Rishtedaaron ko:', t: card.salaryTold }, { p: 'Asli sach:', t: card.salarySach }] },
      { label: '🎯 HOBBIES', items: [{ p: '', t: card.hobbies }] },
      { label: '✨ KHOOBIYAN', items: card.khoobiyan.map((x) => ({ p: '•', t: x })) },
      { label: '🚩 RED FLAGS', items: card.redFlags.map((x) => ({ p: '•', t: x })) },
      { label: '💘 IDEAL MATCH', items: [{ p: '', t: card.idealMatch }] },
    ];
  }

  function layoutRows(ctx, rows, maxW, fs) {
    const lab = Math.round(fs * 0.74), lh = Math.round(fs * 1.3);
    let h = 0;
    const out = rows.map((r) => {
      const items = r.items.map((it) => {
        ctx.font = F.body(500, fs);
        const pre = it.p ? it.p + ' ' : '';
        const lines = wrap(ctx, pre + it.t, maxW);
        return { pre, lines };
      });
      const rh = lab + 14 + items.reduce((a, i) => a + i.lines.length * lh, 0) + 22;
      h += rh;
      return { label: r.label, items, rh };
    });
    return { out, h, lab, lh };
  }

  function drawRows(ctx, x, y, w, rows, fs, t) {
    const { out, lab, lh } = layoutRows(ctx, rows, w, fs);
    for (const r of out) {
      ctx.textAlign = 'left';
      ctx.fillStyle = t.accent;
      ctx.font = F.body(800, lab);
      ctx.fillText(r.label, x, y + lab);
      let yy = y + lab + 14;
      for (const it of r.items) {
        it.lines.forEach((ln, i) => {
          yy += lh;
          ctx.fillStyle = t.text;
          if (i === 0 && it.pre) {
            ctx.font = F.body(700, fs);
            ctx.fillStyle = t.primary;
            ctx.fillText(it.pre, x, yy - lh * 0.25);
            const pw = ctx.measureText(it.pre).width;
            ctx.font = F.body(500, fs);
            ctx.fillStyle = t.text;
            ctx.fillText(ln.slice(it.pre.length), x + pw, yy - lh * 0.25);
          } else {
            ctx.font = F.body(500, fs);
            ctx.fillText(ln, x, yy - lh * 0.25);
          }
        });
      }
      y += r.rh;
    }
    return y;
  }

  function scoreGauge(ctx, cx, cy, r, score, t) {
    ctx.lineCap = 'round';
    ctx.lineWidth = r * 0.18;
    ctx.strokeStyle = 'rgba(128,128,128,0.25)';
    ctx.beginPath();
    ctx.arc(cx, cy, r, Math.PI * 0.75, Math.PI * 2.25);
    ctx.stroke();
    ctx.strokeStyle = t.primary;
    ctx.beginPath();
    ctx.arc(cx, cy, r, Math.PI * 0.75, Math.PI * 0.75 + (Math.PI * 1.5 * score) / 10);
    ctx.stroke();
    ctx.lineCap = 'butt';
    ctx.textAlign = 'center';
    ctx.fillStyle = t.text;
    ctx.font = F.body(800, r * 0.6);
    ctx.fillText(score.toFixed(1), cx, cy + r * 0.12);
    ctx.font = F.body(700, r * 0.24);
    ctx.fillStyle = t.soft;
    ctx.fillText('/ 10', cx, cy + r * 0.48);
  }

  // Rubber-stamp style score (square format)
  function scoreStamp(ctx, cx, cy, r, score, t) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-0.2);
    ctx.strokeStyle = t.primary;
    ctx.fillStyle = t.panel;
    ctx.lineWidth = 6;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, r - 12, 0, Math.PI * 2); ctx.stroke();
    ctx.textAlign = 'center';
    ctx.fillStyle = t.primary;
    ctx.font = F.body(800, r * 0.2);
    ctx.fillText('RISHTA SCORE', 0, -r * 0.36);
    ctx.font = F.body(800, r * 0.62);
    ctx.fillText(score.toFixed(1), 0, r * 0.26);
    ctx.font = F.body(700, r * 0.2);
    ctx.fillText('/ 10', 0, r * 0.56);
    ctx.restore();
  }

  function bubble(ctx, x, y, w, text, t, fs) {
    ctx.font = F.hand(fs);
    const lines = wrap(ctx, '"' + text + '"', w - 60);
    const lh = fs * 1.2;
    const head = fs * 0.8;
    const h = head + 26 + lines.length * lh + 30;
    ctx.fillStyle = t.panel;
    roundRect(ctx, x, y, w, h, 28);
    ctx.fill();
    ctx.strokeStyle = t.accent;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.textAlign = 'left';
    ctx.fillStyle = t.accent;
    ctx.font = F.body(800, head);
    ctx.fillText('👩 MUMMY KA VERDICT', x + 30, y + 22 + head);
    ctx.fillStyle = t.text;
    ctx.font = F.hand(fs);
    lines.forEach((ln, i) => ctx.fillText(ln, x + 30, y + head + 26 + (i + 1) * lh));
    return h;
  }

  function measureBubble(ctx, w, text, fs) {
    ctx.font = F.hand(fs);
    const lines = wrap(ctx, '"' + text + '"', w - 60);
    return fs * 0.8 + 26 + lines.length * fs * 1.2 + 30;
  }

  function footer(ctx, W, H, t, opts, s) {
    const site = (opts.siteUrl || '').replace(/^https?:\/\//, '');
    if (opts.pro) {
      ctx.textAlign = 'center';
      ctx.fillStyle = t.soft;
      ctx.font = F.body(600, 24 * s);
      ctx.fillText(site, W / 2, H - 62);
      return H - 100;
    }
    const bh = 150 * s;
    const y = H - 46 - bh;
    ctx.fillStyle = t.band;
    roundRect(ctx, 46, y, W - 92, bh, 22);
    ctx.fill();
    ctx.textAlign = 'center';
    ctx.fillStyle = t.bandText;
    ctx.font = F.body(600, 30 * s);
    ctx.fillText('Apna funny biodata banao 👇', W / 2, y + 50 * s);
    ctx.fillStyle = t.bandAccent;
    const fs = fitFont(ctx, site, W - 200, 60 * s, 30, (z) => F.body(800, z));
    ctx.fillText(site, W / 2, y + 52 * s + fs);
    return y;
  }

  function disclaimer(ctx, W, y, t) {
    ctx.textAlign = 'center';
    ctx.fillStyle = t.soft;
    ctx.font = F.body(500, 20);
    ctx.fillText('*Sirf mazaak ke liye. Real rishte ke liye mummy se hi baat karein.', W / 2, y);
  }

  function render(canvas, data, opts = {}) {
    const format = opts.format === 'square' ? 'square' : 'story';
    const sq = format === 'square';
    const t = THEMES[opts.theme] || THEMES.marigold;
    const scale = opts.scale || 1;
    const W = 1080, H = sq ? 1080 : 1920;
    canvas.width = Math.round(W * scale);
    canvas.height = Math.round(H * scale);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.textBaseline = 'alphabetic';
    const card = data.card;
    const px = 90, pw = W - 180;

    background(ctx, W, H, t);
    toran(ctx, W, t, sq ? 0.62 : 1);

    // ---- top block ----
    let y = sq ? 66 : 160;
    y = header(ctx, W, y, t, sq ? 0.62 : 1) + (sq ? 8 : 30);
    if (sq) {
      ctx.textAlign = 'center';
      ctx.fillStyle = t.text;
      const fs = fitFont(ctx, data.name, 560, 66, 36, (z) => F.body(800, z));
      ctx.fillText(data.name, W / 2, y + fs);
      y += fs + 6;
      if (data.city) { ctx.fillStyle = t.soft; ctx.font = F.body(600, 26); ctx.fillText('📍 ' + data.city, W / 2, y + 28); y += 36; }
      y = ribbon(ctx, W, y + 6, card.tagline, t, 0.78, 600) + 22;
    } else {
      y = nameBlock(ctx, W, y, { name: data.name, city: data.city }, t, 1) + 18;
      y = ribbon(ctx, W, y, card.tagline, t, 1) + 30;
    }

    // ---- bottom block (computed bottom-up so nothing overlaps) ----
    const bandH = opts.pro ? 0 : (sq ? 120 : 150);
    const bandTop = opts.pro ? H - 96 : H - 46 - bandH;
    const discY = bandTop - (sq ? 14 : 22);
    let blockTop, drawBlock;

    if (sq) {
      const vfs = 30;
      const bh = measureBubble(ctx, pw, card.mummyVerdict, vfs);
      blockTop = discY - 30 - bh;
      drawBlock = (top) => bubble(ctx, px, top, pw, card.mummyVerdict, t, vfs);
    } else {
      const gaugeR = 100, vfs = 38;
      const bubbleW = pw - gaugeR * 2 - 44;
      const bh = measureBubble(ctx, bubbleW, card.mummyVerdict, vfs);
      ctx.font = F.body(700, 24);
      const sl = wrap(ctx, card.scoreLine, gaugeR * 2 + 60);
      const gaugeH = gaugeR * 2 + 10 + 34 + sl.length * 28;
      const blockH = Math.max(gaugeH, bh);
      const closerY = discY - 48;
      blockTop = closerY - 54 - blockH;
      drawBlock = (top) => {
        scoreGauge(ctx, px + gaugeR, top + gaugeR + 6, gaugeR, card.score, t);
        ctx.textAlign = 'center';
        ctx.fillStyle = t.accent;
        ctx.font = F.body(800, 22);
        ctx.fillText('RISHTA SCORE', px + gaugeR, top + gaugeR * 2 + 22);
        ctx.fillStyle = t.primary;
        ctx.font = F.body(700, 24);
        sl.forEach((ln, i) => ctx.fillText(ln, px + gaugeR, top + gaugeR * 2 + 54 + i * 28));
        bubble(ctx, px + gaugeR * 2 + 44, top + Math.max(0, (gaugeH - bh) / 2), bubbleW, card.mummyVerdict, t, vfs);
        if (card.closer) {
          ctx.textAlign = 'center';
          ctx.fillStyle = t.text;
          const cfs = fitFont(ctx, card.closer, pw, 32, 22, (z) => F.body(700, z));
          ctx.font = F.body(700, cfs);
          ctx.fillText(card.closer, W / 2, top + blockH + 54 + 4);
        }
      };
    }

    // ---- rows panel: auto-fit font into the space between top and bottom blocks ----
    const rows = rowsFor(card, format);
    const avail = blockTop - y - (sq ? 20 : 34);
    let fs = sq ? 34 : 46;
    while (fs > 20 && layoutRows(ctx, rows, pw - 60, fs).h + 30 > avail) fs -= 1;
    const panelH = layoutRows(ctx, rows, pw - 60, fs).h + 30;
    const spare = Math.max(0, avail - panelH);
    const panelY = y + spare * 0.35;
    ctx.fillStyle = t.panel;
    roundRect(ctx, px, panelY, pw, panelH, 30);
    ctx.fill();
    drawRows(ctx, px + 30, panelY + 20, pw - 60, rows, fs, t);
    drawBlock(blockTop - spare * 0.3);
    if (sq) scoreStamp(ctx, W - 150, 238, 80, card.score, t);

    // ---- footer + watermark ----
    footer(ctx, W, H, t, opts, sq ? 0.8 : 1);
    disclaimer(ctx, W, opts.pro ? H - 100 : discY, t);
    return canvas;
  }

  window.RRCard = { render, loadFonts, THEMES };
})();
