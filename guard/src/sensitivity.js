// PART 3: SENSITIVE ENQUIRY DETECTION
// Rule-based for the prototype. Production would add an LLM classifier (see README).
//
// Actions:  "allow"    -> safe to answer with the chatbot
//           "redact"   -> answer, but personal data is masked before it reaches any external AI
//           "escalate" -> do NOT answer with AI; route to a human immediately

const CATEGORIES = [
  { category: 'mental_health', risk: 'critical', action: 'escalate',
    patterns: [/\b(suicid\w*|self[- ]harm|kill myself|end my life|want to die|depress\w*|anxiety|panic attack|hopeless|can'?t cope)\b/i] },
  { category: 'harassment_safety', risk: 'critical', action: 'escalate',
    patterns: [/\b(harass\w*|assault\w*|abus\w*|bully\w*|stalk\w*|threat\w*|discriminat\w*|unsafe)\b/i] },
  { category: 'academic_integrity_discipline', risk: 'high', action: 'escalate',
    patterns: [/\b(plagiaris\w*|cheating|misconduct|disciplinary|expelled|suspension|academic appeal)\b/i] },
  { category: 'grades_and_records', risk: 'high', action: 'escalate',
    patterns: [/\b(my (grade|grades|gpa|marks|transcript|results?)|grade (appeal|dispute|change)|failed (the )?(unit|subject|course))\b/i] },
  { category: 'visa_immigration', risk: 'high', action: 'escalate',
    patterns: [/\b(visa|residency|emirates id|immigration|work permit|passport)\b/i] },
  { category: 'financial', risk: 'high', action: 'escalate',
    patterns: [/\b(refund|tuition (fee|payment)|payment plan|scholarship|owe|debt|fee waiver|bank (account|details)|credit card|iban)\b/i] },
  { category: 'complaint', risk: 'medium', action: 'escalate',
    patterns: [/\b(complain\w*|unacceptable|lodge a complaint|speak to (a )?(manager|human|person|someone))\b/i] },
];

// Personal data detectors (used for redaction and as a signal)
const PII = [
  { type: 'email', re: /\b[\w.+-]+@[\w-]+(\.[\w-]+)+\b/g, mask: '[EMAIL]' },
  { type: 'emirates_id', re: /\b784[- ]?\d{4}[- ]?\d{7}[- ]?\d\b/g, mask: '[EMIRATES_ID]' },
  { type: 'card_number', re: /\b(?:\d[ -]?){13,16}\b/g, mask: '[CARD_NUMBER]' },
  { type: 'phone', re: /(?:\+|00)\d{1,3}[\s-]?\(?\d{1,4}\)?[\s-]?\d{3,4}[\s-]?\d{3,4}\b|\b0\d{1,2}[\s-]?\d{3}[\s-]?\d{4}\b/g, mask: '[PHONE]' },
  { type: 'student_id', re: /\b(?:student\s*(?:id|number|no\.?)\s*[:#]?\s*)?\d{7,8}\b/gi, mask: '[STUDENT_ID]' },
];

function redact(text) {
  let out = text;
  const found = [];
  for (const { type, re, mask } of PII) {
    const before = out;
    out = out.replace(re, mask);
    if (out !== before) found.push(type);
  }
  return { text: out, found };
}

const RISK_ORDER = { low: 0, medium: 1, high: 2, critical: 3 };

function checkSensitivity(message) {
  const text = String(message || '');
  const hits = CATEGORIES.filter((c) => c.patterns.some((p) => p.test(text)));
  const { text: redacted, found: pii } = redact(text);

  if (hits.length) {
    // Take the most severe category
    const top = hits.sort((a, b) => RISK_ORDER[b.risk] - RISK_ORDER[a.risk])[0];
    return {
      sensitive: true,
      category: top.category,
      risk: top.risk,
      action: top.action,            // "escalate"
      allCategories: hits.map((h) => h.category),
      piiDetected: pii,
      safeText: redacted,
      // Critical cases should show crisis support text, not an AI answer
      requiresImmediateHumanContact: top.risk === 'critical',
    };
  }
  if (pii.length) {
    return { sensitive: true, category: 'personal_data', risk: 'medium', action: 'redact',
             allCategories: ['personal_data'], piiDetected: pii, safeText: redacted,
             requiresImmediateHumanContact: false };
  }
  return { sensitive: false, category: 'general', risk: 'low', action: 'allow',
           allCategories: [], piiDetected: [], safeText: text, requiresImmediateHumanContact: false };
}

module.exports = { checkSensitivity, redact };
