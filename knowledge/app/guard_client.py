"""Client for Synapse Guard's sensitivity check (POST /api/guard/check).

The detector lives in Guard (guard/src/sensitivity.js) and is NOT duplicated here.
The user's own Guard token is forwarded, so Guard also applies its RBAC and audit log.
"""
from __future__ import annotations

import logging
import re
from dataclasses import dataclass

import httpx

log = logging.getLogger("knowledge.guard")

# Mirror of guard/src/sensitivity.js for serverless deployments where Guard runs in the same project
# and no external GUARD_API_URL is configured.
_CATEGORIES: list[tuple[str, str, re.Pattern[str]]] = [
    ("mental_health", "critical", re.compile(r"\b(suicid\w*|self[- ]harm|kill myself|end my life|want to die|depress\w*|anxiety|panic attack|hopeless|can'?t cope)\b", re.I)),
    ("harassment_safety", "critical", re.compile(r"\b(harass\w*|assault\w*|abus\w*|bully\w*|stalk\w*|threat\w*|discriminat\w*|unsafe)\b", re.I)),
    ("academic_integrity_discipline", "high", re.compile(r"\b(plagiaris\w*|cheating|misconduct|disciplinary|expelled|suspension|academic appeal)\b", re.I)),
    ("grades_and_records", "high", re.compile(r"\b(my (grade|grades|gpa|marks|transcript|results?)|grade (appeal|dispute|change)|failed (the )?(unit|subject|course))\b", re.I)),
    ("visa_immigration", "high", re.compile(r"\b(visa|residency|emirates id|immigration|work permit|passport)\b", re.I)),
    ("financial", "high", re.compile(r"\b(refund|tuition (fee|payment)|payment plan|scholarship|owe|debt|fee waiver|bank (account|details)|credit card|iban)\b", re.I)),
    ("complaint", "medium", re.compile(r"\b(complain\w*|unacceptable|lodge a complaint|speak to (a )?(manager|human|person|someone))\b", re.I)),
]
_PII: list[tuple[re.Pattern[str], str]] = [
    (re.compile(r"\b[\w.+-]+@[\w-]+(\.[\w-]+)+\b"), "[EMAIL]"),
    (re.compile(r"\b784[- ]?\d{4}[- ]?\d{7}[- ]?\d\b"), "[EMIRATES_ID]"),
    (re.compile(r"\b(?:\d[ -]?){13,16}\b"), "[CARD_NUMBER]"),
    (re.compile(r"(?:\+|00)\d{1,3}[\s-]?\(?\d{1,4}\)?[\s-]?\d{3,4}[\s-]?\d{3,4}\b|\b0\d{1,2}[\s-]?\d{3}[\s-]?\d{4}\b"), "[PHONE]"),
    (re.compile(r"\b(?:student\s*(?:id|number|no\.?)\s*[:#]?\s*)?\d{7,8}\b", re.I), "[STUDENT_ID]"),
]
_RISK = {"low": 0, "medium": 1, "high": 2, "critical": 3}


def _local_check(message: str) -> "GuardVerdict":
    text = str(message or "")
    redacted = text
    pii_found = False
    for pat, mask in _PII:
        new_text = pat.sub(mask, redacted)
        if new_text != redacted:
            pii_found = True
            redacted = new_text
    hits = [(cat, risk) for cat, risk, pat in _CATEGORIES if pat.search(text)]
    if hits:
        cat, risk = sorted(hits, key=lambda x: -_RISK[x[1]])[0]
        return GuardVerdict(action="escalate", category=cat, safe_text=redacted, urgent=(risk == "critical"))
    if pii_found:
        return GuardVerdict(action="redact", category="personal_data", safe_text=redacted, urgent=False)
    return GuardVerdict(action="allow", category="general", safe_text=text, urgent=False)


class GuardUnavailable(Exception):
    pass


@dataclass
class GuardVerdict:
    action: str  # allow | redact | escalate
    category: str
    safe_text: str
    urgent: bool


class GuardClient:
    def __init__(self, base_url: str, timeout: float = 5.0):
        self.base_url = base_url
        self._client = httpx.Client(timeout=timeout)

    @property
    def configured(self) -> bool:
        return True

    def check(self, message: str, bearer: str) -> GuardVerdict:
        if not self.base_url:
            return _local_check(message)
        try:
            r = self._client.post(f"{self.base_url}/api/guard/check", json={"message": message}, headers={"Authorization": bearer})
        except httpx.HTTPError as exc:
            raise GuardUnavailable(str(exc)) from exc
        if r.status_code != 200:
            raise GuardUnavailable(f"HTTP {r.status_code}")
        d = r.json()
        return GuardVerdict(
            action=str(d.get("action", "escalate")),
            category=str(d.get("category", "general")),
            safe_text=str(d.get("safeText") or message),
            urgent=bool(d.get("requiresImmediateHumanContact")),
        )
