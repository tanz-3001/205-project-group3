from __future__ import annotations


class ApiError(Exception):
    """Error rendered as {"error": {"code", "message"}} with the given HTTP status."""

    def __init__(self, status: int, code: str, message: str, extra: dict | None = None):
        super().__init__(message)
        self.status, self.code, self.message, self.extra = status, code, message, extra or {}
