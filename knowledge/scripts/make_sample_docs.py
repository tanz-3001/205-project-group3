"""Generate the demo knowledge-base documents in knowledge/sample_docs/.

All content is FICTIONAL sample policy for "Synapse Demo University". It contains no real
student data and must be replaced with approved university documents before going live.

    python scripts/make_sample_docs.py
"""
from __future__ import annotations

from pathlib import Path

import docx
import fitz  # PyMuPDF
from docx.shared import Pt

OUT = Path(__file__).resolve().parent.parent / "sample_docs"
NOTICE = "SAMPLE DOCUMENT - fictional content for the Synapse prototype. Not real university policy."

# --------------------------------------------------------------------------- PDF
REGULATIONS = [
    ("Academic Regulations 2026", 1, None),
    (None, 0, NOTICE),
    ("1. Purpose and Scope", 2, None),
    (None, 0, "These regulations apply to all undergraduate and postgraduate students of Synapse Demo University from the start of the 2026 academic year. Where a programme handbook sets a stricter rule, the programme handbook applies."),
    ("2. Attendance Policy", 2, None),
    (None, 0, "Students are expected to attend all scheduled lectures, tutorials and laboratory sessions. Attendance is recorded at every session using the student ID card reader or the online register."),
    (None, 0, "A student whose attendance in a course falls below 80 percent of scheduled sessions will receive a formal attendance warning from the course instructor. If attendance falls below 70 percent, the student may be withdrawn from the course with a grade of W, unless an approved absence covers the shortfall."),
    (None, 0, "An absence is approved only when the student submits an Absence Notification Form through the student portal within 5 working days of returning, together with supporting evidence such as a medical certificate. Absences for official university activities are approved by the Dean of Students."),
    ("3. Assessment and Late Submission", 2, None),
    ("3.1 Submission deadlines", 3, None),
    (None, 0, "Coursework must be submitted through the learning platform by 23:59 local time on the published deadline. Email submissions are not accepted unless the instructor has agreed in writing."),
    ("3.2 Late submission penalties", 3, None),
    (None, 0, "Work submitted after the deadline without an approved extension loses 10 percent of the available marks for each calendar day it is late, up to a maximum of 5 calendar days. Work submitted more than 5 calendar days late receives a mark of zero."),
    ("3.3 Extensions", 3, None),
    (None, 0, "A student may request an extension of up to 7 calendar days by submitting an Extension Request Form to the course instructor before the deadline. Requests made after the deadline are considered only in exceptional circumstances through the Mitigating Circumstances procedure."),
    ("4. Mitigating Circumstances", 2, None),
    (None, 0, "Mitigating circumstances are serious, unforeseen events outside the student's control, such as illness, bereavement or a family emergency, that affect performance in an assessment. Claims must be submitted within 10 working days of the affected assessment, with independent supporting evidence."),
    (None, 0, "Claims are reviewed by the Mitigating Circumstances Panel, which meets every two weeks during the semester. The panel may grant a deferred assessment, an extension or the removal of a late penalty. The panel does not change marks for academic judgement."),
    ("5. Examinations", 2, None),
    (None, 0, "The final examination timetable is published in the student portal under Exams at least 4 weeks before the examination period begins. Students must bring their valid student ID card to every examination; students without ID will not be admitted until their identity has been verified."),
    (None, 0, "Students who arrive more than 30 minutes after the start of an examination will not be admitted. Mobile phones and smart watches must be switched off and placed in the designated area. Any unauthorised material found at the desk is treated as a breach of examination regulations."),
    ("6. Course Registration, Add and Drop", 2, None),
    (None, 0, "Students may add or drop courses through Registration in the student portal until the end of week 2 of the semester. Dropping a course before this deadline removes it from the academic record and the tuition for that course is adjusted automatically."),
    (None, 0, "After week 2, a student may withdraw from a course until the end of week 10 and will receive a grade of W, which does not affect the GPA. No tuition adjustment is made for withdrawals after week 2. Withdrawal after week 10 is not permitted except through the Mitigating Circumstances procedure."),
    ("7. Academic Progression", 2, None),
    (None, 0, "Students must maintain a cumulative GPA of at least 2.0 to remain in good academic standing. A student whose cumulative GPA falls below 2.0 is placed on academic probation for the following semester and must meet an academic advisor before registering."),
    (None, 0, "Students on academic probation may register for a maximum of 12 credit hours. A student who remains below a cumulative GPA of 2.0 for two consecutive semesters on probation may be dismissed from the programme."),
]


def make_pdf(path: Path) -> None:
    doc = fitz.open()
    page = None
    y = 0.0
    left, width, bottom = 60, 475, 760
    sizes = {1: 20, 2: 14, 3: 12, 0: 10.5}

    def new_page():
        nonlocal page, y
        page = doc.new_page(width=595, height=842)
        y = 70
        page.insert_text((left, 40), "Synapse Demo University - Academic Regulations 2026", fontsize=8, fontname="helv", color=(0.4, 0.4, 0.4))

    scratch = fitz.open()
    probe = scratch.new_page(width=595, height=3000)

    def height(text: str, size: float, font: str) -> float:
        spare = probe.insert_textbox(fitz.Rect(left, 0, left + width, 1000), text, fontsize=size, fontname=font)
        probe.clean_contents()
        return 1000 - spare

    new_page()
    for heading, level, para in REGULATIONS:
        text = heading or para
        size, font = sizes[level], ("hebo" if level else "helv")
        needed = height(text, size, font)
        # Start each numbered section from 5 onwards on a new page so page citations are meaningful.
        if (y + needed + 40 > bottom) or (heading and heading[:2] in ("5.", "7.")):
            new_page()
        page.insert_textbox(fitz.Rect(left, y, left + width, y + needed + 4), text, fontsize=size, fontname=font)
        y += needed + (8 if level else 12)
    scratch.close()
    for i, p in enumerate(doc, start=1):
        p.insert_text((left, 810), f"Page {i} of {doc.page_count}", fontsize=8, fontname="helv", color=(0.4, 0.4, 0.4))
    doc.save(path)
    doc.close()


