const { nanoid } = require('nanoid');
const db = require('../db');
const { signToken } = require('../auth');
const { PUBLIC_ROLES } = require('../roles');

const router = require('express').Router();

const VENDOR_REQUIRED_FIELDS = ['merchant_name', 'address', 'post_code', 'contact_number', 'business_hours', 'business_licence'];
const MAX_STAFF = 5;

function isVendorRole(role) {
  return role && role !== 'consumer' && PUBLIC_ROLES.includes(role);
}

function validateVendorInfo(info) {
  if (!info || typeof info !== 'object') return 'vendor_info_required';
  for (const f of VENDOR_REQUIRED_FIELDS) {
    if (!info[f] || String(info[f]).trim() === '') return `missing_${f}`;
  }
  const staffMobiles = (info.staff_mobiles || []).filter(Boolean);
  if (staffMobiles.length > MAX_STAFF) return 'too_many_staff';
  for (const entry of staffMobiles) {
    const m = typeof entry === 'object' ? entry.mobile : entry;
    if (!isValidMobile(m)) return `invalid_staff_mobile:${m}`;
  }
  return null;
}

function resolveDefaultCurrency(user) {
  if (!user) return 'SGD';
  const vp = db.prepare('SELECT country FROM vendor_profiles WHERE user_id = ?').get(user.id);
  if (vp?.country === 'CN') return 'RMB';
  if (vp?.country === 'SG') return 'SGD';
  // staff: look up via vendor owner
  const staffRow = db.prepare(
    `SELECT vp.country FROM vendor_staff vs
     JOIN vendor_profiles vp ON vp.user_id = vs.vendor_user_id
     WHERE vs.staff_mobile = ? LIMIT 1`
  ).get(user.mobile);
  if (staffRow?.country === 'CN') return 'RMB';
  return 'SGD';
}

function enrichUser(user) {
  if (!user) return user;
  return { ...user, default_currency: resolveDefaultCurrency(user) };
}

function resolveVendorContext(user) {
  // Check if this user is a staff member of some vendor
  const staffRow = db.prepare(
    `SELECT vs.*, u.role AS vendor_role, vp.merchant_name
     FROM vendor_staff vs
     JOIN users u ON u.id = vs.vendor_user_id
     LEFT JOIN vendor_profiles vp ON vp.user_id = vs.vendor_user_id
     WHERE vs.staff_mobile = ?`
  ).get(user.mobile);
  if (!staffRow) return null;
  return {
    vendor_user_id: staffRow.vendor_user_id,
    vendor_role: staffRow.vendor_role,
    merchant_name: staffRow.merchant_name,
    is_staff_admin: staffRow.is_admin === 1,
  };
}

function genOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function isValidMobile(m) {
  if (typeof m !== 'string') return false;
  // +65 Singapore: 8 digits starting with 8 or 9
  if (/^\+65[89]\d{7}$/.test(m)) return true;
  // +60 Malaysia: 8 digits
  if (/^\+60\d{8}$/.test(m)) return true;
  // +86 China: 13 digits starting with 1
  if (/^\+861\d{12}$/.test(m)) return true;
  // Generic fallback: +countrycode 7-15 digits
  return /^\+\d{8,16}$/.test(m);
}

