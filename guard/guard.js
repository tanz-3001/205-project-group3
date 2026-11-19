/*!
 * Synapse Guard (browser edition)
 * Sign-in, role-based access control and sensitive enquiry detection.
 * No dependencies, no build step. Include with: <script src="guard/guard.js"></script>
 *
 * PROTOTYPE NOTES (be ready to explain these in Q&A):
 *  - Users are a hard-coded demo list and passwords are SHA-256 hashed in the browser. Real
 *    deployments use the university single sign-on (SSO) with multi-factor authentication.
 *  - Sessions live in sessionStorage. Real deployments use short-lived tokens issued by a server.
 *  - Role checks here only change what the page shows. A real system MUST enforce roles on the server.
 *  - Detection is rule-based (regex). A production version adds an LLM classifier and human review.
 */
(function (root) {
  'use strict';

  var ROLES = { STUDENT: 'student', STAFF: 'staff', ADMIN: 'admin' };

  // ---------- RBAC: one permission map, easy to explain and change ----------
  var PERMISSIONS = {
    student: ['ask', 'requests:own'],
    staff: ['ask', 'requests:own', 'staff:view', 'tickets:manage'],
    admin: ['ask', 'requests:own', 'staff:view', 'tickets:manage', 'audit:view', 'users:manage']
  };
  var VIEW_PERMISSION = { ask: 'ask', requests: 'requests:own', staff: 'staff:view' };

  // ---------- DEMO USERS (fake accounts; hashes only, no plain-text passwords in code) ----------
  var USERS = [
    { id: 'u1', email: 'layla@demo.ac.ae', name: 'Layla A.', role: 'student', hash: '8983d56eb31086e0f2c9ee86594d5c1364502c0d3f92a170ebfe58b802398231' },
    { id: 'u2', email: 'staff@demo.ac.ae', name: 'Sam Staff', role: 'staff', hash: 'a1657ac2f5387319b34b5e34ddc9d84a10995a28c06d89a40fd2f8f8142cdbb6' },
    { id: 'u3', email: 'admin@demo.ac.ae', name: 'Ada Admin', role: 'admin', hash: 'b569a00f26714158bd8f54f28048c56e02a4a35b76e9fa3d6e581398679d5cca' }
  ];
  var SALT = 'synapse-demo-salt';
  var SESSION_KEY = 'synapse:session', AUDIT_KEY = 'synapse:audit';
  var SESSION_MS = 2 * 60 * 60 * 1000, MAX_FAILS = 5, LOCK_MS = 60 * 1000;

  // ---------- storage helper (falls back to memory so tests and private mode still work) ----------
  var mem = {};
  function store(kind) {
    try { var s = root[kind]; if (s) { s.setItem('__t', '1'); s.removeItem('__t'); return s; } } catch (e) {}
    return { getItem: function (k) { return k in mem ? mem[k] : null; }, setItem: function (k, v) { mem[k] = String(v); }, removeItem: function (k) { delete mem[k]; } };
  }
  function readJSON(s, k, d) { try { var v = JSON.parse(s.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }

  // ---------- audit log (stores categories and events, NEVER message text) ----------
  function audit(type, detail) {
    var s = store('localStorage'), log = readJSON(s, AUDIT_KEY, []);
    log.push({ at: Date.now(), type: type, detail: detail || '' });
    try { s.setItem(AUDIT_KEY, JSON.stringify(log.slice(-200))); } catch (e) {}
  }
  function getAuditLog() { return can('audit:view') ? readJSON(store('localStorage'), AUDIT_KEY, []) : []; }

  // =====================================================================
  // PART 3: SENSITIVE ENQUIRY DETECTION
  // Labels match the staff hand-off tags already used in index.html.
  // Ordered most severe first. The first match wins.
  // =====================================================================
  var RULES = [
    { label: 'Wellbeing', category: 'wellbeing_safety', risk: 'critical',
      re: /suicid|self[- ]?harm|kill myself|end my life|want to die|hurt myself|hopeless|can'?t cope|cannot cope|panic attack|depress|anxi(ety|ous)|overwhelm|stress(ed)?\b|mental health|harass|abus|assault|bully|stalk|unsafe/i,
      urgent: /suicid|self[- ]?harm|kill myself|end my life|want to die|hurt myself|abus|assault/i },
    { label: 'Academic appeals', category: 'academic_appeal_or_grades', risk: 'high',
      re: /appeal|dispute|unfair|plagiar|cheat|misconduct|disciplinary|my (grade|grades|gpa|marks|transcript)\b|grade (change|review)|failed (my|the) (unit|subject|course|exam)/i },
    { label: 'Financial help', category: 'financial_hardship', risk: 'high',
      re: /hardship|afford|can'?t pay|cannot pay|unable to pay|struggling to pay|fee waiver|refund|\bowe\b|\bdebt\b/i },
    { label: 'Legal and complaints', category: 'legal_or_complaint', risk: 'high',
      re: /lawyer|legal|lawsuit|\bsue\b|complain|discriminat|visa|immigration|residency/i }
  ];

  // Personal data detectors. Order matters: longer, more specific patterns first.
  var PII = [
    { type: 'email', re: /\b[\w.+-]+@[\w-]+(\.[\w-]+)+\b/g, mask: '[EMAIL]' },
    { type: 'emirates_id', re: /\b784[- ]?\d{4}[- ]?\d{7}[- ]?\d\b/g, mask: '[EMIRATES_ID]' },
    { type: 'card_number', re: /\b(?:\d[ -]?){13,16}\b/g, mask: '[CARD_NUMBER]' },
    { type: 'phone', re: /(?:\+|00)\d{1,3}[\s-]?\(?\d{1,4}\)?[\s-]?\d{3,4}[\s-]?\d{3,4}\b|\b0\d{1,2}[\s-]?\d{3}[\s-]?\d{4}\b/g, mask: '[PHONE]' },
    { type: 'student_id', re: /\b\d{7,8}\b/g, mask: '[STUDENT_ID]' }
  ];

  function redact(text) {
    var out = String(text == null ? '' : text), found = [];
    PII.forEach(function (p) {
      var before = out; out = out.replace(p.re, p.mask);
      if (out !== before) found.push(p.type);
    });
    return { text: out, found: found };
  }

  // Returns { sensitive, action: 'allow'|'redact'|'escalate', label, category, risk, urgent, piiDetected, safeText }
  function checkSensitivity(message) {
    var text = String(message == null ? '' : message);
    var r = redact(text);
    var hit = null;
    for (var i = 0; i < RULES.length; i++) { if (RULES[i].re.test(text)) { hit = RULES[i]; break; } }
    if (hit) {
      return { sensitive: true, action: 'escalate', label: hit.label, category: hit.category, risk: hit.risk,
               urgent: !!(hit.urgent && hit.urgent.test(text)), piiDetected: r.found, safeText: r.text };
    }
    if (r.found.length) {
      return { sensitive: true, action: 'redact', label: null, category: 'personal_data', risk: 'medium',
               urgent: false, piiDetected: r.found, safeText: r.text };
    }
    return { sensitive: false, action: 'allow', label: null, category: 'general', risk: 'low',
             urgent: false, piiDetected: [], safeText: text };
  }

  // =====================================================================
  // PART 1: AUTHENTICATION
  // =====================================================================
  var attempts = {}, listeners = [];

  function sha(p) {
    var c = root.crypto || (typeof globalThis !== 'undefined' && globalThis.crypto);
    if (!c || !c.subtle) return Promise.reject(new Error('NO_CRYPTO')); // needs https or localhost
    return c.subtle.digest('SHA-256', new TextEncoder().encode(SALT + ':' + p)).then(function (buf) {
      return Array.prototype.map.call(new Uint8Array(buf), function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
    });
  }
  function initials(n) { return n.split(/\s+/).map(function (w) { return w[0]; }).join('').slice(0, 2).toUpperCase(); }

  function getSession() {
    var s = readJSON(store('sessionStorage'), SESSION_KEY, null);
    if (!s || s.exp < Date.now()) { if (s) store('sessionStorage').removeItem(SESSION_KEY); return null; }
    return s;
  }

  function login(email, password) {
    email = String(email || '').trim().toLowerCase();
    if (!email || !password) return Promise.resolve({ ok: false, error: 'MISSING' });
    var a = attempts[email] || (attempts[email] = { n: 0, until: 0 });
    if (a.until > Date.now()) { audit('LOGIN_LOCKED', email); return Promise.resolve({ ok: false, error: 'ACCOUNT_LOCKED' }); }
    return sha(password).then(function (h) {
      var u = USERS.filter(function (x) { return x.email === email; })[0];
      // Same generic error for a wrong email or a wrong password (no account enumeration)
      if (!u || u.hash !== h) {
        a.n += 1; if (a.n >= MAX_FAILS) { a.until = Date.now() + LOCK_MS; a.n = 0; }
        audit('LOGIN_FAILED', email);
        return { ok: false, error: 'INVALID_CREDENTIALS' };
      }
      a.n = 0;
      var s = { id: u.id, email: u.email, name: u.name, initials: initials(u.name), role: u.role, exp: Date.now() + SESSION_MS };
      store('sessionStorage').setItem(SESSION_KEY, JSON.stringify(s));
      audit('LOGIN_OK', u.id);
      return { ok: true, session: s };
    }).catch(function () { return { ok: false, error: 'NO_CRYPTO' }; });
  }

  function logout() {
    var s = getSession();
    if (s) audit('LOGOUT', s.id);
    store('sessionStorage').removeItem(SESSION_KEY);
    emit(); if (typeof document !== 'undefined') { applyRoleUI(); mountLogin(); }
  }

  // =====================================================================
  // PART 2: ROLE-BASED ACCESS CONTROL
  // =====================================================================
  function can(permission) { var s = getSession(); return !!s && (PERMISSIONS[s.role] || []).indexOf(permission) > -1; }
  function canView(view) { return can(VIEW_PERMISSION[view] || 'ask'); }
  function emit() { var s = getSession(); listeners.forEach(function (f) { try { f(s); } catch (e) {} }); }

  // Show or hide anything tagged data-role="staff admin", and fill in the user's name.
  function applyRoleUI() {
    var s = getSession(), role = s && s.role;
    [].forEach.call(document.querySelectorAll('[data-role]'), function (el) {
      el.hidden = !(role && el.getAttribute('data-role').split(/\s+/).indexOf(role) > -1);
    });
    [].forEach.call(document.querySelectorAll('[data-user-name]'), function (el) { el.textContent = s ? s.name : ''; });
    [].forEach.call(document.querySelectorAll('[data-user-initials]'), function (el) { el.textContent = s ? s.initials : ''; });
    [].forEach.call(document.querySelectorAll('[data-user-role]'), function (el) { el.textContent = s ? s.role.charAt(0).toUpperCase() + s.role.slice(1) : ''; });
  }

  // ---------- sign-in screen (built by this file so the integrator adds nothing to the HTML) ----------
  function injectStyles() {
    if (document.getElementById('sg-style')) return;
    var st = document.createElement('style'); st.id = 'sg-style';
    st.textContent =
      '[data-role][hidden]{display:none!important}' +
      '#sg-login{position:fixed;inset:0;z-index:1000;display:grid;place-items:center;padding:16px;background:rgba(11,60,73,.55);font-family:"Public Sans",system-ui,sans-serif}' +
      '.sg-card{width:100%;max-width:420px;padding:28px;border-radius:12px;background:#fff;color:var(--ink,#17323A);box-shadow:0 20px 50px rgba(11,60,73,.3)}' +
      '.sg-card h2{margin:0 0 4px;color:var(--navy,#0B3C49);font-size:1.5rem}' +
      '.sg-card p{margin:0 0 16px;color:var(--muted,#53686C);font-size:.95rem}' +
      '.sg-card label{display:block;margin:12px 0 4px;font-weight:600;font-size:.92rem}' +
      '.sg-card input{width:100%;min-height:48px;padding:0 12px;border:1px solid #A9BDB9;border-radius:8px;font:inherit;box-sizing:border-box}' +
      '.sg-go{width:100%;min-height:48px;margin-top:18px;border:0;border-radius:8px;background:var(--blue,#0B6B63);color:#fff;font:700 1rem inherit;cursor:pointer}' +
      '.sg-go:hover{background:var(--dk,#085249)}.sg-go[disabled]{opacity:.6;cursor:wait}' +
      '.sg-err{min-height:1.4em;margin:10px 0 0;color:#9A2B1A;font-weight:600;font-size:.92rem}' +
      '.sg-demo{margin-top:16px;padding-top:14px;border-top:1px solid var(--line,#D6E2DF)}' +
      '.sg-demo small{display:block;margin-bottom:8px;color:var(--muted,#53686C)}' +
      '.sg-demo div{display:flex;gap:8px;flex-wrap:wrap}' +
      '.sg-demo button{min-height:44px;padding:0 14px;border:1px solid var(--navy,#0B3C49);border-radius:8px;background:#fff;color:var(--navy,#0B3C49);font:600 .9rem inherit;cursor:pointer}' +
      '.sg-demo button:hover{background:var(--soft,#DDF0EC)}' +
      '.sg-card input:focus-visible,.sg-card button:focus-visible{outline:3px solid var(--navy,#0B3C49);outline-offset:2px}';
    document.head.appendChild(st);
  }
  function setInert(on) {
    [].forEach.call(document.body.children, function (el) {
      if (el.id === 'sg-login' || el.tagName === 'SCRIPT') return;
      if (on) el.setAttribute('inert', ''); else el.removeAttribute('inert');
    });
  }
  var ERR = { MISSING: 'Enter your email and password.', INVALID_CREDENTIALS: 'Email or password is incorrect.', ACCOUNT_LOCKED: 'Too many attempts. Try again in a minute.', NO_CRYPTO: 'Sign-in needs a secure page (https or localhost).' };

  function mountLogin() {
    if (document.getElementById('sg-login')) return;
    injectStyles();
    var o = document.createElement('div');
    o.id = 'sg-login'; o.setAttribute('role', 'dialog'); o.setAttribute('aria-modal', 'true'); o.setAttribute('aria-labelledby', 'sg-title');
    o.innerHTML =
      '<form class="sg-card" novalidate>' +
      '<h2 id="sg-title">Sign in to Synapse</h2><p>Use your university email address.</p>' +
      '<label for="sg-email">Email</label><input id="sg-email" type="email" autocomplete="username">' +
      '<label for="sg-pass">Password</label><input id="sg-pass" type="password" autocomplete="current-password">' +
      '<p class="sg-err" id="sg-err" role="alert"></p>' +
      '<button class="sg-go" type="submit">Sign in</button>' +
      '<div class="sg-demo"><small>Demo accounts (prototype only). Passwords are shown in the project README.</small><div>' +
      '<button type="button" data-fill="layla@demo.ac.ae">Student</button>' +
      '<button type="button" data-fill="staff@demo.ac.ae">Staff</button>' +
      '<button type="button" data-fill="admin@demo.ac.ae">Admin</button></div></div></form>';
    document.body.appendChild(o); setInert(true);
    var f = o.querySelector('form'), em = o.querySelector('#sg-email'), pw = o.querySelector('#sg-pass'), er = o.querySelector('#sg-err'), go = o.querySelector('.sg-go');
    o.addEventListener('click', function (e) { var b = e.target.closest('[data-fill]'); if (b) { em.value = b.getAttribute('data-fill'); pw.focus(); } });
    f.addEventListener('submit', function (e) {
      e.preventDefault(); go.disabled = true; er.textContent = '';
      login(em.value, pw.value).then(function (r) {
        go.disabled = false;
        if (!r.ok) { er.textContent = ERR[r.error] || 'Could not sign in.'; pw.value = ''; pw.focus(); return; }
        setInert(false); o.remove(); applyRoleUI(); emit();
      });
    });
    em.focus();
  }

  // Call once when the page loads. onChange(session|null) fires after sign-in and sign-out.
  function init(opts) {
    opts = opts || {};
    if (typeof opts.onChange === 'function') listeners.push(opts.onChange);
    injectStyles();
    document.addEventListener('click', function (e) { if (e.target.closest('[data-guard-logout]')) logout(); });
    applyRoleUI();
    if (getSession()) emit(); else mountLogin();
  }

  var api = {
    ROLES: ROLES, PERMISSIONS: PERMISSIONS,
    init: init, login: login, logout: logout, getSession: getSession,
    can: can, canView: canView, applyRoleUI: applyRoleUI,
    checkSensitivity: checkSensitivity, redact: redact,
    getAuditLog: getAuditLog, logEvent: audit
  };
  root.SynapseGuard = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
