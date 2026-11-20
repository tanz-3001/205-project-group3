# Synapse Guard

Authentication, role-based access control (RBAC) and sensitive enquiry detection for Synapse.

## Run
    npm install
    npm start        # http://localhost:4000
    npm test         # 8 tests

Demo accounts: student@demo.ac.ae / Student#123 , admin@demo.ac.ae / Admin#123

## Integration contract (for the integrator)
    const { guardRouter, authenticate, requireRole, checkSensitivity, seedDemoUsers } = require('./guard/src');
    app.use('/api', guardRouter);                      // /auth/login, /auth/register, /auth/me, /guard/check
    app.get('/api/dashboard', authenticate, requireRole('admin'), handler);   // protect any route
    const r = checkSensitivity(message);               // call BEFORE sending text to the LLM
    // r = { sensitive, category, risk, action: 'allow'|'redact'|'escalate', safeText, piiDetected, requiresImmediateHumanContact }

Chat flow: authenticate -> checkSensitivity -> if escalate: create escalation + show human handoff;
if redact: send r.safeText to the LLM; if allow: send as is.

## Prototype vs production
| Feature | Prototype (this repo) | Production |
|---|---|---|
| Users | In-memory, bcrypt hashes | University SSO (SAML/OIDC) + database, MFA |
| Sessions | JWT, 2h expiry | Short-lived tokens + refresh, secure cookies |
| RBAC | 2 roles, permission map | Roles from identity provider, per-department scopes |
| Detection | Regex rules + PII masking | Rules + LLM classifier tuned on real tickets, human-reviewed |
| Audit | In-memory array | Append-only store, retention policy |
