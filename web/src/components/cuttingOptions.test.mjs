import assert from 'node:assert/strict';
import test from 'node:test';
import { getCuttingOptions } from './cuttingOptions.js';

test('returns meat-specific cutting options for beef and fish', () => {
  assert.deepEqual(getCuttingOptions('beef'), ['100g/Pcs', '150g/Pcs', '200g/Pcs', '250g/Pcs', '300g/Pcs', '350g/Pcs', '400g/Pcs']);
  assert.deepEqual(getCuttingOptions('fish'), ['Butter Fly', 'Whole', 'Half', 'Quarter', '8 pieces', 'Small pieces']);
  assert.deepEqual(getCuttingOptions('chicken'), ['Whole', 'Half', 'Quarter', '8 pieces', 'Small pieces']);
});
