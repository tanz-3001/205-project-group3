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

SectionList = list[tuple[str | None, int, str | None]]


# --------------------------------------------------------------------------- PDFs
REGULATIONS: SectionList = [
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
    ("8. Grading Scale and GPA Calculation", 2, None),
    (None, 0, "Courses are graded on a 4.00 scale: A (90-100, 4.00 points), A- (85-89, 3.70), B+ (80-84, 3.30), B (75-79, 3.00), B- (70-74, 2.70), C+ (65-69, 2.30), C (60-64, 2.00), D (50-59, 1.00), and F (below 50, 0.00). The minimum passing grade for an undergraduate core course is C, and the minimum passing grade for postgraduate courses is B-."),
    (None, 0, "Grades W (Withdrawn), I (Incomplete), and T (Transfer Pass) carry zero quality points and are excluded from GPA calculations. An Incomplete grade must be resolved within 4 weeks of the next semester or it automatically converts to F."),
    ("9. Academic Advising and Course Load Limits", 2, None),
    (None, 0, "Full-time undergraduate students normally enrol in 12 to 18 credit hours per semester; full-time postgraduate students normally enrol in 9 to 12 credit hours. Students with a cumulative GPA of 3.50 or higher may request an overload of up to 21 undergraduate credit hours through their faculty advisor."),
    (None, 0, "Every student meets their assigned faculty academic advisor at least once before course registration opens each semester to clear advising holds and confirm degree progress."),
    ("10. Leave of Absence and Re-admission", 2, None),
    (None, 0, "A student in good academic standing may apply for an official Leave of Absence for up to two consecutive regular semesters by submitting the Leave Form before the add/drop deadline. Time on approved leave does not count toward maximum programme duration limits."),
    (None, 0, "Students returning from an approved leave resume study without re-applying. Students who interrupt study for more than two semesters without an approved leave must apply for re-admission through the Registrar's Office at least 4 weeks before semester start."),
]

CALENDAR: SectionList = [
    ("Academic Calendar 2026-2027", 1, None),
    (None, 0, NOTICE),
    ("1. Fall Semester 2026 Key Dates", 2, None),
    (None, 0, "New Student Orientation takes place from 24 August to 28 August 2026. Classes for Fall 2026 begin on Monday, 31 August 2026. The course add/drop deadline closes on Friday, 11 September 2026 at 23:59."),
    (None, 0, "Midterm assessments are held from 12 October to 23 October 2026. The last day to withdraw with a grade of W is Friday, 6 November 2026. Study and revision days run from 7 December to 9 December 2026, followed by final examinations from 10 December to 20 December 2026. Official Fall grades are released on 28 December 2026."),
    ("2. Spring Semester 2027 Key Dates", 2, None),
    (None, 0, "Spring 2027 registration opens on 7 December 2026 and orientation runs from 14 January to 15 January 2027. Classes begin on Monday, 18 January 2027, and the add/drop period closes on Friday, 29 January 2027."),
    (None, 0, "Spring midterms run from 1 March to 12 March 2027, followed by Spring Break from 22 March to 26 March 2027. Course withdrawal closes on 9 April 2027. Final examinations run from 10 May to 20 May 2027, with Spring grades published on 27 May 2027 and Commencement Ceremony held on 5 June 2027."),
    ("3. Summer Term 2027 Key Dates", 2, None),
    (None, 0, "Summer 2027 classes begin on Monday, 14 June 2027, with a compressed add/drop deadline on Thursday, 17 June 2027. Withdrawal closes on 14 July 2027, and Summer final examinations take place from 26 July to 29 July 2027. Undergraduate students may take at most 6 credit hours in Summer."),
    ("4. Public Holidays and Emergency Campus Closures", 2, None),
    (None, 0, "Teaching does not take place on official national public holidays published by the Registrar. Essential security, residential housing, and online IT support remain active 24 hours a day. When severe weather forces an in-person closure, synchronous classes move automatically to SynapseLearn virtual rooms unless instructed otherwise."),
]

