// In-memory sliding-window rate limits + global daily AI cap.
// NOTE: in-memory state lives in this single process. On Render free the instance sleeps after ~15 min idle and
// restarts on deploys, which RESETS all counters (incl. the global daily cap). Use the AI provider's spend limit as
// the hard safety net; for durable limits plug in Render Key Value / Upstash Redis (see README).
const config = require('./config');

const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;

const aiHits = new Map(); // ip -> [timestamps]
const reqHits = new Map(); // ip -> [timestamps]
let global = { day: istDay(), count: 0 };

function istDay(now = Date.now()) {
  // Reset global counter at IST midnight
  return new Date(now + 5.5 * HOUR).toISOString().slice(0, 10);
}

function prune(map, ip, windowMs, now) {
  const arr = (map.get(ip) || []).filter((t) => now - t < windowMs);
  map.set(ip, arr);
  return arr;
}

function countSince(arr, windowMs, now) {
  return arr.filter((t) => now - t < windowMs).length;
}

/** Hard request limit (all generations). Returns {ok, retryAfterSec}. Records the hit if ok. */
function hitRequest(ip, now = Date.now()) {
  const arr = prune(reqHits, ip, HOUR, now);
  if (arr.length >= config.limits.requestsPerIpHour) {
    return { ok: false, retryAfterSec: Math.ceil((HOUR - (now - arr[0])) / 1000) };
  }
  arr.push(now);
  return { ok: true };
}

/** Can this IP use the AI right now? Does NOT record. */
function aiAllowed(ip, { pro = false } = {}, now = Date.now()) {
  if (global.day !== istDay(now)) global = { day: istDay(now), count: 0 };
  if (global.count >= config.limits.aiGlobalDaily) return { ok: false, reason: 'global_daily_cap' };
  const arr = prune(aiHits, ip, DAY, now);
  const perDay = pro ? config.limits.aiProPerIpDay : config.limits.aiPerIpDay;
  const perHour = pro ? Math.max(config.limits.aiPerIpHour * 3, 15) : config.limits.aiPerIpHour;
  if (countSince(arr, HOUR, now) >= perHour) return { ok: false, reason: 'ip_hourly_limit' };
  if (arr.length >= perDay) return { ok: false, reason: 'ip_daily_limit' };
  return { ok: true, remainingHour: perHour - countSince(arr, HOUR, now), remainingDay: perDay - arr.length };
}

function recordAi(ip, now = Date.now()) {
  if (global.day !== istDay(now)) global = { day: istDay(now), count: 0 };
  global.count++;
  prune(aiHits, ip, DAY, now).push(now);
}

function stats() {
  return { globalDay: global.day, globalAiCalls: global.count, globalCap: config.limits.aiGlobalDaily, trackedIps: aiHits.size };
}

function _reset() {
  aiHits.clear();
  reqHits.clear();
  global = { day: istDay(), count: 0 };
}

// periodic cleanup so memory doesn't grow forever
setInterval(() => {
  const now = Date.now();
  for (const ip of aiHits.keys()) if (!prune(aiHits, ip, DAY, now).length) aiHits.delete(ip);
  for (const ip of reqHits.keys()) if (!prune(reqHits, ip, HOUR, now).length) reqHits.delete(ip);
}, 10 * 60 * 1000).unref();

module.exports = { hitRequest, aiAllowed, recordAi, stats, _reset };
