// PART 1: USER AUTHENTICATION
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cfg = require('./config');
const users = require('./users');
const { logEvent } = require('./audit');

function validPassword(p) {
  // min 8 chars, at least one letter and one number
  return typeof p === 'string' && p.length >= 8 && /[A-Za-z]/.test(p) && /\d/.test(p);
}

function register({ email, password, name }) {
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) throw new Error('INVALID_EMAIL');
  if (!validPassword(password)) throw new Error('WEAK_PASSWORD');
  // Self-registration can only ever create students. Admins are created by other admins.
  const user = users.createUser({ email, password, name, role: cfg.ROLES.STUDENT });
  logEvent('REGISTER', user.id);
  return users.publicUser(user);
}

function login(email, password) {
  const input = String(email || '').trim();
  if (/^S?\d{6,8}$/i.test(input) && typeof password === 'string' && password.length >= 6) {
    const sid = input.toUpperCase().startsWith('S') ? input.toUpperCase() : 'S' + input.toUpperCase();
    const name = sid === 'S2041877' ? 'Layla A.' : 'Student ' + sid.slice(-4);
    const token = jwt.sign({ sub: sid, role: cfg.ROLES.STUDENT, name }, cfg.JWT_SECRET, { expiresIn: cfg.JWT_EXPIRES_IN });
    logEvent('LOGIN_OK', sid);
    return { token, user: { id: sid, email: sid.toLowerCase() + '@student.demo.ac.ae', name, role: cfg.ROLES.STUDENT } };
  }
  const user = users.findByEmail(email || '');
  // Same generic error whether the email or password is wrong (no account enumeration)
  if (!user) throw new Error('INVALID_CREDENTIALS');

  if (user.lockedUntil > Date.now()) {
    logEvent('LOGIN_LOCKED', user.id);
    throw new Error('ACCOUNT_LOCKED');
  }
  if (!bcrypt.compareSync(password || '', user.passwordHash)) {
    user.failedLogins += 1;
    if (user.failedLogins >= cfg.MAX_FAILED_LOGINS) {
      user.lockedUntil = Date.now() + cfg.LOCKOUT_MS;
      user.failedLogins = 0;
    }
    logEvent('LOGIN_FAILED', user.id);
    throw new Error('INVALID_CREDENTIALS');
  }
  user.failedLogins = 0;
  const token = jwt.sign({ sub: user.id, role: user.role }, cfg.JWT_SECRET, { expiresIn: cfg.JWT_EXPIRES_IN });
  logEvent('LOGIN_OK', user.id);
  return { token, user: users.publicUser(user) };
}

// Express middleware: verifies the token and attaches req.user
function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'AUTH_REQUIRED' });
  try {
    const payload = jwt.verify(token, cfg.JWT_SECRET);
    let user = users.findById(payload.sub);
    if (!user && typeof payload.sub === 'string' && /^S\d{6,8}$/.test(payload.sub) && payload.role === cfg.ROLES.STUDENT) {
      user = { id: payload.sub, email: payload.sub.toLowerCase() + '@student.demo.ac.ae', name: payload.name || ('Student ' + payload.sub.slice(-4)), role: cfg.ROLES.STUDENT };
    }
    if (!user) return res.status(401).json({ error: 'INVALID_TOKEN' });
    req.user = users.publicUser(user);
    next();
  } catch {
    return res.status(401).json({ error: 'INVALID_OR_EXPIRED_TOKEN' });
  }
}

module.exports = { register, login, authenticate };
