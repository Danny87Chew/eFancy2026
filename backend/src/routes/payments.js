const router = require('express').Router();
const db = require('../db');
const { authRequired } = require('../auth');

// POST /api/payments/:id/confirm
// Marks a pending payment as succeeded (used for manual-confirmation in dev/demo)
router.post('/:id/confirm', authRequired, (req, res) => {
  const p = db.prepare('SELECT * FROM payments WHERE id = ?').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'not_found' });
  const o = db.prepare('SELECT * FROM orders WHERE id = ?').get(p.order_id);
  if (!o) return res.status(404).json({ error: 'order_not_found' });
  // only order owner or admin can confirm
  if (o.user_id !== req.user.id && !['admin', 'super_admin'].includes(req.user.role))
    return res.status(403).json({ error: 'forbidden' });

  if (p.status === 'succeeded') return res.json({ ok: true, order: db.prepare('SELECT * FROM orders WHERE id = ?').get(o.id) });

  db.prepare("UPDATE payments SET status = 'succeeded' WHERE id = ?").run(p.id);
  const paidStatus = o.module === 'checkup' ? 'CheckupPaid' : 'OrderPaid';
  db.prepare(`UPDATE orders SET status = ?, paid_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`).run(paidStatus, o.id);
  res.json({ ok: true, order: db.prepare('SELECT * FROM orders WHERE id = ?').get(o.id) });
});

module.exports = router;
