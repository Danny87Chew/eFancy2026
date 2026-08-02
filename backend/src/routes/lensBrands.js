const router = require('express').Router();
const db = require('../db');
const { authRequired, requireAdmin } = require('../auth');

function resolveVendorOwner(user) {
  const ownerRow = db.prepare(
    `SELECT vs.vendor_user_id, vp.merchant_name
     FROM vendor_staff vs
     LEFT JOIN vendor_profiles vp ON vp.user_id = vs.vendor_user_id
     WHERE vs.staff_mobile = ? LIMIT 1`
  ).get(user.mobile);
  if (ownerRow) {
    return { vendorUserId: ownerRow.vendor_user_id, vendorName: ownerRow.merchant_name || null };
  }
  const profile = db.prepare('SELECT merchant_name FROM vendor_profiles WHERE user_id = ?').get(user.id);
  return { vendorUserId: user.id, vendorName: profile?.merchant_name || null };
}

function canEditLensBrand(user, brand) {
  if (!user) return false;
  if (['admin', 'super_admin'].includes(user.role)) return true;
  if (user.role !== 'spectacle_lens_vendor') return false;
  const { vendorUserId, vendorName } = resolveVendorOwner(user);
  if (brand?.vendor_user_id === user.id) return true;
  if (brand?.vendor_user_id === vendorUserId) return true;
  if (vendorName && brand?.vendor_name === vendorName) return true;
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
  const { vendorUserId, vendorName } = resolveVendorOwner(req.user);
  const query = vendorName
    ? 'SELECT * FROM lens_brands WHERE active = 1 AND (vendor_user_id = ? OR vendor_name = ?) ORDER BY name'
    : 'SELECT * FROM lens_brands WHERE active = 1 AND vendor_user_id = ? ORDER BY name';
  const rows = vendorName
    ? db.prepare(query).all(vendorUserId, vendorName)
    : db.prepare(query).all(vendorUserId);
  res.json({ brands: rows });
});

router.post('/', authRequired, (req, res) => {
  const { brand, name, code, price_multiplier, base_price, promotion_price, vendor_name, vendor_office, vendor_mobile, vendor_address, active } = req.body || {};
  const effectiveName = name ?? brand ?? null;
  if (!effectiveName) return res.status(400).json({ error: 'name_required' });
  if (!['admin', 'super_admin', 'spectacle_lens_vendor'].includes(req.user.role)) {
    return res.status(403).json({ error: 'forbidden' });
  }
  const vendorUserId = req.user.role === 'spectacle_lens_vendor' ? resolveVendorOwner(req.user).vendorUserId : null;
  try {
    const info = db
      .prepare('INSERT INTO lens_brands (brand, name, code, vendor_user_id, price_multiplier, base_price, promotion_price, vendor_name, vendor_office, vendor_mobile, vendor_address, active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(brand || null, effectiveName, code || null, vendorUserId, Number(price_multiplier) || 1, Number(base_price) || 0, Number(promotion_price) || 0, vendor_name || null, vendor_office || null, vendor_mobile || null, vendor_address || null, active != null ? (active ? 1 : 0) : 1);
    res.json({ brand: db.prepare('SELECT * FROM lens_brands WHERE id = ?').get(info.lastInsertRowid) });
  } catch (err) {
    if (err && (err.code === 'SQLITE_CONSTRAINT' || String(err.message || '').toLowerCase().includes('unique'))) {
      const msg = String(err.message || '').toLowerCase();
      if (msg.includes('name') || msg.includes('lens_brands.name')) return res.status(409).json({ error: 'name_taken' });
      if (msg.includes('code') || msg.includes('idx_lens_brands_code_unique')) return res.status(409).json({ error: 'code_taken' });
      return res.status(409).json({ error: 'already_exists' });
    }
    console.error('Failed to create lens brand', err);
    res.status(500).json({ error: 'server_error' });
  }
});


router.patch('/:id', authRequired, (req, res) => {
  const { brand, name, code, price_multiplier, base_price, promotion_price, vendor_name, vendor_office, vendor_mobile, vendor_address, active } = req.body || {};
  const brandRow = db.prepare('SELECT * FROM lens_brands WHERE id = ?').get(req.params.id);
  if (!brandRow) return res.status(404).json({ error: 'not_found' });
  if (!canEditLensBrand(req.user, brandRow)) return res.status(403).json({ error: 'forbidden' });
  const effectiveName = name ?? null;
  try {
    db.prepare(
      `UPDATE lens_brands SET
         brand = COALESCE(?, brand),
         name = COALESCE(?, name),
         code = COALESCE(?, code),
         price_multiplier = COALESCE(?, price_multiplier),
         base_price = COALESCE(?, base_price),
         promotion_price = COALESCE(?, promotion_price),
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
      base_price != null ? Number(base_price) : null,
      promotion_price != null ? Number(promotion_price) : null,
      vendor_name ?? null,
      vendor_office ?? null,
      vendor_mobile ?? null,
      vendor_address ?? null,
      active != null ? (active ? 1 : 0) : null,
      req.params.id
    );
    res.json({ brand: db.prepare('SELECT * FROM lens_brands WHERE id = ?').get(req.params.id) });
  } catch (err) {
    if (err && (err.code === 'SQLITE_CONSTRAINT' || String(err.message || '').toLowerCase().includes('unique'))) {
      const msg = String(err.message || '').toLowerCase();
      if (msg.includes('name') || msg.includes('lens_brands.name')) return res.status(409).json({ error: 'name_taken' });
      if (msg.includes('code') || msg.includes('idx_lens_brands_code_unique')) return res.status(409).json({ error: 'code_taken' });
      return res.status(409).json({ error: 'already_exists' });
    }
    console.error('Failed to update lens brand', err);
    res.status(500).json({ error: 'server_error' });
  }
});

router.delete('/:id', authRequired, (req, res) => {
  const brandRow = db.prepare('SELECT * FROM lens_brands WHERE id = ?').get(req.params.id);
  if (!brandRow) return res.status(404).json({ error: 'not_found' });
  if (!canEditLensBrand(req.user, brandRow)) return res.status(403).json({ error: 'forbidden' });
  db.prepare('UPDATE lens_brands SET active = 0 WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
