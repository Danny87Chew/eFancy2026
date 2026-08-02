import test from 'node:test';
import assert from 'node:assert/strict';

import { calculateCartTotals, getSelectedCheckoutItems } from './cartUtils.js';

test('calculateCartTotals returns per-item subtotals and overall total', () => {
  const items = [
    { id: 'a', name: 'Frame', price: 10, quantity: 2 },
    { id: 'b', name: 'Lens', price: 5.5, quantity: 1 },
  ];

  const result = calculateCartTotals(items);

  assert.deepEqual(result, [
    { id: 'a', subtotal: 20 },
    { id: 'b', subtotal: 5.5 },
  ]);
  assert.equal(result.reduce((sum, item) => sum + item.subtotal, 0), 25.5);
});

test('getSelectedCheckoutItems returns only the selected cart entries', () => {
  const items = [
    { id: 'a', name: 'Frame', price: 10, quantity: 2 },
    { id: 'b', name: 'Lens', price: 5.5, quantity: 1 },
  ];

  const result = getSelectedCheckoutItems(items, ['b']);

  assert.deepEqual(result, [{ id: 'b', name: 'Lens', price: 5.5, quantity: 1 }]);
});
