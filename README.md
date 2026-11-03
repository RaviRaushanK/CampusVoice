# CampusVoice

College Feedback, Survey and Grievance Management System built with the MERN stack.

**Phases 1-10: COMPLETE. CampusVoice Development: 100% COMPLETE.** Final validation results and operational limitations are documented in Phase 10 below.

The application includes authentication/RBAC, profiles, notifications, academic management, Faculty feedback sessions/results, General Feedback, Private Suggestions, content moderation, routed complaints/grievances, scoped analytics, integrated DSA and privacy-safe administrative audit browsing.

## Problem, objectives and roles

CampusVoice gives a college one controlled workflow for teaching feedback, private suggestions and grievances, while keeping their different visibility rules intact. Its objectives are to route issues to the correct authority, preserve recipient anonymity, track complaint progress, summarize authorized activity, and demonstrate DSA against real persistent data.

| Role | Main permissions |
| --- | --- |
| Principal | Departments/HODs, institution aggregate analytics, explicitly assigned/escalated complaints and sanitized audit browser |
| HOD | Own-department Faculty/Students/curriculum/assignments, departmental feedback/analytics and explicitly assigned/escalated complaints |
| Faculty | Own assignments/sessions/results, received General Feedback, own private Suggestions, assigned issues and personal analytics |
| Student | Own profile/activity/history, eligible session responses and General Feedback, same-department private Suggestions and routed complaints |

Higher roles do not automatically gain private-content access. Anonymous means recipient anonymity: internal Student references remain for integrity/ownership. Suggestions are author/selected-Faculty only; Principal General Feedback stays aggregate-only. Against-Faculty complaints bypass that Faculty; Against-HOD complaints go directly to Principal. These rules also constrain analytics, notifications, evidence and audit browsing.

## Technology Stack

For setup, use Installation/Environment Setup and the explicit Principal seeder below. Phases 6–9 explain the business workflows and DSA; the final Phase 10 section covers audit design, hardening, release verification, deployment and a practical demo order.

- Frontend: React, Vite, JavaScript, Bootstrap 5, Bootstrap Icons, React Router
- Backend: Node.js, Express.js, MongoDB, Mongoose, dotenv
- Architecture: MVC, service layer, REST API, React view layer

Request flow:

```text
React View -> REST API -> Route -> Controller -> Service -> Model -> MongoDB
```

## Folder Structure

```text
campusvoice/
|-- config/
|-- models/
|-- controllers/
|-- services/
|-- routes/
|-- middleware/
|-- validators/
|-- utils/
|   |-- dsa/
|   `-- constants/
|-- seeders/
|-- uploads/
|-- frontend/
|   |-- public/
|   `-- src/
|       |-- assets/
|       |-- components/
|       |-- layouts/
|       |-- pages/
|       |-- services/
|       |-- context/
|       |-- hooks/
|       |-- routes/
|       |-- utils/
|       |-- styles/
|       |-- App.jsx
|       `-- main.jsx
|-- tests/
|-- app.js
|-- server.js
`-- package.json
```

## Prerequisites

- Node.js 22.12+ (or Node.js 24 LTS), as required by the installed Vite/test tooling
- npm
- MongoDB running locally, or a MongoDB connection string

## Installation

```bash
npm install
```

There is one root `package.json` and lockfile shared by backend and frontend; do not run a separate frontend dependency install. For a clean reproducible checkout use `npm ci`. Obtain the repository from the Team Lead, run commands from its root, configure `.env`, start MongoDB, explicitly seed the Principal as documented below, then use `npm run dev` (or the separate backend/frontend scripts). No demo records are inserted automatically.

## Environment Setup

Create a `.env` file in the project root using `.env.example` as a guide:

```env
NODE_ENV=development
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/campusvoice
TEST_MONGODB_URI=mongodb://127.0.0.1:27017/campusvoice_test
FRONTEND_ORIGIN=http://localhost:5173
VITE_API_BASE_URL=http://localhost:5000/api
JWT_SECRET=<set a randomly generated secret of at least 32 bytes>
JWT_EXPIRES_IN=8h
COOKIE_SECURE=false
COOKIE_SAME_SITE=lax
TRUST_PROXY_HOPS=0
```

Do not commit real secrets in `.env`.

## MongoDB Setup

For local development, start MongoDB and keep the default URI:

```text
mongodb://127.0.0.1:27017/campusvoice
```

If MongoDB runs elsewhere, update `MONGODB_URI` in `.env`.

## Run Backend

```bash
npm run dev:backend
```

Production backend start:

```bash
npm start
```

## Run Frontend

```bash
npm run dev:frontend
```

The Vite app runs at:

```text
http://localhost:5173
```

## Run Complete Development Environment

```bash
npm run dev
```

This starts the Express API and Vite frontend together.

## Health Endpoint

```text
GET /api/health
```

Expected response:

```json
{
  "success": true,
  "message": "CampusVoice API is running"
}
```

## Initial Principal setup

There is no public registration. Copy `.env.example` to `.env`, configure MongoDB and generate a JWT secret locally:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Put that value in `JWT_SECRET`. Set the following bootstrap variables locally (never commit the values):

- `PRINCIPAL_NAME`
- `PRINCIPAL_USER_CODE` (3-50 letters/numbers/dots/underscores/hyphens, starting with a letter or number)
- `PRINCIPAL_PASSWORD` (at least 8 characters, uppercase, lowercase, number and special character; at most 72 UTF-8 bytes)
- `PRINCIPAL_EMAIL` (optional)

```bash
npm run seed:principal
```

The command creates one active Principal with a bcrypt hash and `mustChangePassword=true`, then disconnects. If any Principal already exists, repeated runs preserve its credentials, even when a different bootstrap user code is supplied. No HOD, Faculty or Student accounts are created. A conflicting existing user code fails without overwriting it. `PRINCIPAL_USERNAME` is supported for compatibility with the earlier partial implementation.

Remove bootstrap credentials from your environment after successful setup. Visit `/login`, use the supplied user code and temporary password, then change the password. The new session opens the Principal dashboard. An existing Principal from an earlier seed is never repaired or reset automatically; contact the project administrator if its password is unknown.

Concurrent seed runs use a database bootstrap lock. If a process is forcibly terminated during seeding, an administrator must first confirm no seed is running, then remove the `initial-principal` document from `bootstrap_locks` before retrying.

## Authentication and protected routes

| Endpoint | Behavior |
| --- | --- |
| `POST /api/auth/login` | Validate credentials, check active status, issue HTTP-only cookie, return safe profile |
| `POST /api/auth/logout` | Revoke all current account sessions and clear the cookie |
| `GET /api/auth/me` | Restore safe user profile; available during first-login password change |
| `POST /api/auth/change-password` | Validate current/new/confirmation, revoke old tokens, issue a new session |

All state-changing `/api` requests, including login, require the exact configured `Origin` and `X-CSRF-Protection: 1` header. The React API client sends credentials and this header automatically. Requests without an Origin are intentionally rejected; non-browser API clients must supply both headers too. The header is a browser preflight defense, not a secret token; the exact Origin check and restricted credential-aware CORS are essential to it.

JWTs are never returned in JSON or saved to browser storage. Cookies expire with `JWT_EXPIRES_IN` (`s`, `m`, `h` or `d` suffix, maximum 30 days). Production always uses secure cookies and requires HTTPS. Set `COOKIE_SAME_SITE=none` only for a deployment that needs cross-site cookies, with `COOKIE_SECURE=true`; browser third-party-cookie policies may still restrict those cookies. Prefer a same-site frontend/API deployment.

`FRONTEND_ORIGIN` must be the exact frontend origin without a trailing slash. The root `.env` supplies both backend configuration and Vite's `VITE_API_BASE_URL`; restart development processes after changing it. Set `TRUST_PROXY_HOPS` to the actual trusted reverse-proxy count only when deployed behind one, and restrict direct backend access accordingly. It defaults to zero. Login and password-change limits are 10 failed requests per 15 minutes (per IP and per account, respectively); multi-process deployments need a shared rate-limit store.

`/` and `/login` resolve to the authenticated user's dashboard or `/change-password` when required. All four dashboard routes are protected:

- `/principal/dashboard`
- `/hod/dashboard`
- `/faculty/dashboard`
- `/student/dashboard`

Cross-role URLs redirect to the user's own dashboard before rendering protected content. Initial session checks show a loading state. Session expiry clears the authenticated UI on API rejection, tab refocus or the periodic session check. Logout errors leave the current UI visible and allow retrying.

The shared navbar shows the user's name and role and provides logout. Sidebar navigation retains each role's original module labels as disabled placeholders; Dashboard, Change password and Logout are operational. Both logout controls share a pending state to prevent duplicate requests. The original dashboard components, CSS tokens and honest empty statistics remain intact. Temporary role-preview navigation has been removed. A temporary session-check network failure displays an availability error and keeps an already authenticated user visible; a confirmed 401 removes protected content.

## Backend integration for later phases

Use `protect` (authentication plus completed-password enforcement), then `requireRole` for normal application APIs:

```js
const { protect } = require('./middleware/authMiddleware');
const { requireRole } = require('./middleware/roleMiddleware');
// Apply to real routes when their business module is implemented:
// router.use(protect, requireRole('PRINCIPAL'));
```

`authenticate` alone is reserved for authentication recovery endpoints (`me`, logout and password change). Authentication failures return 401; role/password restrictions return 403. A password restriction includes `code: "PASSWORD_CHANGE_REQUIRED"`.

User passwords must be hashed with `services/authService.hashPassword` before assigning `passwordHash`. The model accepts only bcrypt hashes and excludes them from default queries/JSON. Safe profiles use an explicit allowlist. Model save/update middleware increments `tokenVersion` for password, role and activation changes. Password changes use an atomic version comparison. Do not bypass these rules through raw database writes or replacement updates in future modules. Logout revokes **all sessions for that account**; old JWTs cannot be replayed to revoke newer sessions.

