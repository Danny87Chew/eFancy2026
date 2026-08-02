const assert = require('assert');
const express = require('express');
const http = require('http');
const adminRouter = require('./src/routes/admin');
const db = require('./src/db');
const { signToken } = require('./src/auth');

async function main() {
  const app = express();
  app.use(express.json());
  app.use('/api/admin', adminRouter);

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();

  try {
    const suffix = `${Date.now()}`;
    const userId = db.prepare(
      'INSERT INTO users (user_code, mobile, nickname, real_name, role) VALUES (?, ?, ?, ?, ?)'
    ).run(`TESTADMIN${suffix}`, `+651000000${suffix.slice(-4)}`, 'Test', 'Admin', 'admin').lastInsertRowid;
    const token = signToken(userId);
    db.prepare('INSERT INTO user_sessions (user_id, token) VALUES (?, ?)').run(userId, token);

    const createRes = await fetch(`http://127.0.0.1:${port}/api/admin/goods`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        name: 'Test Good',
        source_price: 10,
        market_price: 20,
        promotion_price: 15,
        stock: 5,
      }),
    });
    assert.strictEqual(createRes.status, 201, `create expected 201 but got ${createRes.status}`);
    const created = await createRes.json();
    assert.ok(created.good && created.good.id, 'expected created good to be returned');

    const patchRes = await fetch(`http://127.0.0.1:${port}/api/admin/goods/${created.good.id}`, {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ name: 'Updated Good', promotion_price: 12 }),
    });
    assert.strictEqual(patchRes.status, 200, `patch expected 200 but got ${patchRes.status}`);

    const deleteRes = await fetch(`http://127.0.0.1:${port}/api/admin/goods/${created.good.id}`, {
      method: 'DELETE',
      headers: { authorization: `Bearer ${token}` },
    });
    assert.strictEqual(deleteRes.status, 200, `delete expected 200 but got ${deleteRes.status}`);
    console.log('goods crud smoke test passed');
  } finally {
    server.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