LIBRARY: SectionList = [
    ("Library and Research Services Guide 2026", 1, None),
    (None, 0, NOTICE),
    ("1. Opening Hours and Study Zones", 2, None),
    (None, 0, "During regular teaching weeks, the Main Library in Building C is open Sunday to Thursday from 07:30 to 23:00, and Friday to Saturday from 09:00 to 21:00. Level 1 houses the Collaborative Commons and IT Help Desk; Level 2 is a Quiet Study Floor; Level 3 is a strict Silent Individual Zone."),
    (None, 0, "During the 2-week study and final examination period, Level 2 and Level 3 remain open 24 hours a day for students carrying a valid university student ID card."),
    ("2. Borrowing Limits and Overdue Fines", 2, None),
    (None, 0, "Undergraduate students may borrow up to 10 print items for 21 days. Postgraduate taught and research students may borrow up to 20 print items for 42 days. Course reserve textbooks are short-loan items issued for 4 hours (renewable once overnight)."),
    (None, 0, "Standard loans may be renewed twice online via the Library Catalogue unless another user has placed a hold. Overdue standard books incur a fine of AED 2 per day per item, while overdue short-loan reserve books incur AED 5 per hour."),
    ("3. Group Study Room Bookings", 2, None),
    (None, 0, "Twelve soundproof Group Study Rooms on Level 1 and Level 2 seat 4 to 8 students and include wireless display screens and whiteboards. Rooms are booked in the student portal up to 7 days in advance for a maximum of 2 hours per day and 6 hours per week per student."),
    (None, 0, "Reservations are automatically released to walk-in groups if nobody taps a valid student ID at the room door reader within 15 minutes of the start time."),
    ("4. Research Databases, Referencing and Interlibrary Loans", 2, None),
    (None, 0, "Enrolled students have off-campus access to over 120 peer-reviewed databases (including IEEE Xplore, JSTOR, ScienceDirect, Scopus, and ProQuest) via single sign-on. Articles or books not held locally can be requested free of charge through Interlibrary Loan, typically delivered digitally within 3 to 5 working days."),
    (None, 0, "Subject Research Librarians offer weekly drop-in Zotero, Mendeley, APA 7th, and IEEE citation workshops plus 30-minute one-on-one literature search consultations bookable through the Library section of the portal."),
]

GRADUATION: SectionList = [
    ("Graduation and Academic Honours Guide 2026", 1, None),
    (None, 0, NOTICE),
    ("1. Degree Completion Requirements", 2, None),
    (None, 0, "To qualify for an undergraduate Bachelor's degree, students must complete at least 120 credit hours (including all core, major, and general education requirements), achieve a minimum cumulative GPA of 2.00, and complete the final 30 credit hours in residence at Synapse Demo University."),
    (None, 0, "Master's candidates must complete at least 36 credit hours with a minimum cumulative GPA of 3.00 and pass either a capstone project or defended thesis."),
    ("2. Dean's List and Latin Graduation Honours", 2, None),
    (None, 0, "Full-time undergraduate students completing at least 12 graded credits in a regular semester with a term GPA of 3.60 or higher and no failing or incomplete grades are named to the Dean's Honours List."),
    (None, 0, "Graduating Bachelor's students who have earned at least 60 graded credits at Synapse Demo University receive Latin Honours on their diploma and official transcript: Cum Laude (cumulative GPA 3.50 to 3.69), Magna Cum Laude (3.70 to 3.84), and Summa Cum Laude (3.85 to 4.00)."),
    ("3. Applying to Graduate and Commencement Ceremony", 2, None),
    (None, 0, "Final-year students must submit the Application to Graduate in the student portal no later than week 6 of their final semester. After final grades post, the Registrar's Office completes degree clearance within 5 working days."),
    (None, 0, "Graduands collect academic regalia (gown, hood, and cap) from Building A Atrium during the week prior to Commencement. Each confirmed graduand receives 4 complimentary guest tickets, with extra seats allocated via lottery when available."),
    ("4. Transcripts, Degree Attestation and Alumni Access", 2, None),
    (None, 0, "Graduates receive one complimentary sealed paper diploma, a verified digital credential badge, and two official sealed transcripts upon clearance. Additional certified electronic transcripts are requested via the Documents portal and issued within 2 working days; ministry attestation packs take 5 to 7 working days."),
    (None, 0, "University alumni retain lifetime access to Campus Wi-Fi visitor passes, Career Services consultations for 2 years post-graduation, and Main Library reading-room privileges."),
]

INTEGRITY_ETHICS: SectionList = [
    ("Academic Integrity and Research Ethics Policy 2026", 1, None),
    (None, 0, NOTICE),
    ("1. Citation and Referencing Standards", 2, None),
    (None, 0, "All written coursework, laboratory reports, and research outputs must acknowledge external sources using an approved academic citation style: APA 7th Edition for Psychology and Social Sciences, IEEE for Engineering and Computing, or Harvard for Business programmes."),
    (None, 0, "Students can attend weekly citation and reference-manager drop-in workshops hosted by Subject Research Librarians or consult style templates on SynapseLearn before submitting coursework."),
    ("2. Responsible Use of Generative AI in Coursework", 2, None),
    (None, 0, "Unless restricted by a module syllabus, students may use generative AI tools for brainstorming outlines, grammar proofreading, or explaining core concepts. Submitting unattributed AI-generated essays, code, or fabricated references as one's own original work is strictly prohibited."),
    (None, 0, "Every major coursework submission includes a mandatory AI Use Disclosure box on SynapseLearn stating which tool was used, the purpose of assistance, and confirming final human verification of all claims and citations."),
    ("3. Collaboration and Group Assessment Rules", 2, None),
    (None, 0, "Where group coursework is assigned, each team submits a signed Contribution Log confirming shared responsibility. Unless explicitly permitted as joint work, sharing assignment drafts or source code across individual assessments is classified as collusion."),
    ("4. Undergraduate and Postgraduate Research Ethics Approval", 2, None),
    (None, 0, "Any capstone, honours thesis, or research project involving human participants, surveys, interviews, or personal datasets requires prior approval from the University Research Ethics Committee (REC)."),
    (None, 0, "Students submit the online REC Protocol Form with Participant Information Sheets and Informed Consent Forms at least 10 working days before data collection begins; standard low-risk reviews complete within 10 working days."),
    ("5. Academic Writing Support", 2, None),
    (None, 0, "The Academic Writing Centre in Building B, Room 205 is open Sunday to Thursday from 09:00 to 17:00, offering free 30-minute one-on-one consultations on thesis structure, paraphrasing, literature synthesis, and citation accuracy."),
]

