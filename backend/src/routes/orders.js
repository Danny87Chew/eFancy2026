const router = require('express').Router();
const { nanoid } = require('nanoid');
const db = require('../db');
const { authRequired, requireAdmin } = require('../auth');
const { getConfig } = require('../configStore');
const { canTransition } = require('../orderStates');

function loadOrderComments(orderId) {
  return db.prepare(`
    SELECT c.*, u.nickname AS author_nickname, u.real_name, u.mobile, u.role AS author_role
    FROM order_comments c
    LEFT JOIN users u ON u.id = c.user_id
    WHERE c.order_id = ?
    ORDER BY c.created_at ASC, c.id ASC
  `).all(orderId);
}

function loadOrder(id) {
  const o = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
  if (!o) return null;
  o.meta = o.meta_json ? JSON.parse(o.meta_json) : null;
  o.items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(id);
  o.payments = db.prepare('SELECT * FROM payments WHERE order_id = ?').all(id);
  o.comments = loadOrderComments(id);
  return o;
}

function isModifiable(order) {
  if (order.status !== 'CheckupPaid' && order.status !== 'OrderPaid') return false;
  const win = Number(getConfig('order_modify_window_hours', 12));
  const paid = new Date(order.paid_at).getTime();
  return Date.now() - paid < win * 3600 * 1000;
}

// GET /api/orders/mine
router.get('/mine', authRequired, (req, res) => {
  const rows = db.prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY id DESC').all(req.user.id);
  for (const r of rows) {
    r.meta = r.meta_json ? JSON.parse(r.meta_json) : null;
    r.comments = loadOrderComments(r.id);
  }
  res.json({ orders: rows });
});

// POST /api/orders/:id/comments
router.post('/:id/comments', authRequired, (req, res) => {
  const o = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!o) return res.status(404).json({ error: 'not_found' });
  const isOwner = o.user_id === req.user.id;
  const isAdmin = ['admin', 'super_admin'].includes(req.user.role);
  if (!isOwner && !isAdmin) return res.status(403).json({ error: 'forbidden' });

  const content = String(req.body?.content || '').trim();
  if (!content) return res.status(400).json({ error: 'content_required' });

  const parentIdRaw = req.body?.parent_id;
  let parentId = null;
  if (parentIdRaw != null && parentIdRaw !== '') {
    parentId = Number(parentIdRaw);
    if (!Number.isInteger(parentId) || parentId <= 0) return res.status(400).json({ error: 'invalid_parent_id' });
    const parent = db.prepare('SELECT * FROM order_comments WHERE id = ? AND order_id = ?').get(parentId, o.id);
    if (!parent) return res.status(400).json({ error: 'invalid_parent_comment' });
  }

  const info = db.prepare(`
    INSERT INTO order_comments (order_id, user_id, parent_id, content)
    VALUES (?, ?, ?, ?)
  `).run(o.id, req.user.id, parentId, content);

  const comment = db.prepare(`
    SELECT c.*, u.nickname AS author_nickname, u.real_name, u.mobile, u.role AS author_role
    FROM order_comments c
    LEFT JOIN users u ON u.id = c.user_id
    WHERE c.id = ?
  `).get(info.lastInsertRowid);

  res.json({ ok: true, comment, comments: loadOrderComments(o.id) });
});

// GET /api/orders/:id
router.get('/:id', authRequired, (req, res) => {
  const o = loadOrder(req.params.id);
  if (!o) return res.status(404).json({ error: 'not_found' });
  if (o.user_id !== req.user.id && !['admin', 'super_admin'].includes(req.user.role))
    return res.status(403).json({ error: 'forbidden' });
  o.modifiable = isModifiable(o);
  res.json({ order: o });
});

