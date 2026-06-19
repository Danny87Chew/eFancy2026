const db = require('../backend/src/db');
const now = new Date().toISOString();

function insertOrder(orderCode, userId, module, status, total, metaJson, items) {
  const insOrder = db.prepare('INSERT INTO orders (order_code, user_id, module, status, total, meta_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  const res = insOrder.run(orderCode, userId, module, status, total, JSON.stringify(metaJson), now, now);
  const orderId = res.lastInsertRowid;
  const insItem = db.prepare('INSERT INTO order_items (order_id, kind, ref_id, label, qty, unit_price, meta_json) VALUES (?, ?, ?, ?, ?, ?, ?)');
  for (const it of items) {
    insItem.run(orderId, it.kind, it.ref_id || null, it.label, it.qty || 1, it.unit_price || 0, it.meta_json ? JSON.stringify(it.meta_json) : null);
  }
  return orderId;
}

// Order 1: promo
const o1meta = { pricing: { frame_base_price: 89, frame_promo_price: 69, base_total: 175, promo_total: 155 }, frame_name: 'Classic Round', lens: { thickness: '1.56', blueLight: true } };
const o1items = [
  { kind: 'frame', ref_id: 1, label: 'Classic Round', qty: 1, unit_price: 69, meta_json: { frame_base_price: 89, frame_promo_price: 69 } },
  { kind: 'lens', label: 'Zeiss', qty: 1, unit_price: 86 }
];
const id1 = insertOrder('TST-PROMO-1', 4, 'espectacles', 'PendingForPayment', 155.0, o1meta, o1items);
console.log('Inserted order id', id1);

// Order 2: no promo
const o2meta = { pricing: { frame_base_price: 99, frame_promo_price: 99, base_total: 185, promo_total: 185 }, frame_name: 'Square Tortoise', lens: { thickness: '1.56', blueLight: false } };
const o2items = [
  { kind: 'frame', ref_id: 2, label: 'Square Tortoise', qty: 1, unit_price: 99, meta_json: { frame_base_price: 99, frame_promo_price: 99 } },
  { kind: 'lens', label: 'Zeiss', qty: 1, unit_price: 86 }
];
const id2 = insertOrder('TST-NOPROMO-2', 4, 'espectacles', 'PendingForPayment', 185.0, o2meta, o2items);
console.log('Inserted order id', id2);

// Report counts
const counts = db.prepare("SELECT (SELECT COUNT(*) FROM orders) AS orders_count, (SELECT COUNT(*) FROM order_items) AS items_count, (SELECT COUNT(*) FROM payments) AS payments_count, (SELECT COUNT(*) FROM refunds) AS refunds_count;").get();
console.log('Counts:', counts);