## Verification

```bash
npm run check:backend
npm run build:frontend
npm test
npm run test:browser
```

Or run `npm run test:backend` and `npm run test:frontend` separately. Database-backed tests require an explicit `TEST_MONGODB_URI` naming `campusvoice_test` or `campusvoice_test_*`; they fail before connecting when it is missing, malformed or names the development database. There is no fallback to `MONGODB_URI`. Each suite creates a unique database such as `campusvoice_test_auth_<random-id>` under that namespace, uses only isolated fixtures, and drops only its own generated database on completion. The base test database is never dropped. Connection guards run before fixture deletion and cleanup, and the Principal seeder subprocess receives the same isolated URI and test bootstrap values. The test identity needs permission to create/drop those isolated databases. Development accounts are never inserted, changed or deleted by these tests.

Configure `TEST_MONGODB_URI` in your local environment or root `.env` before running backend/browser tests. On PowerShell, for example:

```powershell
$env:TEST_MONGODB_URI = "mongodb://127.0.0.1:27017/campusvoice_test"
npm run test:backend
npm run test:browser
```

For an authenticated MongoDB test server, include an explicit `authSource` in the URI, particularly for SRV deployments. The helper preserves credentials, replica-set hosts and connection options while replacing the database target. Database-free startup and isolation guard tests also cover asynchronous HTTP errors and unsafe/missing test configuration.

Coverage includes all four roles, first-login API restrictions, password validation, seed command/idempotence, cookie creation, old-token rejection, deactivation/reactivation, logout, invalid/expired tokens, CSRF, CORS, rate limiting, current user and health. React tests render the real application routes/layouts with mocked auth services and test direct URLs, all cross-role combinations, first-login restoration, password change, logout, session expiry and the credential-aware API client. HTTPS cookie behavior is configured but these local tests do not exercise a deployed TLS/reverse-proxy environment. Frontend production output is `frontend/dist`.

The optional live browser check uses Playwright. Install its Chromium browser once:

```bash
npx playwright install chromium
```

`npm run test:browser` starts its own local API and Vite servers on available ports and uses a uniquely named `campusvoice_test_browser_*` database. It verifies real login, first-login password changes, HTTP-only cookies, restored sessions, all cross-role redirects, four dashboards and logout at 1440, 1024, 768, 375 and 320 pixels. It also checks horizontal overflow, clipped controls, mobile navigation, icon font loading and browser errors. Screenshots go into the ignored `test-results/browser/` directory. The browser, servers and temporary database are cleaned up on completion or failure. This command never seeds the normal development database.

## Profile and account management

All four roles use `/profile` to view their account, edit their name and optional email, and open the existing password-change flow. `GET /api/profile` and `PATCH /api/profile` reuse authentication and the forced-password-change guard. PATCH accepts only name and email; unsupported fields are rejected. Emails are trimmed and lowercased; blank or null email removes the optional address. Successful updates synchronize the shared user name and email from the server response without changing authentication state.

The User schema declares a unique partial email index for populated string addresses. Profile writes await index initialization and return a clean conflict for duplicate addresses, including concurrent claims. Existing databases must have no duplicate populated emails before that index can build; resolve any legacy duplicates through the normal administrator review process. This change does not migrate or rewrite existing records.

Profile tests use the same mandatory `TEST_MONGODB_URI` and guarded isolated databases as authentication tests. Browser checks cover view/edit modes, save/cancel, long emails, shared navbar synchronization, and the existing voluntary password-change flow for all four roles at all five viewport sizes.

## Shared notification system

Notifications are generated internally by backend modules through `services/notificationService.createNotification({ recipient, type, title, message, relatedResourceType, relatedResourceId })`. Creation validates an existing User recipient, a controlled type, and trimmed nonempty title/message (maximum 160/2000 characters). There is no public creation, deletion, or content-editing endpoint. Feedback-session publication generates eligible Student notifications through this service.

All notification routes use the existing authentication and forced-password-change guard. Every database operation is scoped to the authenticated recipient; responses omit recipient records and internal metadata. Both PATCH routes require the existing Origin/CSRF header protection and accept no body fields.

| Endpoint | Behavior |
| --- | --- |
| `GET /api/notifications` | Own notifications, newest first (`createdAt`, then `_id`, descending) |
| `GET /api/notifications/unread-count` | Own unread count |
| `PATCH /api/notifications/:notificationId/read` | Mark an owned notification read; retain its first read timestamp |
| `PATCH /api/notifications/read-all` | Mark only own unread notifications read; return `modifiedCount` |

Listing accepts only `page` (default 1, maximum 1,000,000), `limit` (default 20, maximum 100), and `status=all|unread|read` (default `all`). Invalid or unsupported queries are rejected. The response contains `notifications` and `pagination` (`page`, `limit`, `total`, `totalPages`, `hasNextPage`, `hasPreviousPage`). Empty results have `totalPages: 0`; pages beyond the last page return an empty array. Related resource metadata does not populate or validate future module records: an ObjectId requires a controlled resource type, while a type alone is allowed. Compound indexes support recipient/date sorting and recipient/read-state filtering/counting.

All four roles share `/notifications`, accessible through the navbar bell and the existing sidebar entry. The bell shows the real unread count, hides the badge at zero or when unavailable, and caps the visible badge at `99+`. The page uses backend All/Unread/Read filters and 20-item Previous/Next pagination, with loading, retry, and empty states. Read and read-all actions refresh both the server list and unread count; failed actions keep the current records unchanged. Resource IDs are not displayed and do not link to unimplemented modules.

One notification provider consumes AuthContext, holding only unread-count state. Counts refresh after authenticated session restoration, notification-page loads, successful read operations, and visible-tab changes. There is no polling timer and no WebSockets. Concurrent count refreshes are deduplicated; stale filter/count responses are ignored. Logout/account changes clear notification state and abort old requests; forced-password sessions do not fetch notifications. Count failures leave the navbar and dashboards usable, with retry available on the notification page.

Notification fixtures are created only in guarded, isolated test databases using mandatory `TEST_MONGODB_URI`; no development notifications are seeded. Browser coverage exercises the shared notification UI and existing auth/profile flows for all four roles at 1440, 1024, 768, 375 and 320 pixels. Session publication, Suggestions and Complaint workflows call the internal creation service with neutral, ownership-scoped notifications.

## Scope and next phase

Phase 1–5 authentication, profile, notification, shared-layout, health and academic behavior is retained. Phase 6 adds Faculty sessions, participation and results. Phase 7 adds General Feedback, Private Suggestions and moderation. Phase 8 adds routed complaints/grievances. Phase 9 adds authorized analytics and integrated DSA. Phase 10 finalizes audit logging, hardening, integration and documentation below. AI and Faculty rankings remain outside the project.

Phase 5 supplies the academic foundation required by later feedback/session modules. It does not generate business notifications or implement those later modules.

## College and academic management

Principal manages Departments and HOD accounts. HODs manage Faculty, Students, Subjects, Class Groups and Faculty Assignments only inside their authenticated department. Faculty have a read-only My Assignments page; Students see only their own academic information. Principal has institution-wide academic counts, without extra Faculty/Student modification rights. Every academic route reuses existing authentication, first-login restrictions and CSRF protection; unsupported/protected body fields are rejected. HOD department IDs are derived server-side, never accepted on Faculty/Student/Subject/Class/Assignment writes.

| API resource | Read/write owner | UI route |
| --- | --- | --- |
| `/api/departments` | Principal; HOD can read own department | `/departments` |
| `/api/hods` | Principal | `/hods` |
| `/api/faculty` | Own-department HOD | `/faculty` |
| `/api/students` | Own-department HOD | `/students` |
| `/api/subjects` | Own-department HOD | `/subjects` |
| `/api/classes` | Own-department HOD | `/classes` |
| `/api/faculty-assignments` | Own-department HOD | `/faculty-assignments` |
| `/api/faculty-assignments/mine` | Authenticated Faculty, read only | `/my-assignments` |
| `/api/academic/dashboard` | Current user's authorized counts/information | Role dashboards |

Management resources provide paginated GET collection, GET `/:id`, POST create and PATCH `/:id`; there is no destructive DELETE. Assignment PATCH changes only `isActive`. List defaults are page 1/limit 20, maximum limit 100/page 1,000,000, with deterministic sorting. Account lists search name/email/userCode; Subjects search code/name. Students support semester/section filters, Classes semester/section/year, and Assignments status/year. Lookups load up to 100 active matching records and provide search refinement rather than fetching entire collections. Dashboard metrics use database count queries and HOD queries always scope by department.

Provisioning uses a user-entered temporary password, the existing bcrypt helper, and mandatory first-login password change. Passwords/hashes/security metadata are never included in management responses. User codes remain immutable after creation. Student USN uses the existing unique lowercase `userCode` (displayed uppercase); no independent competing USN identifier is stored. Email follows existing trimmed/lowercase uniqueness rules and remains optional. Account deactivation and HOD department reassignment revoke existing sessions. A partial unique User index permits only one active HOD per assigned Department, including concurrent requests and reactivation.

Department/Subject codes normalize uppercase. Subject uniqueness is department+code; Class Group uniqueness is department+academicYear+semester+section, including inactive records. MCA semesters are 1–4. Optional sections normalize uppercase. Academic years use `YYYY-YYYY` with consecutive years (for example `2026-2027`); optional admission batches use the same format with a two-year span (for example `2025-2027`). These management rules preserve existing legacy User schema compatibility.

