const router = require('express').Router();
const db = require('../db');
const { authRequired, requireAdmin } = require('../auth');

// GET /api/shops?q=postcode|road|town|district|mrt
router.get('/', (req, res) => {
  const q = (req.query.q || '').trim();
  let rows;
  if (q) {
    const like = `%${q}%`;
    rows = db
      .prepare(
        `SELECT * FROM partner_shops WHERE active = 1 AND (
           postcode LIKE ? OR road LIKE ? OR town LIKE ? OR district LIKE ? OR mrt LIKE ? OR name LIKE ?
         ) ORDER BY name`
      )
      .all(like, like, like, like, like, like);
  } else {
    rows = db.prepare('SELECT * FROM partner_shops WHERE active = 1 ORDER BY name').all();
  }
  res.json({ shops: rows });
});

router.post('/', authRequired, requireAdmin, (req, res) => {
  const { name, address, postcode, road, town, district, mrt, opening_time, contact } = req.body || {};
  if (!name) return res.status(400).json({ error: 'name_required' });
  const info = db
    .prepare(
      `INSERT INTO partner_shops (name, address, postcode, road, town, district, mrt, opening_time, contact)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(name, address, postcode, road, town, district, mrt, opening_time, contact);
  res.json({ shop: db.prepare('SELECT * FROM partner_shops WHERE id = ?').get(info.lastInsertRowid) });
});

router.patch('/:id', authRequired, requireAdmin, (req, res) => {
  const fields = ['name', 'address', 'postcode', 'road', 'town', 'district', 'mrt', 'opening_time', 'contact', 'active'];
  const set = [];
  const vals = [];
  for (const f of fields) {
    if (req.body[f] !== undefined) {
      set.push(`${f} = ?`);
      vals.push(f === 'active' ? (req.body[f] ? 1 : 0) : req.body[f]);
    }
  }
  if (set.length) {
    vals.push(req.params.id);
    db.prepare(`UPDATE partner_shops SET ${set.join(', ')} WHERE id = ?`).run(...vals);
  }
  res.json({ shop: db.prepare('SELECT * FROM partner_shops WHERE id = ?').get(req.params.id) });
});

module.exports = router;
