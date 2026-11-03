# CampusVoice frontend styling inventory

**Complete UI/UX styling: 100% COMPLETE.** Reviewed 3 November 2026.

Final validation: production build passed; 324 focused frontend tests passed
across 13 files, with 0 failures/skips; visual inventory captured 187 page states
across 1440/1024/768/375/320px, with no page-level overflow or browser runtime
errors. All 44 rendered-page patterns appear in both this checklist and the
capture inventory. Targeted recaptures verified the final mobile login spacing,
unbroken academic identifiers, complaint action/timeline ordering, long results,
selected questionnaire controls and confirmations. `git diff --check` passed.
The build retains the two existing React Router module-directive warnings.

Visual fixture accounts in development: 0. Remaining visual test databases and
isolated upload directories: 0. Development fingerprints changed during the
work, so an unchanged development database is not claimed; existing development
records were preserved and the visual harness wrote only to its guarded test
database. Original/final fingerprints and capture reports remain in ignored
`test-results/`. No commit, push, merge or branch switch was performed.

This is a presentation pass over the existing application. No API, authorization,
privacy, eligibility, complaint lifecycle, analytics calculation or DSA rule was
intentionally changed. The earlier HOD email-index fix remains separate.

## Design and CSS ownership

The application uses one navy/blue academic design system for all four roles.
Segoe UI/system fonts, restrained borders, 6/10/14px radius tokens, small shadows,
semantic badges and 180ms transitions are shared. Bootstrap provides the grid,
controls, utilities and icons; no new UI dependency or external font was added.

| Stylesheet | Responsibility |
| --- | --- |
| `variables.css` | Color, size, radius, shadow and Bootstrap integration tokens |
| `index.css` | Base elements, typography, focus, selection, utilities and reduced motion only |
| `layout.css` | Sidebar, navbar, user avatar, page header, workspace footer and content sizing |
| `components.css` | Panels, stat cards, badges, alerts, loading, empty and confirmation states |
| `forms.css` | Inputs, buttons, filters and identity selections |
| `tables.css` | Shared table typography, rows, actions and scroll containers |
| `responsive.css` | Shared tablet/mobile layout and controls |
| `motion.css` | Brief entrances, backdrop/alert fades and pointer interaction effects, gated by motion preference |
| `auth.css` | Login and both password-change modes |
| `dashboard.css` | Role dashboards and authorized quick links |
| `academic.css` | Academic lists, editors and readable table identifiers |
| `feedback.css` | Sessions, builder, questionnaire, ratings and result distributions |
| `messages.css` | General Feedback, Suggestions and their embedded histories/inboxes |
| `complaints.css` | Raise/list/detail, evidence, status/actions and timeline |
| `analytics.css` | Analytics, Student period summary and FIFO/Priority processing |
| `profile.css` | Account overview, editor and read-only information |
| `notifications.css` | Bell, unread/read cards and notification list |
| `audit.css` | Administrative information, filters and responsive audit table/cards |

Shared CSS is imported once by `main.jsx`. Page-family styles are imported by
their owning components and scoped to those families. `index.css` is not a
container for page styling. The only `!important` declarations added are the
standard reduced-motion overrides, which must also override Bootstrap motion.

## Rendered-page inventory

All 44 rendered-page route patterns below are included in the visual inventory.
Shared `/profile` and `/notifications` were also captured under every role.

| Role | Route | Page / reviewed states |
| --- | --- | --- |
| Shared | `/login` | Login, visible focus and password visibility control |
| Shared | `/change-password` | First-login and voluntary password change |
| Shared | `/profile` | Overview, read-only information and edit form |
| Shared | `/notifications` | Unread/read items, filters and pagination |
| Principal | `/principal/dashboard` | Real metrics, workspace and authorized shortcuts |
| Principal | `/departments` | Table, filters, editor, confirmation, empty/loading/error/retry |
| Principal | `/hods` | HOD table and provisioning editor |
| Principal | `/principal/feedback-overview` | Aggregate-only Feedback summary/distribution |
| Principal | `/principal/complaints` | Complaint inbox and filters |
| Principal | `/principal/complaints/:complaintId` | Detail, permitted actions and timeline |
| Principal | `/principal/complaint-processing` | FIFO and Priority modes |
| Principal | `/principal/analytics` | Institution overview, feedback, sessions and authorized complaints |
| Principal | `/principal/audit-logs` | Safe administrative history, filters, table/cards and uncertainty warning |
| HOD | `/hod/dashboard` | Department metrics, information and shortcuts |
| HOD | `/faculty` | Faculty table and provisioning editor |
| HOD | `/students` | Student identifiers, academic information, filters and editor |
| HOD | `/subjects` | Subject codes, semester, status and editor |
| HOD | `/classes` | Class criteria, academic year, status and editor |
| HOD | `/faculty-assignments` | Faculty/Subject/Class relationships and editor |
| HOD | `/hod/general-feedback` | Department filters, aggregates and allowed messages |
| HOD | `/hod/complaints` | Complaint inbox |
| HOD | `/hod/complaints/:complaintId` | Detail, actions and timeline |
| HOD | `/hod/complaint-processing` | FIFO and Priority modes |
| HOD | `/hod/analytics` | Department analytics without Suggestions |
| Faculty | `/faculty/dashboard` | Real session/activity metrics and teaching context |
| Faculty | `/my-assignments` | Own assignment table |
| Faculty | `/my-sessions` | Draft/open/closed cards and available actions |
| Faculty | `/my-sessions/new` | New draft editor |
| Faculty | `/my-sessions/:sessionId/edit` | Four question types, controls, history and preview |
| Faculty | `/my-sessions/:sessionId/results` | Open/closed results, distributions, permitted Named/Anonymous text cards |
| Faculty | `/faculty/general-feedback` | Received Feedback and ratings |
| Faculty | `/faculty/suggestions` | Private inbox with allowed identity labels |
| Faculty | `/faculty/complaints` | Assigned issue inbox |
| Faculty | `/faculty/complaints/:complaintId` | Detail, safe attachment labels, actions and timeline |
| Faculty | `/faculty/complaint-processing` | FIFO and Priority modes |
| Faculty | `/faculty/analytics` | Own aggregates including own private Suggestions |
| Student | `/student/dashboard` | Pending/completed metrics, personal summary and actions |
| Student | `/feedback-sessions` | Pending and completed categories |
| Student | `/feedback-sessions/:sessionId/respond` | Four question types, selected controls, identity and final confirmation |
| Student | `/student/general-feedback` | Form, rating, identity and embedded My Feedback history |
| Student | `/student/suggestions` | Private form, identity and embedded Sent Suggestions history |
| Student | `/student/complaints/new` | Type cards, details, evidence, identity and urgent disclaimer |
| Student | `/student/complaints` | Own case history and statuses |
| Student | `/student/complaints/:complaintId` | Own detail, evidence, available action and progress |

