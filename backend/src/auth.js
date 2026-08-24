const jwt = require('jsonwebtoken');
const { jwtSecret } = require('./config');
const db = require('./db');

function signToken(userId) {
  return jwt.sign({ uid: userId }, jwtSecret, { expiresIn: '365d' });
}

function authRequired(req, res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'auth_required' });
  try {
    const payload = jwt.verify(token, jwtSecret);
    const session = db
      .prepare('SELECT * FROM user_sessions WHERE token = ? AND revoked_at IS NULL')
      .get(token);
    if (!session) return res.status(401).json({ error: 'session_revoked' });
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.uid);
    if (!user) return res.status(401).json({ error: 'user_not_found' });
    req.user = user;
    req.token = token;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'invalid_token' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'auth_required' });
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: 'forbidden' });
    next();
  };
}

// super_admin satisfies admin requirement
function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'auth_required' });
  if (!['admin', 'super_admin'].includes(req.user.role))
    return res.status(403).json({ error: 'forbidden' });
  next();
}

function requireAdminOrdersAccess(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'auth_required' });
  if (!['admin', 'super_admin', 'staff', 'platform_staff'].includes(req.user.role))
    return res.status(403).json({ error: 'forbidden' });
  next();
}

module.exports = { signToken, authRequired, requireRole, requireAdmin, requireAdminOrdersAccess };
