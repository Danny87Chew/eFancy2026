const router = require('express').Router();
const { nanoid } = require('nanoid');
const db = require('../db');
const { authRequired } = require('../auth');
const { VENDOR_ROLES } = require('../roles');
const { canTransition } = require('../orderStates');

// Spectacle Producer Vendor allowed actions and the status they transition to
const PRODUCER_ACTIONS = {
  accept:    { from: 'PendingForBid',         to: 'PendingForManufacture' },
  start:     { from: 'PendingForManufacture', to: 'ManufacturingAccept' },
  processing:{ from: 'ManufacturingAccept',   to: 'UnderManufacturing' },
  done:      { from: 'UnderManufacturing',    to: 'ManufactureDone' },
  shipback:  { from: 'ManufactureDone',       to: 'ShippingBack' },
};

function isVendorUser(user, vendorRole) {
  return user.role === vendorRole;
}

// Middleware: must be any vendor role or a staff member of a vendor
function requireVendor(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'auth_required' });
  const isDirectVendor = VENDOR_ROLES.includes(req.user.role);
  if (isDirectVendor) return next();
  // Check if this user is registered as vendor staff
  const staffRow = db.prepare(
    `SELECT vs.vendor_user_id, u.role AS vendor_role
     FROM vendor_staff vs
     JOIN users u ON u.id = vs.vendor_user_id
     WHERE vs.staff_mobile = ?`
  ).get(req.user.mobile);
  if (staffRow) {
    req.vendorRole = staffRow.vendor_role;
    req.vendorUserId = staffRow.vendor_user_id;
    return next();
  }
  return res.status(403).json({ error: 'forbidden' });
}

function effectiveVendorRole(req) {
  return req.vendorRole || req.user.role;
}

function getVendorOwnerId(req) {
  return req.vendorUserId || req.user.id;
}

// GET /api/vendor/checkup/qr/:token  — look up checkup order by QR token
router.get('/checkup/qr/:token', authRequired, requireVendor, (req, res) => {
  const role = effectiveVendorRole(req);
  if (role !== 'spectacle_checkup_vendor')
    return res.status(403).json({ error: 'forbidden' });

  const o = db.prepare(
    `SELECT o.*, u.nickname AS user_nickname, u.real_name AS user_real_name, u.mobile AS user_mobile
     FROM orders o
     LEFT JOIN users u ON u.id = o.user_id
     WHERE o.qr_token = ? AND o.module = 'checkup'`
  ).get(req.params.token);
  if (!o) return res.status(404).json({ error: 'not_found' });
  if (o.status === 'Cancelled') return res.status(400).json({ error: 'order_cancelled' });
  if (o.status === 'Finalised' || o.status === 'SystemDone')
    return res.status(400).json({ error: 'already_completed' });

  o.meta = o.meta_json ? JSON.parse(o.meta_json) : null;
  o.items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(o.id);
  res.json({ order: o });
});

// POST /api/vendor/checkup/:id/upload  — vendor submits eyesight data
router.post('/checkup/:id/upload', authRequired, requireVendor, (req, res) => {
  const role = effectiveVendorRole(req);
  if (role !== 'spectacle_checkup_vendor')
    return res.status(403).json({ error: 'forbidden' });

  const o = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!o || o.module !== 'checkup') return res.status(404).json({ error: 'not_found' });
  if (o.status === 'Cancelled') return res.status(400).json({ error: 'order_cancelled' });
  if (o.status === 'Finalised') return res.status(400).json({ error: 'already_completed' });

  const { l_sph, l_cyl, l_axis, l_add, r_sph, r_cyl, r_axis, r_add, pd } = req.body || {};
  if (pd == null) return res.status(400).json({ error: 'pd_required' });

  db.prepare(
    `INSERT INTO eyesight_records (user_id, l_sph, l_cyl, l_axis, l_add, r_sph, r_cyl, r_axis, r_add, pd, source, shop_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'shop', ?)`
  ).run(o.user_id, l_sph ?? null, l_cyl ?? null, l_axis ?? null, l_add ?? null,
        r_sph ?? null, r_cyl ?? null, r_axis ?? null, r_add ?? null, pd, o.shop_id ?? null);

  db.prepare(
    `UPDATE orders SET status = 'PendingForOrder', updated_at = datetime('now') WHERE id = ?`
  ).run(o.id);

  res.json({ ok: true });
});