SCHOLARSHIPS_AID: SectionList = [
    ("Scholarships, Bursaries and Financial Aid Guide 2026", 1, None),
    (None, 0, NOTICE),
    ("1. Merit Entrance Awards", 2, None),
    (None, 0, "Incoming undergraduate students are automatically assessed for Merit Entrance tuition reductions based on verified final secondary school averages: 25 percent tuition reduction for 90.0 to 94.9 percent, 40 percent reduction for 95.0 to 97.9 percent, and the 50 percent Chancellor's Award for averages of 98.0 percent or higher."),
    (None, 0, "To retain a Merit Entrance Award in subsequent academic years, recipients must maintain a full-time course load (at least 12 credit hours per regular semester) and achieve a cumulative GPA of 3.30 or higher at each annual June review."),
    ("2. Continuing Student Excellence Awards", 2, None),
    (None, 0, "Enrolled students not already on a higher entrance scholarship who achieve a cumulative GPA of 3.75 or higher across two consecutive regular semesters (at least 24 graded credits) qualify for the Dean's Academic Excellence Award, providing a 15 percent tuition credit for the following academic year."),
    ("3. Family, Alumni and Community Leadership Bursaries", 2, None),
    (None, 0, "Eligible students may apply for one supplementary bursary per academic year: a 10 percent Sibling Grant when two or more immediate siblings attend concurrently, a 15 percent Alumni Family Grant for children of Synapse Demo University graduates, or a 20 percent Community and Extracurricular Leadership Bursary for documented civic or campus leadership."),
    ("4. Annual Review and Application Deadlines", 2, None),
    (None, 0, "Applications for supplementary bursaries and continuing awards close on 15 July for Fall semester and 15 December for Spring semester via the Finance section of the student portal. Decisions are issued by the Financial Aid Committee within 15 working days of deadline closure."),
]


def _build_pdf(
    path: Path,
    header_title: str,
    sections: SectionList,
    page_break_prefixes: tuple[str, ...] = (),
) -> None:
    doc = fitz.open()
    page = None
    y = 0.0
    left, width, bottom = 60, 475, 760
    sizes = {1: 20, 2: 14, 3: 12, 0: 10.5}

    def new_page():
        nonlocal page, y
        page = doc.new_page(width=595, height=842)
        y = 70
        page.insert_text((left, 40), f"Synapse Demo University - {header_title}", fontsize=8, fontname="helv", color=(0.4, 0.4, 0.4))

    scratch = fitz.open()
    probe = scratch.new_page(width=595, height=3000)

    def height(text: str, size: float, font: str) -> float:
        spare = probe.insert_textbox(fitz.Rect(left, 0, left + width, 1000), text, fontsize=size, fontname=font)
        probe.clean_contents()
        return 1000 - spare

    new_page()
    for heading, level, para in sections:
        text = heading or para or ""
        size, font = sizes[level], ("hebo" if level else "helv")
        needed = height(text, size, font)
        if (y + needed + 40 > bottom) or (
            heading and page_break_prefixes and any(heading.startswith(p) for p in page_break_prefixes)
        ):
            new_page()
        page.insert_textbox(fitz.Rect(left, y, left + width, y + needed + 4), text, fontsize=size, fontname=font)
        y += needed + (8 if level else 12)
    scratch.close()
    for i, p in enumerate(doc, start=1):
        p.insert_text((left, 810), f"Page {i} of {doc.page_count}", fontsize=8, fontname="helv", color=(0.4, 0.4, 0.4))
    doc.save(path)
    doc.close()


# -------------------------------------------------------------------------- DOCXs
def _add_table(d: docx.Document, headers: tuple[str, ...], rows: list[tuple[str, ...]]) -> None:
    t = d.add_table(rows=1, cols=len(headers))
    t.style = "Table Grid"
    for i, h in enumerate(headers):
        t.rows[0].cells[i].text = h
    for row in rows:
        cells = t.add_row().cells
        for i, v in enumerate(row):
            cells[i].text = v


