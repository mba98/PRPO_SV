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

---

## Phase 4 — PO creation from approved PR (2026-05-21)

### Scope delivered

- **Entry page:** `/purchase-requests/approved-for-po` — lists PRs ready for PO (SAP PR exists, remaining line qty / pending vendors)
- **API:** `POST /api/purchase-orders/from-pr/[prId]` (body: `vendor`), `POST .../retry`
- **SAP PO:** Service Layer `/PurchaseOrders` with PR base document (`BaseType` / `BaseEntry` / `BaseLine` from `sapResponse`)
- **Duplicate guard:** per `relatedPRId` + `vendor` when `sapPODocEntry` already set on portal PO
- **PR fields:** `sapPODocEntry`, `sapPODocNum`, `sapPOCreationStatus`, `sapPOErrorMessage`, `relatedPortalPONumber`; status → `Partially Ordered` / `Fully Ordered`
- **Portal PO record:** `PurchaseOrder` with link to PR; `approval_history` + `sap_integration_logs` + emails `po.sap.created` / `po.sap.failed`

### Key files

- `lib/sap/poFromPrSap.js`, `lib/sap/mappers/poToSap.js`, `lib/purchaseOrdersService.js`, `lib/prPoReadiness.js`
- `app/api/purchase-orders/from-pr/[prId]/route.js`, `.../retry/route.js`
- `components/purchase-requests/ApprovedForPoManager.jsx`
- `models/PurchaseRequest.js`, `models/PurchaseOrder.js`
- Tests: `poToSap.test.js`, `prPoReadiness.test.js`, `poFromPrFlow.test.js`

### Env

- `.env.local.example` — `SAP_PR_BASE_TYPE` (default `1470000113`)

### Commands run

| Command | Result |
|---------|--------|
| `npm run lint` | Pass |
| `npm test` | Pass — 71 tests |
| `npm run build` | Pass (from Phase 4 implementation run) |

### Commit

- Message: `phase-4: po creation from approved pr`

### Pending notes

- Full portal PO approval workflow (PM → Finance → SAP) is spec Phase 4B — not implemented; this phase creates SAP PO directly from approved PR page.
- Confirm `SAP_PR_BASE_TYPE` matches your SAP B1 version if base document errors occur.

---

## Phase 4B — PO approval workflow (2026-05-21)

### Scope delivered

- **Portal-first PO:** `/purchase-requests/approved-for-po` creates MongoDB PO with `Pending Project Manager Approval` (no immediate SAP)
- **Approval matrix (PO):** PM (`po.approve.pm`) → Finance (`po.approve.finance`); SAP only after final approval
- **Pages:** `/purchase-orders`, `/purchase-orders/[id]`, `/purchase-orders/[id]/approve`, `/purchase-orders/ready-for-ap-reserve-invoice`
- **APIs:** list, get, put, approve, reject, create-sap-po, retry-sap, from-pr, ready-for-ap-reserve-invoice
- **Emails:** `po.created`, `po.pm.approved`, `po.finance.approved`, `po.rejected`, `po.sap.created`, `po.sap.failed`
- **Guards:** duplicate portal PO per PR/vendor; duplicate SAP on `sapPODocEntry`
- **Admin SAP:** `POST .../create-sap-po` and `retry-sap` for manual retry (view.all / admin.settings)

### Key files

- `lib/approvalEngine.js` (PO status mapping), `lib/purchaseOrdersService.js`, `lib/sap/poFromPrSap.js`, `lib/sap/poSap.js`
- `lib/sap/mappers/poToSap.js` (`mapPoToSapFromPortalRecord`)
- `app/api/purchase-orders/**`, `components/purchase-orders/**`, `app/(portal)/purchase-orders/**`
- Tests: `poApproval.test.js`, `poFromPrFlow.test.js`, `poSap.test.js`, `validators/purchaseOrder.test.js`

### Commands run

| Command | Result |
|---------|--------|
| `npm run lint` | Pass |
| `npm test` | Pass — 80 tests |
| `npm run build` | Pass |

### Commit

- Message: `phase-4b: po approval workflow`

### Phase 4 alignment

Phase 4 (4A + 4B) is now aligned with the spec: portal PO from approved PR, matrix-driven approval, SAP PO after finance approval, list/detail/approve pages, and duplicate guards.

---

## Phase 5 — A/P Reserve Invoice module (2026-05-21)

### Scope delivered

- **APRI from PO:** `POST /api/ap-reserve-invoices/from-po/[poId]` — only POs with status `Created in SAP` and `sapPODocEntry`; duplicate guard per PO; copies header/lines with SAP PO `LineNum` base refs; immediate SAP `/PurchaseInvoices` with `ReserveInvoice: 'tYES'`, `BaseType: 22`
- **APRI APIs:** list, get detail, retry SAP (`admin.settings` / `view.all`)
- **SAP:** `lib/sap/mappers/apReserveInvoiceToSap.js`, `lib/sap/apriSap.js` — integration logs, approval history, sanitized API errors
- **Emails:** `apri.sap.created` (Finance, WHS, Procurement), `apri.sap.failed` (Admin) via EmailGroup override
- **Pages:** `/ap-reserve-invoices`, `/ap-reserve-invoices/[id]`; `/purchase-orders/ready-for-ap-reserve-invoice` with Create APRI action (excludes POs that already have an APRI)
- **Validators:** `lib/validators/apReserveInvoice.js`
- **Indexes:** `status` + `createdAt`, `vendor` on `APReserveInvoice`

### Key files

- `lib/apReserveInvoicesService.js`, `lib/poApriReadiness.js`
- `lib/sap/mappers/apReserveInvoiceToSap.js`, `lib/sap/apriSap.js`
- `app/api/ap-reserve-invoices/**`
- `components/ap-reserve-invoices/ApriListManager.jsx`, `ApriDetailView.jsx`
- `app/(portal)/ap-reserve-invoices/**`, updated `ready-for-ap-reserve-invoice/page.js`
- Tests: `apReserveInvoiceToSap.test.js`, `poApriReadiness.test.js`, `apriDuplicateGuard.test.js`, `validators/apReserveInvoice.test.js`

### Env

- No new environment variables (reuses existing SAP Service Layer config).

