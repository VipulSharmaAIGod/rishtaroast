# RishtaRoast 💍😂: funny Hinglish shaadi biodata card generator

You type a name, city, job, "vibe" and one bad habit. The app makes a **funny rishta biodata** in Hinglish
("Mummy ke hisaab se vs asli sach", salary as told to relatives, red flags, Mummy's verdict, a Rishta Score)
and draws it as a **shareable image card**: a 1080×1920 story and a 1080×1080 square. Every free card has a big branded footer with the site URL, so each share sends people back to the site.

> **Live (Render, free):** site https://rishtaroast.onrender.com · API https://rishtaroast-api.onrender.com (`/healthz`)
> Repo: https://github.com/VipulSharmaAIGod/rishtaroast. No AI key or Razorpay keys are set yet, so cards use templates. UPI/Razorpay values are still **PLACEHOLDERS**.
> Services were created directly (not from the Blueprint), so the custom headers, redirect and health-check path in `render.yaml` are **not** applied. See "Live deployment notes" below.

## Architecture (Render)
```
 Browser ──► rishtaroast        Render STATIC SITE (free, global CDN, never sleeps)   public/
   │           • page, card drawing, Hinglish template engine, content filter (all client-side)
   │           • config: public/config.js (API_BASE_URL etc.), filled at build from env vars
   │
   └─(optional, 4s timeout)──► rishtaroast-api   Render WEB SERVICE (free, Singapore)   server.js
               • POST /api/generate (AI, server-side templates as backup), /api/config,
                 /api/pro/order + /api/pro/verify (stubs), GET /healthz
               • CORS locked to ALLOWED_ORIGINS, plus rate limits, caps, cache and content filter
```
- **The site works without the API.** When the page loads it sends a fire-and-forget warm-up ping to `/healthz` to wake a sleeping free instance. When you press "Biodata Banao", it calls the API with a **4 s timeout**. On a timeout, network error, 429 or 5xx it **silently** makes the card with the same template engine in the browser. Only a content-filter rejection (400 `blocked`) is shown to the user.
- The template engine and filter live in **one shared file each** (`public/shared/templates.js`, `public/shared/filter.js`), built so they work in both the browser and Node. The server uses them through `lib/templates.js` / `lib/filter.js`, so there is a single source of truth and a test checks both give identical output.
- Pro checkout status comes from the API (`/api/config`) in the background. If the API is asleep, the Pro button says "server jaag raha hai, 30s baad try karo" and triggers another warm-up.

## Run locally
```bash
cd /workspace/viral-tool
npm install
npm run static        # static site  → http://localhost:8080   (this alone is a fully working app)
npm start             # API (optional) → http://localhost:3000  (config.js auto-uses it on localhost)
# local Pro testing without payment:
PRO_DEMO_UNLOCK=true npm start
```
Tests:
```bash
npm test     # 22 API tests: limits/caps/cache/filter/AI mock/CORS/healthz/shared-module parity (no network needed)
npm run e2e  # headless Chrome: starts static + API itself; scenarios A) API up, B) API stopped, C) API hanging; refreshes screenshots/
npm run og   # re-render public/og.png (needs `npm run static` running); do this after the domain is final
npm run configure-static   # what Render's static build runs (applies env vars to public/*)
npm run mock-ai            # fake OpenAI-compatible API on :4555 for manual AI-path testing
```
Node ≥ 18 (tested on Node 20). The e2e/OG scripts use system Chrome (`CHROME_PATH`, default `/usr/bin/google-chrome`).

## Files
```
render.yaml                 Blueprint: static site + API web service
public/                     STATIC SITE (publish dir)
  index.html privacy.html   pages (SEO meta, OG, JSON-LD)
  config.js                 ← the ONE frontend config (API_BASE_URL, SITE_URL, UPI, Pro price…)
  app.js card.js styles.css UI, canvas card renderer
  shared/templates.js       Hinglish template engine (browser + server)
  shared/filter.js          content filter (browser + server)
  og.png upi-qr.svg robots.txt sitemap.xml manifest.webmanifest favicon.svg fonts/
server.js                   API web service (API routes only)
lib/                        config, generate pipeline, ai client, rateLimit, cache, payments, cors
scripts/                    configure-static, static-server, e2e, test-api, mock-ai-server, make-og
```

## Feature status
| Feature | Status |
|---|---|
| Static site works with **no API at all** (cards, download, share, tip) | ✅ e2e scenario B (API stopped): card in about 0.2 s |
| 4 s API timeout, then client templates without telling the user | ✅ e2e scenario C (API hangs): falls back at about 4.2 s |
| Warm-up ping to `/healthz` on page load | ✅ checked in e2e |
| Story 1080×1920 + square 1080×1080 PNG, branded footer | ✅ |
| Share: Web Share API with PNG, then WhatsApp / X / Instagram (save + how-to) / download fallback | ✅ (the native OS share sheet is stubbed in the test) |
| Tip button next to Share: UPI deep link + **static** UPI QR + Razorpay link | ✅ renders. ⚠️ values are **PLACEHOLDERS** with a visible warning |
| Pro (HD 2160×3840, no watermark, premium themes, 3× AI quota) | ✅ demo unlock works through the API. ⚠️ **Razorpay checkout is STUBBED**, and its order/verify code is untested with real keys |
| AI via OpenAI-compatible API | ✅ tested with a local mock only. ⚠️ never run against a real provider |
| CORS limited to `ALLOWED_ORIGINS` (other origins: preflight 403, POST 403) | ✅ tested |
| Rate limits (5/hr, 20/day per IP), global 500/day AI cap, max_tokens 350, 24 h cache, 60 req/hr/IP hard cap | ✅ tested. ⚠️ in memory, see below |
| Content filter: client-side (instant/offline) + server-side on inputs and AI output | ✅ basic word list |
| SEO (title, meta, canonical, OG/Twitter, og.png, JSON-LD, robots, sitemap) + privacy page | ✅ |

### Known limitations
- **Rate limit and cap counters are in memory and reset whenever the free instance sleeps or redeploys.** So "500 AI calls/day" really means "500 per awake period". **Set a monthly spend limit in the AI provider's dashboard.** That is the real safety net. For durable counters, add Render Key Value (free tier) or Upstash Redis.
- If the API is cold, the first card or two after a quiet period will be template-based (the 4 s timeout is shorter than a 30–60 s cold start). That is by design. The warm-up ping means later cards usually get AI.
- Pro perks are enforced in the browser through a signed token in localStorage, so a technical user could bypass them. The server HMAC-checks the token only for the extra AI quota.
- The word-list filter misses masked words (e.g. `ch*tiya`).
- `og.png` has the domain baked into the image. Re-run `npm run og` and commit it once the final domain is known (Render's static build can't run Chrome).
- Instagram has no web share intent, and `upi://` links only open on phones with a UPI app (desktop users get the QR code).

## render.yaml summary
| | `rishtaroast` (static) | `rishtaroast-api` (web) |
|---|---|---|
| type / runtime | web / static | web / node |
| plan / region | n/a. Render static sites have no plan/region field (always free, global CDN) | `free` / `singapore` |
| build | `npm ci --omit=dev && node scripts/configure-static.js` | `npm ci --omit=dev` |
| start / publish | publish `./public` | `node server.js`, health check `/healthz` |
| env (fixed) | `UPI_PAYEE_NAME`, `PRO_ENABLED`, `PRO_PRICE_INR`, `PRO_VALIDITY_DAYS`, `NODE_VERSION` | `NODE_ENV=production`, AI defaults, all cost-control values, `PRO_*`, `PRO_DEMO_UNLOCK=false`, `TRUST_PROXY=1` |
| env (`sync: false`, you fill in) | `API_BASE_URL`, `SITE_URL`, `UPI_ID`, `RAZORPAY_TIP_LINK` | `ALLOWED_ORIGINS`, `AI_API_KEY`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` |
| generated | none | `PRO_TOKEN_SECRET` (`generateValue: true`) |
| extras | security headers, long cache for fonts, `no-cache` for config.js, `/privacy` → `/privacy.html` redirect, build filter | build filter (server, lib, shared) |

Validated against Render's published JSON schema (`https://render.com/schema/render.yaml.json`).

## Live deployment notes
- Created on 1 Oct 2026 in the Render workspace "Vipul's workspace" with the Render API (not as a Blueprint):
  - `rishtaroast` (static site, `srv-dautod7pn0mc7395cedg`)
  - `rishtaroast-api` (web service, free plan, Singapore, `srv-dauto9jncjis738acqm0`)
- Both auto-deploy on every push to `main`.
- Because they weren't created from the Blueprint, `render.yaml`'s extra settings are **not applied** (they can be added in the dashboard):
  - static headers `X-Frame-Options`, `Referrer-Policy`, and long-cache/`no-cache` rules (Render already sends `X-Content-Type-Options: nosniff`)
  - the `/privacy` redirect (not needed: Render serves `privacy.html` for `/privacy` anyway, and the links use `/privacy.html`)
  - the API `healthCheckPath: /healthz`
  - build filters
- `PRO_TOKEN_SECRET` was generated locally and set on the API. It is not in the repo.
- Live check: `node scripts/live-check.js` (headless; makes cards against the live site, including a test with the API blocked).

## Deploy steps (reference / re-creating from the Blueprint)
1. Create a **GitHub** repo and push this one (`git remote add origin … && git push -u origin main`). Not done.
2. Render dashboard → **New → Blueprint** → pick the repo. Render reads `render.yaml` and **asks for the `sync: false` values**. You can enter the expected URLs straight away:
   - static `API_BASE_URL` = `https://rishtaroast-api.onrender.com`
   - static `SITE_URL` = `https://rishtaroast.onrender.com`
   - API `ALLOWED_ORIGINS` = `https://rishtaroast.onrender.com`
   - plus `UPI_ID`, and optionally `RAZORPAY_TIP_LINK`, `AI_API_KEY`, `RAZORPAY_KEY_ID/SECRET` (leave blank if not ready).
3. **After both services exist, check the real URLs.** Render adds a random suffix if a name is taken, e.g. `rishtaroast-api-x7k2.onrender.com`. If they differ, fix `API_BASE_URL` / `SITE_URL` on the static site and `ALLOWED_ORIGINS` on the API, then **Manual Deploy → Clear build cache & deploy** the static site, because `config.js` is written at build time. (`sync: false` values are only prompted at first creation; later edits go in each service's Environment tab.)
4. Open `https://<api>/healthz`, which should return `{"ok":true}`. Open the site, make a card, and check the footer says "Bana: AI" (if a key is set) or "Desi template engine".
5. Optional custom domain: add it to the static site, then add it to `SITE_URL` and `ALLOWED_ORIGINS` (comma-separated), redeploy, and run `npm run og` locally and commit.

## What you must provide
**Required, all free:** a GitHub account, a Render account, and your **UPI ID**.
**Optional:** an **AI API key** for an OpenAI-compatible provider (Gemini/Groq have free tiers; OpenAI gpt-4o-mini is roughly ₹0.02–0.05 per card) **with a spend cap set**; a **Razorpay** account (KYC) for a tip Payment Link and API keys for Pro (test with test-mode keys first); a custom domain; a contact email for the privacy page (currently a PLACEHOLDER).
`PRO_TOKEN_SECRET` is generated by Render automatically.

## Env var reference
- **Static site** (build-time, written into `public/config.js` by `scripts/configure-static.js`): `API_BASE_URL`, `SITE_URL`, `UPI_ID`, `UPI_PAYEE_NAME`, `RAZORPAY_TIP_LINK`, `PRO_ENABLED`, `PRO_PRICE_INR`, `PRO_VALIDITY_DAYS`. Unset values leave the file unchanged.
- **API service:** see `.env.example`: `ALLOWED_ORIGINS`, `AI_*`, cost-control vars, `PRO_*`, `RAZORPAY_KEY_ID/SECRET`, `PRO_TOKEN_SECRET`, `PRO_DEMO_UNLOCK` (forced off when `NODE_ENV=production`), `TRUST_PROXY`.