def make_student_handbook_docx(path: Path) -> None:
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
    _add_table(
        d,
        ("Instalment", "Amount due", "Deadline"),
        [
            ("First instalment", "40% of semester tuition", "Before the first day of classes"),
            ("Second instalment", "30% of semester tuition", "End of week 6"),
            ("Third instalment", "30% of semester tuition", "End of week 11"),
        ],
    )
    d.add_heading("2.2 Late payment", 2)
    d.add_paragraph("A late payment fee of AED 250 is charged when an instalment is more than 7 days overdue. Students with overdue balances cannot register for the next semester or receive official transcripts until the balance is cleared.")
    d.add_heading("2.3 Receipts", 2)
    d.add_paragraph("Payment receipts can be downloaded from the Finance section of the student portal, under Payment history. Receipts are available within 24 hours of a card payment and within 3 working days of a bank transfer.")

    d.add_heading("3. Student Support Services", 1)
    d.add_paragraph("The Student Services Centre is open Sunday to Thursday, 8:00 to 16:00, in Building A, Ground Floor. Requests can also be submitted at any time through Synapse; staff reply within 2 working days.")
    d.add_paragraph("Counselling and wellbeing appointments are free and confidential. Appointments are booked through the Wellbeing team via Synapse or at the Student Services Centre.")

    d.add_heading("4. Library", 1)
    d.add_paragraph("Undergraduate students may borrow up to 10 items for 21 days. Items can be renewed twice online unless another student has reserved them. Overdue items incur a fine of AED 2 per day per item.")

    d.add_heading("5. Student ID Cards and Campus Access", 1)
    d.add_paragraph("Every enrolled student receives a physical smart Student ID card and an encrypted mobile wallet pass after uploading a passport-style photo during onboarding. ID cards grant access to teaching buildings after 20:00, science laboratories, library 24-hour exam zones, and examination halls.")
    d.add_paragraph("Lost or damaged cards must be reported immediately at the Student Services Centre desk or via Security in the portal; replacement cards cost AED 50 and are printed the same working day.")

    d.add_heading("6. Campus Dining, Prayer Rooms and Lost Property", 1)
    d.add_paragraph("The Student Commons Food Court (Building D) serves halal, vegetarian, vegan, and allergen-labelled meals alongside a campus cafe and grocery kiosk.")
    d.add_paragraph("Separate male and female prayer rooms with ablution facilities are located on the Ground Floor of Buildings A and C. The Campus Bookstore on Building D Ground Floor stocks required textbooks and lab stationery, while the Lost and Found Desk at Building B Ground Floor Reception holds unclaimed personal items for 30 days.")

    d.add_heading("7. Student Clubs, Societies and Campus Events", 1)
    d.add_paragraph("Synapse Demo University hosts over 35 academic, cultural, volunteer, and sports clubs overseen by the Office of Student Life. Any group of 8 or more enrolled students may register a new society at the start of Fall or Spring semester.")
    _add_table(
        d,
        ("Event category", "Advance booking lead time", "Approving office"),
        [
            ("Society meeting or study workshop", "5 working days", "Office of Student Life"),
            ("Campus fair booth or fundraiser", "10 working days", "Student Life & Facilities"),
            ("External guest speaker or auditorium event", "15 working days", "Dean of Students & Security"),
        ],
    )
    d.save(path)


def make_housing_transport_docx(path: Path) -> None:
    d = docx.Document()
    d.styles["Normal"].font.size = Pt(11)
    d.add_heading("Campus Housing and Transport Guide 2026", 0)
    d.add_paragraph(NOTICE)

    d.add_heading("1. University Residences Overview", 1)
    d.add_paragraph("Synapse Demo University operates two on-campus residential halls: North Hall (exclusively for undergraduate students, supervised by 24-hour Resident Advisors) and East Residences (studio and shared suite accommodation reserved for postgraduate students and final-year undergraduates). All rooms include high-speed Wi-Fi, study furniture, air conditioning, weekly common-area housekeeping, and card-controlled access.")
    d.add_heading("1.1 Room Types and Semester Fees", 2)
    _add_table(
        d,
        ("Residence & Room Type", "Occupancy", "Semester Fee (AED)", "Refundable Deposit"),
        [
            ("North Hall - Standard Twin Room", "2 students", "AED 6,500", "AED 1,000"),
            ("North Hall - Single En-suite Room", "1 student", "AED 9,800", "AED 1,000"),
            ("East Residences - Graduate Studio", "1 student", "AED 12,400", "AED 1,500"),
        ],
    )
    d.add_heading("1.2 Residential Life, Quiet Hours and Visitors", 2)
    d.add_paragraph("Residence quiet hours run from 23:00 to 07:00 Sunday to Thursday and 00:00 to 08:00 Friday to Saturday. Day visitors must sign in with valid photo ID at the residence reception and depart before 22:00; overnight guests are not permitted without prior written approval from the Residence Warden.")
    d.add_paragraph("Maintenance requests (plumbing, lighting, locks, air conditioning) are logged in the Housing portal and resolved within 24 hours for urgent issues or 3 working days for routine requests.")

    d.add_heading("2. Campus Shuttle Bus Service", 1)
    d.add_paragraph("Free university shuttle buses operate Sunday to Friday for all students and staff carrying a valid Student ID card. Live shuttle GPS locations appear in the Campus Map section of the student portal.")
    _add_table(
        d,
        ("Route", "Stops Covered", "Operating Hours", "Frequency"),
        [
            ("Route A - Metro Express", "Main Gate <-> Central Metro Station", "06:45 - 22:00", "Every 15 mins"),
            ("Route B - City Loop", "North Hall <-> City Centre Mall <-> Tech Park", "08:00 - 21:00", "Every 30 mins"),
            ("Route C - Campus & Residences", "Building A <-> Library <-> North Hall <-> East Residences", "07:00 - 23:30", "Every 10 mins"),
        ],
    )

    d.add_heading("3. Student Parking and Electric Vehicles", 1)
    d.add_paragraph("Students driving to campus must apply for a semester parking permit (AED 300 per regular semester) in the Transport portal using their vehicle registration card. Lot P1 and Lot P2 near the East Gate are designated for student permit holders; Lot P3 provides 12 Type-2 EV charging bays free for up to 3 hours per session.")
    d.add_paragraph("Covered bicycle and e-scooter racks are available beside every academic building. Riders must dismount on pedestrian walkways across the main campus quad.")
    d.save(path)


