"""Small in-process sliding-window rate limiter (per user, per bucket).

Suitable for a single service instance. For several instances use a shared store (e.g. Redis).
"""
from __future__ import annotations

import threading
import time
from collections import defaultdict, deque

from .errors import ApiError


class RateLimiter:
    def __init__(self) -> None:
        self._hits: dict[str, deque[float]] = defaultdict(deque)
        self._lock = threading.Lock()

    def check(self, key: str, limit: int, window_s: float = 60.0) -> None:
        if limit <= 0:
            return
        now = time.monotonic()
        with self._lock:
            q = self._hits[key]
            while q and now - q[0] > window_s:
                q.popleft()
            if len(q) >= limit:
                raise ApiError(429, "rate_limited", "Too many requests. Please wait a moment and try again.")
            q.append(now)
