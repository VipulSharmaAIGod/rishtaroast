// Basic content filter: keeps the tool playful, not hateful.
// Blocks religion, caste, politics, gender/sexuality slurs, body-shaming, colourism, dowry and profanity.
// Deliberately conservative: a false positive just asks the user to rephrase.
// SHARED FILE: used by the browser (client-side checks) AND the API server (lib/filter.js re-exports it).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.RRFilter = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const TERMS = {
    religion: ['hindu', 'muslim', 'musalman', 'mussalman', 'islam', 'sikh', 'sardarji', 'christian', 'isai', 'buddhist', 'parsi', 'mandir', 'masjid', 'church', 'gurudwara', 'allah', 'jihad', 'jihadi', 'kafir', 'mulla', 'mullah', 'katua', 'sanghi', 'bhakt', 'andhbhakt', 'hindutva', 'quran', 'bible', 'namaz', 'maulvi', 'religion', 'dharm', 'dharma', 'mazhab', 'conversion', 'love jihad'],
    caste: ['caste', 'jaat', 'jaatiwad', 'jativad', 'jaatpaat', 'dalit', 'brahmin', 'brahman', 'baniya', 'bania', 'kshatriya', 'shudra', 'chamar', 'bhangi', 'harijan', 'obc', 'sc st', 'reservation', 'gotra', 'upper caste', 'lower caste', 'savarna', 'neech'],
    politics: ['modi', 'rahul gandhi', 'gandhi parivar', 'kejriwal', 'bjp', 'congress', 'aap party', 'pappu', 'feku', 'rss', 'khalistan', 'pakistani', 'paki', 'chinki', 'bihari', 'madrasi', 'bangladeshi', 'rohingya', 'terrorist', 'atankwadi'],
    gender: ['chakka', 'hijra', 'hijda', 'meetha', 'gay', 'lesbian', 'homo', 'faggot', 'tranny', 'chhakka', 'aurat ki', 'ladki jaisa', 'ladkiyon jaisa', 'womaniser', 'feminazi', 'kitchen mein', 'chudail'],
    body: ['mota', 'moti', 'motu', 'mote', 'motapa', 'kaale', 'gore', 'takle', 'ganje', 'naate', 'patle', 'thulla', 'thulli', 'fat', 'fatso', 'ugly', 'kaala', 'kaali', 'kalu', 'kallu', 'gora', 'gori', 'fair', 'fairness', 'complexion', 'saanwla', 'saawla', 'takla', 'takli', 'ganja', 'ganji', 'height', 'weight', 'naata', 'naati', 'tingu', 'bauna', 'patla', 'patli', 'haddi', 'pimple', 'dark skin', 'chashmish', 'bhaingi', 'langda', 'andha', 'behra', 'pagal khana', 'retard', 'disabled', 'handicap'],
    dowry: ['dahej', 'dowry', 'daaj'],
    profanity: ['fuck', 'fck', 'fuk', 'shit', 'bitch', 'slut', 'whore', 'bastard', 'asshole', 'dick', 'pussy', 'cunt', 'sex', 'sexy', 'nude', 'porn', 'rape', 'randi', 'raand', 'chutiya', 'chutia', 'chootiya', 'madarchod', 'mc', 'bc', 'behenchod', 'bhenchod', 'bhosdi', 'bhosda', 'bhosdike', 'gaand', 'gand', 'gandu', 'lund', 'loda', 'lauda', 'lodu', 'lavde', 'chod', 'chodu', 'harami', 'haramkhor', 'kutta', 'kutti', 'kamina', 'kamini', 'suar', 'jhaant', 'tatti', 'saala', 'saali', 'kill', 'suicide', 'marr ja', 'mar ja', 'drugs', 'nasha'],
  };

  const LEET = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', '$': 's', '!': 'i' };

  function normalize(text) {
    return String(text || '')
      .toLowerCase()
      .replace(/[013457@$!]/g, (c) => LEET[c] || c)
      .replace(/[^a-z\u0900-\u097f\s]/g, ' ')
      .replace(/(.)\1{2,}/g, '$1$1') // "chuuuutiya" -> "chuutiya"
      .replace(/\s+/g, ' ')
      .trim();
  }

  const PATTERNS = Object.entries(TERMS).flatMap(([category, words]) =>
    words.map((w) => ({ category, word: w, re: new RegExp(`(^|\\s)${w.replace(/\s+/g, '\\s*')}(s|es)?(\\s|$)`) }))
  );

  // Names/surnames often overlap with community words (e.g. "Jain", "Singh"), so for the name field
  // we only apply the abuse-type categories.
  const NAME_CATEGORIES = new Set(['gender', 'body', 'dowry', 'profanity']);

  function check(text, { allow = [], categories = null } = {}) {
    let n = normalize(text);
    // strip allowed tokens (e.g. the user's own name echoed back in AI output)
    for (const a of allow) {
      for (const tok of normalize(a).split(' ').filter((t) => t.length > 1)) {
        n = n.replace(new RegExp(`(^|\\s)${tok}(\\s|$)`, 'g'), ' ');
      }
    }
    n = n.replace(/\s+/g, ' ').trim();
    const squashed = n.replace(/\s/g, '');
    for (const p of PATTERNS) {
      if (categories && !categories.has(p.category)) continue;
      if (p.re.test(n)) return { ok: false, category: p.category, word: p.word };
      // catch spaced-out evasion like "c h u t i y a" for longer words only
      if (p.word.length >= 6 && !p.word.includes(' ') && squashed.includes(p.word) && n.split(' ').every((t) => t.length <= 2)) {
        return { ok: false, category: p.category, word: p.word };
      }
    }
    // no links / phone numbers / handles (prevents spam & doxxing on cards)
    if (/(https?:\/\/|www\.|[a-z0-9-]{2,}\.(com|in|net|org|xyz|io|co|me|app)\b)/i.test(text)) return { ok: false, category: 'link' };
    if (/\d{7,}/.test(String(text).replace(/[\s-]/g, ''))) return { ok: false, category: 'phone' };
    return { ok: true };
  }

  function checkAll(values) {
    for (const v of values) {
      const r = check(v);
      if (!r.ok) return r;
    }
    return { ok: true };
  }

  return { check, checkAll, normalize, NAME_CATEGORIES };
});
