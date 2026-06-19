const router = require('express').Router();
const db = require('../db');
const { nanoid } = require('nanoid');
const { authRequired, requireAdmin, requireRole } = require('../auth');
const { ALL_ROLES, VENDOR_ROLES } = require('../roles');
const { getConfig, setConfig, allConfig } = require('../configStore');
const { canTransition } = require('../orderStates');

function isValidMobile(m) {
  if (typeof m !== 'string') return false;
  // +65 Singapore: 8 digits starting with 8 or 9
  if (/^\+65[89]\d{7}$/.test(m)) return true;
  // +60 Malaysia: 8 digits
  if (/^\+60\d{8}$/.test(m)) return true;
  // +86 China: 13 digits starting with 1
  if (/^\+861\d{12}$/.test(m)) return true;
  return /^\+\d{8,16}$/.test(m);
}

// GET /api/admin/config
router.get('/config', authRequired, requireAdmin, (req, res) => {
  res.json({ config: allConfig() });
});

// POST /api/admin/orders/backfill-localized-names  (super_admin)
router.post('/orders/backfill-localized-names', authRequired, requireRole('super_admin'), (req, res) => {
  const rows = db.prepare('SELECT id, meta_json FROM orders WHERE meta_json IS NOT NULL').all();
  let changes = 0;
  const tx = db.transaction(() => {
    for (const r of rows) {
      let meta = null;
      try { meta = JSON.parse(r.meta_json); } catch { meta = null; }
      if (!meta) continue;
      let updated = false;
      if (meta.frame_id && !meta.frame_name_zh) {
        const f = db.prepare('SELECT name_zh FROM spectacle_frames WHERE id = ?').get(meta.frame_id);
        if (f && f.name_zh) { meta.frame_name_zh = f.name_zh; updated = true; }
      }
      if (meta.shop_id && !meta.shop_name_zh) {
        const s = db.prepare('SELECT name_zh FROM partner_shops WHERE id = ?').get(meta.shop_id);
        if (s && s.name_zh) { meta.shop_name_zh = s.name_zh; updated = true; }
      }
      if (meta.lens && meta.lens.brand_id && !meta.lens.brand_name_zh) {
        const b = db.prepare('SELECT name_zh FROM lens_brands WHERE id = ?').get(meta.lens.brand_id);
        if (b && b.name_zh) { meta.lens.brand_name_zh = b.name_zh; meta.brand_name_zh = b.name_zh; updated = true; }
      }
      if (updated) {
        db.prepare('UPDATE orders SET meta_json = ?, updated_at = datetime(\'now\') WHERE id = ?').run(JSON.stringify(meta), r.id);
        changes += 1;
      }
    }
  });
  tx();
  res.json({ updated: changes });
});

// PATCH /api/admin/config { key, value } (super_admin only)
router.patch('/config', authRequired, requireRole('super_admin'), (req, res) => {
  const { key, value } = req.body || {};
  if (!key) return res.status(400).json({ error: 'key_required' });
  setConfig(key, value);
  db.prepare(
    `INSERT INTO admin_audit_logs (actor_user_id, action, target, detail_json) VALUES (?, 'config.update', ?, ?)`
  ).run(req.user.id, key, JSON.stringify({ value }));
  res.json({ ok: true, key, value: getConfig(key) });
});