// POST /api/orders/checkup  { shop_id }
// Creates Pending checkup order with QR token
router.post('/checkup', authRequired, (req, res) => {
  const { shop_id } = req.body || {};
  if (!shop_id) return res.status(400).json({ error: 'shop_required' });
  const shop = db.prepare('SELECT * FROM partner_shops WHERE id = ? AND active = 1').get(shop_id);
  if (!shop) return res.status(404).json({ error: 'shop_not_found' });
  const fee = Number(getConfig('checkup_fee', 20));
  const code = 'O' + nanoid(10).toUpperCase();
  const qr = nanoid(24);
  const meta = { kind: 'checkup', shop_id, shop_name: shop.name };
  if (shop.name_zh) meta.shop_name_zh = shop.name_zh;
  const info = db
    .prepare(
      `INSERT INTO orders (order_code, user_id, module, status, total, meta_json, qr_token, shop_id)
       VALUES (?, ?, 'checkup', 'PendingForPayment', ?, ?, ?, ?)`
    )
    .run(code, req.user.id, fee, JSON.stringify(meta), qr, shop_id);
  db.prepare(
    `INSERT INTO order_items (order_id, kind, label, qty, unit_price) VALUES (?, 'checkup', ?, 1, ?)`
  ).run(info.lastInsertRowid, `Eyesight Checkup at ${shop.name}`, fee);
  res.json({ order: loadOrder(info.lastInsertRowid) });
});

// PATCH /api/orders/:id/checkup/shop  { shop_id }
// Change the partner shop for a pending/paid (not finalised) checkup order.
router.patch('/:id/checkup/shop', authRequired, (req, res) => {
  const o = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!o || o.module !== 'checkup') return res.status(404).json({ error: 'not_found' });
  if (o.user_id !== req.user.id) return res.status(403).json({ error: 'forbidden' });
  if (o.status !== 'PendingForPayment' && o.status !== 'CheckupPaid') return res.status(400).json({ error: 'not_changeable' });
  const { shop_id } = req.body || {};
  const shop = db.prepare('SELECT * FROM partner_shops WHERE id = ? AND active = 1').get(shop_id);
  if (!shop) return res.status(404).json({ error: 'shop_not_found' });
  const meta = o.meta_json ? JSON.parse(o.meta_json) : {};
  meta.shop_id = shop.id;
  meta.shop_name = shop.name;
  if (shop.name_zh) meta.shop_name_zh = shop.name_zh;
  db.prepare(
    `UPDATE orders SET shop_id = ?, meta_json = ?, updated_at = datetime('now') WHERE id = ?`
  ).run(shop.id, JSON.stringify(meta), o.id);
  db.prepare(
    `UPDATE order_items SET label = ? WHERE order_id = ? AND kind = 'checkup'`
  ).run(`Eyesight Checkup at ${shop.name}`, o.id);
  res.json({ order: loadOrder(o.id) });
});

// POST /api/orders/:id/checkup/upload  (staff/admin) -- attaches eyesight data
router.post('/:id/checkup/upload', authRequired, requireAdmin, (req, res) => {
  const o = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!o || o.module !== 'checkup') return res.status(404).json({ error: 'not_found' });
  const { l_sph, l_cyl, l_axis, l_add, r_sph, r_cyl, r_axis, r_add, pd } = req.body || {};
  db.prepare(
    `INSERT INTO eyesight_records (user_id, l_sph, l_cyl, l_axis, l_add, r_sph, r_cyl, r_axis, r_add, pd, source, shop_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'shop', ?)`
  ).run(o.user_id, l_sph, l_cyl, l_axis, l_add, r_sph, r_cyl, r_axis, r_add, pd, o.shop_id);
  // checkup order considered Paid+Finalised together once data uploaded (simplification)
  db.prepare("UPDATE orders SET status = 'Finalised', finalised_at = datetime('now'), updated_at = datetime('now') WHERE id = ?").run(o.id);
  res.json({ ok: true });
});

// GET /api/eyesight/latest
router.get('/eyesight/latest', authRequired, (req, res) => {
  const row = db
    .prepare('SELECT * FROM eyesight_records WHERE user_id = ? ORDER BY id DESC LIMIT 1')
    .get(req.user.id);
  res.json({ record: row || null });
});

