const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const { port } = require('./config');
require('./db'); // init

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(morgan('dev'));

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/frames', require('./routes/frames'));
app.use('/api/lens-brands', require('./routes/lensBrands'));
app.use('/api/shops', require('./routes/shops'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/goods', require('./routes/goods'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/vendor', require('./routes/vendor'));
app.use('/api/payments', require('./routes/payments'));

// Public config (selected keys)
const { getConfig } = require('./configStore');
app.get('/api/config/public', (req, res) => {
  res.json({
    checkup_fee: Number(getConfig('checkup_fee', 20)),
    order_modify_window_hours: Number(getConfig('order_modify_window_hours', 12)),
    refund_window_weeks: Number(getConfig('refund_window_weeks', 4)),
    sgd_to_rmb_rate: Number(getConfig('sgd_to_rmb_rate', 5.3)),
  });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'server_error', detail: err.message });
});

app.listen(port, () => console.log(`API listening on http://localhost:${port}`));
