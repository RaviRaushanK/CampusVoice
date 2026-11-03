# CampusVoice

College Feedback, Survey and Grievance Management System built with the MERN stack.

The foundation includes authentication/RBAC, profile/account management, shared notifications, and college/academic management.

## Technology Stack

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

JWTs are never returned in JSON or saved to browser storage. Cookies expire with `JWT_EXPIRES_IN` (`s`, `m`, `h` or `d` suffix). Production always uses secure cookies and requires HTTPS. Set `COOKIE_SAME_SITE=none` only for a deployment that needs cross-site cookies, with `COOKIE_SECURE=true`; browser third-party-cookie policies may still restrict those cookies. Prefer a same-site frontend/API deployment.

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

Notification fixtures are created only in guarded, isolated test databases using mandatory `TEST_MONGODB_URI`; no development notifications are seeded. Browser coverage exercises the shared notification UI and existing auth/profile flows for all four roles at 1440, 1024, 768, 375 and 320 pixels. Complaint, Feedback, and other future modules should call the internal creation service when their own business events are implemented.

## Scope and next phase

Phase 1–5 authentication, profile, notification, shared-layout, health and academic behavior is retained. Phase 6 — Feedback & Survey System is complete: Faculty session building/publishing, Student participation, and privacy-safe Faculty results with question analytics. General feedback, suggestions, complaints, institution/department analytics and DSA features remain deferred.

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

Part 3 adds Faculty results and question analytics as described below. CSV export is optional and deferred. Advanced institution/department analytics, general feedback/moderation, Suggestions and Complaints remain later work.

## Phase 6 Part 3 — Faculty Results and Session Analytics

**Phase 6 — Feedback & Survey System: COMPLETE (Parts 1, 2 and 3).** Full backend, frontend and browser regression, privacy checks and development-database fingerprint verification passed. CSV export is optional and deferred; it does not block Phase 6 completion. Phase 7 has not started.

Faculty can open View Results for their own published sessions at `/my-sessions/:sessionId/results`. OPEN results are live and refresh manually; scheduled and closed/expired results remain readable. Draft results return a controlled conflict. Student, HOD and Principal roles cannot use Faculty results endpoints. The Faculty dashboard now counts real Draft/Open/Scheduled/Closed sessions using the same effective availability rules as participation. My Sessions links to Results without making an analytics request for every card.

`GET /api/feedback-sessions/:sessionId/results` returns explicit session metadata, summary totals, and question aggregates. Every results query first verifies Faculty ownership. The service streams one session-scoped response query using only identity mode and answers, accumulating bounded counters for the existing questionnaire; it does not send raw responses or short-answer text in the main payload. No Student identity lookup is used for aggregate results. Read endpoints never mutate session, response, or notification records.

**Response-rate semantics:** Eligible Students are the currently active STUDENT accounts matching the session's published Department/semester/normalized-section criteria and its batch when specified. The service reuses Part 2's recipient/eligibility filter; an unspecified class batch remains a wildcard. Class criteria stay frozen, but Student membership is current, including after closure. Historical submissions remain counted even if their Student later changes class or becomes inactive. Rate is total responses divided by current eligible Students × 100, rounded to two decimals; it may exceed 100% after membership changes. A zero denominator yields 0%. Anonymous plus Named equals total responses.

Single Choice includes every configured option, including zeros, with count and percentage of valid answers to that question. Multi Select counts respondents selecting each option; percentages use respondents who answered that question and can sum above 100%. Rating returns numeric average (null with zero answers) and the full 1–5 distribution; the UI displays averages to two decimal places. All question types expose answered/skipped counts, whose sum equals the session response count. Optional skipped short answers do not create empty cards.

Short answers load on demand through `GET /api/feedback-sessions/:sessionId/results/questions/:questionId/responses?page=1&limit=20` (maximum limit 100). It accepts only an owned published session and its own SHORT_ANSWER question. Anonymous items contain only `identityMode` and `text`; the database projection removes anonymous Student references before application mapping. Named items add only `identity: { name, userCode }`, with a safe null identity if that account is unavailable. Only named IDs on the current page are batch-loaded. No Student/response IDs, timestamps, email, security fields, or stable Anonymous-number labels are returned. Text ordering is question-specific with internal tie-breaking; no correlation key is exposed across questions. User-entered text is rendered as text, without HTML injection.

The Results page uses shared loading/alert/stat/layout components, question cards, responsive CSS bar charts with adjacent readable counts/percentages, paginated text cards, empty states, retries, and manual Refresh. Charts add no dependencies and never replace numeric data. There is no automatic analytics polling, anonymous-identity reveal endpoint, generic raw-response listing, CSV export, AI analysis or cross-Faculty analytics. Backend HTTP tests inspect complete responses for anonymous identity leakage; frontend and isolated browser tests cover both Anonymous and Named display.

Part 1/2 body limits, notifications, response finality, uniqueness, identity lock, eligibility and availability behavior are retained. The 2 MB JSON allowance remains limited to Feedback resources; other JSON and all URL-encoded requests remain at 16 KB. Tests use guarded isolated databases, with read-only development fingerprints before/after verification. General Feedback, Private Suggestions, moderation, Complaints/routing, HOD/Principal analytics, DSA and AI analysis remain outside this implementation.