// POST /api/orders/spectacles  { frame_id, eyesight, lens: { thickness, blueLight, photochromic, progressive, brand_id }, total, base_total, promo_total, frame_base_price, frame_promo_price }
router.post('/spectacles', authRequired, (req, res) => {
  const { frame_id, eyesight, lens, total, base_total, promo_total, frame_base_price, frame_promo_price, checkup_order_id } = req.body || {};
  const frame = db.prepare('SELECT * FROM spectacle_frames WHERE id = ? AND active = 1').get(frame_id);
  if (!frame) return res.status(400).json({ error: 'invalid_frame' });
  if (!eyesight || typeof eyesight.pd !== 'number') return res.status(400).json({ error: 'invalid_eyesight' });
  if (!lens || !lens.thickness) return res.status(400).json({ error: 'invalid_lens' });

  // Validate checkup order if provided
  let checkupOrder = null;
  if (checkup_order_id) {
    checkupOrder = db.prepare('SELECT * FROM orders WHERE id = ? AND user_id = ?').get(checkup_order_id, req.user.id);
    if (!checkupOrder || checkupOrder.status !== 'PendingForOrder')
      return res.status(400).json({ error: 'invalid_checkup_order' });
  }

  // Persist eyesight
  db.prepare(
    `INSERT INTO eyesight_records (user_id, l_sph, l_cyl, l_axis, l_add, r_sph, r_cyl, r_axis, r_add, pd, source)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'self')`
  ).run(
    req.user.id,
    eyesight.l_sph, eyesight.l_cyl, eyesight.l_axis, eyesight.l_add,
    eyesight.r_sph, eyesight.r_cyl, eyesight.r_axis, eyesight.r_add,
    eyesight.pd
  );

  const code = 'O' + nanoid(10).toUpperCase();
  // Determine unit prices
  const frameUnitBase = frame_base_price != null ? Number(frame_base_price) : Number(frame.base_price || 0);
  const frameUnitPromo = frame_promo_price != null ? Number(frame_promo_price) : (frame.promotion_price != null ? Number(frame.promotion_price) : frameUnitBase);
  const chosenFrameUnit = (frameUnitPromo > 0 && frameUnitPromo < frameUnitBase) ? frameUnitPromo : frameUnitBase;
  const finalTotal = (promo_total != null) ? Number(promo_total) : (total != null ? Number(total) : (frameUnitBase || 0));

  const meta = { frame_id, frame_name: frame.name, eyesight, lens, pricing: { frame_base_price: frameUnitBase, frame_promo_price: frameUnitPromo, chosen_frame_unit: chosenFrameUnit, base_total: base_total != null ? Number(base_total) : undefined, promo_total: promo_total != null ? Number(promo_total) : undefined } };
  if (frame.name_zh) meta.frame_name_zh = frame.name_zh;
  if (checkup_order_id) meta.checkup_order_id = checkup_order_id;
  const info = db
    .prepare(
      `INSERT INTO orders (order_code, user_id, module, status, total, meta_json)
       VALUES (?, ?, 'espectacles', 'PendingForPayment', ?, ?)`
    )
    .run(code, req.user.id, Number(finalTotal) || 0, JSON.stringify(meta));
  const oid = info.lastInsertRowid;

  // Insert frame item using chosen frame unit price
  db.prepare(`INSERT INTO order_items (order_id, kind, ref_id, label, qty, unit_price, meta_json) VALUES (?, 'frame', ?, ?, 1, ?, ?)`) 
    .run(oid, frame.id, frame.name, chosenFrameUnit, JSON.stringify({ frame_base_price: frameUnitBase, frame_promo_price: frameUnitPromo }));

  let brandLabel = 'Standard lens';
  if (lens.brand_id) {
    const b = db.prepare('SELECT * FROM lens_brands WHERE id = ?').get(lens.brand_id);
    if (b) brandLabel = b.name;
    if (b && b.name_zh) {
      // prefer storing localized brand name inside lens meta stored with order
      lens.brand_name_zh = b.name_zh;
      // also store a top-level reference for convenience
      meta.brand_name_zh = b.name_zh;
    }
  }
  const lensUnit = Math.max(0, Number(finalTotal) - chosenFrameUnit);
  db.prepare(`INSERT INTO order_items (order_id, kind, ref_id, label, qty, unit_price, meta_json) VALUES (?, 'lens', ?, ?, 1, ?, ?)`) 
    .run(oid, lens.brand_id || null, brandLabel, lensUnit, JSON.stringify(lens));

  // Transition the checkup order to Finalised
  if (checkupOrder) {
    db.prepare(`UPDATE orders SET status = 'Finalised', finalised_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`)
      .run(checkupOrder.id);
  }

  res.json({ order: loadOrder(oid) });
});