// GET /api/vendor/orders — Returns orders relevant to this vendor type
router.get('/orders', authRequired, requireVendor, (req, res) => {
  const role = effectiveVendorRole(req);
  const tab = req.query.tab; // 'available' | 'taken' | undefined
  let rows;

  if (role === 'spectacle_checkup_vendor') {
    rows = db.prepare(
      `SELECT o.*, u.nickname AS user_nickname, u.real_name AS user_real_name, u.mobile AS user_mobile
       FROM orders o
       LEFT JOIN users u ON u.id = o.user_id
       WHERE o.module = 'checkup' AND o.status = 'CheckupPaid'
       ORDER BY o.id DESC LIMIT 200`
    ).all();
  } else if (role === 'spectacle_producer_vendor') {
    const vendorOwnerId = getVendorOwnerId(req);
    if (tab === 'available') {
      rows = db.prepare(
        `SELECT o.*, u.nickname AS user_nickname, u.real_name AS user_real_name, u.mobile AS user_mobile
         FROM orders o
         LEFT JOIN users u ON u.id = o.user_id
         WHERE o.module = 'espectacles' AND o.status = 'PendingForBid'
         AND o.manufacturer_vendor_id IS NULL
         ORDER BY o.id DESC LIMIT 200`
      ).all();
    } else if (tab === 'taken') {
      const takenStatuses = ['PendingForManufacture','ManufacturingAccept','UnderManufacturing','ManufactureDone','ShippingBack'];
      rows = db.prepare(
        `SELECT o.*, u.nickname AS user_nickname, u.real_name AS user_real_name, u.mobile AS user_mobile
         FROM orders o
         LEFT JOIN users u ON u.id = o.user_id
         WHERE o.module = 'espectacles'
         AND o.manufacturer_vendor_id = ?
         AND o.status IN (${takenStatuses.map(() => '?').join(',')})
         ORDER BY o.id DESC LIMIT 200`
      ).all(vendorOwnerId, ...takenStatuses);
    } else {
      const producerStatuses = ['PendingForBid','PendingForManufacture','ManufacturingAccept','UnderManufacturing','ManufactureDone','ShippingBack'];
      rows = db.prepare(
        `SELECT o.*, u.nickname AS user_nickname, u.real_name AS user_real_name, u.mobile AS user_mobile
         FROM orders o
         LEFT JOIN users u ON u.id = o.user_id
         WHERE o.module = 'espectacles'
         AND o.status IN (${producerStatuses.map(() => '?').join(',')})
         ORDER BY o.id DESC LIMIT 200`
      ).all(...producerStatuses);
    }
  } else {
    rows = [];
  }

  for (const r of rows) r.meta = r.meta_json ? JSON.parse(r.meta_json) : null;
  res.json({ orders: rows, vendor_role: role });
});

// GET /api/vendor/orders/:id
router.get('/orders/:id', authRequired, requireVendor, (req, res) => {
  const role = effectiveVendorRole(req);
  const o = db.prepare(
    `SELECT o.*, u.nickname AS user_nickname, u.real_name AS user_real_name, u.mobile AS user_mobile
     FROM orders o
     LEFT JOIN users u ON u.id = o.user_id
     WHERE o.id = ?`
  ).get(req.params.id);
  if (!o) return res.status(404).json({ error: 'not_found' });

  // Access checks per role
  if (role === 'spectacle_checkup_vendor') {
    if (o.module !== 'checkup') return res.status(403).json({ error: 'forbidden' });
  } else if (role === 'spectacle_producer_vendor') {
    const producerStatuses = ['PendingForBid','PendingForManufacture','ManufacturingAccept','UnderManufacturing','ManufactureDone','ShippingBack'];
    if (o.module !== 'espectacles' || !producerStatuses.includes(o.status))
      return res.status(403).json({ error: 'forbidden' });
  } else {
    return res.status(403).json({ error: 'forbidden' });
  }

  o.meta = o.meta_json ? JSON.parse(o.meta_json) : null;
  o.items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(o.id);
  res.json({ order: o, vendor_role: role });
});

