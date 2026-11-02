# CampusVoice

College Feedback, Survey and Grievance Management System built with the MERN stack.

Phase 2 adds authentication, first-login password changes, role-based access control and protected dashboards to the existing Phase 1 foundation.

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

Notifications are generated internally by backend modules through `services/notificationService.createNotification({ recipient, type, title, message, relatedResourceType, relatedResourceId })`. Creation validates an existing User recipient, a controlled type, and trimmed nonempty title/message (maximum 160/2000 characters). There is no public creation, deletion, or content-editing endpoint. No business module generates notifications yet.

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

Phase 1 architecture, shared components, health endpoint and four dashboard layouts are retained. Department/HOD creation, faculty/student management, subjects, assignments, feedback, suggestions, complaints/routing/escalation, analytics and DSA features are not implemented.

Phase 4 provides shared notification infrastructure and UI. Later module integrations remain outside this phase.