// GET /api/admin/users (admin+)
router.get('/users', authRequired, requireAdmin, (req, res) => {
  // Keep staff account roles aligned with their vendor owner role for admin visibility.
  db.prepare(
    `UPDATE users
     SET role = (
       SELECT owner.role
       FROM vendor_staff vs
       JOIN users owner ON owner.id = vs.vendor_user_id
       WHERE vs.staff_user_id = users.id
       ORDER BY vs.id DESC
       LIMIT 1
     )
     WHERE id IN (SELECT staff_user_id FROM vendor_staff WHERE staff_user_id IS NOT NULL)
       AND role NOT IN ('admin', 'super_admin')`
  ).run();

  const users = db.prepare('SELECT id, user_code, mobile, nickname, real_name, role, created_at, updated_at FROM users ORDER BY id DESC').all();
  const staffRows = db.prepare(
    `SELECT
       vs.vendor_user_id,
       vs.id,
       vs.staff_mobile,
       vs.staff_user_id,
       vs.is_admin,
       vs.name AS staff_name,
       vu.user_code AS vendor_user_code,
       vu.nickname AS vendor_nickname,
       vu.role AS vendor_role,
       su.user_code AS staff_user_code,
       su.nickname AS staff_nickname,
       su.role AS staff_role
     FROM vendor_staff vs
     JOIN users vu ON vu.id = vs.vendor_user_id
     LEFT JOIN users su ON su.id = vs.staff_user_id
     ORDER BY vs.id ASC`
  ).all();

  const staffsByVendor = new Map();
  const staffOfUser = new Map();
  for (const row of staffRows) {
    if (!staffsByVendor.has(row.vendor_user_id)) staffsByVendor.set(row.vendor_user_id, []);
    staffsByVendor.get(row.vendor_user_id).push({
      id: row.id,
      staff_mobile: row.staff_mobile,
      staff_user_id: row.staff_user_id,
      is_admin: row.is_admin,
      name: row.staff_name,
      vendor_user_id: row.vendor_user_id,
      vendor_user_code: row.vendor_user_code,
      vendor_nickname: row.vendor_nickname,
      vendor_role: row.vendor_role,
      user_code: row.staff_user_code,
      nickname: row.staff_nickname,
      role: row.staff_role,
    });

    if (row.staff_user_id) {
      if (!staffOfUser.has(row.staff_user_id)) staffOfUser.set(row.staff_user_id, []);
      staffOfUser.get(row.staff_user_id).push({
        id: row.id,
        vendor_user_id: row.vendor_user_id,
        vendor_user_code: row.vendor_user_code,
        vendor_nickname: row.vendor_nickname,
        vendor_role: row.vendor_role,
        staff_mobile: row.staff_mobile,
        is_admin: row.is_admin,
      });
    }
  }

  const enriched = users.map((u) => {
    const profile = db.prepare(
      `SELECT merchant_name, contact_number, office_number, mobile_number, address, post_code AS postcode, road, town, district, mrt,
              business_hours, business_licence, country
       FROM vendor_profiles WHERE user_id = ?`
    ).get(u.id) || null;
    return {
      ...u,
      vendor_profile: profile,
      staffs: staffsByVendor.get(u.id) || [],
      staff_of: staffOfUser.get(u.id) || [],
    };
  });
  res.json({ users: enriched });
});