// POST /api/vendor/orders/:id/:action  (spectacle_producer_vendor only)
router.post('/orders/:id/:action', authRequired, requireVendor, (req, res) => {
  const role = effectiveVendorRole(req);
  if (role !== 'spectacle_producer_vendor') return res.status(403).json({ error: 'forbidden' });

  const actionDef = PRODUCER_ACTIONS[req.params.action];
  if (!actionDef) return res.status(400).json({ error: 'invalid_action' });

  const o = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!o) return res.status(404).json({ error: 'not_found' });
  if (o.module !== 'espectacles') return res.status(400).json({ error: 'wrong_module' });
  if (o.status !== actionDef.from) return res.status(400).json({ error: 'invalid_transition', current: o.status, expected: actionDef.from });
  if (!canTransition(o.status, actionDef.to)) return res.status(400).json({ error: 'invalid_transition' });

  const vendorOwnerId = getVendorOwnerId(req);

  if (req.params.action === 'accept') {
    // Ensure not already taken by another vendor
    if (o.manufacturer_vendor_id && o.manufacturer_vendor_id !== vendorOwnerId) {
      return res.status(409).json({ error: 'already_taken' });
    }
    db.prepare(`UPDATE orders SET status = ?, manufacturer_vendor_id = ?, updated_at = datetime('now') WHERE id = ?`)
      .run(actionDef.to, vendorOwnerId, o.id);
  } else {
    // For non-accept actions, ensure this vendor owns the order
    if (o.manufacturer_vendor_id && o.manufacturer_vendor_id !== vendorOwnerId) {
      return res.status(403).json({ error: 'not_your_order' });
    }
    db.prepare(`UPDATE orders SET status = ?, updated_at = datetime('now') WHERE id = ?`)
      .run(actionDef.to, o.id);
  }

  const updated = db.prepare('SELECT * FROM orders WHERE id = ?').get(o.id);
  updated.meta = updated.meta_json ? JSON.parse(updated.meta_json) : null;
  updated.items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(o.id);
  res.json({ order: updated });
});

// ── Staff management (checkup vendors only) ──────────────────────────────────

// Allows direct vendor owners AND staff members with is_admin=1
// Sets req.vendorOwnerId so queries use the correct vendor
function requireStaffAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'auth_required' });
  const role = req.user.role;
  const OWNER_ROLES = ['spectacle_checkup_vendor', 'spectacle_producer_vendor'];
  if (OWNER_ROLES.includes(role)) {
    req.vendorOwnerId = req.user.id;
    return next();
  }
  const staffRow = db.prepare(
    `SELECT vs.vendor_user_id, vs.is_admin, u.role AS vendor_role
     FROM vendor_staff vs JOIN users u ON u.id = vs.vendor_user_id
     WHERE vs.staff_mobile = ? AND vs.is_admin = 1`
  ).get(req.user.mobile);
  if (staffRow && OWNER_ROLES.includes(staffRow.vendor_role)) {
    req.vendorOwnerId = staffRow.vendor_user_id;
    return next();
  }
  return res.status(403).json({ error: 'forbidden' });
}

// GET /api/vendor/staff  — list staff + own profile mobile
router.get('/staff', authRequired, requireStaffAdmin, (req, res) => {
  const staff = db.prepare(
    `SELECT id, staff_mobile, staff_user_id, is_admin, name, created_at FROM vendor_staff WHERE vendor_user_id = ? ORDER BY id ASC`
  ).all(req.vendorOwnerId);
  const owner = db.prepare(`SELECT mobile, nickname FROM users WHERE id = ?`).get(req.vendorOwnerId);
  const profile = db.prepare(`SELECT contact_number FROM vendor_profiles WHERE user_id = ?`).get(req.vendorOwnerId);
  res.json({ staff, owner_mobile: owner?.mobile || '', owner_name: owner?.nickname || '', contact_number: profile?.contact_number || '' });
});

