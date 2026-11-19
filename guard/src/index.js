// Public API of Synapse Guard. The integrator imports only from here.
const auth = require('./auth');
const rbac = require('./rbac');
const { checkSensitivity, redact } = require('./sensitivity');
const { seedDemoUsers } = require('./users');
const { logEvent, getAuditLog } = require('./audit');
const router = require('./routes');

module.exports = {
  guardRouter: router,                // app.use('/api', guardRouter)
  authenticate: auth.authenticate,    // middleware: req.user = { id, email, name, role }
  requireRole: rbac.requireRole,      // requireRole('admin')
  requirePermission: rbac.requirePermission,
  checkSensitivity,                   // checkSensitivity(message) -> { sensitive, category, risk, action, safeText, ... }
  redact,
  seedDemoUsers,
  logEvent,
  getAuditLog,
};