// POST /api/auth/otp/request { mobile, intent, role, vendor_info }
router.post('/otp/request', (req, res) => {
  const { mobile, intent, role, vendor_info } = req.body || {};
  if (!isValidMobile(mobile)) return res.status(400).json({ error: 'invalid_mobile' });

  let existing = db.prepare('SELECT id FROM users WHERE mobile = ?').get(mobile);
  if (intent === 'login' && !existing) {
    // Allow login if this mobile is a registered vendor staff member (auto-create account)
    const staffRow = db.prepare(
      `SELECT vs.vendor_user_id, owner.role AS vendor_role
       FROM vendor_staff vs
       JOIN users owner ON owner.id = vs.vendor_user_id
       WHERE vs.staff_mobile = ?`
    ).get(mobile);
    if (staffRow) {
      const userCode = 'U' + require('nanoid').nanoid(8).toUpperCase();
      const inserted = db.prepare(`INSERT INTO users (user_code, mobile, role) VALUES (?, ?, ?)`).run(userCode, mobile, staffRow.vendor_role);
      db.prepare(`UPDATE vendor_staff SET staff_user_id = ? WHERE staff_mobile = ?`).run(inserted.lastInsertRowid, mobile);
      existing = { id: inserted.lastInsertRowid };
    } else {
      return res.status(404).json({ error: 'user_not_found' });
    }
  }
  if (intent === 'register' && existing) {
    return res.status(409).json({ error: 'user_already_exists' });
  }
  if (intent === 'register' && role && !PUBLIC_ROLES.includes(role)) {
    return res.status(400).json({ error: 'invalid_role' });
  }
  if (intent === 'register' && isVendorRole(role)) {
    const err = validateVendorInfo(vendor_info);
    if (err) return res.status(400).json({ error: err });
  }

  const code = genOtp();
  const expires = new Date(Date.now() + 5 * 60 * 1000).toISOString();
  db.prepare(
    'INSERT INTO otp_codes (mobile, code, expires_at) VALUES (?, ?, ?)'
  ).run(mobile, code, expires);
  console.log(`[OTP] ${mobile} (${intent || 'auto'}${role ? '/' + role : ''}) -> ${code}`);
  const payload = { ok: true, intent: intent || 'auto' };
  if (process.env.NODE_ENV !== 'production') payload.devCode = code;
  res.json(payload);
});

