// PART 2: ROLE-BASED ACCESS CONTROL
const { ROLES } = require('./config');

// Permissions are mapped to roles in ONE place, so the policy is easy to explain and change.
const PERMISSIONS = {
  [ROLES.STUDENT]: ['chat:use', 'history:read:own'],
  [ROLES.ADMIN]: [
    'chat:use', 'history:read:own',
    'dashboard:view', 'escalations:manage', 'knowledge:upload', 'audit:view', 'users:manage',
  ],
};

const can = (role, permission) => (PERMISSIONS[role] || []).includes(permission);

// Middleware: wrap a route so only these roles can reach it
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'AUTH_REQUIRED' });
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: 'FORBIDDEN' });
    next();
  };
}

// Middleware: finer-grained, permission based
function requirePermission(permission) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'AUTH_REQUIRED' });
    if (!can(req.user.role, permission)) return res.status(403).json({ error: 'FORBIDDEN' });
    next();
  };
}

module.exports = { PERMISSIONS, can, requireRole, requirePermission };