def make_careers_internships_docx(path: Path) -> None:
    d = docx.Document()
    d.styles["Normal"].font.size = Pt(11)
    d.add_heading("Careers, Internships and Placements Guide 2026", 0)
    d.add_paragraph(NOTICE)

    d.add_heading("1. Career Services Centre", 1)
    d.add_paragraph("The Career Services Centre is located in Building B, Level 2, and is open Sunday to Thursday from 08:30 to 17:00. Career advisors run daily 20-minute drop-in CV and LinkedIn reviews as well as booked 45-minute mock technical and behavioural interviews.")
    d.add_paragraph("Students and recent graduates browse vetted internships, graduate schemes, and part-time campus vacancies on the SynapseCareers job board using their university login.")

    d.add_heading("2. Credit-Bearing Internships", 1)
    d.add_heading("2.1 Eligibility Requirements", 2)
    d.add_paragraph("Undergraduate students must have completed at least 60 credit hours with a cumulative GPA of 2.20 or higher before beginning a credit-bearing internship module (6 credit hours). Internships require a minimum of 240 supervised workplace hours completed over at least 8 continuous weeks during Summer or a dedicated placement semester.")
    d.add_heading("2.2 Internship Milestones and Assessment", 2)
    _add_table(
        d,
        ("Milestone", "Timing", "Submission Requirement"),
        [
            ("Employer Offer & Learning Agreement", "At least 3 weeks before start date", "Signed tripartite agreement via SynapseCareers"),
            ("Mid-Placement Check-in", "Week 4 of placement", "Supervisor feedback form & weekly log summary"),
            ("Final Reflective Portfolio & Presentation", "Within 10 days after final work day", "2,500-word report & 10-minute faculty panel defence"),
        ],
    )

    d.add_heading("3. On-Campus Part-Time Student Employment", 1)
    d.add_paragraph("Full-time students in good academic standing (cumulative GPA >= 2.00) may work on campus as peer tutors, library assistants, IT lab monitors, or Student Ambassadors for a maximum of 15 hours per week during teaching semesters and up to 30 hours per week during official semester breaks.")
    d.add_paragraph("The standard on-campus student hourly stipend is AED 35 per hour (AED 45 per hour for postgraduate teaching assistants), paid monthly directly by Student Finance.")

    d.add_heading("4. Career Fairs and Alumni Mentorship", 1)
    d.add_paragraph("The university hosts two campus-wide Career and Internship Fairs each year in October (Fall) and March (Spring) in the Main Exhibition Hall, featuring over 80 regional and international employers. Final-year students may also request matching with an Alumni Mentor in their target industry at the start of each semester.")
    d.save(path)


def make_international_onboarding_docx(path: Path) -> None:
    d = docx.Document()
    d.styles["Normal"].font.size = Pt(11)
    d.add_heading("International Student Onboarding and Campus Life Guide 2026", 0)
    d.add_paragraph(NOTICE)

    d.add_heading("1. Pre-Arrival and First-Week Checklist", 1)
    d.add_paragraph("New international students follow a structured pre-arrival and Week 1 onboarding timeline coordinated by Student Services.")
    _add_table(
        d,
        ("Stage", "Timing", "Action"),
        [
            ("Airport Meet & Greet Shuttle", "At least 7 days before arrival", "Submit flight itinerary in the Arrival portal to book complimentary airport transfer"),
            ("Temporary Arrival Housing", "Up to 5 nights prior to check-in", "Request early arrival room allocation via Housing Support before standard move-in"),
            ("Orientation & ID Card Pickup", "Week 1 (Orientation Week)", "Attend Welcome Briefing in Building A Auditorium and collect physical + digital Student ID"),
            ("Local SIM & Bank Letter Request", "First 5 working days", "Request an official enrolment confirmation letter via Documents for local telecom and banking"),
        ],
    )

    d.add_heading("2. International Student Office", 1)
    d.add_paragraph("The International Student Office is located in Building A, Room 210, open Sunday to Thursday from 08:30 to 16:30. Dedicated student advisors assist with settling-in orientation, issuing official enrolment and bank introduction letters, and referring students to specialist staff for formal travel or entry documentation enquiries.")

    d.add_heading("3. Peer Buddy Programme and Cultural Societies", 1)
    d.add_paragraph("Every incoming international student can sign up for the Peer Buddy Programme to be paired with a trained senior student buddy two weeks before classes begin. Student Life hosts the Welcome Mixer in Week 1 and the campus-wide Cultural Festival each November with over 25 student-led national and cultural societies.")

    d.add_heading("4. English Academic Skills Workshops", 1)
    d.add_paragraph("The Centre for Academic Skills offers free weekly workshops covering academic writing structure, seminar participation, oral presentations, and technical report vocabulary. Sessions are bookable through the student portal with no extra tuition fee.")
    d.save(path)