// PATCH /api/orders/:id/spectacles  (modify within 12h of OrderPaid, or if PendingForPayment)
router.patch('/:id/spectacles', authRequired, (req, res) => {
  const o = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!o) return res.status(404).json({ error: 'not_found' });
  if (o.user_id !== req.user.id) return res.status(403).json({ error: 'forbidden' });
  if (o.module !== 'espectacles') return res.status(400).json({ error: 'bad_module' });
  const isPaid = o.status === 'OrderPaid' && isModifiable(o);
  if (o.status !== 'PendingForPayment' && !isPaid)
    return res.status(400).json({ error: 'not_modifiable' });

  const { frame_id, eyesight, lens, total } = req.body || {};
  const meta = o.meta_json ? JSON.parse(o.meta_json) : {};
  if (frame_id) {
    const frame = db.prepare('SELECT * FROM spectacle_frames WHERE id = ?').get(frame_id);
    if (!frame) return res.status(400).json({ error: 'invalid_frame' });
    meta.frame_id = frame.id;
    meta.frame_name = frame.name;
    if (frame.name_zh) meta.frame_name_zh = frame.name_zh;
  }
  if (eyesight) meta.eyesight = eyesight;
  if (lens) meta.lens = lens;

  // Support promo_total/base_total being sent from client
  const promo_total = req.body && req.body.promo_total != null ? Number(req.body.promo_total) : null;
  const newTotal = (promo_total != null) ? promo_total : (total != null ? Number(total) : o.total);
  db.prepare(
    `UPDATE orders SET meta_json = ?, total = ?, updated_at = datetime('now') WHERE id = ?`
  ).run(JSON.stringify(meta), newTotal, o.id);

  // For paid orders: compute diff and create refund or supplement payment
  let diff = 0;
  let supplementOrderId = null;
  if (isPaid) {
    diff = Math.round((newTotal - o.total) * 100) / 100;
    if (diff < 0) {
      // Issue refund credit
      const pays = db.prepare("SELECT * FROM payments WHERE order_id = ? AND status = 'succeeded'").all(o.id);
      if (pays.length > 0) {
        db.prepare("INSERT INTO refunds (payment_id, amount, status) VALUES (?, ?, 'pending')")
          .run(pays[0].id, Math.abs(diff));
      }
    } else if (diff > 0) {
      // Create a supplement payment order
      const code = 'OS' + nanoid(10).toUpperCase();
      const suppMeta = JSON.stringify({ parent_order_id: o.id, parent_order_code: o.order_code, kind: 'supplement' });
      const suppInfo = db.prepare(
        `INSERT INTO orders (order_code, user_id, module, status, total, meta_json) VALUES (?, ?, 'espectacles', 'PendingForPayment', ?, ?)`
      ).run(code, req.user.id, diff, suppMeta);
      supplementOrderId = suppInfo.lastInsertRowid;
    }
  }

  res.json({ order: loadOrder(o.id), diff, supplement_order_id: supplementOrderId });
});

