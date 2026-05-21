# Project Progress

## Phase 0 — Foundations (2026-05-21)

### Completed

- Initialized JavaScript-only Next.js **14.2.18** App Router project with React **18**, Tailwind **3.4.x**, Node **≥ 20** (`engines`, `.nvmrc`).
- Configured ESLint (`next/core-web-vitals` + Prettier) and Prettier with Tailwind plugin.
- Created full folder structure per spec (`app`, `components`, `lib`, `models`, `middleware`, `seed`, `tests`).
- Added **14 Mongoose models** (13 collections + `EmailGroup`) with `optimisticConcurrency`, field definitions, and indexes.
- Implemented integration stubs: `mongodb`, `sapServiceLayer`, `sapHana`, `s3`, `email`, `auth`, `health`, `errors`, `approvalEngine`, `numbering`.
- Implemented `GET /api/health` (Admin-only via `admin.settings` permission) with probes for mongo, sap, hana, s3, smtp.
- Built `npm run seed` for roles, approval matrix, email groups, and first admin user (refuses non-empty DB).
- Added Vitest unit tests for errors, health, auth, numbering, and seed data definitions.
- Added `.env.local.example`, `README.md`.

### Tests run

| Command | Result |
|---------|--------|
| `npm run lint` | Pass — no ESLint warnings or errors |
| `npm test` | Pass — 12 tests, 5 files |

### Commit

- Message: `phase-0: foundations`

### Pending / review notes

- Phase 1 not started (auth UI, layout, Framer Motion components).
- `/api/health` requires a valid JWT session cookie and `admin.settings` permission; run `npm run seed` on a fresh MongoDB first.
- Live health probes need real env values in `.env.local` (SAP SL, HANA ODBC, S3, SMTP).
- SAP mapper files exist as stubs and throw until Phase 3+.
- `odbc` native module requires self-hosted Node (not Edge/Vercel).

---

## Phase 1 — Project Scaffold & Auth (2026-05-21)

### Completed

- Extended integration clients: SAP Service Layer (`request`, CRUD stubs, 401 retry), SAP HANA (`searchItems`, `getItemDetail`), S3 (pre-signed URLs, key builder), email (`sendEmail` + `email_logs`).
- Completed JWT auth: `signToken`, `verifyToken`, `withAuth`, httpOnly `portal_session` cookie helpers.
- Login rate limit (5 / 15 min per IP + username) and account lockout (10 failures → 30 min).
- Auth APIs: `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me` with Zod validation and standard envelopes.
- `/login` page; middleware + `(portal)` layout redirect unauthenticated users.
- Sidebar navigation filtered by permissions; placeholder pages for future phases.
- Framer Motion + animated components: `AnimatedPageWrapper`, `AnimatedModal`, `AnimatedDrawer`, `AnimatedStatusBadge`, `AnimatedSkeletonLoader`, `useMotionSafe`.
- Zustand auth store; `HealthCheckPanel` on dashboard and `/settings/sap-integration` (Admin: `admin.settings`) to call `GET /api/health` after login.

### Tests run

| Command | Result |
|---------|--------|
| `npm run lint` | Pass |
| `npm test` | Pass — 22 tests, 9 files |
| `npm run build` | Pass |

### Commit

- Message: `phase-1: auth scaffold`

### Pending / review notes

- Phase 2 not started (users, roles, approval matrix CRUD).
- Health probes still require real SAP/HANA/S3/SMTP env; UI shows per-dependency status when run.
- Seed admin then sign in → Dashboard or Settings → SAP Integration → **Run health check**.

---

## Env documentation (2026-05-21)

### Files changed

- `.env.local.example` — reorganized with grouped comments and placeholders for all required variables
- `.gitignore` — explicit `.env.local` entry (also covered by `.env*.local`)
- `PROJECT_PROGRESS.md` — this entry

### Environment variables confirmed

