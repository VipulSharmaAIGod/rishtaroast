// Provider-agnostic AI client. Works with ANY OpenAI-compatible /chat/completions endpoint:
// OpenAI, Google Gemini (OpenAI-compat endpoint), Groq, OpenRouter, Together, DeepSeek, local Ollama, etc.
// Configure with AI_BASE_URL + AI_MODEL + AI_API_KEY. No SDK dependency (plain fetch).
const config = require('./config');
const { WORK, VIBE } = require('./templates');

const SYSTEM_PROMPT = `You write FUNNY, PLAYFUL Hinglish (Hindi in Roman script mixed with English) lines for a fake "shaadi biodata" roast card that Indians share on WhatsApp/Instagram.
Style: desi family humour, rishta-aunty energy, "Mummy ke hisaab se vs asli sach", Bollywood/cricket/office/hostel references. Short punchy lines (max ~70 characters each).
HARD RULES (never break):
- Gender-neutral: refer to the person with respectful plural Hindi ("karte hain", "inka", "inhe"). Never "ladka/ladki".
- NO religion, caste, gotra, community, region/state stereotypes, politics or politicians.
- NO body shaming: never mention looks, skin colour, fairness, height, weight, hair, disability.
- NO dowry, NO sexual content, NO profanity/gaali, NO insults about family members, NO real celebrities.
- Roast habits, job clichés and harmless quirks only. Keep it affectionate; the closer must be a genuine compliment.
Return ONLY a JSON object with exactly these keys:
{"occupationTold": "what mummy tells relatives about their job",
 "occupationSach": "the funny reality",
 "salaryTold": "salary as told to rishtedaar",
 "salarySach": "funny real salary situation",
 "hobbies": "one funny hobby line",
 "khoobiyan": ["strength 1", "strength 2"],
 "redFlags": ["playful red flag 1 (use their habit)", "playful red flag 2"],
 "mummyVerdict": "one-line quote from Mummy",
 "score": number between 6.0 and 9.9,
 "idealMatch": "funny ideal partner line",
 "tagline": "a '<something> follows my brother' style catchphrase with 1 emoji",
 "closer": "one genuine compliment line"}`;

function buildUserPrompt(input) {
  const work = (WORK[input.work] || WORK.other).label;
  const vibe = (VIBE[input.vibe] || VIBE.sanskaari).label;
  return `Name: ${input.name}\nCity: ${input.city || 'not given'}\nWork: ${work}${input.workOther ? ` (${input.workOther})` : ''}\nVibe: ${vibe}\nBuri aadat (habit): ${input.habit || 'not given'}\nVariation #${input.variant || 0}. Make it specific to these inputs.`;
}

function extractJson(text) {
  if (!text) return null;
  try { return JSON.parse(text); } catch (_) { /* fall through */ }
  const m = String(text).match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch (_) { return null; }
}

const clip = (s, n) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, n);

/** Validate & normalise AI output into the card shape. Returns null if unusable. */
function sanitize(obj) {
  if (!obj || typeof obj !== 'object') return null;
  const str = ['occupationTold', 'occupationSach', 'salaryTold', 'salarySach', 'hobbies', 'mummyVerdict', 'idealMatch', 'tagline', 'closer'];
  const out = {};
  for (const k of str) {
    if (typeof obj[k] !== 'string' || !obj[k].trim()) return null;
    out[k] = clip(obj[k], 110);
  }
  for (const k of ['khoobiyan', 'redFlags']) {
    if (!Array.isArray(obj[k]) || obj[k].length < 1) return null;
    out[k] = obj[k].slice(0, 2).map((x) => clip(x, 110)).filter(Boolean);
    if (!out[k].length) return null;
  }
  let score = Number(obj.score);
  if (!isFinite(score)) score = 7.5;
  out.score = Math.round(Math.min(9.9, Math.max(6.0, score)) * 10) / 10;
  return out;
}

async function generateWithAI(input) {
  if (!config.ai.enabled || !config.ai.apiKey) throw new Error('ai_not_configured');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.ai.timeoutMs);
  try {
    const body = {
      model: config.ai.model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: buildUserPrompt(input) },
      ],
      max_tokens: config.ai.maxTokens,
      temperature: config.ai.temperature,
    };
    if (config.ai.jsonMode) body.response_format = { type: 'json_object' };
    const res = await fetch(`${config.ai.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.ai.apiKey}` },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`ai_http_${res.status}`);
    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content;
    const parsed = sanitize(extractJson(text));
    if (!parsed) throw new Error('ai_bad_output');
    return { card: parsed, usage: data.usage || null };
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { generateWithAI, sanitize, extractJson, SYSTEM_PROMPT, buildUserPrompt };