// POST /api/orders/:id/pay  { method }
router.post('/:id/pay', authRequired, (req, res) => {
  const o = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!o) return res.status(404).json({ error: 'not_found' });
  if (o.user_id !== req.user.id) return res.status(403).json({ error: 'forbidden' });
  if (o.status !== 'PendingForPayment')
    return res.status(400).json({ error: 'not_payable' });

  const method = (req.body && req.body.method) || 'card';
  const allowed = ['card', 'paylah', 'paynow', 'wechat', 'alipay'];
  if (!allowed.includes(method)) return res.status(400).json({ error: 'invalid_method' });

  // For PayNow, create a pending payment and return a QR payload for the client to show
  if (method === 'paynow') {
    const txn = 'PN' + nanoid(10).toUpperCase();
    const info = db.prepare(
      `INSERT INTO payments (order_id, method, amount, status, transaction_ref) VALUES (?, ?, ?, 'pending', ?)`
    ).run(o.id, method, o.total, txn);
    const payId = info.lastInsertRowid;
    const paynowUen = getConfig('paynow_uen', 'SOMEUEN');
    const { buildPayNowEMV } = require('../payments/paynow');
    const merchantName = getConfig('merchant_name', 'eFancy');
    const city = getConfig('merchant_city', 'Singapore');
    const emv = buildPayNowEMV({ uen: paynowUen, amount: Number(o.total), ref: txn, merchantName, city });
    const qr = emv;
    return res.json({ order: loadOrder(o.id), paynow: { qr, payment_id: payId, txn } });
  }

  // Default: immediate success (simulated) for other methods
  const txn = 'TX' + nanoid(10).toUpperCase();
  db.prepare(
    `INSERT INTO payments (order_id, method, amount, status, transaction_ref) VALUES (?, ?, ?, 'succeeded', ?)`
  ).run(o.id, method, o.total, txn);
  const paidStatus = o.module === 'checkup' ? 'CheckupPaid' : 'OrderPaid';
  db.prepare(`UPDATE orders SET status = ?, paid_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`)
    .run(paidStatus, o.id);
  res.json({ order: loadOrder(o.id) });
});

// POST /api/orders/:id/cancel
// States where users can self-cancel (before Processing)
const USER_CANCELLABLE = new Set([
  'PendingForPayment', 'Pending', 'UserAccept', 'VendorAccept',
  'CheckupPaid', 'OrderPaid', 'Finalised', 'PendingForOrder', 'PendingForManufacture', 'ManufacturingAccept'
]);

router.post('/:id/cancel', authRequired, (req, res) => {
  const o = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!o) return res.status(404).json({ error: 'not_found' });
  const isOwner = o.user_id === req.user.id;
  const isAdmin = ['admin', 'super_admin'].includes(req.user.role);
  if (!isOwner && !isAdmin) return res.status(403).json({ error: 'forbidden' });

  if (isOwner && !isAdmin) {
    // User self-cancel: only allowed before Processing
    if (!USER_CANCELLABLE.has(o.status))
      return res.status(400).json({ error: 'not_cancellable_processing_started' });
  }

  if (!canTransition(o.status, 'Cancelled'))
    return res.status(400).json({ error: 'invalid_transition' });

  db.prepare("UPDATE orders SET status = 'Cancelled', cancelled_at = datetime('now'), updated_at = datetime('now') WHERE id = ?")
    .run(o.id);

  // Schedule refunds for any successful payments
  const pays = db.prepare("SELECT * FROM payments WHERE order_id = ? AND status = 'succeeded'").all(o.id);
  for (const p of pays) {
    db.prepare("INSERT INTO refunds (payment_id, amount, status) VALUES (?, ?, 'pending')")
      .run(p.id, p.amount);
  }
  res.json({ order: loadOrder(o.id) });
});

// Cron-ish endpoint to auto-finalise orders past modify window (admin trigger).
router.post('/cron/finalise', authRequired, requireAdmin, (req, res) => {
  const win = Number(getConfig('order_modify_window_hours', 12));
  const cutoff = new Date(Date.now() - win * 3600 * 1000).toISOString();
  const info = db
    .prepare(
      `UPDATE orders SET status = 'Finalised', finalised_at = datetime('now')
       WHERE status IN ('CheckupPaid', 'OrderPaid') AND paid_at IS NOT NULL AND paid_at < ?`
    )
    .run(cutoff);
  res.json({ finalised: info.changes });
});

module.exports = router;