### Commands run

| Command | Result |
|---------|--------|
| `npm run lint` | Pass |
| `npm test` | Pass — 95 tests |
| `npm run build` | Pass |

### Commit

- Message: `phase-5: ap reserve invoice module`

### Pending notes

- Phase 6 (attachments UI on APRI detail) not started.
- Failed APRI must be retried via `/ap-reserve-invoices/[id]` (not a second `from-po` call).
- SAP PO `sapResponse.DocumentLines` must include `LineNum` for each item before APRI creation succeeds.

---

## Fix — SAP lookup dropdowns for PR master data (2026-05-21)

### Scope delivered

- **HANA item search:** `OITM` + `OITB` join with quoted schema (`SAP_SL_COMPANY_DB` / `HANA_SCHEMA`); parameterized `%query%`; normalized fields (`itemCode`, `itemName`, `uom`, `purchaseUom`, `inventoryUom`, `itemGroupCode`, `itemGroupName`); friendly API errors (no raw ODBC text)
- **Lookup APIs:** `GET /api/sap/vendors`, `/warehouses`, `/projects`, `/cost-centers` (Service Layer + 5‑min cache); `GET /api/lookups/departments` (branch_map keys + active user departments)
- **PR create UI:** searchable dropdowns for item, vendor, warehouse, project, cost center, department; UoM/item name/item group read-only from SAP item; header defaults propagate to new lines
- **Components:** `components/lookups/*` (`SapLookupCombobox`, `ItemSearchInput`, `VendorSelect`, etc.)

### Key files

- `lib/sap/hanaSql.js`, `lib/sapHana.js`, `lib/sapItems.js`, `lib/sapLookups.js`, `lib/sapLookupCache.js`, `lib/sapLookupApi.js`, `lib/lookups/departments.js`
- `app/api/sap/**`, `app/api/lookups/departments/route.js`
- `components/purchase-requests/PrCreateForm.jsx`, `components/lookups/**`
- Tests: `sapHanaSql.test.js`, `sapLookups.test.js`, `sapLookupApi.test.js`, `validators/sapLookup.test.js`, updated `sapItems.test.js`

### Env

- `.env.local.example` — optional `HANA_SCHEMA`, `HANA_SQL_LIMIT_STYLE` (`limit` | `fetch`)

### Commands run

| Command | Result |
|---------|--------|
| `npm run lint` | Pass |
| `npm test` | Pass — 106 tests |
| `npm run build` | Pass |

### Commit

- Message: `fix: add sap lookup dropdowns for pr master data`

### Pending notes

- If item search still fails on your HANA build, set `HANA_SQL_LIMIT_STYLE=fetch` in `.env.local`.
- Populate `system_settings.branch_map` in MongoDB for department list + SAP branch resolution.

---

## Fix — SAP warehouse lookup errors (2026-05-22)

### Root cause

`GET /api/sap/warehouses` returned `{ success: false, error: "SAP_LOOKUP_FAILED" }`. Two distinct bugs:

1. **TLS (primary):** the SAP B1 Service Layer (`https://<host>:50000/b1s/v1`) is published on the internal HANA host with a **self-signed certificate**. Node's global `fetch` rejected it (`DEPTH_ZERO_SELF_SIGNED_CERT`), so `login()` threw a generic `fetch failed` that the error mapper bucketed as `SAP_LOOKUP_FAILED` — masking a connection problem as a lookup problem.
2. **Field mapping (secondary):** `mapWarehouseRow` read `WhsCode`/`WhsName` (HANA `OWHS` columns), but the Service Layer `/Warehouses` endpoint returns `WarehouseCode`/`WarehouseName`. Even a successful call would have normalized to empty rows.

### Changes

- **`lib/sapServiceLayer.js`** — rewrote the transport from `fetch` to `node:https`/`node:http` so TLS is controllable per-connection:
  - `SAP_SL_CA_CERT` (preferred — pin the cert, keep verification on) or `SAP_SL_INSECURE_TLS=true` (internal/dev only; scoped to the SAP SL agent, not global).
  - Login/connection failures now throw an error tagged `code: 'SAP_LOGIN_FAILED'` (with HTTP status when available).
  - Collects **all** Set-Cookie values (`B1SESSION` + `ROUTEID`) for load-balanced setups.
  - Added opt-in safe debug logging (`SAP_DEBUG=true`): host, company DB, endpoint, HTTP status only — never password, cookie, or session id.
- **`lib/sapLookups.js`** — `mapWarehouseRow` now reads `WarehouseCode`/`WarehouseName` with `WhsCode`/`WhsName` fallback. `slRows` already unwraps both `{ value: [...] }` and a direct array.
- **`lib/sapLookupApi.js`** — maps `SAP_LOGIN_FAILED` → `{ success: false, message: "Failed to connect to SAP Service Layer", error: "SAP_LOGIN_FAILED" }`; authenticated lookup errors still map to `SAP_LOOKUP_FAILED`. Real technical error logged server-side only.
- **`.env.local.example`** — documented that SAP Service Layer vars are **required** for vendors, warehouses, projects, and cost centers; added `SAP_SL_CA_CERT`, `SAP_SL_INSECURE_TLS`, `SAP_DEBUG`.
- **`.env.local`** (server, gitignored) — set `SAP_SL_INSECURE_TLS=true` for the internal self-signed host.
- Tests: `tests/unit/sapLookups.test.js` (Service Layer + HANA field mapping, `value`/array unwrap, no-match → `[]`, cache reuse) and `tests/unit/sapLookupApi.test.js` (login vs lookup error mapping, no secret leakage).

### Verification (live SAP `SV_DEMO_19052026`)

- `POST /Login` → 200 with `SAP_SL_INSECURE_TLS=true`; cookies `B1SESSION`, `ROUTEID`.
- `GET /Warehouses` → 200; 6 warehouses normalized to `{ warehouseCode, warehouseName }`.
- `?query=` (no match) → `{ success: true, data: [] }`.

### Commands run

| Command | Result |
|---------|--------|
| `npm run lint` | Pass — no ESLint warnings or errors |
| `npm test` | Pass — 116 tests, 35 files |
| `npm run build` | Pass |

### Commit

- Message: `fix: handle sap warehouse lookup errors`

