# Synapse

A student services portal prototype. Students ask a question, get an answer from approved policies and FAQs (with the source shown), and are handed to a member of staff when the topic is sensitive or the answer is uncertain.

## What it does
- Answers common questions on enrollment, fees, policies, timetables, exams and IT.
- Shows the source of every answer.
- Sends sensitive topics (appeals, financial hardship, wellbeing, legal) to staff instead of answering.
- Lets students rate answers and track their requests.
- Gives staff a simple view of question volume, topics, unanswered questions and open requests.

## Run it
No build step. Open `index.html` in a browser, or enable GitHub Pages (Settings, Pages, deploy from `main`) to host it.

## Project status
Prototype. The FAQ content is sample text and the data is stored in the browser only (`localStorage`). Nothing is sent to a server.

## Goals
- Answer routine questions accurately, from approved sources only.
- Escalate sensitive or uncertain cases to a person.
- Read-only integration with existing content (SharePoint) and the helpdesk (Zendesk).
- Role-based sign-in for students, staff and admins.
- Measure accuracy, student ratings and staff workload.

## Roadmap
See the open issues. Good first tasks are labelled `good first issue`.

## Contributing
Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request.

## Important
Never commit real student data, passwords or API keys.
