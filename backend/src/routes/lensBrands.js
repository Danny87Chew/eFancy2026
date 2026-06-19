const router = require('express').Router();
const db = require('../db');
const { authRequired, requireAdmin } = require('../auth');

router.get('/', (req, res) => {
  res.json({
    brands: db.prepare('SELECT * FROM lens_brands WHERE active = 1 ORDER BY name').all(),
  });
});

router.post('/', authRequired, requireAdmin, (req, res) => {
  const { name, price_multiplier, vendor_name, vendor_office, vendor_mobile, vendor_address, active } = req.body || {};
  if (!name) return res.status(400).json({ error: 'name_required' });
  const info = db
    .prepare('INSERT INTO lens_brands (name, price_multiplier, vendor_name, vendor_office, vendor_mobile, vendor_address, active) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(name, Number(price_multiplier) || 1, vendor_name || null, vendor_office || null, vendor_mobile || null, vendor_address || null, active != null ? (active ? 1 : 0) : 1);
  res.json({
    brand: db.prepare('SELECT * FROM lens_brands WHERE id = ?').get(info.lastInsertRowid),
  });
});

router.patch('/:id', authRequired, requireAdmin, (req, res) => {
  const { name, price_multiplier, vendor_name, vendor_office, vendor_mobile, vendor_address, active } = req.body || {};
  db.prepare(
    `UPDATE lens_brands SET
       name = COALESCE(?, name),
       price_multiplier = COALESCE(?, price_multiplier),
       vendor_name = COALESCE(?, vendor_name),
       vendor_office = COALESCE(?, vendor_office),
       vendor_mobile = COALESCE(?, vendor_mobile),
       vendor_address = COALESCE(?, vendor_address),
       active = COALESCE(?, active)
     WHERE id = ?`
  ).run(
    name ?? null,
    price_multiplier != null ? Number(price_multiplier) : null,
    vendor_name ?? null,
    vendor_office ?? null,
    vendor_mobile ?? null,
    vendor_address ?? null,
    active != null ? (active ? 1 : 0) : null,
    req.params.id
  );
  res.json({ brand: db.prepare('SELECT * FROM lens_brands WHERE id = ?').get(req.params.id) });
});

router.delete('/:id', authRequired, requireAdmin, (req, res) => {
  db.prepare('UPDATE lens_brands SET active = 0 WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
