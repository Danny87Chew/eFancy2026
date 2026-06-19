const db = require('./db');

function getConfig(key, fallback) {
  const row = db.prepare('SELECT value FROM system_config WHERE key = ?').get(key);
  if (!row) return fallback;
  const v = row.value;
  // Try to parse numbers
  if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
  return v;
}

function setConfig(key, value) {
  db.prepare(
    `INSERT INTO system_config (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value=excluded.value`
  ).run(key, String(value));
}

function allConfig() {
  return db.prepare('SELECT key, value FROM system_config').all();
}

module.exports = { getConfig, setConfig, allConfig };
