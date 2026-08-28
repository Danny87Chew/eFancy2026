const test = require('node:test');
const assert = require('node:assert/strict');

const { shouldHideOrderPrices, redactOrderForRole } = require('../src/orderVisibility.js');

test('staff roles should hide order prices', () => {
  const order = {
    total: 120.5,
    meta: { vendor_price: 99.9, pricing: { base_total: 120.5, promo_total: 99.9 } },
    items: [{ id: 1, unit_price: 40.5, qty: 2 }],
    payments: [{ id: 10, amount: 120.5 }],
  };

  assert.equal(shouldHideOrderPrices('staff'), true);
  assert.equal(shouldHideOrderPrices('admin'), false);

  const hidden = redactOrderForRole(order, 'staff');
  assert.equal(hidden.total, null);
  assert.equal(hidden.meta.vendor_price, null);
  assert.equal(hidden.meta.pricing.base_total, null);
  assert.equal(hidden.items[0].unit_price, null);
  assert.equal(hidden.payments[0].amount, null);
});