// POST /api/admin/users  { mobile, role, nickname?, real_name?, merchant_name?, contact_number?, office_number?, mobile_number?, address?, postcode?, road?, town?, district?, mrt?, business_hours?, business_licence?, staffs? } (admin+)
router.post('/users', authRequired, requireAdmin, (req, res) => {
  const {
    mobile, role, nickname, real_name,
    merchant_name, contact_number, office_number, mobile_number,
    address, postcode, road, town, district, mrt, business_hours, business_licence,
    country,
    staffs,
  } = req.body || {};
  const parsedMobile = String(mobile || '').trim();
  const parsedRole = String(role || '').trim();

  if (!parsedMobile) return res.status(400).json({ error: 'mobile_required' });
  if (!isValidMobile(parsedMobile)) return res.status(400).json({ error: 'invalid_mobile' });
  if (!parsedRole) return res.status(400).json({ error: 'role_required' });
  if (!VENDOR_ROLES.includes(parsedRole)) return res.status(400).json({ error: 'invalid_vendor_role' });

  let normalizedStaffs = [];
  if (staffs !== undefined) {
    if (!Array.isArray(staffs)) return res.status(400).json({ error: 'invalid_staffs' });
    try {
      normalizedStaffs = staffs.map((s) => {
        const staffMobile = String(s?.staff_mobile || '').trim();
        if (!staffMobile) throw new Error('staff_mobile_required');
        if (!isValidMobile(staffMobile)) throw new Error('invalid_staff_mobile');
        if (staffMobile === parsedMobile) throw new Error('staff_cannot_be_owner');
        return {
          staff_mobile: staffMobile,
          is_admin: s?.is_admin ? 1 : 0,
          name: s?.name ? String(s.name).trim() : null,
        };
      });
    } catch (e) {
      if (e.message === 'staff_mobile_required') return res.status(400).json({ error: 'staff_mobile_required' });
      if (e.message === 'invalid_staff_mobile') return res.status(400).json({ error: 'invalid_staff_mobile' });
      if (e.message === 'staff_cannot_be_owner') return res.status(400).json({ error: 'staff_cannot_be_owner' });
      return res.status(400).json({ error: 'invalid_staffs' });
    }

    const seen = new Set();
    for (const s of normalizedStaffs) {
      if (seen.has(s.staff_mobile)) return res.status(400).json({ error: 'duplicate_staff_mobile' });
      seen.add(s.staff_mobile);
    }
  }

  const existing = db.prepare('SELECT id FROM users WHERE mobile = ?').get(parsedMobile);
  if (existing) return res.status(409).json({ error: 'mobile_taken' });

  const code = 'U' + nanoid(8).toUpperCase();
  const insertUser = db.prepare('INSERT INTO users (user_code, mobile, nickname, real_name, role) VALUES (?, ?, ?, ?, ?)');
  const insertProfile = db.prepare(
    `INSERT INTO vendor_profiles
       (user_id, merchant_name, contact_number, office_number, mobile_number, address, post_code, road, town, district, mrt, business_hours, business_licence, country)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const findUserByMobile = db.prepare('SELECT id FROM users WHERE mobile = ?');
  const createUser = db.prepare('INSERT INTO users (user_code, mobile, role) VALUES (?, ?, ?)');
  const setUserRole = db.prepare("UPDATE users SET role = ? WHERE id = ? AND role NOT IN ('admin', 'super_admin')");
  const insStaff = db.prepare(
    'INSERT INTO vendor_staff (vendor_user_id, staff_mobile, staff_user_id, is_admin, name) VALUES (?, ?, ?, ?, ?)'
  );

  const tx = db.transaction(() => {
    const info = insertUser.run(
      code,
      parsedMobile,
      nickname ? String(nickname).trim() : null,
      real_name ? String(real_name).trim() : null,
      parsedRole,
    );
    const userId = info.lastInsertRowid;
    insertProfile.run(
      userId,
      String(merchant_name || nickname || real_name || code).trim(),
      String(contact_number || parsedMobile).trim(),
      office_number ? String(office_number).trim() : null,
      mobile_number ? String(mobile_number).trim() : null,
      address ? String(address).trim() : null,
      postcode ? String(postcode).trim() : null,
      road ? String(road).trim() : null,
      town ? String(town).trim() : null,
      district ? String(district).trim() : null,
      mrt ? String(mrt).trim() : null,
      business_hours ? String(business_hours).trim() : null,
      business_licence ? String(business_licence).trim() : null,
      country === 'CN' ? 'CN' : 'SG',
    );

    for (const s of normalizedStaffs) {
      let staffUser = findUserByMobile.get(s.staff_mobile);
      if (!staffUser) {
        const userCode = 'U' + nanoid(8).toUpperCase();
        const inserted = createUser.run(userCode, s.staff_mobile, parsedRole);
        staffUser = { id: inserted.lastInsertRowid };
      } else {
        setUserRole.run(parsedRole, staffUser.id);
      }
      insStaff.run(userId, s.staff_mobile, staffUser.id, s.is_admin, s.name);
    }

    return userId;
  });

  const userId = tx();
  const created = db.prepare('SELECT id, user_code, mobile, nickname, real_name, role, created_at FROM users WHERE id = ?').get(userId);

  db.prepare(
    `INSERT INTO admin_audit_logs (actor_user_id, action, target, detail_json) VALUES (?, 'user.vendor.create', ?, ?)`
  ).run(req.user.id, String(userId), JSON.stringify({ mobile: parsedMobile, role: parsedRole, staffs_count: normalizedStaffs.length }));

  res.status(201).json({ user: created });
});

// PATCH /api/admin/users/:id  { role, mobile, nickname, real_name, merchant_name?, contact_number?, office_number?, mobile_number?, address?, postcode?, road?, town?, district?, mrt?, business_hours?, business_licence?, staffs? } (super_admin)
router.patch('/users/:id', authRequired, requireRole('super_admin'), (req, res) => {
  const {
    role, mobile, nickname, real_name, staffs,
    merchant_name, contact_number, office_number, mobile_number, address, postcode, road, town, district, mrt, business_hours, business_licence,
    country,
  } = req.body || {};
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'not_found' });

  let changed = false;

  if (nickname !== undefined) {
    const v = nickname === null ? null : String(nickname).trim() || null;
    db.prepare('UPDATE users SET nickname = ? WHERE id = ?').run(v, req.params.id);
    db.prepare(
      `INSERT INTO admin_audit_logs (actor_user_id, action, target, detail_json) VALUES (?, 'user.nickname.update', ?, ?)`
    ).run(req.user.id, String(req.params.id), JSON.stringify({ nickname: v }));
    changed = true;
  }

  if (real_name !== undefined) {
    const v = real_name === null ? null : String(real_name).trim() || null;
    db.prepare('UPDATE users SET real_name = ? WHERE id = ?').run(v, req.params.id);
    db.prepare(
      `INSERT INTO admin_audit_logs (actor_user_id, action, target, detail_json) VALUES (?, 'user.real_name.update', ?, ?)`
    ).run(req.user.id, String(req.params.id), JSON.stringify({ real_name: v }));
    changed = true;
  }

  if (role !== undefined) {
    if (!ALL_ROLES.includes(role)) return res.status(400).json({ error: 'invalid_role' });
    db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, req.params.id);
    db.prepare(
      `INSERT INTO admin_audit_logs (actor_user_id, action, target, detail_json) VALUES (?, 'user.role.update', ?, ?)`
    ).run(req.user.id, String(req.params.id), JSON.stringify({ role }));
    changed = true;

    // If a vendor owner's role changes, keep associated staff users in sync.
    if (!['consumer', 'admin', 'super_admin'].includes(role)) {
      db.prepare(
        `UPDATE users
         SET role = ?
         WHERE id IN (
           SELECT staff_user_id FROM vendor_staff
           WHERE vendor_user_id = ? AND staff_user_id IS NOT NULL
         )
           AND role NOT IN ('admin', 'super_admin')`
      ).run(role, req.params.id);
    }
  }

  if (mobile !== undefined) {
    const dup = db.prepare('SELECT id FROM users WHERE mobile = ? AND id != ?').get(mobile, req.params.id);
    if (dup) return res.status(409).json({ error: 'mobile_taken' });
    db.prepare('UPDATE users SET mobile = ? WHERE id = ?').run(mobile, req.params.id);
    db.prepare(
      `INSERT INTO admin_audit_logs (actor_user_id, action, target, detail_json) VALUES (?, 'user.mobile.update', ?, ?)`
    ).run(req.user.id, String(req.params.id), JSON.stringify({ mobile }));
    changed = true;
  }

  if (staffs !== undefined) {
    const effectiveRole = role !== undefined ? role : user.role;
    const isVendorUser = !['consumer', 'admin', 'super_admin'].includes(effectiveRole);
    if (!isVendorUser) return res.status(400).json({ error: 'invalid_vendor_user' });
    if (!Array.isArray(staffs)) return res.status(400).json({ error: 'invalid_staffs' });

    const normalized = staffs.map((s) => {
      const sm = String(s?.staff_mobile || '').trim();
      if (!sm) throw new Error('staff_mobile_required');
      return { staff_mobile: sm, is_admin: s?.is_admin ? 1 : 0, name: s?.name ? String(s.name).trim() : null };
    });

    const seen = new Set();
    for (const s of normalized) {
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

    const replaceStaffTx = db.transaction((vendorUserId, list) => {
      delExisting.run(vendorUserId);
      for (const row of list) {
        let staffUser = findUserByMobile.get(row.staff_mobile);
        if (!staffUser) {
          const userCode = 'U' + nanoid(8).toUpperCase();
          const inserted = createUser.run(userCode, row.staff_mobile, effectiveRole);
          staffUser = { id: inserted.lastInsertRowid };
        } else {
          setUserRole.run(effectiveRole, staffUser.id);
        }
        insStaff.run(vendorUserId, row.staff_mobile, staffUser.id, row.is_admin, row.name);
      }
    });

    try {
      replaceStaffTx(user.id, normalized);
    } catch {
      return res.status(400).json({ error: 'invalid_staffs' });
    }

    db.prepare(
      `INSERT INTO admin_audit_logs (actor_user_id, action, target, detail_json) VALUES (?, 'user.staffs.update', ?, ?)`
    ).run(req.user.id, String(req.params.id), JSON.stringify({ staffs_count: normalized.length }));
    changed = true;
  }

  if (changed) {
    db.prepare(`UPDATE users SET updated_at = datetime('now') WHERE id = ?`).run(req.params.id);
  }

  const profileFields = {
    merchant_name, contact_number, office_number, mobile_number, address, postcode, road, town, district, mrt, business_hours, business_licence, country,
  };
  const profileKeys = Object.keys(profileFields).filter((k) => profileFields[k] !== undefined);
  if (profileKeys.length > 0) {
    const existing = db.prepare('SELECT * FROM vendor_profiles WHERE user_id = ?').get(req.params.id);
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
        req.params.id,
      );
    } else {
      db.prepare(
        `INSERT INTO vendor_profiles
           (user_id, merchant_name, contact_number, office_number, mobile_number, address, post_code, road, town, district, mrt, business_hours, business_licence, country)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        req.params.id,
        next.merchant_name || user.nickname || user.user_code,
        next.contact_number || user.mobile,
        next.office_number,
        next.mobile_number,
        next.address, next.post_code, next.road, next.town, next.district, next.mrt,
        next.business_hours, next.business_licence,
        next.country,
      );
    }
    db.prepare(
      `INSERT INTO admin_audit_logs (actor_user_id, action, target, detail_json) VALUES (?, 'user.vendor_profile.update', ?, ?)`
    ).run(req.user.id, String(req.params.id), JSON.stringify({ fields: profileKeys }));
  }

  res.json({ ok: true });
});