def make_programme_catalogue_docx(path: Path) -> None:
    d = docx.Document()
    d.styles["Normal"].font.size = Pt(11)
    d.add_heading("Undergraduate and Postgraduate Programme Catalogue 2026", 0)
    d.add_paragraph(NOTICE)

    d.add_heading("1. Degree Programmes Overview", 1)
    d.add_paragraph("Synapse Demo University offers accredited undergraduate and postgraduate degree programmes across Computing, Engineering, Business, and Social Sciences.")
    _add_table(
        d,
        ("Programme", "Level", "Credits", "Duration", "Faculty Building"),
        [
            ("BSc Computer Science", "Undergraduate", "120 credits", "4 years", "Building E"),
            ("BSc Cybersecurity", "Undergraduate", "120 credits", "4 years", "Building E"),
            ("BEng Software Engineering", "Undergraduate", "132 credits", "4 years", "Building E"),
            ("BBA Business Analytics", "Undergraduate", "120 credits", "4 years", "Building A"),
            ("BA Psychology", "Undergraduate", "120 credits", "4 years", "Building B"),
            ("MSc Data Science and Artificial Intelligence", "Postgraduate", "36 credits", "1.5-2 years", "Building E"),
            ("Master of Business Administration (MBA)", "Postgraduate", "42 credits", "2 years", "Building A"),
        ],
    )

    d.add_heading("2. Minors and Free Electives", 1)
    d.add_paragraph("Undergraduate students may declare an academic Minor by completing 18 designated credits in a secondary discipline (such as Cybersecurity, Data Analytics, Entrepreneurship, or Cognitive Psychology) and may choose up to 12 credits of free electives across faculties.")

    d.add_heading("3. Change of Major Procedure", 1)
    d.add_paragraph("Students wishing to change their declared major must have completed at least 15 credit hours at Synapse Demo University with a cumulative GPA of 2.50 or higher. Change of Major applications are submitted through Academic Advising in the portal before the end of Week 10 for the next semester.")

    d.add_heading("4. Final-Year Capstone Project and Peer Tutoring (PASS)", 1)
    d.add_paragraph("All undergraduate degrees culminate in a two-semester Final-Year Capstone Project supervised by a faculty member and showcased at the public Innovation Demo Day. First- and second-year students can also attend free weekly Peer-Assisted Study Sessions (PASS) led by high-achieving senior peers in core mathematics, programming, and accounting modules.")
    d.save(path)


# --------------------------------------------------------------------------- TXTs
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

## Campus printing and scanning

Each enrolled student receives an automatic print quota of AED 40 (equivalent to 400 black-and-white pages or 100 colour pages) at the start of each regular semester. Unused quota does not roll over between academic years; top-ups can be made at Library Kiosks or in the Print Portal. Follow-Me printers across Buildings A, B, C, and D release jobs when you tap your Student ID card within 24 hours of submission. Colour printing costs AED 0.40 per side and monochrome costs AED 0.10 per side; scanning to university email is free.

## Learning Management System (SynapseLearn)

All course syllabi, recorded lectures, announcements, and assignment dropboxes live on SynapseLearn. Courses appear on your dashboard automatically within 2 hours of completing registration in the student portal. Turnitin similarity checking runs on major written coursework; students may review their draft similarity report once up to 24 hours before the final submission deadline.

## Campus VPN and remote lab access

To reach engineering CAD licences, SPSS, MATLAB, or on-campus library servers from off campus, install the university VPN client (GlobalConnect) from the IT Downloads page and sign in using MFA. Split-tunnel mode routes only university resources through the VPN so personal streaming stays fast. High-performance virtual lab desktops can also be launched directly in any modern web browser via vlab.synapse.edu.example.

## University email and cloud storage

Your university email address and 1 TB of encrypted cloud drive storage remain active throughout enrolment and for 12 months after graduation. Large files over 25 MB should be shared via a cloud drive link rather than attached to email. Report suspected phishing emails immediately by clicking Report Phish in the toolbar or forwarding to security-desk@synapse.edu.example.
"""

HEALTH_ACCESSIBILITY_TXT = f"""# Health, Safety and Accessibility Services Guide 2026

{NOTICE}

## Campus Medical Clinic and Nursing Triage

