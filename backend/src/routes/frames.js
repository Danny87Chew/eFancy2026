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

router.get('/:id', (req, res) => {
  const f = loadFrame(req.params.id);
  if (!f) return res.status(404).json({ error: 'not_found' });
  res.json({ frame: f });
});

// Admin CRUD
router.post('/', authRequired, requireAdmin, (req, res) => {
  const { name, code, brand, vendor, base_price, promotion_price, images, vendor_office, vendor_mobile, vendor_address, active } = req.body || {};
  if (!name) return res.status(400).json({ error: 'name_required' });
  const info = db
    .prepare('INSERT INTO spectacle_frames (name, code, brand, vendor, base_price, promotion_price, vendor_office, vendor_mobile, vendor_address, active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(name, code || null, brand || null, vendor || null, Number(base_price) || 0, Number(promotion_price) || 0, vendor_office || null, vendor_mobile || null, vendor_address || null, active != null ? (active ? 1 : 0) : 1);
  const id = info.lastInsertRowid;
  if (Array.isArray(images)) {
    const stmt = db.prepare('INSERT INTO frame_images (frame_id, url, sort_order) VALUES (?, ?, ?)');
    images.forEach((url, idx) => stmt.run(id, url, idx));
  }
  res.json({ frame: loadFrame(id) });
});

router.patch('/:id', authRequired, requireAdmin, (req, res) => {
  const { name, code, brand, vendor, base_price, promotion_price, active, images, vendor_office, vendor_mobile, vendor_address } = req.body || {};
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
  if (Array.isArray(images)) {
    db.prepare('DELETE FROM frame_images WHERE frame_id = ?').run(req.params.id);
    const stmt = db.prepare('INSERT INTO frame_images (frame_id, url, sort_order) VALUES (?, ?, ?)');
    images.forEach((url, idx) => stmt.run(req.params.id, url, idx));
  }
  res.json({ frame: loadFrame(req.params.id) });
});

router.delete('/:id', authRequired, requireAdmin, (req, res) => {
  db.prepare('UPDATE spectacle_frames SET active = 0 WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
