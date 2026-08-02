const router = require('express').Router();
const db = require('../db');
const { authRequired, requireAdmin } = require('../auth');

function loadFrame(id) {
  const frame = db.prepare('SELECT * FROM spectacle_frames WHERE id = ?').get(id);
  if (!frame) return null;
  const images = db
    .prepare('SELECT id, url, sort_order FROM frame_images WHERE frame_id = ? ORDER BY sort_order, id')
    .all(id);
  frame.images = images;
  return frame;
}

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

function canEditFrame(user, frame) {
  if (!user) return false;
  if (['admin', 'super_admin'].includes(user.role)) return true;
  if (user.role !== 'spectacle_frame_vendor') return false;
  const { vendorUserId, vendorName } = resolveVendorOwner(user);
  if (frame?.vendor_user_id === user.id) return true;
  if (frame?.vendor_user_id === vendorUserId) return true;
  if (vendorName && frame?.vendor === vendorName) return true;
  return false;
}

// Public list (active only)
router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM spectacle_frames WHERE active = 1 ORDER BY id').all();
  for (const r of rows) {
    r.images = db
      .prepare('SELECT id, url, sort_order FROM frame_images WHERE frame_id = ? ORDER BY sort_order, id')
      .all(r.id);
  }
  res.json({ frames: rows });
});

router.get('/my', authRequired, (req, res) => {
  if (req.user.role !== 'spectacle_frame_vendor' && !['admin', 'super_admin'].includes(req.user.role)) {
    return res.status(403).json({ error: 'forbidden' });
  }
  const { vendorUserId, vendorName } = resolveVendorOwner(req.user);
  const query = vendorName
    ? 'SELECT * FROM spectacle_frames WHERE active = 1 AND (vendor_user_id = ? OR vendor = ?) ORDER BY id'
    : 'SELECT * FROM spectacle_frames WHERE active = 1 AND vendor_user_id = ? ORDER BY id';
  const rows = vendorName
    ? db.prepare(query).all(vendorUserId, vendorName)
    : db.prepare(query).all(vendorUserId);
  for (const r of rows) {
    r.images = db
      .prepare('SELECT id, url, sort_order FROM frame_images WHERE frame_id = ? ORDER BY sort_order, id')
      .all(r.id);
  }
  res.json({ frames: rows });
});

router.get('/:id', (req, res) => {
  const f = loadFrame(req.params.id);
  if (!f) return res.status(404).json({ error: 'not_found' });
  res.json({ frame: f });
});

// Admin CRUD
router.post('/', authRequired, (req, res) => {
  const { name, code, brand, vendor, base_price, promotion_price, images, vendor_office, vendor_mobile, vendor_address, active } = req.body || {};
  if (!name) return res.status(400).json({ error: 'name_required' });
  if (!['admin', 'super_admin', 'spectacle_frame_vendor'].includes(req.user.role)) {
    return res.status(403).json({ error: 'forbidden' });
  }
  const vendorUserId = req.user.role === 'spectacle_frame_vendor' ? resolveVendorOwner(req.user).vendorUserId : null;
  try {
    const info = db
      .prepare('INSERT INTO spectacle_frames (name, code, brand, vendor_user_id, vendor, base_price, promotion_price, vendor_office, vendor_mobile, vendor_address, active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(name, code || null, brand || null, vendorUserId, vendor || null, Number(base_price) || 0, Number(promotion_price) || 0, vendor_office || null, vendor_mobile || null, vendor_address || null, active != null ? (active ? 1 : 0) : 1);
    const id = info.lastInsertRowid;
    if (Array.isArray(images)) {
      const stmt = db.prepare('INSERT INTO frame_images (frame_id, url, sort_order) VALUES (?, ?, ?)');
      images.forEach((url, idx) => stmt.run(id, url, idx));
    }
    res.json({ frame: loadFrame(id) });
  } catch (err) {
    if (err && (err.code === 'SQLITE_CONSTRAINT' || String(err.message || '').toLowerCase().includes('unique'))) {
      const msg = String(err.message || '').toLowerCase();
      if (msg.includes('name') || msg.includes('idx_spectacle_frames_name_unique')) return res.status(409).json({ error: 'name_taken' });
      if (msg.includes('code') || msg.includes('idx_spectacle_frames_code_unique')) return res.status(409).json({ error: 'code_taken' });
      return res.status(409).json({ error: 'already_exists' });
    }
    console.error('Failed to create frame', err);
    res.status(500).json({ error: 'server_error' });
  }
});


router.patch('/:id', authRequired, (req, res) => {
  const { name, code, brand, vendor, base_price, promotion_price, active, images, vendor_office, vendor_mobile, vendor_address } = req.body || {};
  const frame = loadFrame(req.params.id);
  if (!frame) return res.status(404).json({ error: 'not_found' });
  if (!canEditFrame(req.user, frame)) return res.status(403).json({ error: 'forbidden' });
  try {
    db.prepare(
      `UPDATE spectacle_frames SET
         name = COALESCE(?, name),
         code = COALESCE(?, code),
         brand = COALESCE(?, brand),
         vendor = COALESCE(?, vendor),
         base_price = COALESCE(?, base_price),
         promotion_price = COALESCE(?, promotion_price),
         vendor_office = COALESCE(?, vendor_office),
         vendor_mobile = COALESCE(?, vendor_mobile),
         vendor_address = COALESCE(?, vendor_address),
         active = COALESCE(?, active)
       WHERE id = ?`
    ).run(
      name ?? null,
      code ?? null,
      brand ?? null,
      vendor ?? null,
      base_price != null ? Number(base_price) : null,
      promotion_price != null ? Number(promotion_price) : null,
      vendor_office ?? null,
      vendor_mobile ?? null,
      vendor_address ?? null,
      active != null ? (active ? 1 : 0) : null,
      req.params.id
    );
  } catch (err) {
    if (err && (err.code === 'SQLITE_CONSTRAINT' || String(err.message || '').toLowerCase().includes('unique'))) {
      const msg = String(err.message || '').toLowerCase();
      if (msg.includes('name') || msg.includes('idx_spectacle_frames_name_unique')) return res.status(409).json({ error: 'name_taken' });
      if (msg.includes('code') || msg.includes('idx_spectacle_frames_code_unique')) return res.status(409).json({ error: 'code_taken' });
      return res.status(409).json({ error: 'already_exists' });
    }
    console.error('Failed to update frame', err);
    return res.status(500).json({ error: 'server_error' });
  }
  if (Array.isArray(images)) {
    db.prepare('DELETE FROM frame_images WHERE frame_id = ?').run(req.params.id);
    const stmt = db.prepare('INSERT INTO frame_images (frame_id, url, sort_order) VALUES (?, ?, ?)');
    images.forEach((url, idx) => stmt.run(req.params.id, url, idx));
  }
  res.json({ frame: loadFrame(req.params.id) });
});

router.delete('/:id', authRequired, (req, res) => {
  const frame = loadFrame(req.params.id);
  if (!frame) return res.status(404).json({ error: 'not_found' });
  if (!canEditFrame(req.user, frame)) return res.status(403).json({ error: 'forbidden' });
  db.prepare('UPDATE spectacle_frames SET active = 0 WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