Assignment creation/reactivation verifies an active Faculty user, Subject and Class Group in the HOD's active Department, plus matching subject/class semester and assignment/class year. A partial unique index prevents duplicate active teaching relationships. Referenced Subject semesters and Class Group identities cannot be rewritten through management updates; create a new record instead. Assignment references remain historical and immutable. Deactivating Departments/accounts/curriculum does not delete or cascade-delete history. Inactive Departments block HOD management operations; account status separately controls login. Retained active assignments with an inactive source are labelled accordingly and return `isUsable: false`; future session services must revalidate current source status before use.

All academic tests and browser provisioning workflows use mandatory `TEST_MONGODB_URI` with the existing guarded isolated databases. The browser suite creates Department → HOD → Faculty/Student/Subject/Class → Assignment through the real UI at 1440/320px, verifies new-user password changes and Faculty/Student visibility, and preserves four-role regression coverage at all five widths. No development academic data is seeded. CSV/Excel student import is intentionally deferred.

## Phase 6 Part 1 — Faculty Session Builder

Faculty manage their own sessions at `/my-sessions`, create at `/my-sessions/new`, and edit at `/my-sessions/:sessionId/edit`. The dashboard displays real My Sessions and Draft Sessions counts. Creation loads the existing paginated Faculty assignment API, permits only usable active assignments, and revalidates the owned assignment and its active Department/Faculty/Subject/Class sources on the server. Department, Subject and Class references derive from that assignment. Assignment and ownership references are immutable after creation; retained drafts remain editable if an academic source is later retired.

`FeedbackSession` embeds questions with stable server-generated subdocument IDs. Array order is canonical: moving a question preserves its ID, removing it omits it from the next draft update, and new questions omit `id`. Foreign/duplicate IDs are rejected. Types are `SINGLE_CHOICE`, `MULTI_SELECT`, `RATING` (fixed 1–5) and `SHORT_ANSWER`, with required/optional flags. Drafts can contain zero questions, up to 50. Choice questions need 2–20 nonblank options, unique after Unicode normalization, whitespace normalization and lowercasing. Limits: title 160, description 2000, prompt 1000, option 200 characters. Part 2 corrects the JSON transport limit for this resource as documented below.

New sessions always save as `DRAFT`. Only owned DRAFT sessions may be edited or hard-deleted. PATCH explicitly accepts title, description, questions, `allowAnonymous`, `opensAt` and `closesAt`; all other fields are rejected. Partial date updates validate against stored dates; optional dates can be cleared with null. API timestamps require a timezone and persist UTC instants; browser inputs display local time. Closing must be strictly after opening when both exist. `allowAnonymous` defaults true and permits a student choice; it does not automatically anonymize responses.

| Endpoint | Behavior |
| --- | --- |
| `GET /api/feedback-sessions/mine` | Own sessions, deterministic newest-first order; `page=1`, `limit=20` (max 100), `status=all\|DRAFT\|OPEN\|CLOSED` |
| `GET /api/feedback-sessions/:sessionId` | Own session and questionnaire |
| `POST /api/feedback-sessions` | Create DRAFT using `facultyAssignmentId` and editable fields |
| `PATCH /api/feedback-sessions/:sessionId` | Update own DRAFT, including complete ordered question array |
| `DELETE /api/feedback-sessions/:sessionId` | Hard-delete own DRAFT only |

All five endpoints require Faculty authentication and completed first-login password change. Existing inactive-account, token-revocation and CSRF rules apply. Queries scope ownership before loading documents; responses include explicit academic projections and never populate User security data. Conditional DRAFT/version writes prevent updates racing a future publication or another in-flight save. Faculty/date and Faculty/status/date indexes support the actual list/count queries. No draft action creates notifications.

Backend tests cover models, validation, assignment/department checks, IDOR, lifecycle, RBAC, CSRF and authentication guards. Frontend tests cover list states, builder operations, retries, field whitelists, immutable assignments and role guards. The browser suite extends the existing HOD provisioning → Faculty assignment workflow with draft creation/editing at 1440/320px while retaining all-role checks at 1440/1024/768/375/320px. All test writes use uniquely named guarded `TEST_MONGODB_URI` databases. Optional `node scripts/databaseFingerprint.js` reads and hashes development collections without modifying records, for before/after comparisons.

## Phase 6 Part 2 — Publishing and Student Responses

Faculty publish through a dedicated action: `DRAFT → OPEN → CLOSED`. Publishing validates the nonempty questionnaire, dates and original active assignment/academic sources, then uses a conditional version/status update to freeze all questionnaire/settings/academic edits. It records `publishedAt` once and snapshots the real class semester, section, academic year and optional batch for stable eligibility. Assignment or curriculum deactivation after publication does not invalidate the published session. Faculty Close is final and idempotent; no reopening is supported. Manual closure records `closedAt`. Date expiry is computed without a scheduler and leaves manual-close metadata untouched.

Stored `OPEN` can mean effectively `SCHEDULED`, `OPEN`, or `CLOSED`, based on the server clock and optional dates. The opening boundary is inclusive and closing boundary exclusive. Student Pending lists show only currently available, eligible, unanswered sessions; scheduled sessions stay hidden until opening. Completed history is owned by the authenticated Student and survives later academic changes. Student dashboard counts use the same definitions.

Eligibility matches the authenticated active Student's Department, semester and normalized section to the published class criteria. A specified class batch must match exactly; a class without a batch accepts any batch. There is no Student academic-year field, so the session's class academic year is retained for context rather than inventing enrollment data. Eligibility and availability are rechecked on questionnaire access and submission; client-supplied academic fields or identities are rejected.

`SessionResponse` stores immutable session/Student references, `identityMode`, ordered answers referencing stable question IDs, and `submittedAt`. A unique `(sessionId, studentId)` index is the final concurrency protection; repeated submissions return a controlled conflict. The internal Student reference remains stored for both Anonymous and Named responses. It is excluded from ordinary queries/JSON, and no Faculty response/result listing exists. Student completion responses expose only session/completion metadata. Responses and identity choices cannot be edited or deleted.

Single Choice accepts exactly one listed string; Multi Select accepts unique listed strings; Rating accepts integer 1–5; Short Answer accepts trimmed text up to 1000 characters. Required questions must be answered. Unanswered optional text/multi-select entries are omitted canonically. Unknown/duplicate question IDs and unsupported fields are rejected. All answers are validated against the server's frozen questionnaire before one final response document is inserted. A conditional session write is the submission admission point, serialized against manual Close; an already-admitted request may finish after closure, while no request is admitted after closure or the configured deadline. No transaction or background job is required for this rule.

Publishing attempts existing `SESSION` notifications only for active, eligible Students. Immediate publication uses availability wording; future publication states the UTC opening time explicitly. Only the successful publication transition sends notifications, preventing duplicate notices from repeated Publish. Publication is authoritative and is not rolled back for secondary notification failures: delivery totals are returned to Faculty, failures emit a generic server warning, and no successful-delivery claim is made on failure. Delivery is best effort with no queue/retry worker. Drafts and individual responses do not notify Faculty.

| New endpoint | Authorization / behavior |
| --- | --- |
| `POST /api/feedback-sessions/:sessionId/publish` | Owner Faculty; empty action body; publish once |
| `POST /api/feedback-sessions/:sessionId/close` | Owner Faculty; empty action body; final/idempotent close |
| `GET /api/feedback-sessions/student` | Student; `category=pending\|completed`, page 1/limit 20, maximum limit 100 |
| `GET /api/feedback-sessions/:sessionId/respond` | Eligible Student; currently open and unanswered questionnaire |
| `POST /api/feedback-sessions/:sessionId/responses` | Eligible Student; `{ identityMode: ANONYMOUS\|NAMED, answers: [{ questionId, value }] }` |

Student UI routes are `/feedback-sessions` and `/feedback-sessions/:sessionId/respond`. Anonymous is the privacy-preserving default when permitted; named-only sessions state that requirement. Semantic question controls, required/optional indicators, confirmation, processing/error states and authoritative Completed refresh accompany submission. Faculty My Sessions has Publish/Close confirmations, effective lifecycle labels and notification-delivery feedback. All APIs preserve existing authentication, first-login, CSRF, inactive-account and revocation checks.

**Body-limit review:** the previous 16 KB ceiling could not carry valid questionnaires. Even 64 KB cannot hold 50 maximum-length choice questions: approximately 250 KB of plain text, 750 KB with three-byte Unicode, or 1.5 MB when JSON escaping is required. Feedback-resource JSON now has a finite **2 MB** ceiling so all documented question/option limits fit; all other JSON and all URL-encoded requests retain **16 KB**. Per-field/question/option limits remain unchanged. Regression tests persist maximum-size ASCII, Unicode and escaped questionnaires, reject oversized/invalid bodies, and verify the original limits on other routes and URL-encoded input.

Backend/frontend tests cover lifecycle, eligibility, privacy, all answer types, duplicate/concurrent submission, notification failures and security guards. The isolated browser workflow covers Faculty publication → eligible Student notification/questionnaire → final submission/Completed → duplicate rejection → wrong-section privacy → Faculty Close at 1440/320px, preserving all-role regression at 1440/1024/768/375/320px. Development database fingerprints can be compared using the existing read-only utility.

Part 3 adds Faculty results and question analytics as described below. CSV export is optional and deferred. General Feedback/moderation, Suggestions and Complaints are documented in Phases 7–8 below; authorized aggregate analytics follow in Phase 9.

## Phase 6 Part 3 — Faculty Results and Session Analytics

**Phase 6 — Feedback & Survey System: COMPLETE (Parts 1, 2 and 3).** Full backend, frontend and browser regression, privacy checks and development-database fingerprint verification passed. CSV export is optional and deferred; it does not block Phase 6 completion. Phase 7 is documented below.

Faculty can open View Results for their own published sessions at `/my-sessions/:sessionId/results`. OPEN results are live and refresh manually; scheduled and closed/expired results remain readable. Draft results return a controlled conflict. Student, HOD and Principal roles cannot use Faculty results endpoints. The Faculty dashboard now counts real Draft/Open/Scheduled/Closed sessions using the same effective availability rules as participation. My Sessions links to Results without making an analytics request for every card.

