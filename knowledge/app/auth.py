"""Authentication & authorisation using Synapse Guard tokens.

Guard (guard/src/auth.js) issues HS256 JWTs: {"sub": <user id>, "role": "student"|"admin", "exp": ...}
signed with JWT_SECRET. This service verifies the same tokens with the same secret;
it never issues tokens and has no user store of its own (no second auth system).
"""
from __future__ import annotations

from dataclasses import dataclass

import jwt
from fastapi import Depends, Request

from .errors import ApiError


@dataclass
class User:
    id: str
    role: str
    name: str = ""


def _settings(request: Request):
    return request.app.state.ctx.settings


def current_user(request: Request) -> User:
    settings = _settings(request)
    if not settings.jwt_secret:
        raise ApiError(503, "auth_not_configured", "Authentication is not configured on the knowledge service.")
    header = request.headers.get("authorization", "")
    if not header.startswith("Bearer "):
        raise ApiError(401, "auth_required", "Sign in to continue.")
    try:
        payload = jwt.decode(header[7:], settings.jwt_secret, algorithms=[settings.jwt_algorithm], options={"require": ["sub", "exp"]})
    except jwt.ExpiredSignatureError:
        raise ApiError(401, "token_expired", "Your session has expired. Sign in again.")
    except jwt.PyJWTError:
        raise ApiError(401, "invalid_token", "Your session is not valid. Sign in again.")
    role = str(payload.get("role", "")).lower()
    return User(id=str(payload["sub"]), role=role, name=str(payload.get("name", "")))


def require_admin(request: Request, user: User = Depends(current_user)) -> User:
    if user.role not in _settings(request).admin_roles:
        raise ApiError(403, "forbidden", "Only knowledge administrators can do this.")
    return user


def require_chat(request: Request, user: User = Depends(current_user)) -> User:
    if user.role not in _settings(request).chat_roles:
        raise ApiError(403, "forbidden", "Your account cannot use Synapse Assist.")
    return user