// POST /api/vendor/staff  — add a staff mobile
router.post('/staff', authRequired, requireStaffAdmin, (req, res) => {
  const { mobile, is_admin, name } = req.body || {};
  if (!mobile) return res.status(400).json({ error: 'mobile_required' });
  // Cannot add own mobile
  if (mobile === req.user.mobile) return res.status(400).json({ error: 'cannot_add_self' });
  const existing = db.prepare(
    `SELECT id FROM vendor_staff WHERE vendor_user_id = ? AND staff_mobile = ?`
  ).get(req.vendorOwnerId, mobile);
  if (existing) return res.status(409).json({ error: 'already_exists' });

  const vendorOwner = db.prepare('SELECT role FROM users WHERE id = ?').get(req.vendorOwnerId);
  const vendorRole = vendorOwner?.role || 'other_vendor';

  // Auto-create a user account for this staff mobile if not yet registered
  let resolvedUser = db.prepare(`SELECT id FROM users WHERE mobile = ?`).get(mobile);
  if (!resolvedUser) {
    const userCode = 'U' + nanoid(8).toUpperCase();
    const inserted = db.prepare('INSERT INTO users (user_code, mobile, role) VALUES (?, ?, ?)').run(userCode, mobile, vendorRole);
    resolvedUser = { id: inserted.lastInsertRowid };
  } else {
    db.prepare("UPDATE users SET role = ? WHERE id = ? AND role NOT IN ('admin', 'super_admin')").run(vendorRole, resolvedUser.id);
  }

  const adminFlag = is_admin ? 1 : 0;
  const staffName = (name && String(name).trim()) || null;
  const info = db.prepare(
    `INSERT INTO vendor_staff (vendor_user_id, staff_mobile, staff_user_id, is_admin, name) VALUES (?, ?, ?, ?, ?)`
  ).run(req.vendorOwnerId, mobile, resolvedUser.id, adminFlag, staffName);

  res.json({ staff: { id: info.lastInsertRowid, staff_mobile: mobile, staff_user_id: resolvedUser.id, is_admin: adminFlag, name: staffName } });
});

// PATCH /api/vendor/staff/:id  — update staff mobile and/or is_admin
router.patch('/staff/:id', authRequired, requireStaffAdmin, (req, res) => {
  const row = db.prepare(`SELECT * FROM vendor_staff WHERE id = ? AND vendor_user_id = ?`).get(req.params.id, req.vendorOwnerId);
  if (!row) return res.status(404).json({ error: 'not_found' });
  const { mobile, is_admin, name } = req.body || {};
  if (!mobile) return res.status(400).json({ error: 'mobile_required' });

  const dup = db.prepare(
    `SELECT id FROM vendor_staff WHERE vendor_user_id = ? AND staff_mobile = ? AND id != ?`
  ).get(req.vendorOwnerId, mobile, row.id);
  if (dup) return res.status(409).json({ error: 'already_exists' });

  const vendorOwner = db.prepare('SELECT role FROM users WHERE id = ?').get(req.vendorOwnerId);
  const vendorRole = vendorOwner?.role || 'other_vendor';

  // Auto-create user account if not yet registered
  let resolvedUser = db.prepare(`SELECT id FROM users WHERE mobile = ?`).get(mobile);
  if (!resolvedUser) {
    const userCode = 'U' + nanoid(8).toUpperCase();
    const inserted = db.prepare('INSERT INTO users (user_code, mobile, role) VALUES (?, ?, ?)').run(userCode, mobile, vendorRole);
    resolvedUser = { id: inserted.lastInsertRowid };
  } else {
    db.prepare("UPDATE users SET role = ? WHERE id = ? AND role NOT IN ('admin', 'super_admin')").run(vendorRole, resolvedUser.id);
  }
  const adminFlag = is_admin !== undefined ? (is_admin ? 1 : 0) : row.is_admin;
  const staffName = name !== undefined ? ((name && String(name).trim()) || null) : row.name;
  db.prepare(`UPDATE vendor_staff SET staff_mobile = ?, staff_user_id = ?, is_admin = ?, name = ? WHERE id = ?`)
    .run(mobile, resolvedUser.id, adminFlag, staffName, row.id);

  res.json({ staff: { id: row.id, staff_mobile: mobile, staff_user_id: resolvedUser.id, is_admin: adminFlag, name: staffName } });
});

// DELETE /api/vendor/staff/:id  — remove staff
router.delete('/staff/:id', authRequired, requireStaffAdmin, (req, res) => {
  const row = db.prepare(`SELECT id FROM vendor_staff WHERE id = ? AND vendor_user_id = ?`).get(req.params.id, req.vendorOwnerId);
  if (!row) return res.status(404).json({ error: 'not_found' });
  db.prepare(`DELETE FROM vendor_staff WHERE id = ?`).run(row.id);
  res.json({ ok: true });
});