### Server next steps

- Preferred over `SAP_SL_INSECURE_TLS`: export the SAP SL certificate and set `SAP_SL_CA_CERT=/path/to/cert.pem` to keep TLS verification on.
- Set `SAP_DEBUG=true` temporarily if a lookup still fails — logs host/DB/endpoint/status with no secrets.

## Bugfix — portal numbering counter MongoDB path conflict (pre–Phase 6)

### Problem

Creating a Purchase Request failed with: `Updating the path 'value.seq' would create a conflict at 'value'` — caused by `$setOnInsert: { value: { seq: 0 } }` and `$inc: { 'value.seq': 1 }` in the same update.

### Changes

- **`lib/numbering.js`** — Store counter sequence in top-level `seq`; atomic `$inc: { seq: 1 }`; legacy `value.seq` migration via `updateOne` before increment; read fallback `doc.seq ?? doc.value?.seq`.
- **`models/SystemSettings.js`** — Added optional `type` and `seq` fields; kept `value` for non-counter settings (e.g. `branch_map`).
- **`tests/unit/numbering.test.js`** — Updated mocks for top-level `seq`; added legacy migration and fallback tests.

### Commands run

| Command | Result |
|---------|--------|
| `npm run lint` | Pass — no ESLint warnings or errors |
| `npm test` | Pass — 118 tests, 35 files |

### Commit

- Message: `fix: resolve numbering counter update conflict`

## Default test users seed (pre–Phase 6)

### Completed

- **`seed/users.js`** — Six default test users (Admin, Requester, WHS Approver, Project Manager, Finance, Procurement); bcrypt cost 12; upsert by username/email; production guard (`ALLOW_DEFAULT_TEST_USERS=true`); `npm run seed:users` for non-empty dev DBs.
- **`seed/index.js`** — Calls `seedDefaultUsers` after admin seed (skips username already created by `SEED_ADMIN_USERNAME`).
- **`seed/roles.js`** — Aligned PM, Finance, and Procurement permissions with plan for E2E workflow testing.
- **`package.json`** — Added `seed:users` script.
- **`tests/unit/seed-data.test.js`** — Role permission and default user definition tests.

### Commands run

| Command | Result |
|---------|--------|
| `npm run lint` | Pass |
| `npm test` | Pass — 119 tests, 35 files |

### Local testing

- Fresh DB: `npm run seed` (requires `SEED_ADMIN_USERNAME` / `SEED_ADMIN_PASSWORD`).
- Existing dev DB: `npm run seed:users`.

### Login usernames

`admin`, `requester`, `whs.approver`, `project.manager`, `finance`, `procurement` (passwords in task spec / `SEED_ADMIN_PASSWORD` for admin).

## Fix — SAP PR ODBC -2028 (invalid Requester / reference codes)

### Root cause

Service Layer POST `/PurchaseRequests` failed with `No matching records found (ODBC -2028)` because `mapPrToSap` fell back to `String(pr.requester)` when `requesterEmail` was absent — sending a **MongoDB ObjectId** as SAP `Requester`. SAP validates master data internally (ODBC), even though creation uses Service Layer, not portal HANA ODBC.

### Changes

- **`lib/sap/mappers/prToSap.js`** — Resolve `Requester` from `user.sapRequesterCode` or `system_settings.sap_default_requester`; never ObjectId/email; pre-SAP validation; debug meta builder.
- **`lib/sap/prSap.js`** — Load requester user + settings; validate before SAP; log `{ sap, debug }` in `sap_integration_logs`; friendly API errors; raw ODBC kept in logs.
- **`models/User.js`** — `sapRequesterCode` field.
- **`lib/usersService.js`**, **`lib/validators/user.js`**, **`app/api/purchase-requests/[id]/create-sap-pr/route.js`**, **`lib/apiHelpers.js`** — Support mapping + `SAP_VALIDATION` responses.
- **`tests/unit/prToSap.test.js`**, **`tests/unit/prSap.test.js`** — Mapper and service tests.

### Commands run

| Command | Result |
|---------|--------|
| `npm run lint` | Pass |
| `npm test` | Pass — 131 tests, 36 files |

### Configure requester mapping

Set `sapRequesterCode` on portal users (Settings → Users) to the SAP employee code, or add MongoDB `system_settings` key `sap_default_requester` with value `"EMP001"` or `{ "code": "EMP001" }`.

## Fix — PM pending visibility, SAP retry requester, dynamic workflow stepper

### Root causes

1. **PM list empty** — Pending tab filtered by status only, not `currentApprovalStep` from `approval_matrix`. Some services also relied on `user.permissions` without merging role permissions defensively.
2. **SAP retry “admin” error** — Validation referred to the acting user when PR requester was not populated on load; retry must use **original PR requester** `sapRequesterCode`, with admin only as `actionBy` / `actionPerformedBy` in logs.

### Changes

- **`lib/effectivePermissions.js`** — `getEffectivePermissions`, `userHasEffectivePermission`.
- **`lib/auth.js`**, **`lib/approvalEngine.js`**, **`lib/purchaseRequestsService.js`** — Effective permissions + matrix-driven `buildPrPendingApprovalFilter` (`status` + `currentApprovalStep`).
- **`lib/workflowSteps.js`**, **`components/workflow/WorkflowStepper.jsx`**, **`PrDetailView.jsx`** — Dynamic approval + SAP steps for all users.
- **`lib/sap/prRequester.js`**, **`lib/sap/prSap.js`** — Populate PR requester; SAP payload uses PR requester mapping; `actionPerformedBy` in logs.
- Tests: `effectivePermissions`, `prPendingApproval`, `workflowSteps`, updated `prSap`, `approvalEngine`.

### Commands run

| Command | Result |
|---------|--------|
| `npm run lint` | Pass |
| `npm test` | Pass — 141 tests, 39 files |

## Fix — Failed SAP list visibility, retry button, requester SAP codes

### Root causes

1. **PR missing from list (project.manager)** — `approved` tab scoped post-approval PRs to `requester` only; approvers could open detail but not see failed SAP PRs in any tab.
2. **No Retry SAP for PM** — Button required `view.all` only; API already allowed `admin.settings` too.
3. **SAP error** — `requester` user has no `sapRequesterCode` in DB; seed did not set it from env.