`GET /api/feedback-sessions/:sessionId/results` returns explicit session metadata, summary totals, and question aggregates. Every results query first verifies Faculty ownership. The service streams one session-scoped response query using only identity mode and answers, accumulating bounded counters for the existing questionnaire; it does not send raw responses or short-answer text in the main payload. No Student identity lookup is used for aggregate results. Read endpoints never mutate session, response, or notification records.

**Response-rate semantics:** Eligible Students are the currently active STUDENT accounts matching the session's published Department/semester/normalized-section criteria and its batch when specified. The service reuses Part 2's recipient/eligibility filter; an unspecified class batch remains a wildcard. Class criteria stay frozen, but Student membership is current, including after closure. Historical submissions remain counted even if their Student later changes class or becomes inactive. Rate is total responses divided by current eligible Students × 100, rounded to two decimals; it may exceed 100% after membership changes. A zero denominator yields 0%. Anonymous plus Named equals total responses.

Single Choice includes every configured option, including zeros, with count and percentage of valid answers to that question. Multi Select counts respondents selecting each option; percentages use respondents who answered that question and can sum above 100%. Rating returns numeric average (null with zero answers) and the full 1–5 distribution; the UI displays averages to two decimal places. All question types expose answered/skipped counts, whose sum equals the session response count. Optional skipped short answers do not create empty cards.

Short answers load on demand through `GET /api/feedback-sessions/:sessionId/results/questions/:questionId/responses?page=1&limit=20` (maximum limit 100). It accepts only an owned published session and its own SHORT_ANSWER question. Anonymous items contain only `identityMode` and `text`; the database projection removes anonymous Student references before application mapping. Named items add only `identity: { name, userCode }`, with a safe null identity if that account is unavailable. Only named IDs on the current page are batch-loaded. No Student/response IDs, timestamps, email, security fields, or stable Anonymous-number labels are returned. Text ordering is question-specific with internal tie-breaking; no correlation key is exposed across questions. User-entered text is rendered as text, without HTML injection.

The Results page uses shared loading/alert/stat/layout components, question cards, responsive CSS bar charts with adjacent readable counts/percentages, paginated text cards, empty states, retries, and manual Refresh. Charts add no dependencies and never replace numeric data. There is no automatic analytics polling, anonymous-identity reveal endpoint, generic raw-response listing, CSV export, AI analysis or cross-Faculty analytics. Backend HTTP tests inspect complete responses for anonymous identity leakage; frontend and isolated browser tests cover both Anonymous and Named display.

Part 1/2 body limits, notifications, response finality, uniqueness, identity lock, eligibility and availability behavior are retained. The 2 MB JSON allowance remains limited to Feedback Session resources; other JSON and all URL-encoded requests remain at 16 KB. Tests use guarded isolated databases, with read-only development fingerprints before/after verification. Phase 7 extends moderation to new Session SHORT_ANSWER submissions. Complaints/routing are documented under Phase 8 and authorized aggregate analytics/DSA under Phase 9. AI analysis remains deferred.

## Phase 7 — General Feedback, Private Suggestions and Content Moderation

**Phase 7 — General Feedback + Private Suggestions + Content Moderation: COMPLETE.** Validation passed: 71 backend files syntax-checked, 596 backend tests, 267 frontend tests, production build, six browser-script syntax checks, and the full four-role browser suite at 1440/1024/768/375/320px with focused Phase 7 flows at 1440/320px. No tests failed or were skipped. Development collection counts and SHA-256 fingerprints remained identical before/after validation. Phase 8 is documented below.

Students submit General Feedback through `/student/general-feedback`, choosing a server-derived active teaching assignment relevant to their current Department, semester, normalized section and batch (when the class specifies one). The existing assignment usability checks verify active Department/Faculty/Subject/Class sources, matching academic year/semester and consistent departments. Options are paginated; submission revalidates the relationship. The server derives Student, Faculty, Subject and Department references. Rating is integer 1–5; trimmed messages are 10–2000 characters. Feedback is final, with no edit/delete/identity-changing endpoints, and students may submit again in the future without a lifetime uniqueness constraint.

Student own history includes submitted text, Faculty/Subject context, rating, identity choice and submission date. Faculty read only feedback addressed to themselves. HOD General Feedback is restricted to both the historical Department and Faculty currently belonging to that Department; transfer does not move old feedback into another Department's HOD view. Faculty/Subject/rating filters preserve that scope. Principal's Feedback Overview exposes only total Feedback, numeric average (null with no feedback), and five rating counts—no text, individual records, identities or Faculty ranking. Faculty/HOD lists include the same bounded summary within their authorized filter.

Private Suggestions at `/student/suggestions` require an active same-Department Faculty recipient, without a Subject. Only the sender's history and the selected Faculty's `/faculty/suggestions` inbox can access a Suggestion. HOD/Principal have no Suggestion endpoints, aggregates, counts or navigation; other Faculty/Students cannot fetch records by ID. Faculty dashboard counts include only their own received Feedback/Suggestions; Student counts include only their own submissions. New per-user/date indexes support newest-first history/inboxes; Feedback also has a Department/date index.

Both modules retain internal Student references for Anonymous and Named messages. Recipient projections remove anonymous Student references inside MongoDB before mapping; only Named IDs on the current page are batch-loaded, exposing name and userCode only. Explicit DTOs omit Student IDs, email, security fields and retry metadata. Anonymous is the default; identity and content are final. Own history is not hidden from its author. No reveal endpoint exists. Individual lists use page 1/limit 20 defaults, maximum limit 100 and deterministic createdAt/_id descending order.

Successful Suggestions attempt one neutral `SUGGESTION` notification to the selected Faculty using the existing notification service. Notification content includes neither sender identity nor message text. Suggestion persistence is primary; delivery failure logs a generic warning and returns an explicit unsuccessful delivery result without rolling back the saved message. The form supplies a UUID `submissionKey`; a unique Student/key index and content fingerprint deduplicate identical concurrent/network retries. Reusing a key for different content returns a conflict. A replay does not send another notification; a new suggestion uses a new key. Clients omitting this optional key do not receive retry deduplication. General Feedback creates no per-submission notifications.

`services/contentModerationService.validateText` is a generic accept/reject service with one server-only terms/config file at `utils/constants/moderation.js`. It uses NFKC/case normalization, zero-width separator handling, Unicode word boundaries, punctuation/whitespace separation and a controlled substitution map. Whole-term matching avoids innocent substring matches. Accepted text is never rewritten by moderation; field validators handle required/length limits. Rejections use only: “Your message contains inappropriate language. Please revise it before submitting.” No public moderation endpoint or frontend blocked-term list is exposed.

Moderation runs before persistence for General Feedback, Suggestions and Session SHORT_ANSWER values. A blocked short answer rejects the entire response before admission or insertion; students can revise and retry. Single Choice, Multi Select and Rating values are not moderated. Existing response uniqueness, identity locking, availability and eligibility rules are preserved. Forms show respectful-language guidance, finality confirmations, processing states and authoritative server errors.

| Endpoint | Role / purpose |
| --- | --- |
| `GET /api/general-feedback/options` | Student: own valid paginated Faculty/Subject assignments |
| `POST /api/general-feedback` | Student: assignment, rating, message, identityMode |
| `GET /api/general-feedback/mine` | Student: own final history |
| `GET /api/general-feedback/received` | Faculty: own received feedback and summary |
| `GET /api/general-feedback/department` | HOD: scoped list/summary; optional facultyId/subjectId/rating filters |
| `GET /api/general-feedback/aggregate` | Principal: aggregate values only |
| `GET /api/general-feedback/:id` | Student author, recipient Faculty, or authorized HOD only |
| `GET /api/suggestions/faculty-options` | Student: active same-Department Faculty |
| `POST /api/suggestions` | Student: facultyId, message, identityMode, optional submissionKey |
| `GET /api/suggestions/mine` | Student: own sent history |
| `GET /api/suggestions/received` | Faculty: own private inbox |
| `GET /api/suggestions/:id` | Author Student or selected Faculty only |

All Phase 7 endpoints reuse HTTP-only JWT authentication, role/first-login/account-revocation guards, explicit field validation, CSRF and existing error handling. Both message resources retain the normal 16 KB JSON limit. Phase 7 introduced no dependencies, alternate authentication, message queue, Complaints, attachments, routing/escalation, advanced analytics, DSA or AI moderation. Automated tests use guarded isolated databases and development collection fingerprints; focused browser workflows cover both desktop/mobile and preserve four-role regression at all five widths.

## Phase 8 — Complaint & Grievance Management

**Phase 8 — Complaint & Grievance Management System: COMPLETE.** Full validation passed: 80 backend files syntax-checked; 686 backend tests (12 files); 310 frontend tests (14 files); production build; seven browser-script syntax checks; upload middleware/utility and new backend-test syntax checks; and the complete four-role browser regression at 1440/1024/768/375/320px. Focused complaint workflows passed at 1440/320px. There were zero failed or skipped tests. All test evidence directories were cleaned, development uploads remained untouched, and before/after development collection counts and SHA-256 fingerprints matched. Phase 9 is documented below.

Students raise final complaints at `/student/complaints/new`, track their own paginated/filterable history at `/student/complaints`, and open details at `/student/complaints/:complaintId`. Faculty, HOD and Principal use `/<role>/complaints` and the corresponding detail route. Shared detail cards include status, priority, handling level, evidence, an actual vertical timeline, resolution and only currently permitted actions. Loading, empty, error/retry, processing, confirmations and notification-delivery failure states reuse the existing UI. Complaint creation and every action prevent duplicate clicks. Filters cover status/type plus handler priority; lists default to page 1/limit 20, maximum 100, newest createdAt/_id first.

