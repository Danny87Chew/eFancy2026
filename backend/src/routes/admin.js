const router = require('express').Router();
const db = require('../db');
const { nanoid } = require('nanoid');
const { authRequired, requireAdmin, requireRole } = require('../auth');
const { ALL_ROLES, VENDOR_ROLES } = require('../roles');
const { getConfig, setConfig, allConfig } = require('../configStore');
const { canTransition } = require('../orderStates');
const config = require('../config');
const http = require('http');
const https = require('https');
const { URL } = require('url');

function httpPostJson(urlStr, body, headers = {}, timeout = 10000) {
  return new Promise((resolve, reject) => {
    try {
      const url = new URL(urlStr);
      const data = JSON.stringify(body || {});
      const opts = {
        method: 'POST',
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname + (url.search || ''),
        headers: Object.assign({ 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }, headers),
        timeout,
      };
      const lib = url.protocol === 'https:' ? https : http;
      const req = lib.request(opts, (res) => {
        let out = '';
        res.setEncoding('utf8');
        res.on('data', d => out += d);
        res.on('end', () => {
          try { const json = out ? JSON.parse(out) : null; resolve({ statusCode: res.statusCode, body: json }); }
          catch (e) { resolve({ statusCode: res.statusCode, body: out }); }
        });
      });
      req.on('error', reject);
      req.write(data);
      req.end();
    } catch (e) { reject(e); }
  });
}

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
  const rows = db.prepare(
    `SELECT o.*,
       u.nickname AS user_nickname,
       u.real_name AS user_real_name,
       u.mobile AS user_mobile,
       (SELECT COUNT(*) FROM order_comments c WHERE c.order_id = o.id) AS comments_count
     FROM orders o
     LEFT JOIN users u ON u.id = o.user_id
     ORDER BY o.id DESC LIMIT 200`
  ).all();
  for (const r of rows) {
    r.meta = r.meta_json ? JSON.parse(r.meta_json) : null;
    r.items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(r.id);
    r.payments = db.prepare('SELECT * FROM payments WHERE order_id = ?').all(r.id);
    if (r.delivery_address_id != null) {
      r.delivery_address = db.prepare('SELECT * FROM delivery_addresses WHERE id = ?').get(r.delivery_address_id) || { id: r.delivery_address_id };
    } else if (r.meta && r.meta.delivery_address) {
      r.delivery_address = r.meta.delivery_address;
    }
    r.has_opening_comments = Number(r.comments_count || 0) > 0;
  }
  res.json({ orders: rows });
});

// PATCH /api/admin/orders/:id/status  { status } (admin+)
// Admin can set any normal transition, plus force-cancel or force-close any non-terminal order.
const TERMINAL_STATES = ['Cancelled', 'SystemDone'];
const ADMIN_FORCE_TARGETS = ['Cancelled', 'SystemDone'];