### Changes

- **`lib/prPermissions.js`** — Post-approval statuses, `canRetrySapPurchaseRequest`, approver list rules.
- **`lib/purchaseRequestsService.js`** — `failed-sap` tab filter; approvers see all post-approval PRs; detail fields `canRetrySap`, `requesterMissingSapCode`.
- **`PrListManager.jsx`** — Post-approval / Failed SAP tabs; status dropdown with all PR statuses.
- **`PrDetailView.jsx`** — Retry for admin only + note for others; SAP failed panel.
- **`seed/users.js`** — `upsertSapRequesterCodes()` from `SAP_REQUESTER_CODE_REQUESTER` / `DEFAULT_SAP_REQUESTER_CODE`.

### Configure SAP requester (local)

Add to `.env.local` then run `npm run seed:users`:

```
SAP_REQUESTER_CODE_REQUESTER=YOUR_SAP_EMPLOYEE_CODE
# or
DEFAULT_SAP_REQUESTER_CODE=YOUR_SAP_EMPLOYEE_CODE
```

Optional: `FORCE_UPDATE_SAP_REQUESTER_CODES=true` to overwrite existing codes.

### Commands run

| Command | Result |
|---------|--------|
| `npm run lint` | Pass |
| `npm test` | Pass — 151 tests, 42 files |

## Fix — standalone Node seed (`seed:users`)

### Problem

`npm run seed:users` failed with `ERR_MODULE_NOT_FOUND` for `@/models` because `lib/mongodb.js` imported `@/models/index.js`, which only resolves under Next.js (not plain `node`).

### Change

- **`lib/mongodb.js`** — Removed `@/models/index.js` import. Model registration stays in each service via its own `import '@/models/index.js'` (unchanged for Next.js).

### Commands run

| Command | Result |
|---------|--------|
| `npm run seed:users` | Pass — connected and seeded users |
| `npm run lint` | Pass |
| `npm test` | Pass — 119 tests, 35 files |

## Fix — default SAP requester code `12` (dev)

### Problem

SAP PR create failed (ODBC -2028) when portal `requester` had no `sapRequesterCode` and env was not set.

### Changes

- **`lib/sap/sapRequesterConfig.js`** — `DEV_DEFAULT_SAP_REQUESTER_CODE = '12'`; `resolveDefaultSapRequesterCode()` (env overrides, then dev fallback outside production).
- **`seed/users.js`** — Uses shared resolver for create + `upsertSapRequesterCodes`.
- **`lib/sap/prSap.js`** — SAP settings fallback uses same default when `system_settings.sap_default_requester` is unset.
- **`tests/unit/sapRequesterConfig.test.js`**, **`tests/unit/prSap.test.js`** — Resolver + dev default `12` coverage.

### Commands run

| Command | Result |
|---------|--------|
| `npm run seed:users` | Pass — updated `requester` SAP code to `12` |
| `npm run lint` | Pass |
| `npm test` | Pass — 157 tests, 43 files |

## Fix — SAP ODBC -2028 diagnostics and retry without invalid cost center

### Root cause (PR-20260522-0002)

SAP payload had valid-looking codes but **cost center `Project`** on the line (not a SAP distribution rule code). Requester `12` was already set; failure was likely cost center and/or branch/item/warehouse in `SV_DEMO_19052026`.

### Changes

- **`lib/sap/mappers/prToSap.js`** — Numeric requester as integer; omit empty project/costing; `formatSapReferenceSummary()`; on **retry** after `Failed to Create in SAP`, omit `CostingCode` from lines.
- **`lib/sap/prSap.js`** — Error message lists values sent; hint when cost center is `Project`.
- **`lib/purchaseRequestsService.js`**, **`PrDetailView.jsx`** — Show `sapReferenceSummary` on failed PR detail.
- **`scripts/validateSapPrRefs.mjs`** — Local SAP reference check helper.

### Commands run

| Command | Result |
|---------|--------|
| `npm run lint` | Pass |
| `npm test` | Pass — 161 tests, 43 files |

## Fix — SAP PR defaults (ReqType 12, Requester 12, Branch -2, DocType items)

### Confirmed SAP GUI values

- Requester Type `ReqType`: 12 (User)
- Requester code: 12 (manager)
- Branch Main: `BPL_IDAssignedToInvoice` -2
- Department: General (`U_Department`)
- Item document: `DocType` `dDocument_Items`

### Changes

- **`lib/sap/mappers/prToSap.js`** — `DocType`, branch via `sapBranchConfig`, department via `sapDepartmentConfig`, string Requester `"12"`, omit invalid optional codes (incl. `Project` cost center), no Branch=1 fallback.
- **`lib/sap/sapBranchConfig.js`**, **`lib/sap/sapDepartmentConfig.js`** — Dev defaults -2 / General; production requires mapping.
- **`lib/sap/prSap.js`** — Loads `sap_department_map`; debug summary includes DocType.
- **`seed/settings.js`**, **`seed/users.js`**, **`seed/index.js`** — `branch_map` and `sap_department_map` upsert; `npm run seed:settings`.
- **`.env.local.example`** — `DEFAULT_SAP_REQUESTER_CODE=12`, `SAP_DEFAULT_BRANCH_ID=-2`, etc.
- **`tests/unit/prToSap.test.js`**, **`tests/unit/prSap.test.js`** — Default payload tests.

### Commands run

| Command | Result |
|---------|--------|
| `npm run lint` | Pass |
| `npm test` | Pass — 163 tests, 43 files |
| `npm run seed:settings` | Pass |

## Fix — SAP PR Postman-aligned payload (RequriedDate, manager, RAN004)

### Confirmed working Postman payload

- Header: `ReqType` 12, `Requester` `manager`, `RequriedDate` (SAP misspelling), `DocDate`, `DocDueDate`, `Comments`
- Lines: `ItemCode`, `LineVendor`, `Quantity`, `RequiredDate`, `WarehouseCode`, `UnitPrice`
- Does **not** send: `DocType`, `BPL_IDAssignedToInvoice`, `CostingCode`, `ProjectCode`, `U_Department`, header `ReqDate`/`RequiredDate`