### Routing and access

| Type | Initial authority | Internal escalation |
| --- | --- | --- |
| `FACULTY_ISSUE` | Selected, academically relevant Faculty | Faculty → HOD → Principal |
| `AGAINST_FACULTY` | Student's active Department HOD | HOD → Principal |
| `DEPARTMENT_ISSUE` | Student's active Department HOD | HOD → Principal |
| `AGAINST_HOD` | Active Principal; target HOD derived from Student's Department | None |
| `COLLEGE_CAMPUS` | Active Principal | None |
| `SAFETY_URGENT` | Active Principal, automatic URGENT priority | None |

Routing is centralized in `utils/constants/complaints.js` and enforced in `complaintService`. The Student chooses a type, never a handling authority or priority. Faculty-required types select a usable real FacultyAssignment option (`facultyAssignmentId`); submission reuses Phase 7 revalidation for active Department/Faculty/Subject/Class, department consistency, semester, normalized section, applicable batch and academic year. The actual target Faculty ID is derived server-side. Options expose only assignment IDs, display context, type/identity choices and evidence limits, without HOD/Principal/handler IDs. HOD resolution requires one active HOD in the original Department; Principal resolution requires exactly one active Principal. Missing/inactive/ambiguous authority returns a controlled conflict, without fallback to another routing level.

Only the Student author and explicitly assigned current/prior handlers may read a complaint or evidence. An HOD's department membership alone grants no access; Principal has no unrestricted complaint view. `AGAINST_FACULTY` explicitly excludes its target from reads/actions/inboxes/counts/notifications, before and after escalation. `AGAINST_HOD` excludes its target HOD completely. A Faculty Issue is initially hidden from HOD/Principal; Department Issues are initially hidden from Principal. Current/prior Faculty/HOD grants also require their present role and department to match the original context. Transfers do not move historical complaints into another department, and author history survives a Student transfer.

Original Student, Department, type, targets, identity choice, initial routing context, content, attachments and createdAt are immutable. Inactive handlers cannot use stale sessions. Cases are not automatically reassigned when account holders change; explicit grants remain tied to the original account and role. Restoring the designated account/context or a separately designed audited reassignment process is necessary if that account can no longer handle the case; Phase 8 does not silently grant a replacement account access.

### Lifecycle, timeline and concurrency

The central state machine permits `SUBMITTED → ACKNOWLEDGED → IN_PROGRESS → RESOLVED → CLOSED`. An unresolved complaint can escalate Faculty → HOD or HOD → Principal, setting `ESCALATED`; the new current authority acknowledges `ESCALATED → ACKNOWLEDGED` before starting progress/resolving. No internal escalation beyond Principal, direct unresolved closure, reopening, generic editing or deletion exists. Only the current assigned handler performs handler actions. Only the Student author closes a RESOLVED case.

The Student can request escalation on their own unresolved case only when another authority exists and no request is pending at that level. A moderated reason of 10–1000 characters records `ESCALATION_REQUESTED` and notifies the current handler; it does not reroute. Actual handler escalation increments the level, clears the pending request, records `ESCALATED` and grants the actual prior handler read-only access. Resolution clears any pending request and requires a moderated 10–2000 character summary; resolvedAt/closedAt are retained.

`models/ComplaintEvent.js` defines the immutable event subdocument model embedded in Complaint. Every submission, acknowledgement, progress step, escalation request, escalation, priority change, resolution and closure appends a timestamped event with internal actor/context. The canonical event and state change share **one atomic Complaint write**. This deliberately avoids a second independently written history collection and does not require replica-set transactions or claim they work on standalone MongoDB. Actions use a version/current-handler/status conditional update, incrementing `__v`; concurrent/stale losers receive 409 without an extra event or notification. No endpoint rewrites/removes events. Finite workflow levels, one request per level and upward-only priority changes bound history growth.

Priority begins NORMAL except Safety/Urgent, which begins URGENT. Only the current handler may raise an unresolved case to HIGH/URGENT. Lowering or unchanged priority is rejected; every successful change appends `PRIORITY_CHANGED`. Safety/Urgent cannot be downgraded. Its form displays: “CampusVoice is not a substitute for emergency services or immediate emergency assistance.” There is no promise of immediate response or automatic timed escalation.

### Identity, moderation and evidence

Anonymous is the default and remains recipient anonymity; the internal Student reference is always retained. Mongo projections remove anonymous Student IDs before response mapping and remove all event actor IDs. Anonymous recipients see Anonymous and Anonymous Student timeline actors, without a correlatable anonymous user identifier. Named handlers receive only Student `name` and `userCode`, batch-loaded once for the current page. DTOs never expose Student account IDs, email/security fields, raw routing grants, disk paths or storage filenames. Author views show You in the timeline. There is no reveal endpoint.

The Phase 7 moderation service is reused for complaint title (trimmed 5–150), description (trimmed 20–5000), escalation reason and resolution summary. Blocked text rejects before mutation or file persistence, with the existing exact rejection message. No second moderation implementation or text rewriting was added.

Evidence is optional and final: up to **3 files**, **5 MB each**, PDF, JPEG/JPG, PNG, MP4 or WebM. Route-scoped Multer memory parsing bounds files, fields, parts and sizes, then checks extension, declared MIME and file magic bytes. No uploaded file is written until authorization, routing and text/evidence validation pass. Private disk names use UUIDs with exclusive creation; normalized basename metadata is never used as a path. The default storage directory is `uploads/complaints/`, configurable server-side with `COMPLAINT_UPLOAD_DIR`. No static directory exposes it. Written files are cleaned on failed writes; parsing/validation/auth failures create no disk files.

Every download authenticates and rechecks complaint ownership/explicit handling grants and attachment membership. Responses force download with the validated MIME, generic Attachment-N filename, no-store and nosniff. Handlers always receive generic Attachment N labels, including for Named cases; only the author sees sanitized original filename metadata. The anonymous form warns users to avoid identifying themselves inside evidence; the application does not redact file contents.

### Notifications, dashboard counts and security

Existing in-app COMPLAINT notifications use neutral messages without complaint text, sender identity or resolution details. Submission notifies the initial handler; acknowledgement/progress/resolution notify the author; escalation request notifies the current handler; actual escalation notifies the author and new handler. Closing creates its event without an extra notification. Excluded targets are never notified. State/history persistence is primary; secondary notification failures return delivered/attempted counts without rolling back the case. Losing conditional transitions do not notify.

Dashboard metrics use the same visibility scope as inboxes: Student total/open/resolved, Faculty visible assigned/pending issues, HOD visible department/pending/request counts, Principal visible assigned/urgent/escalated counts. Open excludes RESOLVED/CLOSED; resolved counts the current RESOLVED state. Prior-handler totals may include readable history. No rankings, trends, queues or institution-wide complaint counts were added. Compound author/current-handler/prior-handler date indexes support scoped reads. Lists use aggregation/count facets and one bounded Named identity query rather than per-item population.

All routes reuse protect/RBAC/CSRF, first-login, inactive-account, token-version revocation, pagination and error infrastructure. Unauthorized valid complaint/evidence IDs return safe unavailable responses. Explicit field allowlists reject client Student/Department/handler/status/priority/routing injection on creation. A per-account shared submission/escalation-request limiter allows 30 requests per 15 minutes. Normal JSON/URL-encoded limits remain 16 KB, scoped Feedback Session JSON remains 2 MB; multipart limits are complaint-only. The shared API client preserves cookie/CSRF behavior while letting the browser set the FormData boundary.

| Endpoint | Authorized use |
| --- | --- |
| `GET /api/complaints/options` | Student options/rules; page/limit |
| `POST /api/complaints` | Student multipart creation, optional `attachments` |
| `GET /api/complaints/mine` | Student own paginated/filterable history |
| `GET /api/complaints/inbox` | Explicit Faculty/HOD/Principal grants only |
| `GET /api/complaints/:id` | Author/current/prior handler detail |
| `GET /api/complaints/:id/attachments/:attachmentId` | Same authorization plus evidence membership |
| `POST /api/complaints/:id/acknowledge` | Current handler, Submitted/Escalated |
| `POST /api/complaints/:id/start` | Current handler, Acknowledged |
| `POST /api/complaints/:id/escalation-request` | Author, eligible unresolved case; `reason` |
| `POST /api/complaints/:id/escalate` | Current Faculty/HOD, unresolved |
| `POST /api/complaints/:id/resolve` | Current handler, In Progress; `resolutionSummary` |
| `POST /api/complaints/:id/close` | Author, Resolved |
| `PATCH /api/complaints/:id/priority` | Current handler, upward-only `priority` |

Backend upload tests require and generate a unique `test-results/complaint-uploads-<uuid>` directory; the browser suite uses an isolated directory under its artifacts. Both remove test evidence/directories after completion, including failure paths, and never use development uploads. Database tests retain the existing guarded unique `campusvoice_test_*` databases. Full validation commands remain `check:backend`, `test:backend`, `test:frontend`, `build:frontend` and `test:browser`, with syntax/whitespace checks and development fingerprints. Phase 8 introduced no DSA, advanced analytics, AI or email/SMS. Authorized analytics and DSA are documented next; Phase 10 remains deferred.

## Phase 9 — Role Analytics and DSA

**Phase 9 — Analytics + DSA: COMPLETE.** Final full validation passed: 91 backend JavaScript/ESM files syntax-checked; 747 backend tests in 14 files (including 23 DSA unit tests); 331 frontend tests in 15 files; production build; eight browser-script syntax checks; new analytics/DSA test syntax; whitespace checks; and all 21 browser workflow checkpoints. No final tests failed or were skipped. Four-role regression passed at 1440/1024/768/375/320px, with focused Analytics/DSA workflows at 1440/320px. Phase 10 is documented below.

