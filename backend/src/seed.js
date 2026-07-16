const db = require('./db');
const { nanoid } = require('nanoid');
const { setConfig, getConfig } = require('./configStore');

function run() {
  console.log('Seeding...');

  // Config defaults
  setConfig('checkup_fee', 20);
  if (getConfig('sgd_to_rmb_rate', null) == null) {
    setConfig('sgd_to_rmb_rate', 5.3);
  }
  setConfig('order_modify_window_hours', 12);
  setConfig('refund_window_weeks', 4);

  // Users
  const users = [
    { mobile: '+6500000000', role: 'super_admin', nickname: 'Root' },
    { mobile: '+6500000001', role: 'admin', nickname: 'Admin' },
    { mobile: '+6500000003', role: 'consumer', nickname: 'Alice' },
  ];
  const ins = db.prepare(
    'INSERT OR IGNORE INTO users (user_code, mobile, role, nickname) VALUES (?, ?, ?, ?)'
  );
  for (const u of users) ins.run('U' + nanoid(8).toUpperCase(), u.mobile, u.role, u.nickname);

  // Lens brands
  const brands = [
    ['Essilor', 1.4],
    ['Zeiss', 1.6],
    ['Hoya', 1.3],
    ['Nikon', 1.5],
    ['Generic', 1.0],
  ];
  const insBrand = db.prepare(
    'INSERT OR IGNORE INTO lens_brands (name, price_multiplier) VALUES (?, ?)'
  );
  for (const [n, m] of brands) insBrand.run(n, m);

  // Partner shops
  const shops = [
    ['OptiCare Bishan', '123 Bishan Rd', '570123', 'Bishan Rd', 'Bishan', 'Central', 'Bishan MRT', '10:00-21:00', '+6561111111'],
    ['VisionPlus Tampines', '1 Tampines St 1', '520101', 'Tampines St 1', 'Tampines', 'East', 'Tampines MRT', '10:00-22:00', '+6562222222'],
    ['ClearSight Jurong', '50 Jurong East Ave', '600050', 'Jurong East Ave', 'Jurong East', 'West', 'Jurong East MRT', '11:00-21:00', '+6563333333'],
  ];
  const insShop = db.prepare(
    `INSERT OR IGNORE INTO partner_shops (name, address, postcode, road, town, district, mrt, opening_time, contact)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  for (const s of shops) insShop.run(...s);

  // Frames
  const frames = [
    { name: 'Classic Round', brand: 'eFancy', base_price: 89, images: [
      'https://images.unsplash.com/photo-1574258495973-f010dfbb5371?w=600',
      'https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=600',
    ]},
    { name: 'Square Tortoise', brand: 'eFancy', base_price: 99, images: [
      'https://images.unsplash.com/photo-1577803645773-f96470509666?w=600',
    ]},
    { name: 'Aviator Steel', brand: 'eFancy', base_price: 129, images: [
      'https://images.unsplash.com/photo-1511499767150-a48a237f0083?w=600',
    ]},
    { name: 'Cat-eye Coral', brand: 'eFancy', base_price: 119, images: [
      'https://images.unsplash.com/photo-1599838082471-fa3e7d99eb3a?w=600',
    ]},
    { name: 'Minimal Titanium', brand: 'eFancy', base_price: 159, images: [
      'https://images.unsplash.com/photo-1556306535-0f09a537f0a3?w=600',
    ]},
    { name: 'Bold Black', brand: 'eFancy', base_price: 79, images: [
      'https://images.unsplash.com/photo-1508296695146-257a814070b4?w=600',
    ]},
  ];
  const fIns = db.prepare('INSERT INTO spectacle_frames (name, brand, base_price) VALUES (?, ?, ?)');
  const fImg = db.prepare('INSERT INTO frame_images (frame_id, url, sort_order) VALUES (?, ?, ?)');
  const existing = db.prepare('SELECT COUNT(*) AS c FROM spectacle_frames').get().c;
  if (existing === 0) {
    for (const f of frames) {
      const r = fIns.run(f.name, f.brand, f.base_price);
      f.images.forEach((u, i) => fImg.run(r.lastInsertRowid, u, i));
    }
  }

  // Seed common fresh/grocery categories (meats / fish) so cutting options apply
  const defaultCategories = ['Beef', 'Lamb', 'Mutton', 'Fish', 'Chicken', 'Duck', 'Goose'];
  const insCat = db.prepare('INSERT OR IGNORE INTO goods_categories (name) VALUES (?)');
  for (const c of defaultCategories) insCat.run(c);

  console.log('Seed complete.');
}

run();