### Changes

- **`lib/sap/mappers/prToSap.js`** — Postman-shaped mapper; debug summary with Vendor/Qty/UnitPrice.
- **`lib/sap/sapRequesterConfig.js`** — Dev default requester `manager`.
- **`lib/sap/sapWarehouseConfig.js`** — Dev default warehouse `RAN004`.
- **`lib/sap/prSap.js`** — Simplified settings load (requester only).
- **`PrCreateForm.jsx`** — Required/document/due dates; warehouse + vendor on lines.
- **`lib/validators/purchaseRequest.js`**, **`models/PurchaseRequest.js`**, **`purchaseRequestsService.js`**, **`PrDetailView.jsx`**
- **`.env.local.example`** — `DEFAULT_SAP_REQUESTER_CODE=manager`, `DEFAULT_SAP_WAREHOUSE_CODE=RAN004`
- **`lib/sap/mappers/poToSap.js`** — Import `resolveBranchId` from `sapBranchConfig`.

### Commands run

| Command | Result |
|---------|--------|
| `npm run lint` | Pass |
| `npm test` | Pass — 176 tests, 43 files |

## Fix — SAP PR Postman-aligned payload (RequriedDate, manager, RAN004)

### Confirmed working Postman payload

- Header: `ReqType` 12, `Requester` `manager`, `RequriedDate` (SAP misspelling), `DocDate`, `DocDueDate`, `Comments`
- Lines: `ItemCode`, `LineVendor`, `Quantity`, `RequiredDate`, `WarehouseCode`, `UnitPrice`
- Does **not** send: `DocType`, `BPL_IDAssignedToInvoice`, `CostingCode`, `ProjectCode`, `U_Department`, header `ReqDate`/`RequiredDate`

### Changes

- **`lib/sap/mappers/prToSap.js`** — Postman-shaped mapper; `formatSapReferenceSummary` with Vendor/Qty/UnitPrice.
- **`lib/sap/sapRequesterConfig.js`** — Dev default requester `manager`.
- **`lib/sap/sapWarehouseConfig.js`** — Dev default warehouse `RAN004`.
- **`lib/sap/prSap.js`** — Simplified settings load (requester only).
- **`PrCreateForm.jsx`** — Required/document/due dates; warehouse + vendor on lines; default `RAN004`.
- **`lib/validators/purchaseRequest.js`**, **`models/PurchaseRequest.js`**, **`purchaseRequestsService.js`**, **`PrDetailView.jsx`**
- **`.env.local.example`** — `DEFAULT_SAP_REQUESTER_CODE=manager`, `DEFAULT_SAP_WAREHOUSE_CODE=RAN004`
- **`lib/sap/mappers/poToSap.js`** — Import `resolveBranchId` from `sapBranchConfig` (fix re-export removal).

### Commands run

| Command | Result |
|---------|--------|
| `npm run lint` | Pass |
| `npm test` | Pass — 176 tests, 43 files |

---

## Fix — Purchase Orders visibility and Create PO from SAP PR (2026-05-23)

### Root cause

1. **Sidebar / client auth** used `user.permissions` only. When role permissions were not merged on the client (or MongoDB roles were seeded before PO permissions existed), the Purchase Orders nav was hidden even for Admin/Procurement.
2. **PO list** pending-tab filters did not use effective permissions or matrix-driven `currentApprovalStep` matching.
3. **No Create PO UI** on PR detail/list for `Created in SAP` PRs — only the separate approved-for-po page.

### Changes

- `lib/poPermissions.js`, effective permissions in `Sidebar`, `authStore`, `lib/navigation.js`
- `lib/purchaseOrdersService.js` — `buildPoPendingApprovalFilter`, procurement list visibility
- `lib/purchaseRequestsService.js` — `canCreatePo`, vendor/PO metadata on PR detail
- `lib/sap/poFromPrSap.js` — PR→PO mapping (SAP PR refs, dates, remarks, warehouse)
- `components/purchase-requests/CreatePoFromPrPanel.jsx`, `PrDetailView.jsx`, `PrListManager.jsx`, `PoListManager.jsx`
- `seed/users.js` — `syncDefaultRolePermissions()` on `npm run seed:users`

### Commands run

| Command | Result |
|---------|--------|
| `npm run lint` | Pass — no ESLint warnings or errors |
| `npm test` | Pass — 188 tests, 45 files |

### Local note

Run `npm run seed:users` on existing dev DBs to refresh role permission arrays from `seed/roles.js`.

---

## Enhancement — PR/PO UoMCode, PO DocRate, PO edit, PO workflow stepper (2026-05-23)

### Scope

- PR line `uomCode` → SAP `UoMCode` (optional, Postman PR payload unchanged otherwise)
- PO line `uomCode` + header `docRate` → SAP `UoMCode` / `DocRate`
- Full PO edit before SAP creation (`PoEditForm`, expanded PUT)
- PO dynamic workflow stepper: Created → approval_matrix → SAP Created
- `po.create` users can view/edit pending POs they created

### Commands run

| Command | Result |
|---------|--------|
| `npm run lint` | Pass — no ESLint warnings or errors |
| `npm test` | Pass — 208 tests, 47 files |

---

## Fix — Standalone SAP PO (no PR base document) (2026-05-23)

### Problem

Creating SAP PO with `BaseType` / `BaseEntry` / `BaseLine` from SAP PR caused exchange-rate and quantity errors. Standalone PO with `DocCurrency` + `DocRate` works.

### Solution

- Standalone `/PurchaseOrders` payload (no base document lines)
- After PO success: PATCH PR Comments (append), POST PR Close
- Non-fatal warnings if PR comment/close fails; PO is not rolled back
- Duplicate guard on `sapPODocEntry` unchanged

### Commands run

| Command | Result |
|---------|--------|
| `npm run lint` | Pass |
| `npm test` | Pass — 214 tests, 48 files |

---

## Fix — A/P Reserve Invoice Postman-aligned payload (2026-05-24)

### Problem

Portal APRI creation hit SAP error `(-180903) Please choose exchange rate 1350 when currency is Dollar.` because the mapper sent neither `DocCurrency` nor `DocRate` (nor `TaxDate`) and included extra line fields (`ItemCode`, `WarehouseCode`, `ProjectCode`, `CostingCode`) that SAP rejects when `BaseType: 22` PO references are used.