The Campus Medical Clinic in Building B, Room 104, is open Sunday to Thursday from 08:00 to 19:00 and on Saturdays from 09:00 to 15:00. Nurse triage, first aid, blood pressure checks, and basic seasonal consultations are free of charge for all enrolled students carrying a Student ID card. After-hours urgent medical incidents on campus or in residences should be reported to Campus Security on +971-800-SYNAPSE (internal extension 5555) or national emergency services on 999.

## Accessibility and Learning Accommodations

The Accessibility and Inclusion Office provides personalised academic accommodations for students with documented physical, sensory, chronic medical, or learning differences (such as dyslexia, ADHD, or hearing/visual impairments). Common accommodations include 25 percent to 50 percent extra examination time, low-distraction individual exam rooms, ergonomic seating, lecture captioning, screen-reader text conversions, and flexible attendance plans.

To have exam accommodations active for a given semester, students should register through Student Support in the portal and upload practitioner documentation at least 4 weeks before the start of the examination period. All accommodation records are strictly confidential and instructors are notified only of the approved adjustments, never the underlying diagnosis.

## Laboratory and Workshop Safety Rules

No student may enter an engineering, chemistry, or biology laboratory without completing the online Health & Safety Induction quiz for that semester. Closed-toe shoes, lab coats, and safety goggles are mandatory inside active wet labs and fabrication workshops; food and drink are strictly prohibited in all laboratories. Report spills, broken glassware, or faulty fume hoods to the Lab Technician immediately.

## Emergency Evacuation and Assembly Points

When a building fire alarm sounds, stop work immediately, leave bags behind if needed, and exit via the nearest illuminated stairwell—never use elevators during an alarm. Proceed directly to your zone Emergency Assembly Point: Central Quad Lawn for Buildings A and C (Library), or North Sports Field for Buildings B, D, and student residences. Remain at the assembly point until Campus Security announces all-clear.

## Accessible Campus Transport

Students with temporary injuries or permanent mobility requirements may book the on-campus electric accessibility buggy through Student Support or by calling Campus Security 20 minutes before a class transition. Buggy transfers run Sunday to Thursday between 07:30 and 20:00 across all academic buildings and residences.
"""

EXCHANGE_ABROAD_TXT = f"""# Exchange and Study Abroad Handbook 2026

{NOTICE}

## Eligibility Criteria for Semester Exchange

Full-time undergraduate students at Synapse Demo University may apply to spend one or two semesters at an approved partner university after completing at least 30 credit hours with a minimum cumulative GPA of 2.80 and no unresolved academic probation or disciplinary holds. Postgraduate students may participate in short-term summer research exchanges with faculty supervisor approval.

## Partner Regions and Application Deadlines

Synapse Demo University maintains reciprocal exchange agreements with over 40 accredited partner universities across Europe (UK, Germany, Spain, Netherlands), East Asia (Japan, South Korea, Singapore), and North America (Canada, United States). Application deadlines are 15 February for the following Fall semester (starting August/September) and 15 September for the following Spring semester (starting January/February). Late applications cannot be considered due to host university nomination cut-offs.

## Application Documents Checklist

Students submit their Exchange Application in the Global Mobility portal along with: an unofficial academic transcript showing GPA >= 2.80, a 500-word Statement of Purpose ranking up to 3 preferred partner institutions, one academic reference from a faculty member, and proof of English or host-language proficiency where required by the partner university.

## Learning Agreement and Credit Transfer Rules

Before departure, nominated students must have a Learning Agreement signed by their Home Department Chair listing at least 12 to 15 credit hours of host courses matched to home degree requirements. Upon receipt of the official host transcript, passed courses transfer back to Synapse Demo University with a grade of T (Transfer Pass), which counts toward earned graduation credits without altering the student's home cumulative GPA. Courses failed abroad do not earn credit.

## Tuition Continuity and Insurance Requirements

Outgoing students on an approved reciprocal exchange continue paying their standard Synapse Demo University home tuition and do not pay additional tuition to the host university. Flights, housing abroad, living expenses, and entry travel documents remain the student's responsibility. All exchange participants must hold comprehensive international medical and emergency evacuation insurance covering the full dates of stay and upload proof to the Global Mobility portal before departure.
"""

STUDENT_CONDUCT_TXT = f"""# Student Code of Conduct and Campus Policies 2026

{NOTICE}

## Campus Community Standards

All members of Synapse Demo University are expected to uphold mutual respect, honesty, and care for shared campus spaces, laboratories, and digital environments. Physical or verbal intimidation, property damage, or disruption of teaching and library quiet zones violates the Student Code of Conduct.

## Classroom and Lecture Recording Policy

Students must obtain explicit permission from the module instructor before making personal audio or video recordings of lectures, seminars, or guest talks, unless approved as a formal learning accommodation through the Accessibility and Inclusion Office. Official lecture recordings posted on SynapseLearn are strictly for private study and must not be redistributed externally.

## Smoke-Free and Clean Campus Policy