The existing `/principal`, `/hod` and `/student` layout roots now redirect to
their dashboards instead of rendering an empty shell. `/faculty` is the existing
HOD Faculty Management route; a Faculty user visiting it recovers to their own
dashboard through the existing role guard. A conflicting index route was not
introduced. `/` and unknown URLs keep the established authenticated-dashboard,
login or mandatory-password-change recovery. There are no separate 404 or
Unauthorized business pages to invent. With aliases/recovery routes, the
inventory contains 49 distinct URL patterns.

## Visual verification and safety

`tests/browser/uiReview.js` is a visual fixture/capture utility, not the full
functional browser regression suite. It creates a unique guarded
`campusvoice_test_visual_*` database, real API-backed records and isolated
evidence. It uses normal login, captures each rendered page at 1440/320px,
checks all four dashboards/navigation at 1024/768/375px, and measures page-level
horizontal overflow. It additionally checks mobile focus trapping, Escape,
scroll lock, root recovery, selected states, confirmations and safe error states.
It removes only its own evidence and database when finished.

Run explicitly with `TEST_MONGODB_URI` configured:

```powershell
node tests/browser/uiReview.js
```

Screenshots, the JSON capture inventory and contact sheets are intentional,
ignored artifacts under `test-results/ui-review/`. Contact sheets cover every
rendered page; full-page captures cover long forms, builder controls, charts,
results, audit cards and timelines. Review is visual, not inferred from React
test success. Targeted recapture is available with `UI_REVIEW_WIDTHS` and
`UI_REVIEW_ONLY`; it writes a separate supplemental inventory.

The page background/secondary-text and button contrast were checked. Mobile
academic tables retain every column inside labelled keyboard-scrollable regions;
codes remain unbroken. Audit rows become labelled mobile cards. Closed navigation
is hidden from keyboard access; open mobile navigation traps focus, supports
Escape, restores focus and prevents background scrolling. Reduced motion and
visible keyboard focus are preserved. No production/demo records are seeded.

The sidebar brand and bottom information remain fixed within the drawer; only
the menu scrolls, with a thin visible scrollbar while wheel/touch/keyboard scrolling
remains available. Every workspace page has a responsive CampusVoice footer at
the end of its content, pushed to the viewport bottom on short pages.

## Follow-up UI updates

The HOD navigation now places Classes before Students. Student admission batch
and section choices come from active department Classes, with a management link
and refresh action that preserve unsaved form values. Faculty Assignment creation
uses an Academic year dropdown from active department Classes; changing the year
clears the previous class and limits choices to matching classes. Related year
and section filters use distinct authorized labels, including retained history.
Class creation still accepts new values. These academic changes passed 87 backend
tests, 57 focused frontend tests and the production build; 14 supplemental page
states were captured at 1440/320px. These are separate from the original styling
validation totals above.

Shared motion adds one-time 200–240 ms entrances to headings, login panels,
panels/cards, empty states and dialogs, and 160 ms fades to alerts and the mobile
backdrop. Fine-pointer hover effects gently lift buttons/cards and shift sidebar
icons. Content is visible without animation support; actions and data loading
are not held for animations. All new motion is gated by
`prefers-reduced-motion: no-preference`, alongside existing global reduced-motion
overrides. No animation package or continuous decorative animation was added.

Motion validation: production build completed with the existing two React Router
warnings; 50 navigation/authentication tests passed. A 375px login browser check
confirmed `cv-enter` under normal preference, `none` under reduced motion and no
horizontal overflow. Its screenshot and logs are retained in ignored
`test-results/`. This focused check does not repeat the original full visual
inventory or certify every animation on every route.

The dedicated full functional regression stage remains with the Team Lead. This
task validates the production build, changed frontend families, imports/syntax,
visual presentation and diff hygiene; it does not claim another full backend or
end-to-end functional certification.
