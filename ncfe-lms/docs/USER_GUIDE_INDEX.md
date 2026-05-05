# NCFE LMS — User Guide Index

Quick navigation to every section of [`USER_GUIDE.md`](USER_GUIDE.md).

## [Section 1 — Overview](USER_GUIDE.md#section-1--overview)
- What is NCFE LMS?
- Data model (Centre → Qualification → Unit → LO → AC; User + Enrolment)
- Production URL
- Where to get help

## [Section 2 — Getting started by role](USER_GUIDE.md#section-2--getting-started-by-role)
- [2.1 Sign in (every role)](USER_GUIDE.md#21-sign-in-every-role)
- [2.2 Admin](USER_GUIDE.md#22-admin) — onboard student, enrol existing user, manage qualifications, audit trail, manage enrolments
- [2.3 Assessor](USER_GUIDE.md#23-assessor) — plan assessment, map evidence + sign off, review portfolio + progress
- [2.4 Student / Learner](USER_GUIDE.md#24-student--learner) — profile + preferences, upload portfolio evidence, sign off, log work hours
- [2.5 IQA](USER_GUIDE.md#25-iqa-internal-quality-assurer) — sample, decide

## [Section 3 — Cross-role workflow walkthrough](USER_GUIDE.md#section-3--cross-role-workflow-walkthrough)
The full assessment lifecycle as a single 8-step narrative: admin onboards → student first login → assessor plans → student uploads → assessor signs off → student signs off → IQA decides → admin audits.

## [Section 4 — Reference](USER_GUIDE.md#section-4--reference)
- [Roles vs permissions matrix](USER_GUIDE.md#roles-vs-permissions-matrix)
- [File upload limits](USER_GUIDE.md#file-upload-limits)
- [Email notification triggers](USER_GUIDE.md#email-notification-triggers)
- [Keyboard shortcuts](USER_GUIDE.md#keyboard-shortcuts) (none currently)
- [Sidebar reference](USER_GUIDE.md#sidebar-reference-assessor--student)

## [Section 5 — FAQ](USER_GUIDE.md#section-5--faq)
12 entries covering the most common questions:

- How do I add a student to multiple courses?
- The welcome email didn't arrive — what went wrong?
- A student forgot their password — what do I do?
- Why is the new user stuck on a "Change your password" screen?
- What happens when I delete a user?
- Can I delete the James Bond demo account?
- How do I bulk-import a qualification's curriculum?
- Why do some users have "n courses" badges and others don't?
- How does opting out of notifications work?
- How do I narrow the audit log by date or user?
- Brevo bounced an email — can I retry?
- How do I change the sender display name?

## Related docs
- [`tests/UI_AUDIT.md`](../tests/UI_AUDIT.md) — full per-page UX gap audit (P0–P3 severity)
- [`tests/UI_GAPS_REPORT.md`](../tests/UI_GAPS_REPORT.md) — fix + verify report for the 9 gaps shipped this run
- [`tests/PROD_REPORT.md`](../tests/PROD_REPORT.md) — production E2E baseline
- [`tests/DEMO_SUMMARY.md`](../tests/DEMO_SUMMARY.md) — demo brief
- [`docs/britethink-dashboard-architecture.txt`](britethink-dashboard-architecture.txt) — architecture spec (source of truth for the assessor + student dashboard layout)
