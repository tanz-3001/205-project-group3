"""Validation, extraction and chunking."""
from __future__ import annotations

import io

import docx
import fitz
import pytest

from app.chunking import chunk_blocks, estimate_tokens, split_sentences
from app.extraction import Block, ExtractionError, clean_text, extract
from app.validation import UploadRejected, safe_filename, validate_upload
from conftest import sample

MB = 1024 * 1024


def make_pdf(pages: list[str]) -> bytes:
    d = fitz.open()
    for text in pages:
        p = d.new_page()
        p.insert_textbox(fitz.Rect(50, 50, 550, 800), text, fontsize=11)
    data = d.tobytes()
    d.close()
    return data


# ---------------------------------------------------------------- validation
class TestValidation:
    def test_valid_types_accepted(self):
        assert validate_upload("a.pdf", "application/pdf", sample("Academic_Regulations_2026.pdf"), 20 * MB).file_type == "pdf"
        assert validate_upload("b.docx", "", sample("Student_Handbook_2026.docx"), 20 * MB).file_type == "docx"
        assert validate_upload("c.txt", "text/plain", sample("IT_Help_Desk_FAQ.txt"), 20 * MB).file_type == "txt"

    @pytest.mark.parametrize("name", ["virus.exe", "page.html", "noext", "image.png"])
    def test_unsupported_extension(self, name):
        with pytest.raises(UploadRejected) as e:
            validate_upload(name, None, b"hello", MB)
        assert e.value.code == "unsupported_type" and e.value.status == 415

    def test_empty_file(self):
        with pytest.raises(UploadRejected) as e:
            validate_upload("a.txt", "text/plain", b"", MB)
        assert e.value.code == "empty_file"

    def test_whitespace_only_text(self):
        with pytest.raises(UploadRejected) as e:
            validate_upload("a.txt", "text/plain", b"   \n\n ", MB)
        assert e.value.code == "empty_file"

    def test_too_large(self):
        with pytest.raises(UploadRejected) as e:
            validate_upload("a.txt", "text/plain", b"x" * (MB + 1), MB)
        assert e.value.status == 413

    def test_extension_spoofing_is_detected(self):
        with pytest.raises(UploadRejected) as e:  # an executable renamed to .pdf
            validate_upload("policy.pdf", "application/pdf", b"MZ\x90\x00" + b"\x00" * 100, MB)
        assert e.value.code == "content_mismatch"
        with pytest.raises(UploadRejected):  # a PDF renamed to .txt
            validate_upload("notes.txt", "text/plain", sample("Academic_Regulations_2026.pdf"), 20 * MB)

    def test_client_mime_mismatch(self):
        with pytest.raises(UploadRejected) as e:
            validate_upload("a.pdf", "image/png", sample("Academic_Regulations_2026.pdf"), 20 * MB)
        assert e.value.code == "mime_mismatch"

    def test_corrupted_pdf(self):
        data = sample("Academic_Regulations_2026.pdf")[:400]
        with pytest.raises(UploadRejected) as e:
            validate_upload("a.pdf", "application/pdf", data, MB)
        assert e.value.code == "corrupted_file"

    def test_corrupted_docx(self):
        data = sample("Student_Handbook_2026.docx")[:300]
        with pytest.raises(UploadRejected) as e:
            validate_upload("a.docx", "", data, MB)
        assert e.value.code in ("corrupted_file", "content_mismatch")

    def test_safe_filename(self):
        assert safe_filename("../../etc/passwd.txt") == "passwd.txt"
        assert safe_filename("C:\\Windows\\evil<script>.pdf") == "evil_script_.pdf"
        assert safe_filename("\x00\x1f.pdf") == "pdf"
        assert len(safe_filename("a" * 400 + ".pdf")) <= 150


# ---------------------------------------------------------------- extraction
class TestExtraction:
    def test_pdf_text_pages_and_headings(self):
        e = extract("pdf", sample("Academic_Regulations_2026.pdf"))
        assert e.page_count and e.page_count >= 2
        text = " ".join(b.text for b in e.blocks)
        assert "80 percent" in text and "10 percent of the available marks" in text
        headings = [b.text for b in e.blocks if b.kind == "heading"]
        assert any("Attendance Policy" in h for h in headings)
        exam = next(b for b in e.blocks if "student ID card to every examination" in b.text)
        assert exam.page and exam.page > 1 and "Examinations" in (exam.heading or "")
        # running header and "Page X of Y" footer are removed as artefacts
        assert not any(b.text.startswith("Page ") and " of " in b.text for b in e.blocks)
        assert sum("Academic Regulations 2026" in b.text and b.kind == "para" for b in e.blocks) == 0

    def test_pdf_page_numbers_preserved(self):
        e = extract("pdf", make_pdf(["Alpha section text about libraries.", "Beta section text about parking.", "Gamma text about sports."]))
        pages = {b.text.split()[0]: b.page for b in e.blocks}
        assert pages["Alpha"] == 1 and pages["Beta"] == 2 and pages["Gamma"] == 3

    def test_docx_headings_and_tables(self):
        e = extract("docx", sample("Student_Handbook_2026.docx"))
        headings = [b.text for b in e.blocks if b.kind == "heading"]
        assert "2. Tuition Fees and Payment" in headings and "2.1 Instalment plan" in headings
        table = next(b for b in e.blocks if b.kind == "table")
        assert "Instalment | Amount due | Deadline" in table.text and "End of week 6" in table.text
        assert table.heading and "2.1 Instalment plan" in table.heading and "Tuition Fees" in table.heading

    def test_txt_markdown_headings(self):
        e = extract("txt", sample("IT_Help_Desk_FAQ.txt"))
        wifi = next(b for b in e.blocks if "SynapseDemo-Secure" in b.text)
        assert wifi.heading and "Connecting to campus Wi-Fi" in wifi.heading

    def test_txt_encoding_fallback(self):
        e = extract("txt", "Café policy — résumé rules apply to everyone here.".encode("cp1252", errors="replace"))
        assert "Caf" in e.blocks[0].text

    def test_empty_content_detected(self):
        blank = fitz.open(); blank.new_page(); data = blank.tobytes(); blank.close()
        with pytest.raises(ExtractionError):
            extract("pdf", data)
        d = docx.Document(); buf = io.BytesIO(); d.save(buf)
        with pytest.raises(ExtractionError):
            extract("docx", buf.getvalue())

    def test_clean_text(self):
        assert clean_text("regu-\nlation  applies\nto  all\u00a0students\x00") == "regulation applies to all students"
        assert clean_text("Para one.\n\n\n\nPara two.") == "Para one.\n\nPara two."