router.patch('/orders/:id/status', authRequired, (req, res) => {
  // allow admin, super_admin, or platform staff to change statuses via this endpoint
  if (!req.user || !['admin', 'super_admin', 'platform_staff'].includes(req.user.role))
    return res.status(403).json({ error: 'forbidden' });

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

// POST /api/admin/orders/:id/release-for-delivery
// Notify shipping partner and set order to PendingForDelivery
router.post('/orders/:id/release-for-delivery', authRequired, (req, res) => {
  if (!req.user || !['admin', 'super_admin', 'platform_staff'].includes(req.user.role))
    return res.status(403).json({ error: 'forbidden' });

  const o = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!o) return res.status(404).json({ error: 'not_found' });

  // Only allow from ReadyForDelivery
  if (o.status !== 'ReadyForDelivery') return res.status(400).json({ error: 'invalid_status' });

  if (!config.shippingPartner.url) return res.status(500).json({ error: 'shipping_partner_not_configured' });

  const payload = {
    order_id: o.id,
    order_code: o.order_code,
    recipient: o.meta_json ? (JSON.parse(o.meta_json).delivery_address || null) : null,
    meta: o.meta_json ? JSON.parse(o.meta_json) : null,
  };

  const headers = {};
  if (config.shippingPartner.apiKey) headers['X-API-KEY'] = config.shippingPartner.apiKey;

  httpPostJson(config.shippingPartner.url, payload, headers).then(result => {
    if (!result || !result.statusCode || result.statusCode >= 400) {
      return res.status(502).json({ error: 'shipping_partner_error', detail: result && result.body });
    }

    // store partner response in meta
    const meta = o.meta_json ? JSON.parse(o.meta_json) : {};
    meta.shipping_partner = { released_at: new Date().toISOString(), response: result.body };
    db.prepare('UPDATE orders SET meta_json = ?, status = ?, updated_at = datetime(\'now\') WHERE id = ?')
      .run(JSON.stringify(meta), 'PendingForDelivery', o.id);
    db.prepare(
      `INSERT INTO admin_audit_logs (actor_user_id, action, target, detail_json) VALUES (?, 'order.release_for_delivery', ?, ?)`
    ).run(req.user.id, String(o.id), JSON.stringify({ partner_response: result.body }));

    const updated = db.prepare('SELECT * FROM orders WHERE id = ?').get(o.id);
    updated.meta = updated.meta_json ? JSON.parse(updated.meta_json) : null;
    res.json({ ok: true, order: updated });
  }).catch(err => {
    console.error('Partner request failed', err);
    res.status(502).json({ error: 'shipping_partner_unreachable' });
  });
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

const enrichGoodsWithImages = (rows) => rows.map((row) => ({
  ...row,
  images: db.prepare('SELECT url FROM goods_images WHERE good_id = ? ORDER BY sort_order, id').all(row.id).map((img) => img.url)
}));

// GET /api/admin/goods-categories (admin+)
router.get('/goods-categories', authRequired, requireAdmin, (req, res) => {
  const categories = db.prepare('SELECT id, name, created_at FROM goods_categories ORDER BY name ASC').all();
  res.json({ categories });
});

// POST /api/admin/goods-categories { name } (admin+)
router.post('/goods-categories', authRequired, requireAdmin, (req, res) => {
  const { name } = req.body || {};
  const trimmed = String(name || '').trim();
  if (!trimmed) return res.status(400).json({ error: 'name_required' });
  try {
    const info = db.prepare('INSERT INTO goods_categories (name) VALUES (?)').run(trimmed);
    const created = db.prepare('SELECT id, name, created_at FROM goods_categories WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json({ category: created });
  } catch (err) {
    if (err && (err.code === 'SQLITE_CONSTRAINT' || String(err.message || '').toLowerCase().includes('unique'))) {
      return res.status(409).json({ error: 'category_exists' });
    }
    console.error('Failed creating goods category', err);
    res.status(500).json({ error: 'server_error' });
  }
});

// PATCH /api/admin/goods-categories/:id { name }
router.patch('/goods-categories/:id', authRequired, requireAdmin, (req, res) => {
  const { name } = req.body || {};
  const trimmed = String(name || '').trim();
  if (!trimmed) return res.status(400).json({ error: 'name_required' });
  const existing = db.prepare('SELECT id FROM goods_categories WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'not_found' });
  try {
    db.prepare('UPDATE goods_categories SET name = ? WHERE id = ?').run(trimmed, req.params.id);
    const updated = db.prepare('SELECT id, name, created_at FROM goods_categories WHERE id = ?').get(req.params.id);
    res.json({ category: updated });
  } catch (err) {
    if (err && (err.code === 'SQLITE_CONSTRAINT' || String(err.message || '').toLowerCase().includes('unique'))) {
      return res.status(409).json({ error: 'category_exists' });
    }
    console.error('Failed updating goods category', err);
    res.status(500).json({ error: 'server_error' });
  }
});

// DELETE /api/admin/goods-categories/:id
router.delete('/goods-categories/:id', authRequired, requireAdmin, (req, res) => {
  const existing = db.prepare('SELECT id FROM goods_categories WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'not_found' });
  db.prepare('DELETE FROM goods_categories WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// GET /api/admin/goods-categories/:id/subcategories (admin+)
router.get('/goods-categories/:id/subcategories', authRequired, requireAdmin, (req, res) => {
  const categoryId = Number(req.params.id);
  const category = db.prepare('SELECT id FROM goods_categories WHERE id = ?').get(categoryId);
  if (!category) return res.status(404).json({ error: 'not_found' });
  const subcategories = db.prepare('SELECT id, name, created_at FROM goods_subcategories WHERE goods_category_id = ? ORDER BY name ASC').all(categoryId);
  res.json({ subcategories });
});

// POST /api/admin/goods-categories/:id/subcategories { name } (admin+)
router.post('/goods-categories/:id/subcategories', authRequired, requireAdmin, (req, res) => {
  const categoryId = Number(req.params.id);
  const category = db.prepare('SELECT id FROM goods_categories WHERE id = ?').get(categoryId);
  if (!category) return res.status(404).json({ error: 'not_found' });
  const { name } = req.body || {};
  const trimmed = String(name || '').trim();
  if (!trimmed) return res.status(400).json({ error: 'name_required' });
  try {
    const info = db.prepare('INSERT INTO goods_subcategories (goods_category_id, name) VALUES (?, ?)').run(categoryId, trimmed);
    const created = db.prepare('SELECT id, name, created_at FROM goods_subcategories WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json({ subcategory: created });
  } catch (err) {
    if (err && (err.code === 'SQLITE_CONSTRAINT' || String(err.message || '').toLowerCase().includes('unique'))) {
      return res.status(409).json({ error: 'subcategory_exists' });
    }
    console.error('Failed creating goods sub-category', err);
    res.status(500).json({ error: 'server_error' });
  }
});

// GET /api/admin/goods?category=...  (admin+)
router.get('/goods', authRequired, requireAdmin, (req, res) => {
  const { category } = req.query || {};
  let rows;
  if (category) rows = db.prepare('SELECT * FROM goods WHERE category = ? ORDER BY id DESC').all(category);
  else rows = db.prepare('SELECT * FROM goods ORDER BY id DESC').all();
  res.json({ goods: enrichGoodsWithImages(rows) });
});

// PATCH /api/admin/goods/:id  { name?, code?, category?, subcategory?, kind?, price?, source_price?, market_price?, promotion_price?, stock?, weight?, available_from?, cutting?, active?, images? }
router.patch('/goods/:id', authRequired, requireAdmin, (req, res) => {
  const existing = db.prepare('SELECT * FROM goods WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'not_found' });

  const { name, code, category, subcategory, kind, price, source_price, market_price, promotion_price, stock, weight, available_from, cutting, active, images } = req.body || {};
  const updates = [];
  const values = [];

  if (name !== undefined) {
    const trimmedName = String(name).trim();
    if (!trimmedName) return res.status(400).json({ error: 'name_required' });
    updates.push('name = ?'); values.push(trimmedName);
  }
  if (code !== undefined) {
    updates.push('code = ?'); values.push(code == null || String(code).trim() === '' ? null : String(code).trim());
  }
  if (category !== undefined) {
    updates.push('category = ?'); values.push(category == null || String(category).trim() === '' ? null : String(category).trim());
  }
  if (kind !== undefined) {
    updates.push('kind = ?'); values.push(kind === 'fresh_preorder' ? 'fresh_preorder' : 'normal');
  }

  let effectiveSourcePrice;
  if (source_price !== undefined) effectiveSourcePrice = Number(source_price);
  else if (price !== undefined) effectiveSourcePrice = Number(price);
  if (effectiveSourcePrice !== undefined) {
    updates.push('price = ?'); values.push(effectiveSourcePrice);
    updates.push('source_price = ?'); values.push(effectiveSourcePrice);
  }
  if (market_price !== undefined) {
    updates.push('market_price = ?'); values.push(Number(market_price));
  }
  if (promotion_price !== undefined) {
    updates.push('promotion_price = ?'); values.push(Number(promotion_price));
  }
  if (stock !== undefined) {
    updates.push('stock = ?'); values.push(Number(stock) || 0);
  }
  if (weight !== undefined) {
    updates.push('weight = ?'); values.push(Number(weight) || 0);
  }
  if (available_from !== undefined) {
    updates.push('available_from = ?'); values.push(available_from == null || String(available_from).trim() === '' ? null : String(available_from).trim());
  }
  if (cutting !== undefined) {
    updates.push('cutting = ?'); values.push(cutting == null || String(cutting).trim() === '' ? null : String(cutting).trim());
  }
  if (subcategory !== undefined) {
    updates.push('subcategory = ?'); values.push(subcategory == null || String(subcategory).trim() === '' ? null : String(subcategory).trim());
  }
  if (active !== undefined) {
    updates.push('active = ?'); values.push(active ? 1 : 0);
  }

  if (updates.length === 0 && images === undefined) return res.status(400).json({ error: 'no_changes' });

  try {
    const tx = db.transaction(() => {
      if (updates.length > 0) {
        db.prepare(`UPDATE goods SET ${updates.join(', ')} WHERE id = ?`).run(...values, req.params.id);
      }
      if (images !== undefined) {
        db.prepare('DELETE FROM goods_images WHERE good_id = ?').run(req.params.id);
        if (Array.isArray(images)) {
          const stmt = db.prepare('INSERT INTO goods_images (good_id, url, sort_order) VALUES (?, ?, ?)');
          images.forEach((url, idx) => {
            const trimmed = String(url || '').trim();
            if (trimmed) stmt.run(req.params.id, trimmed, idx);
          });
        }
      }
    });
    tx();

    const updated = db.prepare('SELECT * FROM goods WHERE id = ?').get(req.params.id);
    const updatedWithImages = enrichGoodsWithImages([updated])[0];
    db.prepare(`INSERT INTO admin_audit_logs (actor_user_id, action, target, detail_json) VALUES (?, 'goods.update', ?, ?)`)
      .run(req.user.id, String(updated.id), JSON.stringify(updatedWithImages));
    res.json({ good: updatedWithImages });
  } catch (err) {
    if (err && (err.code === 'SQLITE_CONSTRAINT' || String(err.message || '').toLowerCase().includes('unique'))) {
      const msg = String(err.message || '').toLowerCase();
      if (msg.includes('code') || msg.includes('idx_goods_code_unique')) return res.status(409).json({ error: 'code_taken' });
      return res.status(409).json({ error: 'already_exists' });
    }
    console.error('Failed updating good', err);
    res.status(500).json({ error: 'server_error' });
  }
});

// DELETE /api/admin/goods/:id
router.delete('/goods/:id', authRequired, requireAdmin, (req, res) => {
  const existing = db.prepare('SELECT id FROM goods WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'not_found' });
  db.prepare('DELETE FROM goods WHERE id = ?').run(req.params.id);
  db.prepare(`INSERT INTO admin_audit_logs (actor_user_id, action, target, detail_json) VALUES (?, 'goods.delete', ?, ?)`)
    .run(req.user.id, String(req.params.id), JSON.stringify({ deleted: true }));
  res.json({ ok: true });
});

// POST /api/admin/goods  { name, code?, category?, kind?, price?, source_price?, market_price?, promotion_price?, stock?, weight?, available_from?, cutting?, active?, images? }
router.post('/goods', authRequired, requireAdmin, (req, res) => {
  const { name, code, category, subcategory, kind, price, source_price, market_price, promotion_price, stock, weight, available_from, cutting, active, images } = req.body || {};
  if (!name || !String(name).trim()) return res.status(400).json({ error: 'name_required' });
  const effectiveKind = kind === 'fresh_preorder' ? 'fresh_preorder' : 'normal';
  const effectiveCutting = cutting == null || String(cutting).trim() === '' ? null : String(cutting).trim();
  const effectiveSourcePrice = source_price != null ? Number(source_price) : (price != null ? Number(price) : 0);
  const effectiveMarketPrice = market_price != null ? Number(market_price) : 0;
  const effectivePromotionPrice = promotion_price != null ? Number(promotion_price) : 0;
  const effectiveWeight = weight != null ? Number(weight) : 0;
  try {
    const info = db.prepare(
      `INSERT INTO goods (name, code, category, subcategory, kind, cutting, vendor_user_id, price, source_price, market_price, promotion_price, stock, weight, available_from, active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      String(name).trim(), code ? String(code).trim() : null, category ? String(category).trim() : null,
      subcategory ? String(subcategory).trim() : null,
      effectiveKind, effectiveCutting, null, effectiveSourcePrice, effectiveSourcePrice, effectiveMarketPrice, effectivePromotionPrice,
      Number(stock) || 0, Number(effectiveWeight) || 0, available_from ? String(available_from) : null,
      active != null ? (active ? 1 : 0) : 1
    );

    if (Array.isArray(images)) {
      const stmt = db.prepare('INSERT INTO goods_images (good_id, url, sort_order) VALUES (?, ?, ?)');
      images.forEach((url, idx) => {
        const trimmed = String(url || '').trim();
        if (trimmed) stmt.run(info.lastInsertRowid, trimmed, idx);
      });
    }

    const created = db.prepare('SELECT * FROM goods WHERE id = ?').get(info.lastInsertRowid);
    const createdWithImages = enrichGoodsWithImages([created])[0];
    db.prepare(`INSERT INTO admin_audit_logs (actor_user_id, action, target, detail_json) VALUES (?, 'goods.create', ?, ?)`)
      .run(req.user.id, String(created.id), JSON.stringify(createdWithImages));
    res.status(201).json({ good: createdWithImages });
  } catch (err) {
    if (err && (err.code === 'SQLITE_CONSTRAINT' || String(err.message || '').toLowerCase().includes('unique'))) {
      const msg = String(err.message || '').toLowerCase();
      if (msg.includes('code') || msg.includes('idx_goods_code_unique')) return res.status(409).json({ error: 'code_taken' });
      return res.status(409).json({ error: 'already_exists' });
    }
    console.error('Failed creating good', err);
    res.status(500).json({ error: 'server_error' });
  }
});

module.exports = router;