| Group | Variables |
|-------|-----------|
| App / Runtime | `NODE_ENV` (auto), `PORT`, `NEXT_PUBLIC_APP_URL` (optional, documented) |
| MongoDB | `MONGODB_URI` |
| Auth / JWT | `JWT_SECRET`, `JWT_EXPIRES_IN` |
| First-run seed | `SEED_ADMIN_USERNAME`, `SEED_ADMIN_PASSWORD` |
| SAP Service Layer | `SAP_SL_BASE_URL`, `SAP_SL_USERNAME`, `SAP_SL_PASSWORD`, `SAP_SL_COMPANY_DB` |
| SAP HANA ODBC | `HANA_CONNECTION_STRING` (+ `HANA_DSN` noted in spec, not used in code yet) |
| AWS S3 | `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_S3_BUCKET` |
| SMTP / Email | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM` |

All `process.env.*` references in application code (`lib/`, `seed/`) are covered. `NODE_ENV` is used in `lib/auth.js` for cookie `Secure` flag (set by Next.js).

### Tests run

| Command | Result |
|---------|--------|
| `npm run lint` | Pass |
| `npm test` | Pass — 22 tests |

---

## Phase 2 — Users, Roles & Approval Matrix (2026-05-21)

### Completed

- **Users API** (`admin.users`): `GET/POST /api/users`, `PUT/DELETE /api/users/[id]` — DELETE deactivates (`isActive: false`).
- **Roles API** (`admin.roles`): `GET/POST /api/roles`, `PUT/DELETE /api/roles/[id]` — delete blocked when role assigned to users (409).
- **Approval Matrix API** (`admin.approval_matrix`): `GET/POST /api/approval-matrix`, `PUT /api/approval-matrix/[id]`.
- Zod validators: `lib/validators/user.js`, `role.js`, `approvalMatrix.js`.
- Services: `lib/usersService.js`, `lib/rolesService.js`, `lib/approvalMatrixService.js`.
- Settings pages: `/settings/users`, `/settings/roles`, `/settings/approval-matrix` with list/create/edit UI.
- Passwords hashed with bcrypt (cost 12); `passwordHash` never returned to client.
- Optimistic concurrency via optional `__v` on PUT.
- Central permission list: `lib/permissions.js` (seed re-exports).

### Tests run

| Command | Result |
|---------|--------|
| `npm run lint` | Pass |
| `npm test` | Pass — 37 tests, 14 files |
| `npm run build` | Pass |

### Commit

- Message: `phase-2: users roles approval matrix`

### Pending / review notes

- Phase 3 not started (purchase requests).
- User extra `permissions[]` on model supported in API but not exposed in UI (role-only assignment in forms).
- Approval matrix step reordering is manual via `stepOrder` field (no drag-and-drop).

---

## Fix — Login page visibility (2026-05-21)

### Root cause

`AnimatedPageWrapper` used Framer Motion `initial: { opacity: 0 }`, which SSR/hydration could leave the login card invisible (white page; form still validated).

### Files changed

- `app/login/LoginForm.jsx` — removed motion wrapper; explicit contrast (slate-100 page, white card, dark text, bordered inputs, indigo button)
- `app/login/page.js` — static CSS loading fallback (no skeleton motion)
- `components/ui/AnimatedPageWrapper.jsx` — render visible static wrapper until client-mounted
- `app/globals.css` — base body/input text and background colors
- `tailwind.config.js` — include `stores/**` in content paths

### Tests run

| Command | Result |
|---------|--------|
| `npm run lint` | Pass |
| `npm test` | Pass — 37 tests |
| `npm run build` | Pass |

### Commit

- Message: `fix: make login page visible`

---

## Fix — ESM import extensions for seed (2026-05-21)

### Root cause

`npm run seed` runs `node seed/index.js` directly. Node ESM requires explicit `.js` on relative imports. Models imported `./schemaOptions` without extension → `ERR_MODULE_NOT_FOUND`.

### Files changed

- All 14 `models/*.js` — `./schemaOptions` → `./schemaOptions.js`
- `lib/validators/auth.js`, `user.js`, `approvalMatrix.js` — `./common` → `./common.js`

### Commands run

| Command | Result |
|---------|--------|
| `npm run seed` | **Pass** (module load) — fails only if `MONGODB_URI` missing or MongoDB unreachable |
| `npm run lint` | Pass |
| `npm test` | Pass — 37 tests |
| `npm run build` | Pass |

### Commit

- Message: `fix: add esm import extensions for seed runtime`

### Note for server

Ensure `.env.local` defines `MONGODB_URI`, `SEED_ADMIN_USERNAME`, and `SEED_ADMIN_PASSWORD` before seeding.

---

## Fix — MongoDB seed connection diagnostics (2026-05-21)

### Changes

- `lib/mongodbUri.js` — URI validation, typo fix (`mmongodb` → `mongodb`), safe host summary, actionable error hints (SRV / timeout / auth / IP whitelist)
- `lib/mongodb.js` — shared `connectMongo()` / `disconnectMongo()`, driver timeouts; no `url.parse` in project code
- `lib/loadEnvLocal.js` — shared env loader for seed and scripts
- `scripts/check-mongodb.js` + `npm run db:check` — connectivity test (scheme/hosts only, no password)
- `seed/index.js` — uses shared connect + enriched errors
- `.env.local.example` — Atlas SRV + non-SRV formats, Atlas checklist, Node 20 note
- `.nvmrc` / `engines` — Node 20 LTS recommended (`>=20 <25`)
- `tests/unit/mongodbUri.test.js` — 9 tests

### Commands run

| Command | Result |
|---------|--------|
| `npm run lint` | Pass |
| `npm test` | Pass — 46 tests |
| `npm run build` | Pass |

### Commit

- Message: `fix: improve mongodb seed connection diagnostics`

### Server next steps

1. Install **Node.js 20 LTS** (replace Node 24 if possible).
2. Atlas **Network Access** → add server public IP.
3. Run `npm run db:check` — if SRV fails, use non-SRV URI from Atlas Connect.
4. Fresh DB → `npm run seed`.

---

## Fix — Mongoose model registration for login (2026-05-21)

### Root cause

Login called `User.populate('role')` but `Role` was not registered in the Next.js API route bundle (only `User` was imported).

### Files changed

- `models/index.js` — central registration for all 14 models
- `lib/mongodb.js`, `lib/authLogin.js`, `lib/auth.js`, `lib/usersService.js`, `lib/approvalMatrixService.js`, `lib/approvalEngine.js`, `lib/rolesService.js`, `lib/email.js`, `lib/numbering.js`
- `app/api/auth/login/route.js` — generic client error; server-side `console.error` only
- `tests/unit/modelsRegister.test.js`

### Commands run

| Command | Result |
|---------|--------|
| `npm run lint` | Pass |
| `npm test` | Pass — 47 tests |
| `npm run build` | Pass |

### Commit

- Message: `fix: register mongoose models for populated refs`

### Login

Seeded admin login should work after deploy when MongoDB is connected and seed has run (`SEED_ADMIN_USERNAME` / `SEED_ADMIN_PASSWORD` from `.env.local`).

---

## Phase 3 — Purchase Request Module (2026-05-21)

### Scope delivered

- **PR APIs:** list, create, get, update, submit, approve, reject, create-sap-pr, retry-sap, approved-for-po, comments
- **SAP items:** HANA search/detail (`validFor = 'Y'`, case-insensitive), Service Layer create with `item_creation_logs`
- **Attachments:** pre-signed PUT (`sign-upload`) + metadata persistence (S3 keys only in MongoDB)
- **Approval flow:** driven by `approval_matrix` (no hardcoded steps); permission check per step; `approval_history` on submit/approve/reject/SAP events
- **SAP PR creation:** on final approval via `lib/sap/prSap.js`; duplicate guard on `sapPRDocEntry`; ODBC/SL errors sanitized for clients
- **Email notifications:** `pr.created`, `pr.whs.approved`, `pr.rejected`, `pr.sap.created`, `pr.sap.failed` via `email_groups`
- **UI:** `/purchase-requests` (tabs + filters), `/create`, `/[id]`, `/[id]/approve`, `/approved-for-po`; item search + Create New Item modal (`items.create`)

### Files changed / added

**Services & lib**

- `lib/purchaseRequestsService.js`, `lib/commentsService.js`, `lib/attachmentsService.js`, `lib/sapItems.js`, `lib/sap/prSap.js`
- `lib/approvalEngine.js`, `lib/auditHistory.js`, `lib/emailNotify.js`, `lib/dateUtils.js`, `lib/uploadClient.js`
- `lib/validators/purchaseRequest.js`, `lib/sap/mappers/prToSap.js`, `lib/apiHelpers.js`
- `models/PurchaseRequest.js` (list filter indexes)

**API routes**

- `app/api/purchase-requests/**`, `app/api/sap/items/**`, `app/api/attachments/**`

**UI**

- `components/purchase-requests/*`, `app/(portal)/purchase-requests/**`, `app/globals.css` (shared form/button/card classes)

**Config & tests**

- `.env.local.example` — `SAP_PR_REQ_TYPE`, `SAP_DEFAULT_BRANCH_ID`
- `tests/unit/validators/purchaseRequest.test.js`, `approvalEngine.test.js`, `prToSap.test.js`, `sapItems.test.js`, `purchaseRequestsApi.test.js`

### Commands run

| Command | Result |
|---------|--------|
| `npm run lint` | Pass |
| `npm test` | Pass — 60 tests |
| `npm run build` | Pass |

### Commit

- Message: `phase-3: purchase request module`

### Pending / review notes

- **SAP / HANA / S3 / SMTP** must be configured in `.env.local` for full E2E (item search, SAP PR create, attachments, emails).
- **Create New Item** button appears when user has `items.create` (manual trigger from line row; wire `noResultsLine` UX if desired).
- **Phase 4** not started (PO from PR, duplicate PO guard, etc.).
- Mongoose duplicate-index warnings on `portalPRNumber` (pre-existing pattern) — cosmetic at runtime.