The first development fingerprint comparison changed during implementation: the user confirmed signing into the Principal account; the observed User login/update timestamps changed and four empty model collections appeared. That activity was preserved, never reverted or hidden by overwriting the original manifests. A fresh controlled before/after comparison around **another complete backend/frontend/browser validation run** matched every collection count and document SHA-256 fingerprint. Controlled manifest SHA-256: `F6E5EAF1999CF83061EF8B9A845441D47B53F8E536473EDC5FC10FDDE4D03198` on both sides. Development remained 2 Departments, 1 User and zero records in all ten other collections. Original and controlled manifests are retained under ignored `test-results/`. Test evidence directories were cleaned and development uploads remained untouched.

Principal, HOD and Faculty access Analytics from their role navigation or dashboard link at `/<role>/analytics`. The shared responsive page uses real server aggregates, existing StatCards and accessible CSS distribution bars with adjacent counts/percentages. Monthly trends have visible month/count labels, including zero months. Rating averages display two decimals; rates display two decimals; zero denominator yields 0%, and an absent rating average is null/“Not available.” Empty modules show “No data available for this period.” Pages load on open, applied dates or manual refresh; there is no polling or new chart dependency. Loading, errors/retry and cancellation clear stale charts.

### Authorized analytics scopes

| Role | Academic overview | Feedback / sessions | Complaints | Suggestions |
| --- | --- | --- | --- | --- |
| Principal | Current Departments, active Faculty/Students/HODs | Institution aggregate-only General Feedback and published-session participation | Only explicit Phase 8 current/prior handling grants | No fields, counts, queries or section |
| HOD | Current department's active Faculty/Students, Subjects, Classes, active Assignments | Historical department **and** Faculty currently in that department; session data aggregate-only, published sessions only | Existing explicit grants only; no Against-HOD, un-escalated Faculty Issues or Principal-only cases | No fields, counts, queries or section |
| Faculty | No institution overview | Own General Feedback, own cross-session Draft/Scheduled/Open/Closed summaries and responses | Own authorized current/prior Faculty Issues; no Against-Faculty complaints | Own received total, Anonymous/Named counts and monthly volumes only |
| Student | No institutional analytics | Own completed responses and submitted Feedback counts | Own submitted/open/resolved totals | Own sent total only |

Student's existing dashboard keeps its all-time activity counts and adds a lazy “My activity by period” panel. Opening it loads `/api/analytics/summary` for the authenticated Student, with optional date controls; closing aborts pending loads. There is no Student institutional Analytics menu or peer comparison.

Principal General Feedback exposes volume, average, 1–5 distribution, monthly volume and up to 100 Department aggregates. HOD/Faculty receive Subject aggregates within their scope, also bounded to 100 with a truncation flag. Groups use academic identity order, never rating order; there is no Faculty leaderboard or performance score. Session statistics contain session availability/question-type counts, published count, total responses, Anonymous/Named counts, eligible response opportunities, participation rate and response volume. They contain no titles, prompts, individual answers, short-answer text, response records or identities.

Complaint aggregates include authorized total, pending/resolved/closed, urgent, escalated, pending escalation requests, escalated-to-Principal, and status/type/priority distributions/monthly volume. They reuse the **same exported Phase 8 scope** as operational complaints. Excluded complaint categories are omitted from the target's distribution as well as excluded from totals. Higher roles do not acquire an all-complaints view. All aggregate DTOs omit individual complaint text, Student identities, raw documents and cross-module anonymous correlation identifiers. Private Suggestion analytics are constructed and queried only for Faculty; HOD/Principal receive no Suggestion information.

### Dates and participation semantics

Analytics accepts strict `YYYY-MM-DD` UTC dates from 2000–2100, inclusive of Date To. Defaults are the latest 12 calendar months through the current UTC day; an omitted Date From derives from Date To. Requests spanning more than 24 calendar months, invalid/rolled dates, reversed ranges, repeated/array parameters or unsupported filters are rejected. Trends always use UTC monthly buckets and zero-fill missing months within that bounded range. Academic overview remains a current snapshot, explicitly labelled in the UI rather than being misleadingly restricted by account creation dates.

Feedback/Suggestion/Complaint period membership uses createdAt. Session totals select sessions created in the period; response totals/trends additionally require submittedAt in the period. Published includes scheduled/open/closed published sessions, excludes drafts for administrators. Faculty additionally sees own drafts in session totals/question-type counts. Availability reuses Phase 6 boundaries through the shared availability helper.

Participation pools counted responses over **the sum of current eligible Student opportunities for selected published sessions**, not distinct institution-wide Students. The correlated Mongo eligibility predicate is shared with Phase 6 publication/results and retains department, semester, normalized section and optional-batch wildcard semantics, including legacy empty batches. Only valid Anonymous/Named responses count, matching Phase 6 Results. Historical responses remain after account/membership changes; therefore a rate can exceed 100% and is never clamped. Zero opportunities gives 0%. This is a pooled participation rate, not an unweighted mean of per-session percentages.

### Complaint processing views

Faculty/HOD/Principal open `/<role>/complaint-processing` from dashboard or complaint inbox. This is an additional read-only view; the normal paginated inbox remains available. Only unresolved complaints **currently** assigned to that authenticated account/role enter a processing structure, after all Phase 8 scope/exclusion rules. Prior handlers may still see authorized historical analytics but do not get actionable queue entries. Dequeueing neither deletes nor mutates MongoDB records; actual actions still re-read current DB state and enforce Phase 8 version/state/handler rules.

FIFO shows oldest submitted cases first. Priority uses URGENT, HIGH, NORMAL, with oldest submitted first within a priority and record ID as deterministic tie-breaker. The default processing view includes **all submission dates**, so old unresolved complaints do not disappear. Explicit API dates can narrow it using the same validated range rules. Mongo selects the first 100 candidates in the requested global order (plus one for truncation detection) before memory processing. Thus a newer Urgent case is not lost behind 100 old Normal cases. The Queue or binary heap then enqueues/dequeues that bounded authorized window. Truncation and the search window are disclosed.

The visible literal title/exact-ID search scans only that bounded window. It uses explicit linear searching with `includes`, without user-created regex. Type filtering remains inside the authorized database scope. Student access is forbidden. Queue output includes only complaint ID/title/type/status/priority/submitted time, without Student identities, attachments or internal handling grants.

### DSA feature mapping and complexity

MongoDB remains durable storage for complaints, embedded events, sessions and responses. DSA structures are transient processing/editing tools, never a replacement database.

| Implementation | Production integration | Typical time / space |
| --- | --- | --- |
| `utils/dsa/Queue.js` | `analyticsService.processing`: FIFO authorized complaint view, Map with head/tail indexes | enqueue/dequeue/peek O(1); O(n) memory, production n ≤ 100 |
| `utils/dsa/PriorityQueue.js` | `analyticsService.processing`: comparator-based binary min-heap for triage | enqueue/dequeue O(log n), peek O(1); O(n), n ≤ 100 |
| `utils/dsa/Stack.mjs` | Faculty `SessionEditor`: separate Undo/Redo stacks for unsaved question states | structural push/pop/peek O(1); cloning O(s) per questionnaire state; bounded 50-state history |
| `utils/dsa/LinkedList.js` | `complaintService.read`: linked-node traversal of **already privacy-safe** serialized timeline events | append O(1) with tail; find/traverse/toArray O(n); O(n) |
| `utils/dsa/search.js` | Binary Search finds a month in sorted bounded aggregate buckets; linear search selects literal processing-window matches | binary O(log b); linear O(n), result O(n); b ≤ 24, n ≤ 100 |
| `utils/dsa/sort.js` | Stable, non-mutating Merge Sort orders monthly aggregate buckets before zero filling | O(b log b) time, O(b) working space; b ≤ 24 |
| Arrays / Maps | Aggregate distributions, state/category counters, priority weights and lookup tables in analytics | O(n + categories) mapping rather than repeated category scans |
| `contentModerationService.js` | Existing Phase 7/8 submission validation | Bounded string normalization/matching; unchanged moderation rules/tests |

The Stack is a bounded circular buffer; each stack keeps at most 50 states and evicts its oldest state in O(1). Undo/Redo covers question add/remove/edit/options/required/reorder changes, preserving local keys and saved question IDs. A new edit clears Redo. Loading a draft or switching routes clears history; buttons are disabled when unavailable or saving, and published sessions never expose editing/history controls. Undo changes only local unsaved questions, not persisted session history, Student responses or complaints. Normal Save remains the only persistence path.

Linked List nodes hold only privacy-safe timeline event types, role labels, allowed notes and timestamps. Raw actor IDs and Student references are removed in Mongo projection first. The canonical event order remains the append-only embedded Mongo history; traversal returns that same order to the existing vertical timeline. It neither rewrites events nor introduces a second history store.

Searching/Sorting are demoable through the processing search and chronologically zero-filled trends. Existing String processing remains Phase 7's NFKC/case normalization, zero-width/punctuation/spacing handling, controlled substitutions and whole-term boundaries. No duplicate moderation algorithm was created.

### APIs, filters and security

| GET endpoint | Roles | Allowed filters |
| --- | --- | --- |
| `/api/analytics/overview` | Principal/HOD/Faculty | dateFrom, dateTo |
| `/api/analytics/feedback` | Principal/HOD/Faculty | dates, subjectId inside scope |
| `/api/analytics/sessions` | Principal/HOD/Faculty | dates, subjectId inside scope |
| `/api/analytics/complaints` | Principal/HOD/Faculty | dates, type, status, priority inside scope |
| `/api/analytics/complaint-processing` | Principal/HOD/Faculty | optional dates, mode=fifo/priority, type/status/priority, literal search ≤ 100 chars |
| `/api/analytics/summary` | Student only | dateFrom, dateTo |

