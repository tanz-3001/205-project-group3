const test = require('node:test');
const assert = require('node:assert');
const G = require('./guard.js');

// Every question and chip already in index.html must still be answered, not escalated.
const NORMAL = [
  'How do I add or drop a course?', 'How do I enroll for a new semester?', 'How do I get an enrollment letter?',
  'What are my tuition payment options?', 'Where can I download my fee receipt?', 'When is the fee deadline?',
  'What is the attendance policy?', 'What is the late submission policy?', 'Where do I find my timetable?',
  'Where do I find my exam schedule?', 'How do I reset my password?', 'How do I connect to campus Wi-Fi?',
  'Reset my password', 'Pay my fees', 'Add or drop a course', 'Exam schedule', 'Can I pay by credit card?'
];
test('normal FAQ questions are allowed', () => {
  NORMAL.forEach((q) => assert.strictEqual(G.checkSensitivity(q).action, 'allow', q));
});

test('sensitive topics escalate with the labels index.html already uses', () => {
  const cases = [
    ['I want to appeal my grade', 'Academic appeals'], ['I think this mark is unfair', 'Academic appeals'],
    ['I am in financial hardship', 'Financial help'], ["I can't afford tuition", 'Financial help'], ['I need a refund', 'Financial help'],
    ['I feel overwhelmed and anxious', 'Wellbeing'], ["I can't cope any more", 'Wellbeing'],
    ['My visa is expiring', 'Legal and complaints'], ['I want to lodge a complaint', 'Legal and complaints'],
  ];
  cases.forEach(([q, label]) => {
    const r = G.checkSensitivity(q);
    assert.strictEqual(r.action, 'escalate', q); assert.strictEqual(r.label, label, q);
  });
});

test('urgent flag only for crisis wording', () => {
  assert.strictEqual(G.checkSensitivity('I want to die').urgent, true);
  assert.strictEqual(G.checkSensitivity('I feel stressed about exams').urgent, false);
});

test('personal data is masked', () => {
  const r = G.checkSensitivity('Email ali@mail.com, call +971 50 123 4567 or 050 123 4567, ID 784-1999-1234567-1, student 20231234, card 4111 1111 1111 1111');
  assert.strictEqual(r.action, 'redact');
  ['ali@mail.com', '+971 50 123 4567', '050 123 4567', '784-1999-1234567-1', '20231234', '4111 1111 1111 1111']
    .forEach((s) => assert.ok(!r.safeText.includes(s), s));
  assert.deepStrictEqual(['email', 'emirates_id', 'card_number', 'phone', 'student_id'].filter((t) => !r.piiDetected.includes(t)), []);
});

test('sensitive message that also has PII is escalated AND masked', () => {
  const r = G.checkSensitivity('I want to appeal, my number is 050 123 4567');
  assert.strictEqual(r.action, 'escalate'); assert.ok(r.safeText.includes('[PHONE]'));
});

test('login, session and RBAC', async () => {
  assert.strictEqual(G.can('ask'), false);                       // nobody signed in
  assert.strictEqual((await G.login('layla@demo.ac.ae', 'wrong')).error, 'INVALID_CREDENTIALS');
  assert.strictEqual((await G.login('nobody@x.com', 'Student#123')).error, 'INVALID_CREDENTIALS');
  assert.strictEqual((await G.login('layla@demo.ac.ae', 'Student#123')).ok, true);
  assert.strictEqual(G.canView('ask'), true); assert.strictEqual(G.canView('staff'), false);
  assert.strictEqual(G.can('audit:view'), false);
  assert.strictEqual((await G.login('staff@demo.ac.ae', 'Staff#123')).ok, true);
  assert.strictEqual(G.canView('staff'), true); assert.strictEqual(G.can('audit:view'), false);
  assert.strictEqual((await G.login('admin@demo.ac.ae', 'Admin#123')).ok, true);
  assert.strictEqual(G.can('audit:view'), true);
});

test('account locks after 5 failed attempts', async () => {
  for (let i = 0; i < 5; i++) await G.login('staff@demo.ac.ae', 'nope');
  assert.strictEqual((await G.login('staff@demo.ac.ae', 'Staff#123')).error, 'ACCOUNT_LOCKED');
});

test('audit log never stores message text', async () => {
  G.checkSensitivity('secret appeal text');
  assert.ok(!JSON.stringify(G.getAuditLog()).includes('secret appeal text'));
});
