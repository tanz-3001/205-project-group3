// Simple in-memory audit log. Production: append-only store (e.g. database table / SIEM).
const log = [];
function logEvent(type, userId, details = {}) {
  log.push({ time: new Date().toISOString(), type, userId, ...details });
}
const getAuditLog = () => [...log];
module.exports = { logEvent, getAuditLog };
