"""Client for Synapse Guard's sensitivity check (POST /api/guard/check).

The detector lives in Guard (guard/src/sensitivity.js) and is NOT duplicated here.
The user's own Guard token is forwarded, so Guard also applies its RBAC and audit log.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass

import httpx

log = logging.getLogger("knowledge.guard")


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
        return bool(self.base_url)

    def check(self, message: str, bearer: str) -> GuardVerdict:
        if not self.base_url:
            raise GuardUnavailable("GUARD_API_URL is not set")
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
