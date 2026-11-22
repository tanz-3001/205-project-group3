"""Text extraction (PDF, DOCX, TXT) and cleaning.

Output is a flat, ordered list of Blocks. Every block keeps the page number (PDF)
and the section heading in force, so chunks and citations stay traceable.
"""
from __future__ import annotations

import io
import re
import statistics
import unicodedata
from collections import Counter
from dataclasses import dataclass, field


class ExtractionError(Exception):
    """Raised with a message that is safe to show to administrators."""


@dataclass
class Block:
    text: str
    kind: str = "para"  # heading | para | table
    page: int | None = None
    heading: str | None = None
    level: int = 0


@dataclass
class Extracted:
    blocks: list[Block] = field(default_factory=list)
    page_count: int | None = None

    @property
    def text_length(self) -> int:
        return sum(len(b.text) for b in self.blocks)


# ------------------------------------------------------------------ cleaning
_CTRL = re.compile(r"[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u200b\ufeff]")
_PAGE_NO = re.compile(r"^\s*(page\s*)?\d{1,4}(\s*(of|/)\s*\d{1,4})?\s*$", re.I)


def clean_text(text: str) -> str:
    text = unicodedata.normalize("NFKC", text)
    text = _CTRL.sub("", text).replace("\u00a0", " ")
    text = re.sub(r"(\w)-\n(\w)", r"\1\2", text)  # re-join words hyphenated across lines
    text = re.sub(r"[ \t]*\n[ \t]*", "\n", text)
    text = re.sub(r"(?<!\n)\n(?!\n)", " ", text)  # single line breaks inside a paragraph
    text = re.sub(r"[ \t]{2,}", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def _assign_headings(blocks: list[Block]) -> list[Block]:
    """Carry the most recent heading path forward onto every block."""
    stack: list[tuple[int, str]] = []
    for b in blocks:
        if b.kind == "heading":
            lvl = b.level or 1
            stack = [(l, t) for l, t in stack if l < lvl] + [(lvl, b.text)]
        b.heading = " › ".join(t for _, t in stack)[:300] or None
    return blocks


def _finalise(blocks: list[Block], page_count: int | None) -> Extracted:
    out = []
    for b in blocks:
        b.text = clean_text(b.text)
        if b.text:
            out.append(b)
    if not any(b.kind != "heading" or len(b.text) > 20 for b in out):
        raise ExtractionError("No readable text was found. If this is a scanned PDF, upload a text-based version.")
    return Extracted(blocks=_assign_headings(out), page_count=page_count)


# ---------------------------------------------------------------------- PDF
_NUMBERED_HEADING = re.compile(r"^(\d+(\.\d+)*\.?|[A-Z]\.|Section\s+\d+[.:]?|Part\s+[IVX\d]+[.:]?)\s+\S")


def extract_pdf(data: bytes) -> Extracted:
    import fitz  # PyMuPDF

    try:
        doc = fitz.open(stream=data, filetype="pdf")
    except Exception as exc:
        raise ExtractionError("The PDF could not be opened (it may be damaged).") from exc
    try:
        if doc.needs_pass:
            raise ExtractionError("The PDF is password-protected.")
        raw: list[tuple[int, str, float, bool]] = []  # (page, text, font size, bold)
        sizes: list[float] = []
        for pno, page in enumerate(doc, start=1):
            for blk in page.get_text("dict", sort=True).get("blocks", []):
                if blk.get("type") != 0:
                    continue
                lines, bsize, bold_chars, chars = [], 0.0, 0, 0
                for line in blk.get("lines", []):
                    spans = line.get("spans", [])
                    lines.append("".join(s.get("text", "") for s in spans))
                    for s in spans:
                        n = len(s.get("text", "").strip())
                        if n:
                            bsize = max(bsize, float(s.get("size", 0)))
                            sizes.extend([round(float(s.get("size", 0)), 1)] * n)
                            chars += n
                            if int(s.get("flags", 0)) & 16 or "bold" in s.get("font", "").lower():
                                bold_chars += n
                text = "\n".join(lines).strip()
                if text:
                    raw.append((pno, text, bsize, chars > 0 and bold_chars / chars > 0.8))
        page_count = doc.page_count
    finally:
        doc.close()

    if not raw:
        raise ExtractionError("No readable text was found. If this is a scanned PDF, upload a text-based version.")
    body = statistics.median(sizes) if sizes else 10.0

    # Repeated short lines on most pages are running headers/footers: drop them.
    norm = lambda s: re.sub(r"\d+", "#", s.strip().lower())  # noqa: E731
    counts = Counter(norm(t) for _, t, _, _ in raw if len(t) < 120)
    repeated = {k for k, v in counts.items() if page_count >= 3 and v >= max(3, int(page_count * 0.6))}

    blocks: list[Block] = []
    for pno, text, size, bold in raw:
        if _PAGE_NO.match(text) or norm(text) in repeated:
            continue
        one_line = " ".join(text.split())
        short = len(one_line) <= 120 and not one_line.endswith((".", ";", ","))
        if short and (size >= body * 1.18 or (bold and (_NUMBERED_HEADING.match(one_line) or len(one_line) < 80))):
            level = 1 if size >= body * 1.45 else 2 if size >= body * 1.18 else 3
            blocks.append(Block(one_line, "heading", pno, level=level))
        else:
            blocks.append(Block(text, "para", pno))
    return _finalise(blocks, page_count)


# --------------------------------------------------------------------- DOCX
def extract_docx(data: bytes) -> Extracted:
    import docx
    from docx.table import Table
    from docx.text.paragraph import Paragraph

    try:
        document = docx.Document(io.BytesIO(data))
    except Exception as exc:
        raise ExtractionError("The Word document could not be opened (it may be damaged).") from exc

    blocks: list[Block] = []
    body = document.element.body
    for child in body.iterchildren():
        tag = child.tag.rsplit("}", 1)[-1]
        if tag == "p":
            p = Paragraph(child, document)
            text = p.text.strip()
            if not text:
                continue
            style = (p.style.name if p.style is not None else "") or ""
            m = re.match(r"Heading\s*(\d)", style, re.I)
            if m or style.lower() == "title":
                blocks.append(Block(text, "heading", level=int(m.group(1)) if m else 1))
            else:
                blocks.append(Block(text, "para"))
        elif tag == "tbl":
            table = Table(child, document)
            rows = []
            for row in table.rows:
                cells, seen = [], set()
                for cell in row.cells:  # merged cells repeat; keep each once
                    if id(cell._tc) in seen:
                        continue
                    seen.add(id(cell._tc))
                    cells.append(" ".join(cell.text.split()))
                if any(cells):
                    rows.append(" | ".join(cells))
            if rows:
                # Keep the header row with every table block so meaning survives chunking.
                blocks.append(Block("Table: " + "\n\n".join(rows), "table"))
    return _finalise(blocks, None)


# ---------------------------------------------------------------------- TXT
def decode_text(data: bytes) -> str:
    for enc in ("utf-8-sig", "utf-16") if data[:2] in (b"\xff\xfe", b"\xfe\xff") else ("utf-8-sig", "cp1252", "latin-1"):
        try:
            return data.decode(enc)
        except UnicodeDecodeError:
            continue
    return data.decode("utf-8", errors="replace")


def extract_txt(data: bytes) -> Extracted:
    text = decode_text(data).replace("\r\n", "\n").replace("\r", "\n")
    blocks: list[Block] = []
    for para in re.split(r"\n\s*\n", text):
        para = para.strip()
        if not para:
            continue
        first, _, rest = para.partition("\n")
        md = re.match(r"^(#{1,6})\s+(.+)$", first.strip())
        is_caps = len(first) <= 80 and first.isupper() and re.search(r"[A-Z]{3}", first)
        if md or is_caps:
            blocks.append(Block(md.group(2) if md else first.strip(), "heading", level=len(md.group(1)) if md else 1))
            if rest.strip():
                blocks.append(Block(rest, "para"))
        else:
            blocks.append(Block(para, "para"))
    return _finalise(blocks, None)


def extract(file_type: str, data: bytes) -> Extracted:
    if file_type == "pdf":
        return extract_pdf(data)
    if file_type == "docx":
        return extract_docx(data)
    if file_type == "txt":
        return extract_txt(data)
    raise ExtractionError("Unsupported file type.")