// PATCH /api/vendor/profile/mobile  — change vendor owner's registered mobile and/or display name (owner only)
router.patch('/profile/mobile', authRequired, (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'auth_required' });
  if (!VENDOR_ROLES.includes(req.user.role))
    return res.status(403).json({ error: 'forbidden' });
  const { mobile, name } = req.body || {};
  if (mobile === undefined && name === undefined) return res.status(400).json({ error: 'nothing_to_update' });
  if (mobile !== undefined) {
    if (!mobile) return res.status(400).json({ error: 'mobile_required' });
    const existing = db.prepare(`SELECT id FROM users WHERE mobile = ? AND id != ?`).get(mobile, req.user.id);
    if (existing) return res.status(409).json({ error: 'mobile_taken' });
    db.prepare(`UPDATE users SET mobile = ? WHERE id = ?`).run(mobile, req.user.id);
  }
  if (name !== undefined) {
    const v = name === null ? null : (String(name).trim() || null);
    db.prepare(`UPDATE users SET nickname = ? WHERE id = ?`).run(v, req.user.id);
  }
  const u = db.prepare(`SELECT mobile, nickname FROM users WHERE id = ?`).get(req.user.id);
  res.json({ ok: true, mobile: u.mobile, name: u.nickname || '' });
});

// GET /api/vendor/profile/self — vendor owner loads their own profile (admin-form shape)
router.get('/profile/self', authRequired, (req, res) => {
  if (!VENDOR_ROLES.includes(req.user.role))
    return res.status(403).json({ error: 'forbidden' });
  const u = db.prepare(
    `SELECT id, user_code, mobile, nickname, real_name, role, created_at, updated_at FROM users WHERE id = ?`
  ).get(req.user.id);
  if (!u) return res.status(404).json({ error: 'not_found' });
  const vendor_profile = db.prepare(
    `SELECT merchant_name, contact_number, office_number, mobile_number, address, post_code AS postcode, road, town, district, mrt,
            business_hours, business_licence, country
     FROM vendor_profiles WHERE user_id = ?`
  ).get(u.id) || null;
  const staffs = db.prepare(
    `SELECT id, staff_mobile, staff_user_id, is_admin, name FROM vendor_staff WHERE vendor_user_id = ? ORDER BY id ASC`
  ).all(u.id);
  res.json({ user: { ...u, vendor_profile, staffs } });
});