# ----------------------------------------------------------------- chunking
class TestChunking:
    def _blocks(self, n_sent: int = 60, page_every: int = 20) -> list[Block]:
        return [Block(f"Sentence number {i} explains rule {i} of the policy in some detail.", "para", page=1 + i // page_every, heading="Policy") for i in range(n_sent)]

    def test_chunks_respect_target_and_sentences(self):
        chunks = chunk_blocks(self._blocks(), target_tokens=80, overlap_tokens=20)
        assert len(chunks) > 3
        for c in chunks:
            assert c.token_count <= 80
            assert c.content.endswith(".")  # no sentence split mid-way
        assert [c.index for c in chunks] == list(range(len(chunks)))

    def test_overlap(self):
        chunks = chunk_blocks(self._blocks(), target_tokens=80, overlap_tokens=20)
        for a, b in zip(chunks, chunks[1:]):
            last_sentence = split_sentences(a.content)[-1]
            assert b.content.startswith(last_sentence) or last_sentence in b.content

    def test_page_references_and_metadata(self):
        chunks = chunk_blocks(self._blocks(), target_tokens=80, overlap_tokens=0, doc_name="Regs")
        assert chunks[0].page_number == 1
        assert chunks[-1].page_end == 3
        assert all(c.section_heading == "Policy" and c.metadata["document"] == "Regs" for c in chunks)
        spanning = [c for c in chunks if c.page_number != c.page_end]
        assert all(c.page_number < c.page_end for c in spanning)

    def test_sections_start_new_chunks(self):
        blocks = [Block("A " * 5 + "first section sentence.", "para", 1, "Fees")] * 8 + [Block("Other topic sentence here.", "para", 2, "Library")] * 3
        chunks = chunk_blocks(blocks, target_tokens=200, overlap_tokens=30)
        assert chunks[-1].section_heading == "Library"
        assert "first section" not in chunks[-1].content

    def test_long_sentence_is_split(self):
        chunks = chunk_blocks([Block("word " * 500 + ".", "para", 1)], target_tokens=100, overlap_tokens=10)
        assert len(chunks) >= 5 and all(c.token_count <= 100 for c in chunks)

    def test_real_documents(self):
        expected = [
            ("Academic_Regulations_2026.pdf", "pdf"),
            ("Academic_Calendar_2026_2027.pdf", "pdf"),
            ("Library_and_Research_Services_Guide_2026.pdf", "pdf"),
            ("Graduation_and_Academic_Honours_Guide_2026.pdf", "pdf"),
            ("Academic_Integrity_and_Research_Ethics_Policy_2026.pdf", "pdf"),
            ("Scholarships_Bursaries_and_Financial_Aid_Guide_2026.pdf", "pdf"),
            ("Student_Handbook_2026.docx", "docx"),
            ("Campus_Housing_and_Transport_Guide_2026.docx", "docx"),
            ("Careers_Internships_and_Placements_Guide_2026.docx", "docx"),
            ("International_Student_Onboarding_and_Campus_Life_Guide_2026.docx", "docx"),
            ("Undergraduate_and_Postgraduate_Programme_Catalogue_2026.docx", "docx"),
            ("IT_Help_Desk_FAQ.txt", "txt"),
            ("Health_Safety_and_Accessibility_Services.txt", "txt"),
            ("Exchange_and_Study_Abroad_Handbook_2026.txt", "txt"),
            ("Student_Code_of_Conduct_and_Campus_Policies_2026.txt", "txt"),
            ("Innovation_Labs_Makerspace_and_Student_Research_Guide_2026.txt", "txt"),
        ]
        for name, kind in expected:
            chunks = chunk_blocks(extract(kind, sample(name)).blocks, 500, 100, name)
            assert chunks and all(estimate_tokens(c.content) <= 500 for c in chunks), name
