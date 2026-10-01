// Tiny TTL + LRU cache for identical inputs (so repeat/viral identical inputs never cost an AI call).
const crypto = require('crypto');
const config = require('./config');

const store = new Map();

function key(obj) {
  return crypto.createHash('sha256').update(JSON.stringify(obj)).digest('hex');
}

function get(k) {
  const e = store.get(k);
  if (!e) return null;
  if (Date.now() > e.exp) {
    store.delete(k);
    return null;
  }
  store.delete(k); // refresh LRU position
  store.set(k, e);
  return e.val;
}

function set(k, val) {
  store.set(k, { val, exp: Date.now() + config.limits.cacheTtlMs });
  while (store.size > config.limits.cacheMaxEntries) store.delete(store.keys().next().value);
}

module.exports = { key, get, set, size: () => store.size, _clear: () => store.clear() };
