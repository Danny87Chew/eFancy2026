const express = require('express');
const router = express.Router();
const db = require('../db');
const { authRequired } = require('../auth');

const enrichGoodsWithImages = (rows) => rows.map((row) => ({
  ...row,
  images: db.prepare('SELECT url FROM goods_images WHERE good_id = ? ORDER BY sort_order, id').all(row.id).map((img) => img.url)
}));

// GET /api/goods?kind=fresh_preorder&category=...
router.get('/', authRequired, (req, res) => {
  const { kind, category, includeInactive } = req.query || {};
  const where = [];
  const params = [];

  if (includeInactive !== '1') {
    where.push('active = 1');
  }

  if (kind) {
    where.push('kind = ?');
    params.push(String(kind).trim());
  }

  if (category) {
    where.push('category = ?');
    params.push(String(category).trim());
  }

  const rows = db.prepare(`SELECT * FROM goods ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY id DESC`).all(...params);
  res.json({ goods: enrichGoodsWithImages(rows) });
});

module.exports = router;