// POST /api/auth/otp/verify { mobile, code, intent, role, vendor_info }
router.post('/otp/verify', (req, res) => {
  const { mobile, code, intent, role, vendor_info } = req.body || {};
  if (!isValidMobile(mobile) || !code) return res.status(400).json({ error: 'invalid_input' });
  const row = db
    .prepare(
      `SELECT * FROM otp_codes WHERE mobile = ? AND code = ? AND consumed = 0
       AND expires_at > datetime('now') ORDER BY id DESC LIMIT 1`
    )
    .get(mobile, code);
  if (!row) return res.status(400).json({ error: 'invalid_or_expired_otp' });

  let user = db.prepare('SELECT * FROM users WHERE mobile = ?').get(mobile);
  if (intent === 'login' && !user) {
    // Allow login for vendor staff whose account may not yet exist
    const staffRow = db.prepare(
      `SELECT vs.vendor_user_id, owner.role AS vendor_role
       FROM vendor_staff vs
       JOIN users owner ON owner.id = vs.vendor_user_id
       WHERE vs.staff_mobile = ?`
    ).get(mobile);
    if (staffRow) {
      const userCode = 'U' + require('nanoid').nanoid(8).toUpperCase();
      const inserted = db.prepare(`INSERT INTO users (user_code, mobile, role) VALUES (?, ?, ?)`).run(userCode, mobile, staffRow.vendor_role);
      db.prepare(`UPDATE vendor_staff SET staff_user_id = ? WHERE staff_mobile = ?`).run(inserted.lastInsertRowid, mobile);
      user = db.prepare('SELECT * FROM users WHERE id = ?').get(inserted.lastInsertRowid);
    } else {
      return res.status(404).json({ error: 'user_not_found' });
    }
  }
  if (intent === 'register' && user) {
    return res.status(409).json({ error: 'user_already_exists' });
  }

  let newRole = 'consumer';
  if (intent === 'register' && role) {
    if (!PUBLIC_ROLES.includes(role)) return res.status(400).json({ error: 'invalid_role' });
    newRole = role;
  }

  if (intent === 'register' && isVendorRole(newRole)) {
    const err = validateVendorInfo(vendor_info);
    if (err) return res.status(400).json({ error: err });
  }

  db.prepare('UPDATE otp_codes SET consumed = 1 WHERE id = ?').run(row.id);

  if (!user) {
    const userCode = 'U' + nanoid(8).toUpperCase();
    const preorderOptIn = newRole === 'consumer' ? 1 : 0;
    const info = db
      .prepare('INSERT INTO users (user_code, mobile, role, preorder_notification_opt_in) VALUES (?, ?, ?, ?)')
      .run(userCode, mobile, newRole, preorderOptIn);
    user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);

    if (isVendorRole(newRole)) {
      db.prepare(
        `INSERT INTO vendor_profiles
          (user_id, merchant_name, address, post_code, contact_number, business_hours, business_licence)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(
        user.id,
        String(vendor_info.merchant_name).trim(),
        String(vendor_info.address).trim(),
        String(vendor_info.post_code).trim(),
        String(vendor_info.contact_number).trim(),
        String(vendor_info.business_hours).trim(),
        String(vendor_info.business_licence).trim(),
      );

      // Save up to 5 staff mobiles; back-fill staff_user_id if already registered
      const staffMobiles = (vendor_info.staff_mobiles || []).filter(Boolean).slice(0, MAX_STAFF);
      for (const entry of staffMobiles) {
        const sm = typeof entry === 'object' ? entry.mobile : entry;
        const isAdmin = typeof entry === 'object' ? (entry.is_admin ? 1 : 0) : 0;
        if (!sm) continue;
        const staffUser = db.prepare('SELECT id FROM users WHERE mobile = ?').get(sm);
        if (staffUser) {
          db.prepare("UPDATE users SET role = ? WHERE id = ? AND role NOT IN ('admin', 'super_admin')").run(newRole, staffUser.id);
        }
        db.prepare(
          `INSERT OR IGNORE INTO vendor_staff (vendor_user_id, staff_mobile, staff_user_id, is_admin) VALUES (?, ?, ?, ?)`
        ).run(user.id, sm, staffUser ? staffUser.id : null, isAdmin);
      }
    }
  }

  // On login, back-fill staff_user_id if this user was pre-listed as staff
  if (intent === 'login' || !user) {
    db.prepare(
      `UPDATE vendor_staff SET staff_user_id = ? WHERE staff_mobile = ? AND staff_user_id IS NULL`
    ).run(user.id, mobile);
  }

  const token = signToken(user.id);
  db.prepare('INSERT INTO user_sessions (user_id, token) VALUES (?, ?)').run(user.id, token);
  const vendorContext = resolveVendorContext(user);
  res.json({ token, user: enrichUser(user), vendor_context: vendorContext || undefined });
});

const { authRequired } = require('../auth');

// GET /api/auth/me
router.get('/me', authRequired, (req, res) => {
  res.json({ user: enrichUser(req.user) });
});

// PATCH /api/auth/me { nickname, real_name, mobile, preorder_notification_opt_in }
router.patch('/me', authRequired, (req, res) => {
  const { nickname, real_name, mobile, preorder_notification_opt_in } = req.body || {};
  if (mobile !== undefined && mobile !== null) {
    const m = String(mobile).trim();
    if (!isValidMobile(m)) return res.status(400).json({ error: 'invalid_mobile' });
    if (m !== req.user.mobile) {
      const taken = db.prepare('SELECT id FROM users WHERE mobile = ? AND id != ?').get(m, req.user.id);
      if (taken) return res.status(409).json({ error: 'mobile_taken' });
      db.prepare("UPDATE users SET mobile = ?, updated_at = datetime('now') WHERE id = ?").run(m, req.user.id);
    }
  }
  const optInValue = preorder_notification_opt_in != null ? Number(preorder_notification_opt_in) : null;
  db.prepare(
    "UPDATE users SET nickname = COALESCE(?, nickname), real_name = COALESCE(?, real_name), preorder_notification_opt_in = COALESCE(?, preorder_notification_opt_in), updated_at = datetime('now') WHERE id = ?"
  ).run(nickname ?? null, real_name ?? null, optInValue, req.user.id);
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  res.json({ user: enrichUser(u) });
});

// GET /api/auth/delivery-addresses
router.get('/delivery-addresses', authRequired, (req, res) => {
  const addresses = db.prepare(`
    SELECT * FROM delivery_addresses 
    WHERE user_id = ? 
    ORDER BY is_default DESC, created_at DESC
  `).all(req.user.id);
  res.json({ addresses });
});

// POST /api/auth/delivery-addresses
router.post('/delivery-addresses', authRequired, (req, res) => {
  const { label, recipient_name, recipient_phone, address, postal_code, city, state, country, is_default } = req.body || {};
  
  if (!recipient_name || !recipient_phone || !address) {
    return res.status(400).json({ error: 'missing_required_fields' });
  }

  const info = db.prepare(`
    INSERT INTO delivery_addresses (user_id, label, recipient_name, recipient_phone, address, postal_code, city, state, country, is_default)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    req.user.id,
    label || null,
    String(recipient_name).trim(),
    String(recipient_phone).trim(),
    String(address).trim(),
    postal_code ? String(postal_code).trim() : null,
    city ? String(city).trim() : null,
    state ? String(state).trim() : null,
    country ? String(country).trim() : 'SG',
    is_default ? 1 : 0
  );

  // If this is the default, unset default from other addresses
  if (is_default) {
    db.prepare('UPDATE delivery_addresses SET is_default = 0 WHERE user_id = ? AND id != ?')
      .run(req.user.id, info.lastInsertRowid);
  }

  const addr = db.prepare('SELECT * FROM delivery_addresses WHERE id = ?').get(info.lastInsertRowid);
  res.json({ address: addr });
});

// GET /api/auth/delivery-addresses/:id
router.get('/delivery-addresses/:id', authRequired, (req, res) => {
  const addr = db.prepare('SELECT * FROM delivery_addresses WHERE id = ?').get(req.params.id);
  if (!addr || addr.user_id !== req.user.id) {
    return res.status(404).json({ error: 'not_found' });
  }
  res.json({ address: addr });
});

// PATCH /api/auth/delivery-addresses/:id
router.patch('/delivery-addresses/:id', authRequired, (req, res) => {
  const addr = db.prepare('SELECT * FROM delivery_addresses WHERE id = ?').get(req.params.id);
  if (!addr || addr.user_id !== req.user.id) {
    return res.status(404).json({ error: 'not_found' });
  }

  const { label, recipient_name, recipient_phone, address, postal_code, city, state, country, is_default } = req.body || {};
  
  db.prepare(`
    UPDATE delivery_addresses 
    SET label = COALESCE(?, label),
        recipient_name = COALESCE(?, recipient_name),
        recipient_phone = COALESCE(?, recipient_phone),
        address = COALESCE(?, address),
        postal_code = COALESCE(?, postal_code),
        city = COALESCE(?, city),
        state = COALESCE(?, state),
        country = COALESCE(?, country),
        is_default = COALESCE(?, is_default),
        updated_at = datetime('now')
    WHERE id = ?
  `).run(
    label, 
    recipient_name ? String(recipient_name).trim() : null,
    recipient_phone ? String(recipient_phone).trim() : null,
    address ? String(address).trim() : null,
    postal_code ? String(postal_code).trim() : null,
    city ? String(city).trim() : null,
    state ? String(state).trim() : null,
    country ? String(country).trim() : null,
    is_default !== undefined && is_default !== null ? (is_default ? 1 : 0) : null,
    req.params.id
  );

  // If this is being set as default, unset default from other addresses
  if (is_default) {
    db.prepare('UPDATE delivery_addresses SET is_default = 0 WHERE user_id = ? AND id != ?')
      .run(req.user.id, req.params.id);
  }

  const updated = db.prepare('SELECT * FROM delivery_addresses WHERE id = ?').get(req.params.id);
  res.json({ address: updated });
});

// DELETE /api/auth/delivery-addresses/:id
router.delete('/delivery-addresses/:id', authRequired, (req, res) => {
  const addr = db.prepare('SELECT * FROM delivery_addresses WHERE id = ?').get(req.params.id);
  if (!addr || addr.user_id !== req.user.id) {
    return res.status(404).json({ error: 'not_found' });
  }

  db.prepare('DELETE FROM delivery_addresses WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// POST /api/auth/logout
router.post('/logout', authRequired, (req, res) => {
  db.prepare("UPDATE user_sessions SET revoked_at = datetime('now') WHERE token = ?")
    .run(req.token);
  res.json({ ok: true });
});

module.exports = router;