// GET /api/admin/orders
router.get('/orders', authRequired, requireAdmin, (req, res) => {
  const rows = db.prepare('SELECT * FROM orders ORDER BY id DESC LIMIT 200').all();
  for (const r of rows) {
    r.meta = r.meta_json ? JSON.parse(r.meta_json) : null;
    r.items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(r.id);
    r.payments = db.prepare('SELECT * FROM payments WHERE order_id = ?').all(r.id);
  }
  res.json({ orders: rows });
});

// PATCH /api/admin/orders/:id/status  { status } (admin+)
// Admin can set any normal transition, plus force-cancel or force-close any non-terminal order.
const TERMINAL_STATES = ['Cancelled', 'SystemDone'];
const ADMIN_FORCE_TARGETS = ['Cancelled', 'SystemDone'];

router.patch('/orders/:id/status', authRequired, requireAdmin, (req, res) => {
  const { status, vendor_price } = req.body || {};
  if (!status) return res.status(400).json({ error: 'status_required' });
  const o = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!o) return res.status(404).json({ error: 'not_found' });

  const isForceTarget = ADMIN_FORCE_TARGETS.includes(status);
  const isAlreadyTerminal = TERMINAL_STATES.includes(o.status);

  if (isAlreadyTerminal) {
    return res.status(400).json({ error: 'order_already_terminal', current: o.status });
  }

  if (!isForceTarget && !canTransition(o.status, status)) {
    return res.status(400).json({ error: 'invalid_transition', from: o.status, to: status });
  }

  // If publishing for bid, store vendor_price in meta
  if (status === 'PendingForBid' && vendor_price != null) {
    const meta = o.meta_json ? JSON.parse(o.meta_json) : {};
    meta.vendor_price = Number(vendor_price);
    db.prepare(`UPDATE orders SET meta_json = ? WHERE id = ?`).run(JSON.stringify(meta), o.id);
  }

  db.prepare(
    `UPDATE orders SET status = ?, updated_at = datetime('now') WHERE id = ?`
  ).run(status, o.id);
  db.prepare(
    `INSERT INTO admin_audit_logs (actor_user_id, action, target, detail_json) VALUES (?, 'order.status.update', ?, ?)`
  ).run(req.user.id, String(o.id), JSON.stringify({ from: o.status, to: status }));
  const updated = db.prepare('SELECT * FROM orders WHERE id = ?').get(o.id);
  updated.meta = updated.meta_json ? JSON.parse(updated.meta_json) : null;
  res.json({ order: updated });
});

// PATCH /api/admin/orders/:id/vendor-price  { vendor_price } (admin+)
router.patch('/orders/:id/vendor-price', authRequired, requireAdmin, (req, res) => {
  const { vendor_price } = req.body || {};
  if (vendor_price == null || isNaN(Number(vendor_price)) || Number(vendor_price) <= 0)
    return res.status(400).json({ error: 'invalid_vendor_price' });
  const o = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!o) return res.status(404).json({ error: 'not_found' });
  if (o.status !== 'PendingForBid') return res.status(400).json({ error: 'not_pending_for_bid' });
  const meta = o.meta_json ? JSON.parse(o.meta_json) : {};
  meta.vendor_price = Number(vendor_price);
  db.prepare(`UPDATE orders SET meta_json = ?, updated_at = datetime('now') WHERE id = ?`).run(JSON.stringify(meta), o.id);
  db.prepare(
    `INSERT INTO admin_audit_logs (actor_user_id, action, target, detail_json) VALUES (?, 'order.vendor_price.update', ?, ?)`
  ).run(req.user.id, String(o.id), JSON.stringify({ vendor_price: meta.vendor_price }));
  res.json({ ok: true });
});

module.exports = router;