### Confirmed working Postman payload (`/PurchaseInvoices`)

```
{ CardCode, DocDate, DocDueDate, TaxDate, DocCurrency, DocRate,
  ReserveInvoice: "tYES", Comments,
  DocumentLines: [{ BaseType: 22, BaseEntry, BaseLine, Quantity }] }
```

### Changes

- **`lib/sap/mappers/apReserveInvoiceToSap.js`** — Postman-shaped payload: `CardCode`, `DocDate`, `DocDueDate`, `TaxDate`, `DocCurrency`, `DocRate`, `ReserveInvoice: 'tYES'`, `Comments`. Lines reduced to `BaseType: 22` / `BaseEntry` / `BaseLine` / `Quantity` only. Defaults resolved via `resolveDefaultPoDocCurrency` / `resolveDefaultPoDocRate` (USD / 1350 in dev).
- **`models/APReserveInvoice.js`** — Added `taxDate`, `docCurrency`, `docRate` fields.
- **`lib/apReserveInvoicesService.js`** — `createApriFromPo` copies `docCurrency` / `docRate` from PO (fallback to env defaults) and sets `taxDate = documentDate`. `sanitizeApri` exposes the new fields.
- **`lib/navigation.js`** — Added top-level nav item **POs Ready for APRI** → `/purchase-orders/ready-for-ap-reserve-invoice`, visible to `apinvoice.create` or `view.all`.
- **`tests/unit/apReserveInvoiceToSap.test.js`** — Full payload assertion (USD / 1350 / `tYES` / `TaxDate` / `BaseType 22`); explicit checks that `ItemCode` / `WarehouseCode` / `UoMCode` / `Currency` / `Rate` are not sent.
- **`tests/unit/navigation.test.js`** — Visibility tests for the new APRI-ready nav item.

### Behaviour

- SAP endpoint unchanged: `POST /PurchaseInvoices` (via `createAPReserveInvoice`).
- PO record continues to provide `relatedSAPPODocEntry`, `relatedSAPPODocNum`, and `line.relatedPOLineNum` (resolved from `po.sapResponse.DocumentLines.LineNum`).
- Comments default to `AP Reserve Invoice based on PO <SAP PO DocNum>` when no remarks are set.

### Commands run

| Command | Result |
|---------|--------|
| `npm run lint` | Pass — no ESLint warnings or errors |
| `npm test` | Pass — 223 tests, 48 files |

---

## Phase 6 — Attachments module (2026-05-24)

### Scope

Pre-signed S3 upload/download for PR, PO, and APRI documents with:
- Strict MIME allow-list + 25 MB size cap (server and client enforcement)
- Document-scoped S3 keys (`{documentType}/{documentId}/{ulid}-{safeFileName}`)
- Per-document access checks (PR/PO requester or approver, APRI invoice permissions)
- `approval_history` entry `Attachment Uploaded` on every successful completion
- Short-lived (5 min) pre-signed GET URLs for downloads

### APIs

- `POST /api/attachments/sign-upload` — Zod-validated; returns pre-signed PUT URL + `s3Key`.
- `POST /api/attachments/complete-upload` — Zod-validated; persists metadata, writes approval-history entry, returns the saved row.
- `GET /api/attachments/[documentType]/[documentId]` — returns attachments with fresh pre-signed GET URLs.
- Removed legacy `POST /api/attachments` (replaced by `complete-upload`).
- No multipart fallback (deferred per phase note; preferred path is sign-upload + complete-upload).

### Files changed

- `lib/documentAccess.js` (new) — `assertCanAccessDocument` for PR / PO / APRI with stable `INVALID_TYPE` / `INVALID_ID` / `NOT_FOUND` / `FORBIDDEN` error codes.
- `lib/attachmentsService.js` — Rewrote: MIME allow-list (`ALLOWED_MIME_TYPES`), Crockford-base32 `newUlid`, `safeFileName`, `signUpload(user, …)`, `completeUpload(user, …)` (writes `approval_history`), `listAttachments(type, id, user)` with access enforcement.
- `lib/validators/attachment.js` (new) — Zod schemas for sign-upload and complete-upload.
- `lib/attachmentClientConstants.js` (new) — client-safe MIME / size constants.
- `lib/uploadClient.js` — points to `/api/attachments/complete-upload`.
- `lib/apiHelpers.js` — maps new attachment error codes (`INVALID_FILE_SIZE`, `INVALID_TYPE`, `INVALID_S3_KEY`) to 400.
- `app/api/attachments/sign-upload/route.js` — uses new validator + service.
- `app/api/attachments/complete-upload/route.js` (new) — replaces legacy `POST /api/attachments`.
- `app/api/attachments/[documentType]/[documentId]/route.js` — passes user to enforce access.
- `app/api/attachments/route.js` — deleted.
- `components/ui/AnimatedEmptyState.jsx` (new) — entrance + gentle icon float; respects `useReducedMotion`.
- `components/ui/index.js` — re-exports `AnimatedEmptyState`.
- `components/attachments/AttachmentPanel.jsx` (new) — reusable upload/list/download panel with skeleton loading, empty state, and reduced-motion support.
- `components/purchase-requests/PrDetailView.jsx` — Attachments tab uses `AttachmentPanel`.
- `components/purchase-orders/PoDetailView.jsx` — Attachments tab uses `AttachmentPanel`.
- `components/ap-reserve-invoices/ApriDetailView.jsx` — adds Attachments tab using `AttachmentPanel`.

### Tests added

- `tests/unit/validators/attachment.test.js` — sign-upload + complete-upload schemas (documentType enum, ObjectId, size cap, required fields).
- `tests/unit/attachmentsService.test.js` — `safeFileName`, `newUlid`, MIME allow-list, sign-upload happy path + MIME / size / FORBIDDEN / NOT_FOUND, complete-upload happy path + s3Key scope check + MIME guard + FORBIDDEN, list with access enforcement and download URL generation.
- `tests/unit/documentAccess.test.js` — INVALID_TYPE / INVALID_ID / NOT_FOUND / PR requester / pr.approve.pm / po.approve.finance / apinvoice.create / FORBIDDEN cases.

