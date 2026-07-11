const router = require('express').Router();
const db = require('../db');
const { authRequired, requireAdmin } = require('../auth');

function canEditLensBrand(user, brand) {
  if (!user) return false;
  if (['admin', 'super_admin'].includes(user.role)) return true;
  if (user.role === 'spectacle_lens_vendor' && brand?.vendor_user_id === user.id) return true;
  return false;
}

router.get('/', (req, res) => {
  const includeInactive = ['1', 'true', 'yes', 'on'].includes(String(req.query.include_inactive || '').toLowerCase());
  const query = includeInactive
    ? 'SELECT * FROM lens_brands ORDER BY active DESC, name'
    : 'SELECT * FROM lens_brands WHERE active = 1 ORDER BY name';
  res.json({
    brands: db.prepare(query).all(),
  });
});

router.get('/my', authRequired, (req, res) => {
  if (req.user.role !== 'spectacle_lens_vendor' && !['admin', 'super_admin'].includes(req.user.role)) {
    return res.status(403).json({ error: 'forbidden' });
  }
  const rows = db.prepare('SELECT * FROM lens_brands WHERE active = 1 AND vendor_user_id = ? ORDER BY name').all(req.user.id);
  res.json({ brands: rows });
});

router.post('/', authRequired, (req, res) => {
  const { brand, name, code, price_multiplier, vendor_name, vendor_office, vendor_mobile, vendor_address, active } = req.body || {};
  const effectiveName = name ?? brand ?? null;
  if (!effectiveName) return res.status(400).json({ error: 'name_required' });
  if (!['admin', 'super_admin', 'spectacle_lens_vendor'].includes(req.user.role)) {
    return res.status(403).json({ error: 'forbidden' });
  }
  const vendorUserId = req.user.role === 'spectacle_lens_vendor' ? req.user.id : null;
  const info = db
    .prepare('INSERT INTO lens_brands (brand, name, code, vendor_user_id, price_multiplier, vendor_name, vendor_office, vendor_mobile, vendor_address, active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(brand || null, effectiveName, code || null, vendorUserId, Number(price_multiplier) || 1, vendor_name || null, vendor_office || null, vendor_mobile || null, vendor_address || null, active != null ? (active ? 1 : 0) : 1);
  res.json({
    brand: db.prepare('SELECT * FROM lens_brands WHERE id = ?').get(info.lastInsertRowid),
  });
});

router.patch('/:id', authRequired, (req, res) => {
  const { brand, name, code, price_multiplier, vendor_name, vendor_office, vendor_mobile, vendor_address, active } = req.body || {};
  const brandRow = db.prepare('SELECT * FROM lens_brands WHERE id = ?').get(req.params.id);
  if (!brandRow) return res.status(404).json({ error: 'not_found' });
  if (!canEditLensBrand(req.user, brandRow)) return res.status(403).json({ error: 'forbidden' });
  const effectiveName = name ?? null;
  db.prepare(
    `UPDATE lens_brands SET
       brand = COALESCE(?, brand),
       name = COALESCE(?, name),
       code = COALESCE(?, code),
       price_multiplier = COALESCE(?, price_multiplier),
       vendor_name = COALESCE(?, vendor_name),
       vendor_office = COALESCE(?, vendor_office),
       vendor_mobile = COALESCE(?, vendor_mobile),
       vendor_address = COALESCE(?, vendor_address),
       active = COALESCE(?, active)
     WHERE id = ?`
  ).run(
    brand ?? null,
    effectiveName,
    code ?? null,
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

router.delete('/:id', authRequired, (req, res) => {
  const brandRow = db.prepare('SELECT * FROM lens_brands WHERE id = ?').get(req.params.id);
  if (!brandRow) return res.status(404).json({ error: 'not_found' });
  if (!canEditLensBrand(req.user, brandRow)) return res.status(403).json({ error: 'forbidden' });
  db.prepare('UPDATE lens_brands SET active = 0 WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
