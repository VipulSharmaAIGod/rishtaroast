// Orchestrates: validate -> filter -> cache -> rate limits/caps -> AI -> output filter -> template fallback.
const config = require('./config');
const filter = require('./filter');
const cache = require('./cache');
const limits = require('./rateLimit');
const { generateWithAI } = require('./ai');
const { generateFromTemplates, scoreLine, WORK, VIBE } = require('./templates');

const clean = (s, n) => String(s || '').replace(/[<>{}\[\]`\\]/g, '').replace(/\s+/g, ' ').trim().slice(0, n);

function parseInput(body = {}) {
  const input = {
    name: clean(body.name, 24),
    city: clean(body.city, 24),
    work: WORK[body.work] ? body.work : 'other',
    workOther: body.work === 'other' ? clean(body.workOther, 30) : '',
    vibe: VIBE[body.vibe] ? body.vibe : 'sanskaari',
    habit: clean(body.habit, 40),
    variant: Math.max(0, Math.min(50, parseInt(body.variant, 10) || 0)),
  };
  if (input.name.length < 2) return { error: 'Naam toh daalo yaar (kam se kam 2 letters) 🙂' };
  const nameCheck = filter.check(input.name, { categories: filter.NAME_CATEGORIES });
  const restCheck = filter.checkAll([input.city, input.workOther, input.habit]);
  if (!nameCheck.ok || !restCheck.ok) {
    return { error: 'Arre arre! Thoda family-friendly rakho 🙏 Religion, caste, looks ya gaali wali cheezein allowed nahi hain.', blocked: true };
  }
  return { input };
}

function outputSafe(card, input) {
  const allow = [input.name, input.city];
  const texts = [card.occupationTold, card.occupationSach, card.salaryTold, card.salarySach, card.hobbies, card.mummyVerdict, card.idealMatch, card.tagline, card.closer, ...card.khoobiyan, ...card.redFlags];
  return texts.every((t) => filter.check(t, { allow }).ok);
}

async function generate(input, { ip, pro = false }) {
  const meta = { source: 'template', reason: null, cached: false };
  const cacheKey = cache.key({ ...input, name: input.name.toLowerCase(), city: input.city.toLowerCase(), habit: input.habit.toLowerCase() });

  const cached = cache.get(cacheKey);
  if (cached) return { card: cached, meta: { ...meta, source: 'ai', cached: true } };

  let card = null;
  if (!config.ai.enabled || !config.ai.apiKey) {
    meta.reason = 'no_api_key';
  } else {
    const allowed = limits.aiAllowed(ip, { pro });
    if (!allowed.ok) {
      meta.reason = allowed.reason;
    } else {
      limits.recordAi(ip); // count the attempt (even failures cost money)
      try {
        const { card: aiCard } = await generateWithAI(input);
        if (outputSafe(aiCard, input)) {
          card = aiCard;
          meta.source = 'ai';
          cache.set(cacheKey, card);
        } else {
          meta.reason = 'ai_output_filtered';
        }
      } catch (e) {
        meta.reason = e.name === 'AbortError' ? 'ai_timeout' : e.message;
      }
    }
  }

  if (!card) card = generateFromTemplates(input, input.variant);
  card.scoreLine = card.scoreLine || scoreLine(card.score);
  return { card, meta };
}

module.exports = { parseInput, generate };