// PATCH /api/vendor/profile/self — vendor owner updates their own profile (admin-form shape, role/mobile locked)
router.patch('/profile/self', authRequired, (req, res) => {
  if (!VENDOR_ROLES.includes(req.user.role))
    return res.status(403).json({ error: 'forbidden' });
  const {
    nickname, real_name, staffs,
    merchant_name, contact_number, office_number, mobile_number, address, postcode, road, town, district, mrt, business_hours, business_licence,
    country,
  } = req.body || {};
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'not_found' });

  let changed = false;

  if (nickname !== undefined) {
    const v = nickname === null ? null : String(nickname).trim() || null;
    db.prepare('UPDATE users SET nickname = ? WHERE id = ?').run(v, user.id);
    changed = true;
  }
  if (real_name !== undefined) {
    const v = real_name === null ? null : String(real_name).trim() || null;
    db.prepare('UPDATE users SET real_name = ? WHERE id = ?').run(v, user.id);
    changed = true;
  }

  if (staffs !== undefined) {
    if (!Array.isArray(staffs)) return res.status(400).json({ error: 'invalid_staffs' });
    const normalized = staffs.map((s) => {
      const sm = String(s?.staff_mobile || '').trim();
      if (!sm) throw new Error('staff_mobile_required');
      return { staff_mobile: sm, is_admin: s?.is_admin ? 1 : 0, name: s?.name ? String(s.name).trim() : null };
    });
    const seen = new Set();
    for (const s of normalized) {
      if (s.staff_mobile === user.mobile) return res.status(400).json({ error: 'staff_cannot_be_owner' });
      if (seen.has(s.staff_mobile)) return res.status(400).json({ error: 'duplicate_staff_mobile' });
      seen.add(s.staff_mobile);
    }
    const findUserByMobile = db.prepare('SELECT id FROM users WHERE mobile = ?');
    const createUser = db.prepare('INSERT INTO users (user_code, mobile, role) VALUES (?, ?, ?)');
    const setUserRole = db.prepare("UPDATE users SET role = ? WHERE id = ? AND role NOT IN ('admin', 'super_admin')");
    const delExisting = db.prepare('DELETE FROM vendor_staff WHERE vendor_user_id = ?');
    const insStaff = db.prepare(
      'INSERT INTO vendor_staff (vendor_user_id, staff_mobile, staff_user_id, is_admin, name) VALUES (?, ?, ?, ?, ?)'
    );
    const tx = db.transaction((vendorUserId, list) => {
      delExisting.run(vendorUserId);
      for (const row of list) {
        let staffUser = findUserByMobile.get(row.staff_mobile);
        if (!staffUser) {
          const userCode = 'U' + nanoid(8).toUpperCase();
          const inserted = createUser.run(userCode, row.staff_mobile, user.role);
          staffUser = { id: inserted.lastInsertRowid };
        } else {
          setUserRole.run(user.role, staffUser.id);
        }
        insStaff.run(vendorUserId, row.staff_mobile, staffUser.id, row.is_admin, row.name);
      }
    });
    try { tx(user.id, normalized); }
    catch { return res.status(400).json({ error: 'invalid_staffs' }); }
    changed = true;
  }

  const profileFields = { merchant_name, contact_number, office_number, mobile_number, address, postcode, road, town, district, mrt, business_hours, business_licence, country };
  const profileKeys = Object.keys(profileFields).filter((k) => profileFields[k] !== undefined);
  if (profileKeys.length > 0) {
    const existing = db.prepare('SELECT * FROM vendor_profiles WHERE user_id = ?').get(user.id);
    const norm = (v) => (v === null ? null : (String(v).trim() || null));
    const next = {
      merchant_name: merchant_name !== undefined ? norm(merchant_name) : (existing?.merchant_name ?? null),
      contact_number: contact_number !== undefined ? norm(contact_number) : (existing?.contact_number ?? null),
      office_number: office_number !== undefined ? norm(office_number) : (existing?.office_number ?? null),
      mobile_number: mobile_number !== undefined ? norm(mobile_number) : (existing?.mobile_number ?? null),
      address: address !== undefined ? norm(address) : (existing?.address ?? null),
      post_code: postcode !== undefined ? norm(postcode) : (existing?.post_code ?? null),
      road: road !== undefined ? norm(road) : (existing?.road ?? null),
      town: town !== undefined ? norm(town) : (existing?.town ?? null),
      district: district !== undefined ? norm(district) : (existing?.district ?? null),
      mrt: mrt !== undefined ? norm(mrt) : (existing?.mrt ?? null),
      business_hours: business_hours !== undefined ? norm(business_hours) : (existing?.business_hours ?? null),
      business_licence: business_licence !== undefined ? norm(business_licence) : (existing?.business_licence ?? null),
      country: country !== undefined ? (country === 'CN' ? 'CN' : 'SG') : (existing?.country ?? 'SG'),
    };
    if (existing) {
      db.prepare(
        `UPDATE vendor_profiles
         SET merchant_name = ?, contact_number = ?, office_number = ?, mobile_number = ?, address = ?, post_code = ?,
             road = ?, town = ?, district = ?, mrt = ?,
             business_hours = ?, business_licence = ?,
             country = ?,
             updated_at = datetime('now')
         WHERE user_id = ?`
      ).run(
        next.merchant_name || user.nickname || user.user_code,
        next.contact_number || user.mobile,
        next.office_number,
        next.mobile_number,
        next.address, next.post_code, next.road, next.town, next.district, next.mrt,
        next.business_hours, next.business_licence,
        next.country,
        user.id,
      );
    } else {
      db.prepare(
        `INSERT INTO vendor_profiles
           (user_id, merchant_name, contact_number, office_number, mobile_number, address, post_code, road, town, district, mrt, business_hours, business_licence, country)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        user.id,
        next.merchant_name || user.nickname || user.user_code,
        next.contact_number || user.mobile,
        next.office_number,
        next.mobile_number,
        next.address, next.post_code, next.road, next.town, next.district, next.mrt,
        next.business_hours, next.business_licence,
        next.country,
      );
    }
    changed = true;
  }

  if (changed) {
    db.prepare(`UPDATE users SET updated_at = datetime('now') WHERE id = ?`).run(user.id);
  }
  res.json({ ok: true });
});

module.exports = router;