### Commands run

| Command | Result |
|---------|--------|
| `npm run lint` | Pass — no ESLint warnings or errors |
| `npm test` | Pass — 262 tests, 51 files |

### Manual test checklist

1. Log in as a user with `pr.create` and create a PR; open its detail page → **Attachments** tab.
2. Click **Upload file**, pick a PDF/PNG/Excel/CSV; verify it appears with size + uploader and downloads via the **Download** button.
3. Attempt to upload a `.zip` or `.exe` → expect a friendly “File type not allowed” error and no S3 PUT call.
4. Attempt to upload a file > 25 MB → expect “exceeds the 25 MB limit”.
5. Repeat 1–4 on a PO detail page (`po.create` user) and on an APRI detail page (`apinvoice.create` user).
6. Log in as an unrelated requester and call `GET /api/attachments/PR/<otherUserPRId>` → expect 403.
7. Open the PR/PO/APRI **History** tab → confirm an `Attachment Uploaded` entry with the file name appears for each successful upload.
8. Confirm download links rotate (presigned expiry) — refresh the page after ≥5 minutes and click an older Download link from the previous page render → it should 403 (URL expired) while the freshly fetched list still works.

---

## Phase 7 — Comments & approval history (2026-05-24)

### Scope

Per-document comments and chronological approval timeline for PR / PO / APRI, sharing the Phase 6 access helper. No SAP, approval workflow, or duplicate guard logic touched.

### APIs

- `GET /api/comments/[documentType]/[documentId]` — chronological (asc) comments with populated `postedBy` and attachment metadata; access enforced.
- `POST /api/comments` — Zod-validated body (`documentType`, `documentId`, `comment` ≤ 2000 chars, optional `attachments[]`); persists Comment + writes `approval_history` `Comment Added`; rejects attachments that don't belong to the target document.
- `GET /api/approval-history/[documentType]/[documentId]` — chronological timeline (asc) with populated `actionBy` and attachment metadata; access enforced.
- Removed legacy `app/api/purchase-requests/[id]/comments/route.js` (UI now uses the generic endpoint).

### Files changed

- `models/ApprovalHistory.js` — Added `Comment Added` and `Updated` to the action enum (the latter was already used by PO edits but was missing from the enum).
- `lib/validators/comment.js` (new) — `createCommentSchema` (with whitespace-trim + max 2000) and `documentScopeSchema`.
- `lib/commentsService.js` — Rewritten: enforces document access via `documentAccess.assertCanAccessDocument`, validates that attachments belong to the same document (`INVALID_ATTACHMENT_SCOPE`), writes the `Comment Added` history entry, and returns sanitized rows with populated `postedBy` and attachment metadata; list is now sorted oldest → newest.
- `lib/approvalHistoryService.js` (new) — `listApprovalHistory(user, documentType, documentId)` with access enforcement, ascending sort, populated `actionBy`, and attachment metadata.
- `lib/apiHelpers.js` — Maps `INVALID_ATTACHMENT_SCOPE` to 400.
- `app/api/comments/route.js` (new) — POST endpoint.
- `app/api/comments/[documentType]/[documentId]/route.js` (new) — GET endpoint.
- `app/api/approval-history/[documentType]/[documentId]/route.js` (new) — GET endpoint.
- `components/comments/CommentsPanel.jsx` (new) — textarea + character counter + submit-disabled-while-empty/submitting, list of comments with attachments, `AnimatedEmptyState` / `AnimatedSkeletonLoader`, friendly inline error, respects `useReducedMotion`.
- `components/approval-history/ApprovalTimeline.jsx` (new) — color-coded dots for `Created` / `Submitted` / `Approved` / `Rejected` / `SAP Created` / `SAP Failed` / `Attachment Uploaded` / `Comment Added` / `Email Sent` / `Updated`, action / step / actor / role / date / comment / status transition / attachment chips, respects `useReducedMotion`.
- `components/purchase-requests/PrDetailView.jsx` — Comments and History tabs now use the shared panels; bespoke comments form removed.
- `components/purchase-orders/PoDetailView.jsx` — Adds Comments tab; History tab uses `ApprovalTimeline`.
- `components/ap-reserve-invoices/ApriDetailView.jsx` — Adds Comments tab; History tab uses `ApprovalTimeline`.

### Tests added

- `tests/unit/validators/comment.test.js` — accept valid body, trim, accept PR/PO/APRI, reject empty/whitespace, reject > 2000 chars, reject bad documentType / documentId, attachment id validation.
- `tests/unit/commentsService.test.js` — persists + logs `Comment Added`, accepts in-scope attachments, rejects cross-document attachments (`INVALID_ATTACHMENT_SCOPE`), propagates FORBIDDEN, list enforces access and returns sanitized rows.
- `tests/unit/approvalHistoryService.test.js` — list enforces access and sorts ascending by `actionDate`.

### Indexes (unchanged, confirmed)

- `comments`: `{ documentType: 1, documentId: 1, postedAt: -1 }` (already in model).
- `approval_history`: `{ documentType: 1, documentId: 1, actionDate: -1 }` (already in model).

### Commands run

| Command | Result |
|---------|--------|
| `npm run lint` | Pass — no ESLint warnings or errors |
| `npm test` | Pass — 281 tests, 54 files |

### Manual test checklist

1. Sign in as a `pr.create` user, open a PR detail page → **Comments** tab → type a comment → **Post comment**; the new comment appears at the bottom of the list with your name and timestamp.
2. Open the same PR's **History** tab → confirm a `Comment Added` entry appears with the comment text.
3. Sign in as a `po.create` user, open a PO detail page → **Comments** tab → add a comment; **History** tab shows the entry.
4. Sign in as an `apinvoice.create` user, open an APRI detail page → **Comments** tab → add a comment; **History** tab shows it.
5. Upload an attachment from the **Attachments** tab on each document — **History** tab still shows the `Attachment Uploaded` entry alongside the new `Comment Added` entries.
6. Sign in as an unrelated requester (no `view.all`) and request `GET /api/comments/PR/<otherUserPRId>` and `GET /api/approval-history/PR/<otherUserPRId>` → expect 403.
7. Confirm previously-recorded events (`Created`, `Submitted`, `Approved`, `Rejected`, `SAP Created`, `SAP Failed`, `Attachment Uploaded`, etc.) still render correctly with the new color-coded timeline.
8. Confirm no SAP creation logic changed: create a PR / PO / APRI end-to-end and verify SAP DocEntry / DocNum are still populated.

