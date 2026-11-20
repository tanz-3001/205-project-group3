// Express router exposing Guard. Mount at /api (or wherever the integrator prefers).
const express = require('express');
const auth = require('./auth');
const { requireRole, requirePermission } = require('./rbac');
const { checkSensitivity } = require('./sensitivity');
const { getAuditLog, logEvent } = require('./audit');

const router = express.Router();
const STATUS = { INVALID_CREDENTIALS: 401, ACCOUNT_LOCKED: 423, EMAIL_EXISTS: 409, INVALID_EMAIL: 400, WEAK_PASSWORD: 400 };
const fail = (res, e) => res.status(STATUS[e.message] || 500).json({ error: e.message });

// --- Authentication ---
router.post('/auth/register', (req, res) => {
  try { res.status(201).json(auth.register(req.body)); } catch (e) { fail(res, e); }
});
router.post('/auth/login', (req, res) => {
  try { res.json(auth.login(req.body.email, req.body.password)); } catch (e) { fail(res, e); }
});
router.get('/auth/me', auth.authenticate, (req, res) => res.json(req.user));

// --- Sensitivity check (Synapse Assist calls this BEFORE sending anything to an LLM) ---
router.post('/guard/check', auth.authenticate, requirePermission('chat:use'), (req, res) => {
  const result = checkSensitivity(req.body.message);
  if (result.sensitive) logEvent('SENSITIVE_DETECTED', req.user.id, { category: result.category, action: result.action });
  res.json(result);
});

// --- Admin-only examples (the dashboard team wraps their routes the same way) ---
router.get('/admin/audit', auth.authenticate, requireRole('admin'), (req, res) => res.json(getAuditLog()));

module.exports = router;