Synapse Demo University operates a smoke-free campus. Smoking and vaping are strictly prohibited inside all academic buildings, residential halls, shuttles, and within 15 metres of building entrances. Designated outdoor shelters are signposted behind Building B and Building D.

## Acceptable Use of Campus IT and Networks

University accounts, Wi-Fi credentials, and virtual lab sessions are strictly personal and must never be shared. Students must not run unauthorised network scanning tools, host commercial cryptocurrency mining processes, or attempt to bypass authentication controls on campus infrastructure.

## Student Ombuds Office

The Student Ombuds Office in Building B, Room 302 is open Sunday to Thursday from 09:00 to 16:00 and provides confidential, impartial guidance to help students understand university policies and navigate formal procedures.
"""

INNOVATION_LABS_TXT = f"""# Innovation Labs, Makerspace and Student Research Guide 2026

{NOTICE}

## Synapse Innovation Hub and Makerspace

The Synapse Innovation Hub and Makerspace in Building E, Level 1 is open to all enrolled students Sunday to Thursday from 09:00 to 21:00 and Saturdays from 10:00 to 18:00. Trained lab stewards are on duty during all open hours to assist students with rapid prototyping and project fabrication.

## Equipment, 3D Printing and Induction

Students may access Bambu Lab and Prusa FFF 3D printers (including a complimentary 250 grams of PLA filament per student each semester), a CO2 laser cutter, soldering and embedded electronics benches, and Meta Quest and HoloLens extended-reality headsets. Every user must complete the 45-minute Safety Induction Badge module in the student portal before booking fabrication equipment.

## Media and Hardware Loan Desk

Students working on coursework, capstones, or approved society projects may borrow DSLR cameras, wireless lapel microphones, graphics drawing tablets, Raspberry Pi 5 boards, and Arduino sensor kits free of charge for up to 7 calendar days using a valid Student ID card.

## Undergraduate Research Grants and Startup Pitch Competition

Students collaborating with a faculty mentor may apply for Undergraduate Research Mini-Grants of up to AED 5,000 per project team to fund datasets, open-source cloud compute, or lab components; grant cycles close each October and March. Every April, the university hosts the annual Synapse Innovation and Startup Pitch Competition featuring an AED 25,000 prototype prize fund and mentorship from regional founders.
"""


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    _build_pdf(
        OUT / "Academic_Regulations_2026.pdf",
        "Academic Regulations 2026",
        REGULATIONS,
        page_break_prefixes=("5.", "7.", "8.", "10."),
    )
    _build_pdf(
        OUT / "Academic_Calendar_2026_2027.pdf",
        "Academic Calendar 2026-2027",
        CALENDAR,
        page_break_prefixes=("3.",),
    )
    _build_pdf(
        OUT / "Library_and_Research_Services_Guide_2026.pdf",
        "Library & Research Guide 2026",
        LIBRARY,
        page_break_prefixes=("3.",),
    )
    _build_pdf(
        OUT / "Graduation_and_Academic_Honours_Guide_2026.pdf",
        "Graduation & Honours Guide 2026",
        GRADUATION,
        page_break_prefixes=("3.",),
    )
    _build_pdf(
        OUT / "Academic_Integrity_and_Research_Ethics_Policy_2026.pdf",
        "Academic Integrity & Ethics 2026",
        INTEGRITY_ETHICS,
        page_break_prefixes=("4.",),
    )
    _build_pdf(
        OUT / "Scholarships_Bursaries_and_Financial_Aid_Guide_2026.pdf",
        "Scholarships & Aid Guide 2026",
        SCHOLARSHIPS_AID,
        page_break_prefixes=("3.",),
    )
    make_student_handbook_docx(OUT / "Student_Handbook_2026.docx")
    make_housing_transport_docx(OUT / "Campus_Housing_and_Transport_Guide_2026.docx")
    make_careers_internships_docx(OUT / "Careers_Internships_and_Placements_Guide_2026.docx")
    make_international_onboarding_docx(OUT / "International_Student_Onboarding_and_Campus_Life_Guide_2026.docx")
    make_programme_catalogue_docx(OUT / "Undergraduate_and_Postgraduate_Programme_Catalogue_2026.docx")
    (OUT / "IT_Help_Desk_FAQ.txt").write_text(IT_FAQ, encoding="utf-8")
    (OUT / "Health_Safety_and_Accessibility_Services.txt").write_text(HEALTH_ACCESSIBILITY_TXT, encoding="utf-8")
    (OUT / "Exchange_and_Study_Abroad_Handbook_2026.txt").write_text(EXCHANGE_ABROAD_TXT, encoding="utf-8")
    (OUT / "Student_Code_of_Conduct_and_Campus_Policies_2026.txt").write_text(STUDENT_CONDUCT_TXT, encoding="utf-8")
    (OUT / "Innovation_Labs_Makerspace_and_Student_Research_Guide_2026.txt").write_text(INNOVATION_LABS_TXT, encoding="utf-8")
    for p in sorted(OUT.iterdir()):
        if p.is_file():
            print(f"{p.name}: {p.stat().st_size} bytes")


if __name__ == "__main__":
    main()
