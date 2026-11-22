"""Sentence-aware chunking with overlap, section context and page references.

Token counts are estimated (≈ words + punctuation marks), which slightly
over-counts relative to BPE tokenisers, so chunks stay within model limits.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field

from .extraction import Block

_TOKEN = re.compile(r"\w+|[^\w\s]")
_SENT_SPLIT = re.compile(r"(?<=[.!?;:])\s+(?=[\"'(\[]?[A-Z0-9•\-])|\n+")


def estimate_tokens(text: str) -> int:
    return len(_TOKEN.findall(text))


@dataclass
class Unit:
    text: str
    tokens: int
    page: int | None
    heading: str | None


@dataclass
class Chunk:
    index: int
    content: str
    token_count: int
    page_number: int | None
    page_end: int | None
    section_heading: str | None
    metadata: dict = field(default_factory=dict)


def split_sentences(text: str) -> list[str]:
    return [s.strip() for s in _SENT_SPLIT.split(text) if s and s.strip()]


def _units(blocks: list[Block], max_tokens: int) -> list[Unit]:
    units: list[Unit] = []
    for b in blocks:
        if b.kind == "heading":
            continue  # headings travel as section context, not as body text
        pieces = [b.text] if b.kind == "table" and estimate_tokens(b.text) <= max_tokens else split_sentences(b.text)
        if b.kind == "table" and len(pieces) > 1:
            pieces = [p for p in b.text.split("\n\n") if p.strip()]
        for s in pieces:
            n = estimate_tokens(s)
            if n <= max_tokens:
                units.append(Unit(s, n, b.page, b.heading))
                continue
            words = s.split()  # a single over-long "sentence": hard split by words
            step = max(1, int(max_tokens * 0.75))
            for i in range(0, len(words), step):
                part = " ".join(words[i : i + step])
                units.append(Unit(part, estimate_tokens(part), b.page, b.heading))
    return units


def chunk_blocks(blocks: list[Block], target_tokens: int = 500, overlap_tokens: int = 100, doc_name: str = "") -> list[Chunk]:
    if target_tokens < 50:
        raise ValueError("target_tokens must be at least 50")
    overlap_tokens = max(0, min(overlap_tokens, target_tokens // 2))
    units = _units(blocks, target_tokens)
    chunks: list[Chunk] = []
    current: list[Unit] = []
    min_fill = int(target_tokens * 0.35)

    def emit() -> None:
        if not current:
            return
        pages = [u.page for u in current if u.page is not None]
        headings = [u.heading for u in current if u.heading]
        content = " ".join(u.text for u in current)
        chunks.append(Chunk(
            index=len(chunks),
            content=content,
            token_count=sum(u.tokens for u in current),
            page_number=min(pages) if pages else None,
            page_end=max(pages) if pages else None,
            section_heading=headings[0] if headings else None,
            metadata={"document": doc_name, "sections": sorted(set(headings), key=headings.index)[:5]},
        ))

    def overlap_tail() -> list[Unit]:
        tail, total = [], 0
        for u in reversed(current):
            if total >= overlap_tokens:
                break
            tail.insert(0, u)
            total += u.tokens
        # Never carry the whole chunk forward (would loop / duplicate).
        return tail if len(tail) < len(current) else tail[1:]

    for u in units:
        size = sum(x.tokens for x in current)
        section_changed = current and u.heading != current[-1].heading
        if current and (size + u.tokens > target_tokens or (section_changed and size >= min_fill)):
            emit()
            # Overlap only within the same section: a new section starts clean.
            current = overlap_tail() if not section_changed else []
        current.append(u)
    emit()
    return chunks
