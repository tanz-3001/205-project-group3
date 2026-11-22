"""Upload validation: never trust the filename or the client MIME type alone."""
from __future__ import annotations

import io
import re
import unicodedata
import zipfile
from dataclasses import dataclass
from pathlib import PurePath

ALLOWED = {
    "pdf": {"application/pdf", "application/x-pdf"},
    "docx": {"application/vnd.openxmlformats-officedocument.wordprocessingml.document"},
    "txt": {"text/plain"},
}
# Browsers sometimes send these for any file; they carry no information.
NEUTRAL_MIME = {"", "application/octet-stream", "binary/octet-stream"}
CANONICAL_MIME = {"pdf": "application/pdf", "docx": next(iter(ALLOWED["docx"])), "txt": "text/plain"}


class UploadRejected(Exception):
    def __init__(self, code: str, message: str, status: int):
        super().__init__(message)
        self.code, self.message, self.status = code, message, status


@dataclass
class ValidatedFile:
    filename: str
    file_type: str
    mime_type: str


def safe_filename(name: str | None) -> str:
    """Strip any path, control characters and unusual symbols; keep a readable name."""
    base = PurePath((name or "").replace("\\", "/")).name
    base = unicodedata.normalize("NFKC", base)
    base = "".join(ch for ch in base if unicodedata.category(ch)[0] != "C")
    base = re.sub(r"[^\w\-. ()&,']", "_", base).strip(" .")
    base = re.sub(r"_+", "_", base)
    return (base or "document")[:150]


def display_name_from(filename: str) -> str:
    stem = filename.rsplit(".", 1)[0]
    return re.sub(r"[_]+", " ", stem).strip()[:200] or "Untitled document"


def sniff(data: bytes) -> str | None:
    """Detect the real type from content (magic bytes / structure)."""
    if data[:5] == b"%PDF-":
        return "pdf"
    if data[:4] == b"PK\x03\x04":
        try:
            with zipfile.ZipFile(io.BytesIO(data)) as z:
                names = set(z.namelist())
            if "word/document.xml" in names and "[Content_Types].xml" in names:
                return "docx"
        except zipfile.BadZipFile:
            return "corrupt-zip"
        return "zip"
    sample = data[:8192]
    if b"\x00" in sample:
        return None
    try:
        sample.decode("utf-8")
        return "txt"
    except UnicodeDecodeError as e:
        # A multi-byte character cut at the sample boundary is still valid UTF-8 text.
        if e.start >= len(sample) - 3:
            return "txt"
    try:
        text = sample.decode("cp1252")
    except UnicodeDecodeError:
        return None
    printable = sum(ch.isprintable() or ch in "\r\n\t" for ch in text)
    return "txt" if printable / max(len(text), 1) > 0.95 else None


def _check_opens(kind: str, data: bytes) -> None:
    """Make sure the file can actually be parsed (detects corrupted / encrypted files)."""
    if kind == "pdf":
        import fitz  # PyMuPDF

        try:
            doc = fitz.open(stream=data, filetype="pdf")
        except Exception as exc:
            raise UploadRejected("corrupted_file", "This PDF appears to be damaged and cannot be opened.", 422) from exc
        try:
            if doc.needs_pass:
                raise UploadRejected("encrypted_file", "This PDF is password-protected. Upload an unprotected copy.", 422)
            if doc.page_count == 0:
                raise UploadRejected("empty_file", "This PDF has no pages.", 422)
        finally:
            doc.close()
    elif kind == "docx":
        import docx

        try:
            docx.Document(io.BytesIO(data))
        except Exception as exc:
            raise UploadRejected("corrupted_file", "This Word document appears to be damaged and cannot be opened.", 422) from exc


def validate_upload(original_name: str | None, client_mime: str | None, data: bytes, max_bytes: int) -> ValidatedFile:
    filename = safe_filename(original_name)
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext not in ALLOWED:
        raise UploadRejected("unsupported_type", "Only PDF, DOCX and TXT files are supported.", 415)
    if len(data) == 0:
        raise UploadRejected("empty_file", "The file is empty.", 422)
    if len(data) > max_bytes:
        raise UploadRejected("file_too_large", f"Files must be smaller than {max_bytes // (1024 * 1024)} MB.", 413)

    mime = (client_mime or "").split(";")[0].strip().lower()
    if mime not in NEUTRAL_MIME and mime not in ALLOWED[ext]:
        raise UploadRejected("mime_mismatch", "The file type reported by your browser does not match the file extension.", 415)

    kind = sniff(data)
    if kind == "corrupt-zip" and ext == "docx":
        raise UploadRejected("corrupted_file", "This Word document appears to be damaged and cannot be opened.", 422)
    if kind != ext:
        if ext == "pdf" and kind is None and b"%PDF" not in data[:1024]:
            raise UploadRejected("content_mismatch", "This file is not a valid PDF.", 415)
        raise UploadRejected("content_mismatch", f"The file content does not match the .{ext} extension.", 415)
    if ext == "txt" and not data.strip():
        raise UploadRejected("empty_file", "The text file contains no text.", 422)

    _check_opens(ext, data)
    return ValidatedFile(filename=filename, file_type=ext, mime_type=CANONICAL_MIME[ext])