# -------------------------------------------------------------------------- DOCX
def make_docx(path: Path) -> None:
    d = docx.Document()
    d.styles["Normal"].font.size = Pt(11)
    d.add_heading("Student Handbook 2026", 0)
    d.add_paragraph(NOTICE)

    d.add_heading("1. Enrollment and Registration", 1)
    d.add_heading("1.1 Registering for a new semester", 2)
    d.add_paragraph("Registration for each semester opens in the student portal four weeks before classes start. Choose your courses in Registration, confirm your selection and check that your fees are cleared or covered by an instalment plan. Registration is not complete until the confirmation email arrives in your university inbox.")
    d.add_heading("1.2 Enrollment letters", 2)
    d.add_paragraph("Official enrollment letters are requested from the Documents section of the student portal. Standard letters are issued to your university email within 2 working days. Letters addressed to embassies or employers take up to 5 working days and require the recipient's details.")
    d.add_heading("1.3 Timetables", 2)
    d.add_paragraph("Your personal timetable is in the student portal under My Classes. It updates automatically within one hour when you add or drop a course. Room changes are announced on the timetable and by email.")

    d.add_heading("2. Tuition Fees and Payment", 1)
    d.add_paragraph("Tuition can be paid in full or in instalments through the Student Finance page of the student portal. Accepted methods are debit or credit card, bank transfer and the approved payment kiosks on campus.")
    d.add_heading("2.1 Instalment plan", 2)
    d.add_paragraph("The instalment plan must be set up before the first payment deadline. The schedule for each semester is shown below.")
    t = d.add_table(rows=1, cols=3)
    t.style = "Table Grid"
    t.rows[0].cells[0].text, t.rows[0].cells[1].text, t.rows[0].cells[2].text = "Instalment", "Amount due", "Deadline"
    for row in [("First instalment", "40% of semester tuition", "Before the first day of classes"),
                ("Second instalment", "30% of semester tuition", "End of week 6"),
                ("Third instalment", "30% of semester tuition", "End of week 11")]:
        cells = t.add_row().cells
        for i, v in enumerate(row):
            cells[i].text = v
    d.add_heading("2.2 Late payment", 2)
    d.add_paragraph("A late payment fee of AED 250 is charged when an instalment is more than 7 days overdue. Students with overdue balances cannot register for the next semester or receive official transcripts until the balance is cleared.")
    d.add_heading("2.3 Receipts", 2)
    d.add_paragraph("Payment receipts can be downloaded from the Finance section of the student portal, under Payment history. Receipts are available within 24 hours of a card payment and within 3 working days of a bank transfer.")

    d.add_heading("3. Student Support Services", 1)
    d.add_paragraph("The Student Services Centre is open Sunday to Thursday, 8:00 to 16:00, in Building A, Ground Floor. Requests can also be submitted at any time through Synapse; staff reply within 2 working days.")
    d.add_paragraph("Counselling and wellbeing appointments are free and confidential. Appointments are booked through the Wellbeing team via Synapse or at the Student Services Centre.")

    d.add_heading("4. Library", 1)
    d.add_paragraph("Undergraduate students may borrow up to 10 items for 21 days. Items can be renewed twice online unless another student has reserved them. Overdue items incur a fine of AED 2 per day per item.")
    d.save(path)


# --------------------------------------------------------------------------- TXT
IT_FAQ = f"""# IT Help Desk FAQ

{NOTICE}

## Resetting your password

Select Forgot password on the portal sign-in page and enter your university email address. A reset link is sent to your registered recovery email and expires after 30 minutes. New passwords must be at least 12 characters and include a number and a symbol.

If your account is locked after 5 failed sign-in attempts, wait 15 minutes and try again, or contact the IT Help Desk to unlock it.

## Connecting to campus Wi-Fi

Connect to the network named SynapseDemo-Secure and sign in with your university username and password. Guests should use SynapseDemo-Guest, which requires a daily access code from the library desk. Each student may register up to 4 devices.

## Multi-factor authentication

Multi-factor authentication (MFA) is required for the student portal and university email. Set it up in the Security section of your account using an authenticator app. If you change phones, ask the IT Help Desk to reset your MFA after verifying your identity in person.

## Software for students

Students can install the office suite on up to 5 personal devices at no cost while enrolled. Specialist software for engineering and design courses is available in the computer labs and through the virtual desktop service.

## Contacting the IT Help Desk

The IT Help Desk is in the Library, Level 1, and is open Sunday to Thursday from 8:00 to 18:00. Requests can also be raised through Synapse at any time.
"""


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    make_pdf(OUT / "Academic_Regulations_2026.pdf")
    make_docx(OUT / "Student_Handbook_2026.docx")
    (OUT / "IT_Help_Desk_FAQ.txt").write_text(IT_FAQ, encoding="utf-8")
    for p in sorted(OUT.iterdir()):
        print(f"{p.name}: {p.stat().st_size} bytes")


if __name__ == "__main__":
    main()