Client department/Faculty/Student scope overrides are rejected. A valid foreign subject produces no out-of-scope data. All routes reuse authentication, first-login, active-account/token-version revocation and role enforcement; all responses are no-store and explicit DTOs. Analytics and processing are read-only; global CSRF/mutation/body-limit rules and upload security remain intact. Mongo aggregation facets handle counts/distributions; correlated joins return scalar cohort/response counts without application-level N+1 queries. Existing author/handler/department/session indexes support scoped matches, and in-memory datasets are capped. No charting or other package dependency was added.

### Validation and demo

Run full `npm run check:backend`, `test:backend`, `test:frontend`, `build:frontend` and `test:browser`, plus `git diff --check`. The syntax checker now includes `.mjs` utilities. DSA unit tests prove FIFO, heap invariants/large sample/priority ties, bounded Stack eviction, linked nodes/traversal, search boundaries and stable non-mutating Merge Sort. Analytics HTTP tests inspect complete JSON for privacy, department/owner/complaint exclusions, dates/zero buckets, participation parity (including rates over 100%), processing bounds/order, read-only persistence and authentication guards.

Browser demonstrations use isolated real application records at 1440/320px: Principal/HOD/Faculty analytics, empty date periods, personal Student summary, FIFO vs Priority processing with oldest ties, literal/exact-ID search, builder Add/Edit/Reorder/Undo/Undo/Redo and normal Save, and linked timeline order. Full four-role regression remains at 1440/1024/768/375/320px. Tests retain guarded unique test databases and isolated evidence cleanup; development counts/fingerprints are compared before/after validation. AI analytics/sentiment/classification, Faculty ranking, PDF/Excel reporting and email/SMS reports remain outside scope; Phase 10 is documented below.

## Phase 10 — Final Integration, Security and Audit Logging

**Status: COMPLETE (100%). Verified 3 November 2026.**

Final validation: 818 backend tests (including all 23 DSA tests), 345 frontend tests, and 23 integrated browser checkpoints passed, with no failed or skipped cases in the final runs. All four roles passed responsive checks at 1440/1024/768/375/320px; complete critical workflows, including Audit Logs, passed at 1440/320px. Backend syntax passed across 99 files, plus 11 explicit test/browser scripts. The production build passed with only the two existing React Router `use client` module-directive warnings. Root and frontend npm audits each reported 0 critical/high/moderate/low/informational vulnerabilities. `git diff --check` passed.

The original and controlled development baselines matched the final database: 1 User, 2 Departments and 0 records in each other existing collection; no AuditLog collection was created by startup/reads. Canonical before/after manifest SHA-256: `a050e09634f93721a48aa9e9f906aebad2a8a9e354dcecbe474f1c36bbb1a20d`. All per-collection hashes matched. Isolated test evidence and temporary upload directories were removed; development uploads remained untouched. Ignored verification reports/screenshots/logs are retained in `test-results/`. Changes remain uncommitted on `develop`; no push, merge or branch switch was performed.

The architecture remains React View → REST API Route → thin Controller → Service → Mongoose Model → MongoDB. Controllers handle HTTP input/output; services own authorization, validation, persistence and workflows. Shared authentication, notifications, moderation, pagination, serializers and DSA are reused. No new business module, public registration, AI, messaging, email/SMS, report export or automatic escalation was added.

### Administrative audit design

`AuditLog`, `auditService`, centralized action constants and the Principal-only `/principal/audit-logs` page record administrative/security operations. `GET /api/audit-logs` supports action/resource-type/UTC date filters and standard page 1/limit 20 pagination, maximum 100. A bounded page loads actor display names in one query. There are no audit edit/delete/detail/reveal endpoints. Model query/save guards reject rewriting or deleting existing records. Database administrators and backups remain an operational trust boundary; application append-only storage is not a claim of cryptographic tamper-proofing.

Audited operations include successful/failed authentication, logout, password changes, Department/HOD/Faculty/Student/Subject/Class/Faculty Assignment creation and updates/status changes, and complaint creation/status/escalation requests/escalation/priority/resolution/closure. Ordinary GETs, analytics/queue reads and individual Feedback, Suggestion or SessionResponse submissions are deliberately not audited. AuditLog never replaces the authoritative embedded ComplaintEvent timeline.

Each important mutation first persists an immutable ATTEMPT, then runs the existing service and appends a separate SUCCEEDED/FAILED result with an internal correlation UUID. The Principal browser joins the result to its intent and shows one operation. Missing completion displays UNCONFIRMED. This supports standalone MongoDB without pretending two collections or a service callback share a replica-set transaction. An attempt may remain unconfirmed after a process/storage interruption; review the current business record before retrying. FAILED describes the service request result, not a transaction rollback guarantee.

If the initial audit cannot persist, normal audited mutations/sign-in/password changes do not start and return a safe 503 `AUDIT_UNAVAILABLE`. If the business operation finishes but outcome logging fails, its result remains authoritative; a generic server warning and `X-Audit-Status: unconfirmed` are emitted. The shared frontend displays a dismissible uncertainty notice. A failed service request keeps its original safe error even if its audit outcome also fails. Logout is the deliberate exception: audit failure must not prevent security revocation or local cookie clearing. Revocation still runs, audit confirmation is reported honestly, and a database revocation failure is not presented as a successful logout.

Audit metadata has an explicit allowlist: approved changed-field names, requested boolean activation state and controlled failure categories. It never copies field values, request bodies, attempted user codes/passwords, hashes, cookies/JWTs, headers, tokens, free-form errors, private text or evidence. IP/user-agent data is not collected. Actor/resource references are retained internally where appropriate; Student complaint actions omit the audit actor ID entirely. No historical audit records are invented or backfilled; the explicit Principal bootstrap remains an idempotent administrative setup command.

### Audit privacy and access

Only Principal can browse audit operations; HOD/Faculty/Student have neither the route nor navigation. All Complaint audit entries are excluded from this browser, its totals, filters and pagination, even when Principal could separately read a particular complaint. This prevents audit-derived existence leaks for un-escalated cases and excluded targets. Private Suggestions and anonymous feedback/answers have no audit linkage or audit statistics.

Student authentication actors display only “Student account”; their internal IDs, name, USN and email never leave the audit API. Non-Student actors display a current account name and role without account IDs or email. No resource IDs, correlation UUIDs, raw nested documents or security fields are exposed. Student provisioning logs show action/changed-field labels, never the provisioned Student identity or credentials. These constraints are tested against complete HTTP responses, rather than relying on UI hiding.

### Security review and hardening

- HS256 JWTs remain in bounded HTTP-only cookies, with fixed issuer/audience and database-checked role/active/tokenVersion. No tokens enter JSON, localStorage or sessionStorage. Expiry now has an enforced 30-day maximum (default 8h). Production always sets Secure; local development still permits HTTP. Signature/expiry/first-login/inactive/revocation checks are unchanged.
- Login rechecks current active role and tokenVersion when updating lastLoginAt, preventing a session from being issued from a stale security snapshot. Unknown/wrong-password/inactive logins share one safe response. Password updates retain compare-and-swap; logout revokes all account sessions and clears the cookie, including on an error response.
- Global Origin plus `X-CSRF-Protection: 1` enforcement covers JSON, PATCH/DELETE, multipart and auth changes. Exact configurable CORS origin/credentials remain; there is no wildcard credential origin. `X-Audit-Status` is explicitly exposed to the frontend.
- Login remains limited to 10 failed requests/IP/15 minutes; password changes to 10 failed requests/account/15 minutes. Authenticated mutations, including password changes, additionally share a generous 120/account/15-minute limit. Complaint submissions/escalation requests retain their tighter shared 30/account/15-minute limit. GETs and security logout are not blocked by the general mutation limiter.
- API responses now set nosniff, DENY framing, no-referrer, a restrictive API-only CSP and camera/microphone/geolocation denial. Production adds HSTS. This API CSP is not applied to SPA HTML. Vite development/preview supply suitable frontend headers: production scripts self-only; no objects/framing; configured API connection origin; local HMR allowance only in development. Inline styles remain permitted for existing Bootstrap/CSS charts. Real production hosting must preserve the frontend headers at its HTTPS reverse proxy/static host.
- Normal JSON/URL-encoded bodies remain 16 KB; the 2 MB JSON exception remains scoped to Feedback Sessions. Multipart remains complaint-only with explicit fields/parts/count/size limits. Query/body allowlists reject Mongo operators and mass assignment. Errors omit stack traces, connection details, paths and token internals; audit unavailability uses a deliberate safe exception message.
- Anonymous serializers, department/Faculty ownership, complaint current/prior grants, Against-Faculty/Against-HOD exclusions, Principal aggregate-only Feedback and private Suggestions were reviewed and retained. Shared analytics never changes authorization because of a role label, priority or client scope parameter.
- PDF/JPEG/PNG/MP4/WebM evidence remains optional/final, maximum 3 × 5 MB, validated by extension, MIME and magic bytes, with generated private filenames, authorized forced downloads, generic handler display names and failure cleanup. Magic-byte checks are not malware scanning or document-content redaction. Anonymous upload guidance remains factual, including the Safety/Urgent emergency disclaimer.

### Dependencies, secrets and repository review

Compatible transitive patches updated `body-parser` 1.20.8 → 1.20.9 and `qs` 6.16.0 → 6.16.2, without a forced major upgrade or added dependency. The former fixes malformed compressed-body denial of service; the latter fixes a stringify denial of service. A malformed compressed request regression also confirms the API stays available. Root and frontend use the same package/lockfile; `npm audit` was run from both directories, covering the shared full tree. Final reports are retained in ignored `test-results/` with exact severity counts.

