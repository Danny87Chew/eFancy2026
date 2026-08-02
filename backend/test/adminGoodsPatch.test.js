const test = require('node:test');
const assert = require('node:assert/strict');
const db = require('../src/db');
const adminRouter = require('../src/routes/admin');

function getPatchHandler() {
  const layer = adminRouter.stack.find((entry) => entry.route && entry.route.path === '/goods/:id' && entry.route.methods.patch);
  assert.ok(layer, 'expected patch /goods/:id route');
  return layer.route.stack[layer.route.stack.length - 1].handle;
}

test('PATCH /api/admin/goods/:id accepts cutting updates without throwing', () => {
  const originalPrepare = db.prepare;
  const originalTransaction = db.transaction;

  let currentGood = { id: 42, name: 'Old name', category: 'beef', kind: 'normal', cutting: 'Whole', price: 10, source_price: 10, market_price: 12, promotion_price: 11, stock: 5, weight: 1000, available_from: null, active: 1 };
  let updatedCutting = 'Whole';

  db.prepare = (sql) => ({
    get: (...args) => {
      if (sql.includes('SELECT * FROM goods WHERE id = ?')) {
        return currentGood;
      }
      if (sql.includes('SELECT url FROM goods_images')) {
        return [];
      }
      return null;
    },
    all: () => [],
    run: (...args) => {
      if (sql.includes('UPDATE goods SET')) {
        updatedCutting = args[args.length - 2] || updatedCutting;
        currentGood = { ...currentGood, cutting: updatedCutting };
      }
      return { lastInsertRowid: 42, changes: 1 };
    },
  });
  db.transaction = (fn) => () => fn();

  try {
    const handler = getPatchHandler();
    const req = {
      params: { id: '42' },
      user: { id: 1 },
      body: { name: 'Updated good', cutting: '200g/Pcs' },
    };
    updatedCutting = req.body.cutting;
    const res = {
      statusCode: 200,
      status(code) { this.statusCode = code; return this; },
      json(payload) { this.payload = payload; return this; },
    };

    assert.doesNotThrow(() => handler(req, res, () => {}));
    assert.equal(res.statusCode, 200);
    assert.ok(res.payload && res.payload.good);
    assert.equal(res.payload.good.cutting, '200g/Pcs');
  } finally {
    db.prepare = originalPrepare;
    db.transaction = originalTransaction;
  }
});
