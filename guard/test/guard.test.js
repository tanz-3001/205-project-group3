const test = require('node:test');
const assert = require('node:assert');
const express = require('express');
const { guardRouter, seedDemoUsers, checkSensitivity } = require('../src/index');

seedDemoUsers();
const app = express();
app.use(express.json());
app.use('/api', guardRouter);
let base, server;
test.before(() => new Promise((r) => { server = app.listen(0, () => { base = `http://localhost:${server.address().port}/api`; r(); }); }));
test.after(() => server.close());

const call = async (path, { method = 'GET', body, token } = {}) => {
  const res = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) }, body: body && JSON.stringify(body) });
  return { status: res.status, json: await res.json() };
};
const login = async (email, password) => (await call('/auth/login', { method: 'POST', body: { email, password } })).json.token;

test('login works and wrong password is rejected', async () => {
  assert.ok(await login('student@demo.ac.ae', 'Student#123'));
  const bad = await call('/auth/login', { method: 'POST', body: { email: 'student@demo.ac.ae', password: 'wrong' } });
  assert.strictEqual(bad.status, 401);
});

test('no token -> 401', async () => assert.strictEqual((await call('/auth/me')).status, 401));

test('RBAC: student blocked from admin route, admin allowed', async () => {
  const s = await login('student@demo.ac.ae', 'Student#123');
  const a = await login('admin@demo.ac.ae', 'Admin#123');
  assert.strictEqual((await call('/admin/audit', { token: s })).status, 403);
  assert.strictEqual((await call('/admin/audit', { token: a })).status, 200);
});

test('registration only creates students and rejects weak passwords', async () => {
  assert.strictEqual((await call('/auth/register', { method: 'POST', body: { email: 'new@x.com', password: 'abc', name: 'N' } })).status, 400);
  const ok = await call('/auth/register', { method: 'POST', body: { email: 'new@x.com', password: 'Passw0rd1', name: 'N', role: 'admin' } });
  assert.strictEqual(ok.json.role, 'student');
});

test('account locks after 5 failed attempts', async () => {
  await call('/auth/register', { method: 'POST', body: { email: 'lock@x.com', password: 'Passw0rd1', name: 'L' } });
  for (let i = 0; i < 5; i++) await call('/auth/login', { method: 'POST', body: { email: 'lock@x.com', password: 'nope' } });
  assert.strictEqual((await call('/auth/login', { method: 'POST', body: { email: 'lock@x.com', password: 'Passw0rd1' } })).status, 423);
});

test('sensitivity: categories and actions', () => {
  assert.strictEqual(checkSensitivity('What time does the library open?').action, 'allow');
  const mh = checkSensitivity("I feel hopeless and can't cope");
  assert.deepStrictEqual([mh.category, mh.action, mh.requiresImmediateHumanContact], ['mental_health', 'escalate', true]);
  assert.strictEqual(checkSensitivity('I want to appeal my grade').category, 'grades_and_records');
  assert.strictEqual(checkSensitivity('My visa expires next month').category, 'visa_immigration');
});

test('sensitivity: PII is redacted before reaching an LLM', () => {
  const r = checkSensitivity('Email me at ali@mail.com or call +971 50 123 4567');
  assert.strictEqual(r.action, 'redact');
  assert.ok(!r.safeText.includes('ali@mail.com'));
  assert.ok(r.safeText.includes('[EMAIL]'));
});

test('guard/check endpoint requires login', async () => {
  assert.strictEqual((await call('/guard/check', { method: 'POST', body: { message: 'hi' } })).status, 401);
  const s = await login('student@demo.ac.ae', 'Student#123');
  const r = await call('/guard/check', { method: 'POST', token: s, body: { message: 'I need a refund' } });
  assert.strictEqual(r.json.category, 'financial');
});
