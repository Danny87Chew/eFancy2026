const Database = require('better-sqlite3');
const { dbFile } = require('./config');

const db = new Database(dbFile);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function init() {
  db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_code TEXT UNIQUE NOT NULL,
    mobile TEXT UNIQUE NOT NULL,
    nickname TEXT,
    real_name TEXT,
    role TEXT NOT NULL DEFAULT 'consumer',  -- consumer|service_vendor|spectacle_checkup_vendor|spectacle_producer_vendor|spectacle_lens_vendor|spectacle_frame_vendor|grocery_vendor|freshfood_vendor|other_vendor|admin|super_admin
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS otp_codes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mobile TEXT NOT NULL,
    code TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    consumed INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_otp_mobile ON otp_codes(mobile);

  CREATE TABLE IF NOT EXISTS user_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    token TEXT UNIQUE NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    revoked_at TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS spectacle_frames (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    code TEXT,
    brand TEXT,
    vendor_user_id INTEGER,
    base_price REAL NOT NULL DEFAULT 0,
    promotion_price REAL NOT NULL DEFAULT 0,
    vendor_office TEXT,
    vendor_mobile TEXT,
    vendor_address TEXT,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  `);
  
  const spectacleFrameCols = db.prepare(`PRAGMA table_info(spectacle_frames)`).all().map(c => c.name);
  if (!spectacleFrameCols.includes('code')) {
    db.prepare('ALTER TABLE spectacle_frames ADD COLUMN code TEXT').run();
  }

  // Ensure name/code uniqueness for frames
  db.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_spectacle_frames_name_unique ON spectacle_frames(name)').run();
  db.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_spectacle_frames_code_unique ON spectacle_frames(code)').run();
  if (!spectacleFrameCols.includes('vendor_user_id')) {
    db.prepare('ALTER TABLE spectacle_frames ADD COLUMN vendor_user_id INTEGER').run();
  }

  db.exec(`
  CREATE TABLE IF NOT EXISTS frame_images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    frame_id INTEGER NOT NULL,
    url TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (frame_id) REFERENCES spectacle_frames(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS lens_brands (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    brand TEXT,
    name TEXT NOT NULL UNIQUE,
    code TEXT,
    vendor_user_id INTEGER,
    price_multiplier REAL NOT NULL DEFAULT 1.0,
    vendor_name TEXT,
    vendor_office TEXT,
    vendor_mobile TEXT,
    vendor_address TEXT,
    active INTEGER NOT NULL DEFAULT 1
  );
  `);
  
  const lensBrandCols = db.prepare(`PRAGMA table_info(lens_brands)`).all().map(c => c.name);
  if (!lensBrandCols.includes('vendor_user_id')) {
    db.prepare('ALTER TABLE lens_brands ADD COLUMN vendor_user_id INTEGER').run();
  }
  if (!lensBrandCols.includes('base_price')) {
    db.prepare('ALTER TABLE lens_brands ADD COLUMN base_price REAL NOT NULL DEFAULT 0').run();
  }
  if (!lensBrandCols.includes('promotion_price')) {
    db.prepare('ALTER TABLE lens_brands ADD COLUMN promotion_price REAL NOT NULL DEFAULT 0').run();
  }
  // Ensure code uniqueness for lens brands
  db.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_lens_brands_code_unique ON lens_brands(code)').run();

  db.exec(`
  CREATE TABLE IF NOT EXISTS goods (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    code TEXT,
    category TEXT,
    kind TEXT NOT NULL DEFAULT 'normal', -- normal|fresh_preorder
    vendor_user_id INTEGER,
    price REAL NOT NULL DEFAULT 0,
    source_price REAL NOT NULL DEFAULT 0,
    market_price REAL NOT NULL DEFAULT 0,
    promotion_price REAL NOT NULL DEFAULT 0,
    stock INTEGER NOT NULL DEFAULT 0,
    weight INTEGER NOT NULL DEFAULT 0,
    available_from TEXT, -- for pre-order availability
    cutting TEXT,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS goods_images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    good_id INTEGER NOT NULL,
    url TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (good_id) REFERENCES goods(id) ON DELETE CASCADE
  );
  `);

  const goodCols = db.prepare(`PRAGMA table_info(goods)`).all().map(c => c.name);
  if (!goodCols.includes('code')) {
    db.prepare('ALTER TABLE goods ADD COLUMN code TEXT').run();
  }
  if (!goodCols.includes('source_price')) {
    db.prepare('ALTER TABLE goods ADD COLUMN source_price REAL NOT NULL DEFAULT 0').run();
  }
  if (!goodCols.includes('market_price')) {
    db.prepare('ALTER TABLE goods ADD COLUMN market_price REAL NOT NULL DEFAULT 0').run();
  }
  if (!goodCols.includes('promotion_price')) {
    db.prepare('ALTER TABLE goods ADD COLUMN promotion_price REAL NOT NULL DEFAULT 0').run();
  }
  if (!goodCols.includes('weight')) {
    db.prepare('ALTER TABLE goods ADD COLUMN weight INTEGER NOT NULL DEFAULT 0').run();
  }
  if (!goodCols.includes('cutting')) {
    db.prepare('ALTER TABLE goods ADD COLUMN cutting TEXT').run();
  }
  if (!goodCols.includes('subcategory')) {
    db.prepare('ALTER TABLE goods ADD COLUMN subcategory TEXT').run();
  }
  // ensure code uniqueness for goods if desired (not enforced for name)
  db.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_goods_code_unique ON goods(code)').run();

  db.exec(`
  CREATE TABLE IF NOT EXISTS goods_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS goods_subcategories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    goods_category_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(goods_category_id, name),
    FOREIGN KEY(goods_category_id) REFERENCES goods_categories(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS partner_shops (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    address TEXT,
    postcode TEXT,
    road TEXT,
    town TEXT,
    district TEXT,
    mrt TEXT,
    opening_time TEXT,
    contact TEXT,
    active INTEGER NOT NULL DEFAULT 1
  );


  CREATE TABLE IF NOT EXISTS eyesight_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    l_sph REAL, l_cyl REAL, l_axis REAL, l_add REAL,
    r_sph REAL, r_cyl REAL, r_axis REAL, r_add REAL,
    pd REAL,
    source TEXT,         -- 'self' | 'shop'
    shop_id INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (shop_id) REFERENCES partner_shops(id)
  );

  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_code TEXT UNIQUE NOT NULL,
    user_id INTEGER NOT NULL,
    module TEXT NOT NULL,         -- espectacles|egroceries|efreshes|eservices|checkup
    status TEXT NOT NULL,         -- see state machine
    total REAL NOT NULL DEFAULT 0,
    meta_json TEXT,               -- module-specific JSON (frame, lens, eyesight,...)
    qr_token TEXT,                -- for checkup pending orders
    shop_id INTEGER,              -- partner shop for checkup
    paid_at TEXT,
    finalised_at TEXT,
    cancelled_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (shop_id) REFERENCES partner_shops(id)
  );

  CREATE TABLE IF NOT EXISTS order_comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    parent_id INTEGER,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (parent_id) REFERENCES order_comments(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_order_comments_order ON order_comments(order_id, created_at);

  CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    kind TEXT NOT NULL,          -- frame|lens|checkup|grocery|fresh|service
    ref_id INTEGER,              -- pointer to frame/brand/etc
    label TEXT,
    qty INTEGER NOT NULL DEFAULT 1,
    unit_price REAL NOT NULL DEFAULT 0,
    meta_json TEXT,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    method TEXT NOT NULL,        -- card|paylah|paynow|wechat|alipay
    amount REAL NOT NULL,
    status TEXT NOT NULL,        -- succeeded|failed|refunded
    transaction_ref TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (order_id) REFERENCES orders(id)
  );

  CREATE TABLE IF NOT EXISTS refunds (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    payment_id INTEGER NOT NULL,
    amount REAL NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', -- pending|completed
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    completed_at TEXT,
    FOREIGN KEY (payment_id) REFERENCES payments(id)
  );

  CREATE TABLE IF NOT EXISTS system_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS admin_audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    actor_user_id INTEGER NOT NULL,
    action TEXT NOT NULL,
    target TEXT,
    detail_json TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS vendor_profiles (
    user_id INTEGER PRIMARY KEY,
    merchant_name TEXT NOT NULL,
    address TEXT,
    post_code TEXT,
    contact_number TEXT,
    business_hours TEXT,
    business_licence TEXT,
    extra_json TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS vendor_staff (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    vendor_user_id INTEGER NOT NULL,
    staff_mobile TEXT NOT NULL,
    staff_user_id INTEGER,           -- filled when that mobile registers/logs in
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (vendor_user_id, staff_mobile),
    FOREIGN KEY (vendor_user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (staff_user_id)  REFERENCES users(id) ON DELETE SET NULL
  );
  CREATE INDEX IF NOT EXISTS idx_vendor_staff_mobile ON vendor_staff(staff_mobile);

  CREATE TABLE IF NOT EXISTS delivery_addresses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    label TEXT,                      -- e.g., "Home", "Office"
    recipient_name TEXT NOT NULL,
    recipient_phone TEXT NOT NULL,
    address TEXT NOT NULL,
    postal_code TEXT,
    city TEXT,
    state TEXT,
    country TEXT NOT NULL DEFAULT 'SG',
    is_default INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_delivery_addresses_user ON delivery_addresses(user_id);
  `);

  // Add localized name column to partner_shops
  const shopCols = db.prepare(`PRAGMA table_info(partner_shops)`).all().map(c => c.name);
  if (!shopCols.includes('name_zh')) {
    db.prepare(`ALTER TABLE partner_shops ADD COLUMN name_zh TEXT`).run();
  }

  // Add is_admin column to vendor_staff if not present
  const cols = db.prepare(`PRAGMA table_info(vendor_staff)`).all().map(c => c.name);
  if (!cols.includes('is_admin')) {
    db.prepare(`ALTER TABLE vendor_staff ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0`).run();
  }
  if (!cols.includes('name')) {
    db.prepare(`ALTER TABLE vendor_staff ADD COLUMN name TEXT`).run();
  }

  // Add updated_at column to users if not present
  const userCols = db.prepare(`PRAGMA table_info(users)`).all().map(c => c.name);
  if (!userCols.includes('updated_at')) {
    db.prepare(`ALTER TABLE users ADD COLUMN updated_at TEXT`).run();
    db.prepare(`UPDATE users SET updated_at = created_at WHERE updated_at IS NULL`).run();
  }

  // Add preorder_notification_opt_in column to users if not present
  if (!userCols.includes('preorder_notification_opt_in')) {
    db.prepare(`ALTER TABLE users ADD COLUMN preorder_notification_opt_in INTEGER NOT NULL DEFAULT 0`).run();
  }

  // Add extra location columns to vendor_profiles if not present
  const profileCols = db.prepare(`PRAGMA table_info(vendor_profiles)`).all().map(c => c.name);
  for (const col of ['road', 'town', 'district', 'mrt']) {
    if (!profileCols.includes(col)) {
      db.prepare(`ALTER TABLE vendor_profiles ADD COLUMN ${col} TEXT`).run();
    }
  }

  db.prepare("UPDATE orders SET status = 'PendingForPayment' WHERE status = 'Opening'").run();
  // Migrate old 'Pending' checkup orders that haven't been paid yet → PendingForPayment
  db.prepare("UPDATE orders SET status = 'PendingForPayment' WHERE status = 'Pending' AND module = 'checkup'").run();
  // Migrate old 'Paid' status to module-specific states
  db.prepare("UPDATE orders SET status = 'CheckupPaid' WHERE status = 'Paid' AND module = 'checkup'").run();
  db.prepare("UPDATE orders SET status = 'OrderPaid' WHERE status = 'Paid' AND module != 'checkup'").run();

  // Add manufacturer_vendor_id to orders for tracking which producer took the order
  const orderCols = db.prepare(`PRAGMA table_info(orders)`).all().map(c => c.name);
  if (!orderCols.includes('manufacturer_vendor_id')) {
    db.prepare(`ALTER TABLE orders ADD COLUMN manufacturer_vendor_id INTEGER REFERENCES users(id)`).run();
  }

  // Add vendor column to spectacle_frames
  const frameCols = db.prepare(`PRAGMA table_info(spectacle_frames)`).all().map(c => c.name);
  if (!frameCols.includes('vendor')) {
    db.prepare(`ALTER TABLE spectacle_frames ADD COLUMN vendor TEXT`).run();
  }
  if (!frameCols.includes('promotion_price')) {
    db.prepare(`ALTER TABLE spectacle_frames ADD COLUMN promotion_price REAL NOT NULL DEFAULT 0`).run();
  }
  if (!frameCols.includes('vendor_office')) {
    db.prepare(`ALTER TABLE spectacle_frames ADD COLUMN vendor_office TEXT`).run();
  }
  if (!frameCols.includes('vendor_mobile')) {
    db.prepare(`ALTER TABLE spectacle_frames ADD COLUMN vendor_mobile TEXT`).run();
  }
  if (!frameCols.includes('vendor_address')) {
    db.prepare(`ALTER TABLE spectacle_frames ADD COLUMN vendor_address TEXT`).run();
  }

  if (!frameCols.includes('name_zh')) {
    db.prepare(`ALTER TABLE spectacle_frames ADD COLUMN name_zh TEXT`).run();
  }

  // Add brand/name/code and vendor contact columns to lens_brands
  const lensCols = db.prepare(`PRAGMA table_info(lens_brands)`).all().map(c => c.name);
  for (const col of ['brand', 'code', 'vendor_name', 'vendor_office', 'vendor_mobile', 'vendor_address']) {
    if (!lensCols.includes(col)) {
      db.prepare(`ALTER TABLE lens_brands ADD COLUMN ${col} TEXT`).run();
    }
  }
  if (!lensCols.includes('brand') || !lensCols.includes('code')) {
    db.prepare(`UPDATE lens_brands SET brand = COALESCE(brand, name) WHERE brand IS NULL`).run();
  }

  if (!lensCols.includes('name_zh')) {
    db.prepare(`ALTER TABLE lens_brands ADD COLUMN name_zh TEXT`).run();
  }

  // Add country column to vendor_profiles ('SG' | 'CN')
  const vpCols = db.prepare(`PRAGMA table_info(vendor_profiles)`).all().map(c => c.name);
  if (!vpCols.includes('country')) {
    db.prepare(`ALTER TABLE vendor_profiles ADD COLUMN country TEXT NOT NULL DEFAULT 'SG'`).run();
  }

  // Add office_number and mobile_number columns to vendor_profiles
  const vpCols2 = db.prepare(`PRAGMA table_info(vendor_profiles)`).all().map(c => c.name);
  if (!vpCols2.includes('office_number')) {
    db.prepare(`ALTER TABLE vendor_profiles ADD COLUMN office_number TEXT`).run();
  }
  if (!vpCols2.includes('mobile_number')) {
    db.prepare(`ALTER TABLE vendor_profiles ADD COLUMN mobile_number TEXT`).run();
  }

  // Back-fill staff_user_id for any staff that already have accounts
  db.prepare(`
    UPDATE vendor_staff SET staff_user_id = (
      SELECT id FROM users WHERE mobile = vendor_staff.staff_mobile
    ) WHERE staff_user_id IS NULL
  `).run();

  // Add delivery_address_id column to orders if not present
  const orderCols2 = db.prepare(`PRAGMA table_info(orders)`).all().map(c => c.name);
  if (!orderCols2.includes('delivery_address_id')) {
    db.prepare(`ALTER TABLE orders ADD COLUMN delivery_address_id INTEGER REFERENCES delivery_addresses(id)`).run();
  }

  // Seed default super admin (mobile 99999999 with +65 prefix)
  const superAdminMobile = '+6599999999';
  const existingSA = db.prepare('SELECT id, role FROM users WHERE mobile = ?').get(superAdminMobile);
  if (!existingSA) {
    db.prepare(`INSERT INTO users (user_code, mobile, role) VALUES (?, ?, 'super_admin')`)
      .run('USUPERADM', superAdminMobile);
  } else if (existingSA.role !== 'super_admin') {
    db.prepare(`UPDATE users SET role = 'super_admin' WHERE id = ?`).run(existingSA.id);
  }
}

init();

module.exports = db;
