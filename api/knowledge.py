"""Vercel ASGI entrypoint for the Synapse Knowledge FastAPI service."""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
KNOWLEDGE_DIR = ROOT / "knowledge"
if str(KNOWLEDGE_DIR) not in sys.path:
    sys.path.insert(0, str(KNOWLEDGE_DIR))

from app.main import create_app  # noqa: E402

app = create_app()