---

## SMTP env loading + health UX fix (2026-05-24)

### Problem

System Health showed SMTP failing with `getaddrinfo ENOTFOUND smtp.example.com`. The portal only read `SMTP_*` variables, but `.env.local` still had the placeholder `SMTP_HOST=smtp.example.com`, and shared infra configs from another project use the `EMAIL_SERVER_*` naming style. The failing badge was also rendered as **“Failed to Create in SAP”**, which is a business-document status incorrectly reused for infrastructure health.

### Fixes

- `lib/email.js`
  - `resolveSmtpConfig(env)` reads `SMTP_*` first, falls back to `EMAIL_SERVER_*`, and exposes `{ host, port, user, pass, from, source, isConfigured, placeholderHost }`. `EMAIL_FROM` falls back to `user`.
  - Detects placeholder hosts (`smtp.example.com`, `your-smtp-host`, `*.example.com`) and treats them as not-configured.
  - New error codes: `SMTP_NOT_CONFIGURED`, `SMTP_PLACEHOLDER_HOST`.
  - `describeSmtpError(err, host)` maps Node DNS / nodemailer errors to friendly messages: `Cannot resolve SMTP host`, `SMTP authentication failed`, `Connection refused by SMTP host`, `SMTP host did not respond`.
  - `pingSmtp` and `sendEmail` use the new resolver and never reference the password value in messages or logs.
- `components/settings/HealthCheckPanel.jsx`
  - Replaced `AnimatedStatusBadge status="Failed to Create in SAP"` with a dedicated `HealthStatusPill` (`Healthy` green / `Failed` red).
- `.env.local.example`
  - Documents both `SMTP_*` (preferred) and `EMAIL_SERVER_*` (fallback) blocks with a Gmail example and a “SMTP_* takes precedence” note.

### Tests added

- `tests/unit/email.test.js` (18 tests): SMTP_* reads, EMAIL_SERVER_* fallback, precedence, `EMAIL_FROM` default, placeholder host detection, default port 587, `SMTP_NOT_CONFIGURED`, `SMTP_PLACEHOLDER_HOST`, `describeSmtpError` for ENOTFOUND / EAUTH / ECONNREFUSED / ETIMEDOUT, password-not-leaked assertion, `sendEmail` failure path logs friendly message.
- `tests/unit/healthCheckPanel.source.test.js` (4 tests): asserts the panel does not contain `"Failed to Create in SAP"`, does not import `AnimatedStatusBadge`, uses `HealthStatusPill`, and shows `Failed` / `Healthy` labels.

### Commands run

| Command | Result |
|---------|--------|
| `npm run lint` | Pass — no ESLint warnings or errors |
| `npm test` | Pass — 303 tests, 56 files |

### Operator note

`.env.local` currently still contains `SMTP_HOST=smtp.example.com`. To use the working Gmail SMTP either:

1. Change that line to `SMTP_HOST=smtp.gmail.com`, **or**
2. Remove `SMTP_HOST` entirely and add `EMAIL_SERVER_HOST=smtp.gmail.com` (plus `EMAIL_SERVER_PORT`, `EMAIL_SERVER_USER`, `EMAIL_SERVER_PASSWORD`).

Then restart the Next.js dev/prod server so the new env values are loaded.

---

## Post Phase 6/7 bug fixes — attachments, approvals, emails (2026-05-25)

### Problems

1. PR attachments uploaded but did not appear in the Attachments tab (ObjectId query mismatch risk; list load errors surfaced as generic failures).
2. PR create with attachment showed browser "Failed to fetch" even when PR was saved (network/JSON errors threw from `apiFetch`; attachment failure blocked navigation).
3. PR/PO approval with attachment failed before approval completed (upload ran before approve; S3/network errors aborted the action).
4. PO approve page had no attachment upload UI.
5. PO detail showed Approve/Reject to PM after Finance step (coarse client permission check vs step-aware API flag).
6. Workflow emails were plain one-line text with no portal links or HTML layout.

### Fixes

- **`lib/apiClient.js`**: never throws on network/JSON failures; maps `Failed to fetch` to a friendly message.
- **`lib/attachmentsService.js`**: `normalizeDocumentId()` ensures consistent ObjectId storage/query.
- **`lib/attachmentUploadHelpers.js`**: batch upload with per-file failure collection + warning formatter.
- **`lib/uploadClient.js`**: clearer S3 PUT error messages.
- **`components/attachments/AttachmentPanel.jsx`**: safe list reload after upload, explicit `documentId` string, `listVersion` refresh bump.
- **`PrCreateForm` / `PrApproveForm` / `PoApproveForm`**: approve/create first, upload attachments after; partial attachment failure shows amber warning and navigates to detail (retry on Attachments tab).
- **`PoDetailView` / `PoApproveForm`**: use API `canApproveCurrentStep`; show "Waiting for {step} Approval" for non-approvers.
- **`lib/purchaseOrdersService.js`**: exposes `canApproveCurrentStep`, `currentStepName`, `currentStepRequiredPermission` on PO detail payload.
- **`lib/emailTemplates.js` + `notifyWorkflowEmail`**: HTML + text templates with greeting, document details, CTA button (`APP_BASE_URL` / `NEXT_PUBLIC_APP_URL`), SPC footer.
- All workflow `notifyEvent` call sites migrated to templates (PR/PO/APRI; SAP created/failed unchanged in logic).

### Tests added/updated

- `tests/unit/apiClient.test.js`, `attachmentUploadHelpers.test.js`, `emailTemplates.test.js`
- `workflowSteps.test.js` — PM cannot approve on Finance step
- `poDetailView.source.test.js`, `attachmentsService` ObjectId expectation
- Updated SAP/PO flow mocks for `notifyWorkflowEmail`

### Commands run

| Command | Result |
|---------|--------|
| `npm run lint` | Pass |
| `npm test` | Pass — 319 tests, 60 files |