Tracked-source credential scanning identified only synthetic URI-preservation test fixtures (`testuser:fixture` on example/local hosts), not deployed credentials. `.env` remains ignored/untracked; `.env.example` holds configuration examples/empty credential placeholders. Vite exposes only intended `VITE_` configuration, not the server JWT/database secrets. Startup/seeder/verification output is retained where intentional; no application debugger/TODO/debug-print leftovers or browser token storage were found. Runtime logs, uploads, caches, dependency/build directories, coverage and test results are ignored.

The unused placeholder DashboardPreview was removed. Disabled future menu items were removed; class context remains in real assignments, and HOD feedback in General Feedback/Analytics. Dashboards now give usable workspace guidance instead of promising later phases. Non-dashboard navbar headers identify the role workspace, while actual module headings remain distinct. Existing loading/empty/error/retry, processing locks, confirmations, visible keyboard focus, labelled controls, chart numbers and responsive layouts are preserved. Audit adds the same states and safe uncertainty messages.

### Configuration and deployment

`.env.example` lists all supported configuration: NODE_ENV/PORT, development MONGODB_URI, separate TEST_MONGODB_URI, optional COMPLAINT_UPLOAD_DIR, FRONTEND_ORIGIN, public VITE_API_BASE_URL, JWT_SECRET/JWT_EXPIRES_IN, cookie options, exact trusted-proxy hop count, and explicit Principal bootstrap values. JWT_SECRET requires at least 32 bytes; use a random value. Never commit real values. No separate Audit secret or credentials are required.

For a production build, set public `VITE_API_BASE_URL=/api` for a same-origin HTTPS reverse-proxy deployment (or an explicit approved HTTPS API URL), then run `npm run build:frontend`. Output is `frontend/dist`. The client's production fallback is `/api`; development retains localhost:5000. Attachment links reuse the same API configuration. Serve static files and proxy `/api` to the backend, use `NODE_ENV=production`, configure the exact frontend origin/proxy hops, restrict database/evidence access and maintain TLS/backups. `npm run preview:frontend` is a local build preview, not a replacement for deployment operations or a tested external TLS environment.

### Major API groups

| Group | Purpose / scope |
| --- | --- |
| `/api/auth` | Cookie session/login/password/logout; no registration |
| `/api/profile` | Authenticated own account only |
| `/api/notifications` | Recipient-owned lists/read state |
| `/api/departments`, `/hods`, `/faculty`, `/students`, `/subjects`, `/classes`, `/faculty-assignments`, `/academic/dashboard` | Principal/HOD management, Faculty own assignments and role dashboard |
| `/api/feedback-sessions` | Owned Faculty lifecycle/results, eligible Student participation |
| `/api/general-feedback` | Own submissions/recipient/department views; Principal aggregates only |
| `/api/suggestions` | Author and selected Faculty only |
| `/api/complaints` | Server routing, explicit ownership/handling grants, lifecycle and evidence |
| `/api/analytics` | Authorized aggregates/personal summary and read-only processing views |
| `/api/audit-logs` | Principal-only sanitized administrative/authentication audit browser |

The earlier phase sections list detailed resource endpoints. Unsupported backend routes return controlled JSON 404; unknown frontend routes return the authenticated user's dashboard (or login/first-login recovery), not another role's view.

### Final project-review demo

Use institution-approved review accounts in a separately configured demonstration database where appropriate. The project does not automatically populate development data. Explicitly seed only the Principal; manually provision other records through the UI.

1. Principal login/first-login password change: profile, Department and HOD management.
2. HOD login: provision Faculty/Student, Subject, Class and Faculty Assignment; show department boundaries.
3. Faculty login: inspect assignments, create a draft questionnaire, demonstrate add/edit/reorder/Undo/Redo, save and publish.
4. Student login: notification, eligible questionnaire, Anonymous/Named choice, final submission and completed history.
5. Submit General Feedback and a Private Suggestion; demonstrate recipient/HOD visibility and Principal aggregate-only/no-Suggestion access.
6. Raise an Anonymous Faculty Issue with permitted evidence; demonstrate moderation rejection and clean revision.
7. Faculty acknowledges/starts progress; Student requests escalation; Faculty escalates to HOD; show prior-handler read-only access and the safe linked timeline.
8. Resolve/close through the allowed authorities/Student. Demonstrate Against-Faculty and Against-HOD exclusions and direct Safety/Urgent routing/disclaimer.
9. Show additional unresolved authorized cases in FIFO and heap Priority processing, oldest ties and literal search; ordering never mutates status.
10. Open each role's analytics/personal summary, date filters, numeric distributions and zero periods; demonstrate private-data exclusions.
11. Principal opens Audit Logs, filters administrative/authentication operations and paginates; show masked Student actors and excluded Complaint/private-content records.
12. Review notifications, profile/password/revocation and logout; repeat critical screens at 320px.

### Testing, safety and known limitations

Actual validation commands are `npm run check:backend`, `npm run test:backend`, `npm run test:frontend`, `npm run build:frontend`, `npm run test:browser` and `git diff --check`. New backend tests/browser scripts are syntax-checked explicitly; `tests/dsa.test.js` retains all 23 DSA cases. `npm audit` audits the shared backend/frontend dependency tree. All database fixtures require guarded unique `campusvoice_test_*` databases; evidence directories are isolated and removed even after failures. Screenshots, audit reports, test logs and fingerprint manifests are intentional ignored verification artifacts, not orphan evidence.

Full integration includes all four roles at 1440/1024/768/375/320px and critical 1440/320px session, message, complaint, Analytics/DSA and Audit workflows. Before/after read-only development fingerprints verify record counts and SHA-256 hashes. If acknowledged real user activity changes the baseline, retain the original manifests and perform another controlled full verification; do not overwrite user data to make hashes match.

Real limitations remain: notifications are in-app; no email/SMS, AI, public registration or report exports; no automatic complaint escalation/emergency response; recipient rather than database anonymity; evidence content may voluntarily identify its author; no antivirus/content redaction; current eligibility can make historical participation exceed 100%; processing views are bounded; inactive/transferred designated handlers are not silently reassigned. Audit is application-level, not retroactive or cryptographically tamper-proof, and unconfirmed outcomes require review. Production TLS/hosting/DB access/backup and retention operations remain deployment responsibilities. No additional development phase is introduced.


## Frontend design and responsive styling

CampusVoice uses one navy/blue academic design system across Principal, HOD, Faculty and Student workspaces, with system fonts, Bootstrap 5 grids/controls and Bootstrap Icons. No additional UI framework, external font or image dependency is required.

Styles live in `frontend/src/styles/`: `variables.css` owns tokens; `index.css` contains only base/global styles; `layout.css`, `components.css`, `forms.css`, `tables.css` and `responsive.css` provide shared presentation. Dedicated `auth`, `dashboard`, `profile`, `academic`, `feedback`, `messages`, `complaints`, `analytics`, `notifications` and `audit` stylesheets are imported by their owning page families. Bootstrap is imported once in `main.jsx`. Page styling is not collected in a giant `index.css`.

Desktop content has bounded widths; tablet/mobile navigation becomes a keyboard-accessible drawer. At 320px, forms/cards stack, academic tables retain their columns inside labelled scroll regions, and audit rows become labelled cards. Selected identity/rating controls, visible focus and reduced-motion overrides preserve accessible interaction. Dashboard values still come from the API; no fake production data was added.

See [the complete UI route and visual-review inventory](docs/UI_REVIEW.md) for all 44 rendered-page patterns, shared states, stylesheet ownership and the isolated screenshot utility. The styling pass verifies presentation and focused frontend behavior; the Team Lead's dedicated full functional regression stage remains separate.

### Navigation and motion

The sidebar keeps its brand and bottom information fixed while only the menu
scrolls, using a thin visible scrollbar. In the HOD menu, Classes appears before
Students so cohort setup precedes Student entry. Every workspace page includes
a responsive CampusVoice footer, positioned at the bottom on short pages.

Shared `motion.css`, imported once in `main.jsx`, adds brief entrances for page
headings, login panels, panels/cards, empty states and dialogs, plus fades for
alerts and the mobile-menu backdrop. Buttons, dashboard cards/shortcuts and
sidebar icons have subtle interaction effects; hover movement applies only to
devices with a fine pointer and hover support. Entrances take 160–240 ms and do
not delay actions or data loading. Motion is enabled only when
`prefers-reduced-motion: no-preference`; global reduced-motion overrides also
cover existing transitions. No animation dependency was added.

The motion update was checked with the production build, 50 focused navigation
and authentication tests, and a mobile browser check confirming normal/reduced
motion behavior and no horizontal page overflow.


Complaint attachments also support MP4/WebM videos within the same 3-file, 5 MB-per-file limits. Separate picker selections accumulate; files can be removed before submission. Video extension/MIME/container headers are checked. WebM requires its EBML DocType; MP4 requires an appropriate file-type brand. This is not full media decoding, malware scanning or metadata redaction. Videos use the same private, authorized download path as other evidence.

### HOD-managed Student batches and sections

In **Classes > Add Class Group**, the HOD defines the admission batch and section
(A, B, C, etc.) for their department. Repeat for the required sections. **Students
> Add Student** and **Edit Student** then show Admission batch and Section as
dropdowns populated from active department class groups. The form provides a
management link that opens in another tab and a refresh button so new options
can be loaded without losing entered Student details. Existing Student values
remain available while editing, including older/inactive cohorts. No batches or
sections are automatically seeded.

Faculty Assignment creation also uses an Academic year dropdown populated from
active department classes. Choose the year before the class group; changing it
clears the previous class selection and loads only matching classes. Academic
year filters in Classes/Faculty Assignments/My Assignments and section filters
in Classes/Students are dropdowns backed by actual authorized records, including
retained history. `GET /api/academic/options` returns only distinct permitted
year/section labels; HOD department and Faculty ownership boundaries are enforced.
Class creation keeps text inputs so the HOD can define new academic years,
admission batches and sections.
