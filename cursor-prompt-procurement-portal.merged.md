# Cursor Agent Operating Instructions (read first)

## Role
You are implementing a production procurement portal. JavaScript only. No TypeScript. Do not switch frameworks or libraries.

## Working Loop
1. Work phase by phase, top to bottom. Do NOT skip ahead.
2. At the start of each phase, restate the phase scope as a checklist and tick items off.
3. After every phase: run `npm run lint && npm test`, commit with message `phase-N: <summary>`, then pause and summarize what changed.
4. Never invent business logic — if a rule is missing, STOP and ask one question.
5. Never hardcode approval steps. Read from the `approval_matrix` collection.
6. Never call SAP without the `sapXXXDocEntry` duplicate guard.
7. Treat every SAP/SMTP/S3/HANA error as a logged event, not a thrown exception to the user.

## Definition of Done (per feature)
- Zod-validated inputs on the API route.
- Unit test for the validator and any mapper.
- Mongo index added if the route filters/sorts on new fields.
- API returns `{ success, data, pagination? }` or `{ success: false, message, error }`.
- UI uses the `Animated*` components and respects `useReducedMotion`.
- Audit entry written to `approval_history` if status changed.

## Non-Goals (do not build)
- TypeScript migration.
- Mobile native app.
- Multi-tenant / multi-company support beyond `SAP_SL_COMPANY_DB`.
- Real-time websockets (polling / SWR is fine).

## When You Are Unsure
Ask **one** focused question and wait. Do not generate placeholder code or `TODO`s and continue.

---

# Cursor AI Agent Prompt — Procurement Workflow Portal

---

## Project Status

**All implementation phases from Phase 0 through Phase 12 are complete.**

### Completed modules
- Foundations
- Auth
- Users / Roles / Approval Matrix
- Purchase Requests
- Purchase Orders
- A/P Reserve Invoices
- Attachments
- Comments & Approval History
- Email Notifications
- SAP Integration Hardening
- Dashboard & Reports
- Admin Settings
- UI/UX Modernization (Arabic RTL, responsive polish, themes)

### Important production notes
- SAP PO is created as a **standalone PO**, not PR BaseEntry, due to SAP B1 Service Layer exchange-rate conflicts.
- The portal preserves PR → PO relationship internally and through SAP comments/UDF when configured.
- SAP PR is **closed** after standalone PO creation.
- APRI is created from SAP PO using **BaseType 22**.
- Email sending is **non-blocking** and logged.
- SAP **duplicate guards** are enforced before every SAP document creation.

### Phase completion
| Phase | Status |
|-------|--------|
| Phase 0 — Foundations | **Completed** |
| Phase 1 — Project Scaffold & Auth | **Completed** |
| Phase 2 — Users, Roles & Approval Matrix | **Completed** |
| Phase 3 — Purchase Request Module | **Completed** |
| Phase 4 — Purchase Order Module | **Completed** |
| Phase 5 — A/P Reserve Invoice Module | **Completed** |
| Phase 6 — Attachments Module | **Completed** |
| Phase 7 — Comments & Approval History | **Completed** |
| Phase 8 — Email Notifications | **Completed** |
| Phase 9 — SAP Integration Module | **Completed** |
| Phase 10 — Dashboard & Reports | **Completed** |
| Phase 11 — Admin Settings | **Completed** |
| Phase 12 — UI/UX Modernization | **Completed** |

### Phase 12 notes
- Arabic RTL supported (`lang="ar"` `dir="rtl"` on root layout).
- Responsive mobile UI: collapsible filters, mobile nav drawer, table scroll / card lists on PR list.
- Framer Motion applied across user-facing pages via `Animated*` components.
- Seven accent color themes (indigo, blue, emerald, amber, rose, violet, slate) via CSS variables and `localStorage`.
- Centralized Arabic copy in `lib/i18n/ar.js`.
- Production UI polish completed without changing SAP creation, approval workflow, or duplicate guards.

---

## PROJECT OVERVIEW

Build a full-stack **Procurement Workflow Portal** using:

- **Framework:** Next.js 14+ (App Router, JavaScript only — no TypeScript)
- **Frontend:** React, Tailwind CSS, Framer Motion
- **Backend:** Next.js API Routes
- **Database:** MongoDB with Mongoose
- **SAP Lookup/Reporting:** SAP HANA via ODBC (`odbc` npm package)
- **SAP Document Creation:** SAP Business One Service Layer (REST API)
- **File Storage:** AWS S3 (`@aws-sdk/client-s3`)
- **Email:** Nodemailer or Resend
- **Auth:** JWT-based sessions with Role-Based Access Control (RBAC)

---

## IMPLEMENTATION PHASES

Work through phases in order. Complete each phase before moving to the next.

> Note: A new **Phase 0 — Foundations** is defined in the Addendum at the end of this document. Run Phase 0 before Phase 1.

---

### PHASE 1 — PROJECT SCAFFOLD & AUTH

**Tasks:**
1. Initialize Next.js App Router project with Tailwind CSS.
2. Set up MongoDB connection utility (`/lib/mongodb.js`).
3. Set up SAP Service Layer client (`/lib/sapServiceLayer.js`) — handles login, session/cookie management, and HTTP calls.
4. Set up SAP HANA ODBC client (`/lib/sapHana.js`) — handles queries for lookups.
5. Set up AWS S3 client (`/lib/s3.js`).
6. Set up email utility (`/lib/email.js`).
7. Build JWT auth middleware (`/lib/auth.js`) — `signToken`, `verifyToken`, `withAuth(handler, permissions[])`.
8. Create `/api/auth/login` — validate credentials, return JWT.
9. Create `/api/auth/logout`.
10. Create `/api/auth/me` — return current user from JWT.
11. Build `/login` page with username/password form.
12. Build layout with protected route wrapper — redirect unauthenticated users to `/login`.
13. Build sidebar navigation — render only links the user's role permits.
14. Install and configure Framer Motion for reusable animation components.
15. Create base animated UI components: AnimatedPageWrapper, AnimatedModal, AnimatedDrawer, AnimatedStatusBadge, and AnimatedSkeletonLoader.

---

### PHASE 2 — USERS, ROLES & APPROVAL MATRIX

**MongoDB Models (create in `/models/`):**

```js
// User
{ name, email, username, passwordHash, role: ObjectId, department, isActive, permissions: [String], createdAt }

// Role
{ name, permissions: [String], createdAt }
// permissions list: pr.create, pr.approve.whs, pr.approve.pm, po.create, po.approve.pm,
//   po.approve.finance, apinvoice.create, items.create, admin.users, admin.roles,
//   admin.approval_matrix, admin.settings, view.all

// ApprovalMatrix
{ documentType: enum['PR','PO'], stepOrder: Number, stepName, requiredPermission, approverRole: ObjectId, isActive }
```

**API Routes:**
- `GET/POST /api/users`, `PUT/DELETE /api/users/[id]`
- `GET/POST /api/roles`, `PUT/DELETE /api/roles/[id]`
- `GET/POST /api/approval-matrix`, `PUT /api/approval-matrix/[id]`

**Pages:**
- `/settings/users` — list, create, edit, deactivate users
- `/settings/roles` — manage roles and permission checkboxes
- `/settings/approval-matrix` — define PR and PO approval steps with stepOrder, stepName, assignedRole

**Rules:**
- Seed default roles (Admin, Requester, WHS Approver, Project Manager, Finance, Procurement) on first run.
- Approval steps are driven by the `approval_matrix` collection — never hardcode approval logic.

---

### PHASE 3 — PURCHASE REQUEST MODULE

#### 3A — PR Creation

**MongoDB Model:**
```js
// PurchaseRequest
{
  portalPRNumber,        // auto-generated: PR-YYYYMMDD-XXXX
  requester: ObjectId,
  requesterEmail,
  department,
  project,
  requiredDate,
  postingDate,
  documentDate,
  warehouse,
  remarks,
  status: enum[
    'Draft','Pending Warehouse Approval','Pending Project Manager Approval',
    'Approved','Rejected','Creating in SAP','Created in SAP','Failed to Create in SAP'
  ],
  currentApprovalStep: Number,
  sapPRDocEntry,
  sapPRDocNum,
  sapCreationStatus,
  sapResponse,
  sapErrorMessage,
  lines: [{
    itemCode, itemName, vendor, quantity, uom, warehouseCode, projectCode,
    costCenter, requiredDate, estimatedUnitPrice, estimatedTotal, remarks,
    uDepartment, uDelDate, uRate
  }],
  createdBy: ObjectId,
  createdAt, updatedAt
}
```

**Page: `/purchase-requests/create`**
- Header form fields: department, project, required date, warehouse, remarks.
- Line items table: add/remove rows.
- Each line: item search autocomplete (calls `GET /api/sap/items/search?query=`), auto-fills itemCode, itemName, uom. If no results found, show **Create New Item** button (only if user has `items.create` permission).
- Attachments upload section (multi-file).
- On submit: `POST /api/purchase-requests` → saves to MongoDB → uploads files to S3 → saves attachment metadata → logs approval history entry → triggers email to WHS approvers.

**Item Search:**
- `GET /api/sap/items/search?query=` → query SAP HANA ODBC. Use the **corrected** query from the Addendum (precedence-safe, case-insensitive).
- `GET /api/sap/items/[itemCode]` → single item detail
- Dropdown shows: ItemCode, ItemName, UoM, ItemGroup

**Create New Item Modal (permission-gated):**
Fields: ItemCode, ItemName, ItemGroup, UoMGroup, DefaultWarehouse, U_Model, U_PartNo, U_Category, U_FactoryName, U_Code, U_UOM.

`POST /api/sap/items/create`:
1. Validate ItemCode does not exist in SAP (call Service Layer `GET /Items('CODE')`).
2. POST to SAP Service Layer `/Items`.
3. On success: save to `item_creation_logs`, return item data to fill PR line.
4. On failure: show SAP error message to user, log error.

**MongoDB Model:**
```js
// ItemCreationLog
{ itemCode, itemName, createdBy: ObjectId, createdAt, sapResponse, status, errorMessage, relatedPRNumber }
```

#### 3B — PR Approval Flow

`POST /api/purchase-requests/[id]/approve`:
1. Verify calling user has the permission required by the current `ApprovalMatrix` step.
2. Log to `approval_history`.
3. Advance `currentApprovalStep`.
4. If more steps remain: update status to next pending status, send email to next approvers.
5. If final step: set status `Approved`, trigger `POST /api/purchase-requests/[id]/create-sap-pr`.

`POST /api/purchase-requests/[id]/reject`:
1. Verify permission.
2. Set status `Rejected`.
3. Log to `approval_history`.
4. Send rejection email to requester.

`POST /api/purchase-requests/[id]/create-sap-pr`:
1. Check `sapPRDocEntry` is null (duplicate guard).
2. Set status `Creating in SAP`.
3. Login to SAP Service Layer (manage session).
4. Build SAP payload from PR data (see `/lib/sap/mappers/prToSap.js` in Addendum).
5. POST to SAP Service Layer `/PurchaseRequests`.
6. On success: save `sapPRDocEntry`, `sapPRDocNum`, status `Created in SAP`, log to `sap_integration_logs`, send success email.
7. On failure: save error, status `Failed to Create in SAP`, log, send failure email to Admin.

`POST /api/purchase-requests/[id]/retry-sap` — Admin/authorized only, re-triggers create-sap-pr.

#### 3C — PR Pages & Lists

- `/purchase-requests` — tabs: My PRs, Pending My Approval, Approved, Rejected, Created in SAP, All (Admin)
- `/purchase-requests/[id]` — full detail: header, lines, attachments, comments, approval history timeline
- `/purchase-requests/[id]/approve` — approve/reject form with comment and attachment upload
- `/purchase-requests/approved-for-po` — PRs with status `Created in SAP` available for PO creation

Filters on list pages: portalPRNumber, sapPRDocNum, requester, department, project, warehouse, status, currentApprovalStep, date range.

---

### PHASE 4 — PURCHASE ORDER MODULE

#### 4A — PO Creation from Approved PR

`POST /api/purchase-orders/from-pr/[prId]`:
1. Verify PR status is `Created in SAP`.
2. Guard: prevent duplicate PO from same PR (per vendor — see Addendum).
3. Copy PR header and lines into new PO document.
4. Set PO status `Pending Project Manager Approval`, `currentApprovalStep = 1`.
5. Log to `approval_history`.
6. Send email to Project Manager approvers.

**MongoDB Model:**
```js
// PurchaseOrder
{
  portalPONumber,        // auto-generated: PO-YYYYMMDD-XXXX
  relatedPRId: ObjectId,
  relatedPRNumber,
  relatedSAPPRDocEntry,
  relatedSAPPRDocNum,
  requester: ObjectId,
  department, project, vendor, warehouse,
  postingDate, documentDate, requiredDate, remarks,
  status: enum[
    'Draft','Pending Project Manager Approval','Pending Finance Approval',
    'Approved','Rejected','Creating in SAP','Created in SAP','Failed to Create in SAP'
  ],
  currentApprovalStep: Number,
  sapPODocEntry, sapPODocNum, sapCreationStatus, sapResponse, sapErrorMessage,
  lines: [{
    relatedPRLineId, itemCode, itemName, quantity, uom, warehouseCode,
    projectCode, costCenter, unitPrice, lineTotal, remarks, uDepartment, uDelDate, uRate
  }],
  createdBy: ObjectId, createdAt, updatedAt
}
```

#### 4B — PO Approval Flow

Same pattern as PR approval. ApprovalMatrix steps for `documentType: 'PO'`:
- Step 1: Project Manager Approval (`po.approve.pm`)
- Step 2: Finance Approval (`po.approve.finance`)

After final step: trigger `POST /api/purchase-orders/[id]/create-sap-po`.

`POST /api/purchase-orders/[id]/create-sap-po`:
1. Duplicate guard on `sapPODocEntry`.
2. POST to SAP Service Layer `/PurchaseOrders`.
3. Save DocEntry, DocNum, log, send emails.

`POST /api/purchase-orders/[id]/retry-sap` — Admin/authorized retry.

#### 4C — PO Pages

- `/purchase-orders` — tabs: Pending My Approval, Approved, Rejected, Created in SAP, All (Admin)
- `/purchase-orders/[id]` — full detail with related PR link
- `/purchase-orders/[id]/approve` — approve/reject form
- `/purchase-orders/ready-for-ap-reserve-invoice` — POs with status `Created in SAP`

---

### PHASE 5 — A/P RESERVE INVOICE MODULE

`POST /api/ap-reserve-invoices/from-po/[poId]`:
1. Verify PO status `Created in SAP`.
2. Guard: prevent duplicate invoice from same PO.
3. Copy PO lines to new AP Reserve Invoice.
4. POST immediately to SAP Service Layer `/APReserveInvoices` (based on PO DocEntry as base document reference — see APRI mapping in Addendum, `BaseType: 22`).
5. On success: save DocEntry, DocNum, status `Created in SAP`, log, send emails to Finance + WHS + Procurement.
6. On failure: save error, status `Failed to Create in SAP`, send failure email to Admin.

**MongoDB Model:**
```js
// APReserveInvoice
{
  portalAPNumber,        // auto-generated: APRI-YYYYMMDD-XXXX
  relatedPOId: ObjectId,
  relatedPONumber,
  relatedSAPPODocEntry,
  relatedSAPPODocNum,
  vendor, postingDate, documentDate, dueDate, remarks,
  status: enum['Ready for AP Reserve Invoice','Creating in SAP','Created in SAP','Failed to Create in SAP','Completed'],
  sapAPDocEntry, sapAPDocNum, sapCreationStatus, sapResponse, sapErrorMessage,
  lines: [{ relatedPOLineId, itemCode, itemName, quantity, uom, warehouseCode, projectCode, costCenter, unitPrice, lineTotal, remarks }],
  createdBy: ObjectId, createdAt, updatedAt
}
```

**Pages:**
- `/ap-reserve-invoices` — list
- `/ap-reserve-invoices/[id]` — detail with SAP response and email log

---

### PHASE 6 — ATTACHMENTS MODULE

**MongoDB Model:**
```js
// Attachment
{ documentType: enum['PR','PO','APRI'], documentId: ObjectId, approvalStep, uploadedBy: ObjectId,
  uploadedAt, fileName, fileType, fileSize, s3Key, s3Url }
```

`POST /api/attachments/upload`:
1. Accept `multipart/form-data`.
2. Upload file to S3 bucket under path `/{documentType}/{documentId}/{timestamp}-{fileName}`.
3. Generate pre-signed URL or public URL.
4. Save metadata to `attachments` collection.

> Preferred flow per Addendum: client uploads via **pre-signed PUT** (`POST /api/attachments/sign-upload`) and then notifies the server to persist metadata. The `multipart/form-data` endpoint above is the fallback path.

`GET /api/attachments/[documentType]/[documentId]` — return list of attachments with S3 URLs.

S3 Config (env vars): `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_S3_BUCKET`.

---

### PHASE 7 — COMMENTS & APPROVAL HISTORY

**MongoDB Models:**
```js
// Comment
{ documentType, documentId: ObjectId, comment, attachments: [ObjectId], postedBy: ObjectId, postedAt }

// ApprovalHistory
{ documentType, documentId: ObjectId, stepName, action: enum['Created','Submitted','Approved','Rejected','SAP Created','SAP Failed','Email Sent','Attachment Uploaded'],
  actionBy: ObjectId, actionByRole, comment, attachments: [ObjectId], actionDate, previousStatus, newStatus }
```

`GET /api/approval-history/[documentType]/[documentId]` — return full chronological timeline.
`GET/POST /api/comments` — scoped by documentType + documentId.

Render approval history as a vertical timeline on detail pages.

---

### PHASE 8 — EMAIL NOTIFICATIONS

**MongoDB Model:**
```js
// EmailLog
{ to: [String], cc: [String], subject, body, relatedDocumentType, relatedDocumentId: ObjectId,
  emailStatus: enum['Sent','Failed'], sentAt, errorMessage }
```

**Email triggers — send email and log every time:**

| Event | Recipients |
|---|---|
| PR created | WHS Approvers |
| WHS approved | Project Manager Approvers |
| PM approved PR | Requester |
| PR rejected | Requester |
| PR created in SAP | Requester + Admin |
| PR SAP failed | Admin |
| PO created | Project Manager Approvers |
| PM approved PO | Finance Approvers |
| Finance approved PO | Requester + Procurement |
| PO rejected | Requester |
| PO created in SAP | Requester + Procurement + Admin |
| PO SAP failed | Admin |
| APRI created in SAP | Finance Team + WHS Team + Procurement |
| APRI SAP failed | Admin |

Recipients are resolved by querying users who have the relevant role/permission. Support a `/settings/email-groups` page for Admin to override recipients per event type. (`EmailGroup` model is defined in the Addendum.)

`POST /api/email/send` — internal utility, accepts `{ to, cc, subject, body, relatedDocumentType, relatedDocumentId }`.

---

### PHASE 9 — SAP INTEGRATION MODULE

**`/lib/sapServiceLayer.js`** must:
- Maintain session cookie (SAP SL uses cookie-based sessions).
- Auto-login if session expired.
- Expose: `login()`, `getItem(itemCode)`, `createItem(payload)`, `createPR(payload)`, `createPO(payload)`, `createAPReserveInvoice(payload)`, `getVendors()`, `getWarehouses()`, `getProjects()`, `getCostCenters()`.

**`/lib/sapHana.js`** must:
- Open ODBC connection using env `HANA_DSN` or connection string.
- Expose: `searchItems(query)`, `getItemDetail(itemCode)`.

**MongoDB Model:**
```js
// SapIntegrationLog
{ documentType, documentId: ObjectId, action, requestPayload, responsePayload,
  sapDocEntry, sapDocNum, status: enum['Success','Failed'], errorMessage, createdAt }
```

**SAP Env Vars:** `SAP_SL_BASE_URL`, `SAP_SL_USERNAME`, `SAP_SL_PASSWORD`, `SAP_SL_COMPANY_DB`, `HANA_CONNECTION_STRING`.

**Duplicate prevention:** Before any SAP document creation, check if `sapXXXDocEntry` is already set. If yes, abort and return existing DocEntry.

**Lookup API Routes (use HANA ODBC or SL as appropriate):**
- `GET /api/sap/items/search?query=`
- `GET /api/sap/items/[itemCode]`
- `POST /api/sap/items/create`
- `GET /api/sap/vendors`
- `GET /api/sap/warehouses`
- `GET /api/sap/projects`
- `GET /api/sap/cost-centers`

---

### PHASE 10 — DASHBOARD & REPORTS

**Page: `/dashboard`**

Cards (query MongoDB aggregations):
- Total PRs | PRs Pending Approval | PRs Created in SAP
- Total POs | POs Pending Approval | POs Created in SAP
- AP Reserve Invoices Created | Failed SAP Integrations

**List features on all list pages:**
- Search (text), filter (dropdowns/date pickers), sort (column headers), pagination (25/page).
- Status badges with color coding.
- Export to Excel (use `xlsx` npm package) via `GET /api/export/purchase-requests`, etc.
- Quick-view approval history drawer.

---

### PHASE 11 — ADMIN SETTINGS ✅ Completed

**Pages:**
- `/settings/users` — CRUD users, assign roles, toggle active
- `/settings/roles` — CRUD roles, checkbox grid for permissions
- `/settings/approval-matrix` — define steps per document type (PR/PO), drag to reorder
- `/settings/email-groups` — configure recipients per email event
- `/settings/sap-integration` — test SAP SL connection, view session status
- `/settings/system-logs` — view `sap_integration_logs` and `email_logs` with filters

---

## MONGODB COLLECTIONS SUMMARY

| # | Collection | Purpose |
|---|---|---|
| 1 | `users` | Portal users |
| 2 | `roles` | RBAC roles & permissions |
| 3 | `approval_matrix` | Configurable approval steps |
| 4 | `purchase_requests` | PR documents |
| 5 | `purchase_orders` | PO documents |
| 6 | `ap_reserve_invoices` | A/P Reserve Invoice documents |
| 7 | `attachments` | File metadata (S3 keys) |
| 8 | `comments` | User comments per document |
| 9 | `approval_history` | Full audit trail |
| 10 | `email_logs` | Sent email records |
| 11 | `sap_integration_logs` | SAP call records |
| 12 | `system_settings` | Key-value system config |
| 13 | `item_creation_logs` | New SAP item creation audit |
| 14 | `email_groups` | Recipient overrides per event (see Addendum) |

---

## ALL REQUIRED PAGES

```
/login
/dashboard
/purchase-requests
/purchase-requests/create
/purchase-requests/[id]
/purchase-requests/[id]/approve
/purchase-requests/approved-for-po
/purchase-orders
/purchase-orders/[id]
/purchase-orders/[id]/approve
/purchase-orders/ready-for-ap-reserve-invoice
/ap-reserve-invoices
/ap-reserve-invoices/[id]
/settings/users
/settings/roles
/settings/approval-matrix
/settings/email-groups
/settings/sap-integration
/settings/system-logs
```

---

## ALL API ROUTES

```
POST   /api/auth/login
POST   /api/auth/logout
GET    /api/auth/me

GET    /api/users
POST   /api/users
PUT    /api/users/[id]
DELETE /api/users/[id]

GET    /api/roles
POST   /api/roles
PUT    /api/roles/[id]
DELETE /api/roles/[id]

GET    /api/approval-matrix
POST   /api/approval-matrix
PUT    /api/approval-matrix/[id]

GET    /api/purchase-requests
POST   /api/purchase-requests
GET    /api/purchase-requests/[id]
PUT    /api/purchase-requests/[id]
POST   /api/purchase-requests/[id]/submit
POST   /api/purchase-requests/[id]/approve
POST   /api/purchase-requests/[id]/reject
POST   /api/purchase-requests/[id]/create-sap-pr
POST   /api/purchase-requests/[id]/retry-sap

GET    /api/purchase-orders
POST   /api/purchase-orders/from-pr/[prId]
GET    /api/purchase-orders/[id]
PUT    /api/purchase-orders/[id]
POST   /api/purchase-orders/[id]/approve
POST   /api/purchase-orders/[id]/reject
POST   /api/purchase-orders/[id]/create-sap-po
POST   /api/purchase-orders/[id]/retry-sap

GET    /api/ap-reserve-invoices
POST   /api/ap-reserve-invoices/from-po/[poId]
GET    /api/ap-reserve-invoices/[id]
POST   /api/ap-reserve-invoices/[id]/retry-sap

POST   /api/attachments/upload
POST   /api/attachments/sign-upload      ← preferred (pre-signed PUT)
GET    /api/attachments/[documentType]/[documentId]

GET    /api/comments/[documentType]/[documentId]
POST   /api/comments

GET    /api/approval-history/[documentType]/[documentId]

POST   /api/email/send
GET    /api/email/logs
GET    /api/email-groups                  ← Addendum
POST   /api/email-groups                  ← Addendum
PUT    /api/email-groups/[id]             ← Addendum

POST   /api/sap/login
GET    /api/sap/items/search
GET    /api/sap/items/[itemCode]
POST   /api/sap/items/create
GET    /api/sap/vendors
GET    /api/sap/warehouses
GET    /api/sap/projects
GET    /api/sap/cost-centers

GET    /api/item-creation-logs
GET    /api/export/purchase-requests
GET    /api/export/purchase-orders
```

---

## BUSINESS RULES (ENFORCE IN ALL RELEVANT API ROUTES)

1. PR cannot be submitted to SAP until all PR approval steps are complete.
2. PO can only be created from a PR with status `Created in SAP`.
3. PO cannot be submitted to SAP until all PO approval steps are complete.
4. A/P Reserve Invoice can only be created from a PO with status `Created in SAP`.
5. Only users with the step's required permission can approve that step.
6. Every approve/reject action must record a comment (optional but stored).
7. All files stored in S3; MongoDB stores only metadata.
8. SAP document creation is blocked if DocEntry already exists (duplicate prevention).
9. Rejected documents do not advance to next approval step.
10. Admin and authorized users can retry failed SAP integrations.
11. New items can only be created in SAP by users with `items.create` permission.
12. Item Code must be validated as non-duplicate in SAP before creation.
13. A PR line cannot be submitted with an empty or unconfirmed Item Code.
14. Full audit trail logged for every status change, approval, SAP call, and attachment upload.

---

## ERROR HANDLING REQUIREMENTS

- All API routes: wrap in try/catch, return `{ success: false, message, error }` on failure.
- SAP Service Layer calls: catch HTTP errors, parse SAP error body (`{ error: { message: { value } } }`), save to `sap_integration_logs`.
- S3 uploads: retry once on failure, return error to client if both fail.
- Email sends: catch SMTP errors, log to `email_logs` with `emailStatus: 'Failed'`.
- ODBC queries: wrap in try/catch, close connection in finally block.
- Retry logic: Admin can call `/retry-sap` endpoints — these re-run the SAP creation call after verifying DocEntry is still null.

---

## ENVIRONMENT VARIABLES (`.env.local`)

```
MONGODB_URI=
JWT_SECRET=
JWT_EXPIRES_IN=8h

# First-run admin seeding (Phase 0)
SEED_ADMIN_USERNAME=
SEED_ADMIN_PASSWORD=

SAP_SL_BASE_URL=https://your-sap-server:50000/b1s/v1
SAP_SL_USERNAME=
SAP_SL_PASSWORD=
SAP_SL_COMPANY_DB=

HANA_CONNECTION_STRING=

AWS_REGION=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_S3_BUCKET=

SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASS=
EMAIL_FROM=
```

---

## UI/UX & DESIGN SYSTEM

### Design Language

The portal must feel **professional, calm, and enterprise-grade** — not playful or consumer-facing. Target aesthetic: clean industrial utility with confident hierarchy. Think financial operations dashboard meets modern SaaS.

- **Color palette:** Dark slate sidebar (`#0f172a`) + white content area. Primary action color: indigo (`#4f46e5`). Status colors: amber (pending), green (approved/created), red (rejected/failed), blue (in-progress). Neutral grays for all secondary text and borders.
- **Typography:** Use `Inter` (via Google Fonts or `next/font`) — clean, legible at all sizes. Headings bold/semibold. Body regular. Mono font (`JetBrains Mono` or `Fira Code`) for SAP DocEntry/DocNum values and system codes.
- **Layout:** Fixed dark sidebar (240px), top header bar (56px), scrollable content area. Sidebar collapses to icon rail on mobile. Content max-width 1400px, centered.
- **Spacing:** Generous padding (24px page padding). Cards with 16px internal padding, 1px borders (`border-slate-200`), subtle `shadow-sm`.
- **Buttons:** Primary = indigo filled. Secondary = white with border. Danger = red. All with 6px border-radius. Consistent 36px height for inline buttons, 40px for form submit buttons.
- **Tables:** Striped rows (`bg-slate-50` on odd). Sticky header. Row hover with `bg-indigo-50` transition. Status badge in dedicated column.
- **Forms:** Label above input. 8px gap between label and input. Full-width inputs inside panels. Grouped sections with `<fieldset>` and subtle section headers.
- **Status Badges:** Pill shape, color-coded, uppercase text, 11px font size.

---

## UI/UX & ANIMATION REQUIREMENTS

### Installation

```bash
npm install framer-motion
```

Import in components: `import { motion, AnimatePresence } from 'framer-motion'`

---

### Animation Philosophy

- Animations must **aid comprehension and flow** — not decorate.
- All durations: **0.15s–0.35s**. Never exceed 0.4s for UI transitions.
- Easing: use `ease: [0.4, 0, 0.2, 1]` (Material ease-in-out) as default. Use `ease: 'easeOut'` for entrances.
- Effects limited to: `opacity`, `y` (vertical slide), `scale`. Avoid `x`, `rotate`, `skew` except in very deliberate cases.
- **No animations on:** table cell content, form validation messages, pagination controls, filter inputs.
- **No infinite animations except:** loading spinners and skeleton pulse.
- Every animation must degrade gracefully — wrap with `useReducedMotion` hook from Framer Motion and skip animations when user has reduced motion preference enabled.

```js
// /components/ui/useMotionSafe.js
import { useReducedMotion } from 'framer-motion'

export function useMotionSafe(animationProps) {
  const shouldReduceMotion = useReducedMotion()
  return shouldReduceMotion ? {} : animationProps
}
<motion.div
  {...useMotionSafe({
    initial: { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.25 }
  })}
>
```

---

### Reusable Animated Components

Build all of these as standalone components in `/components/ui/`. Export from `/components/ui/index.js`.

---

#### 1. `AnimatedPageWrapper`

Wraps every page's main content. Triggers on route change via `key={pathname}`.

```jsx
// Usage: wrap every page's root div
<AnimatedPageWrapper>
  {/* page content */}
</AnimatedPageWrapper>
```

**Behavior:**
- Fade in + subtle upward slide (`y: 12 → 0`, `opacity: 0 → 1`)
- Duration: 0.25s, easeOut
- Apply via `layout` in `app/layout.js` using Next.js App Router `usePathname` as the key

---

#### 2. `AnimatedDashboardCard`

Used for every KPI card on `/dashboard`.

**Behavior:**
- Staggered entrance: cards appear one after another with 0.06s delay between each
- Entrance: `y: 20 → 0`, `opacity: 0 → 1`, duration 0.3s
- Hover: `scale: 1.02`, `shadow-md` upgrade — duration 0.15s
- Number counter: animate displayed number from 0 to actual value using Framer Motion `useMotionValue` + `useTransform` + `animate()`. Duration 0.8s, easeOut.

**Props:** `{ title, value, icon, color, trend }`

---

#### 3. `AnimatedStatusBadge`

Replaces all static status pills across PR, PO, APRI list and detail pages.

**Behavior:**
- On mount: `scale: 0.85 → 1`, `opacity: 0 → 1`, duration 0.2s
- On status change (prop change): brief pulse — `scale: 1 → 1.08 → 1`, duration 0.25s, using `AnimatePresence` with `key={status}`
- Colors mapped per status:
  - `Draft` → slate
  - `Pending * Approval` → amber
  - `Approved` → green
  - `Rejected` → red
  - `Creating in SAP` → blue (with subtle pulse)
  - `Created in SAP` → emerald
  - `Failed to Create in SAP` → rose

For `Creating in SAP` status specifically, add a slow repeating `opacity: 1 → 0.5 → 1` pulse (duration 1.2s, `repeat: Infinity`) to signal active processing.

---

#### 4. `AnimatedApprovalTimeline`

Vertical timeline used on `/purchase-requests/[id]`, `/purchase-orders/[id]`, `/ap-reserve-invoices/[id]`.

**Structure:** Vertical list of steps connected by a line. Each step has: icon, step name, actor name + role, timestamp, comment (if any), status indicator.

**Behavior:**
- Steps animate in sequentially with 0.08s stagger delay
- Each step: `x: -16 → 0`, `opacity: 0 → 1`, duration 0.3s
- Connector line between steps draws downward using `scaleY: 0 → 1` with `transformOrigin: top`, duration 0.4s, triggered after parent step appears
- Completed steps: green circle icon ✓
- Current step: indigo pulsing ring (CSS `animate-ping` or Framer `repeat: Infinity`)
- Pending steps: gray dashed circle
- Rejected steps: red ✕ icon

**Props:** `{ history: ApprovalHistory[] }` — renders from `approval_history` collection data.

---

#### 5. `AnimatedModal`

Replaces all modals in the system. Use `AnimatePresence` to handle mount/unmount.

**Instances:**
- Create New Item modal (PR creation flow)
- Approve with comment modal
- Reject confirmation modal
- Attachment preview modal
- SAP error details modal

**Behavior:**
- Backdrop: `opacity: 0 → 0.5`, dark overlay, duration 0.2s
- Modal panel: `scale: 0.95 → 1`, `opacity: 0 → 1`, duration 0.2s, easeOut
- On close: reverse — scale back to 0.95, opacity to 0, duration 0.15s
- Centered on desktop, bottom-sheet style on mobile (slides up from bottom: `y: 100% → 0`)

**Props:** `{ isOpen, onClose, title, children, size?: 'sm'|'md'|'lg'|'xl' }`

---

#### 6. `AnimatedDrawer`

Side panel that slides in from the right. Used for:
- Approval history quick-view (from list pages)
- SAP integration log detail
- Document filters panel on mobile

**Behavior:**
- `x: '100%' → 0`, `opacity: 0 → 1`, duration 0.28s, easeOut
- Backdrop fade simultaneously
- On close: `x: 0 → '100%'`, duration 0.22s

**Props:** `{ isOpen, onClose, title, width?: string, children }`

---

#### 7. `AnimatedEmptyState`

Displayed when lists have no results.

**Behavior:**
- Icon + heading + subtext + optional CTA button
- Entrance: `y: 16 → 0`, `opacity: 0 → 1`, duration 0.35s, delay 0.1s
- Icon: gentle float — `y: 0 → -6 → 0`, `repeat: Infinity`, duration 3s, easeInOut (very subtle)

**Instances and messages:**
- No PRs found → "No purchase requests yet" + Create PR button (if permitted)
- No POs found → "No purchase orders yet"
- No pending approvals → "You're all caught up ✓"
- No attachments → "No files attached"
- No SAP logs → "No SAP integration activity"
- No search results for item → "No items found" + Create New Item button (if permitted)

**Props:** `{ icon, title, description, action?: { label, onClick } }`

---

#### 8. `AnimatedWorkflowStepper`

Horizontal stepper component shown at the top of PR, PO, and APRI detail pages. Shows the document's position in the approval workflow at a glance.

**PR Steps:** Created → WHS Approval → PM Approval → SAP Created
**PO Steps:** Created → PM Approval → Finance Approval → SAP Created
**APRI Steps:** Created → SAP Created

**Behavior:**
- On page load: steps animate in left-to-right with 0.07s stagger
- Each step: `y: -8 → 0`, `opacity: 0 → 1`, duration 0.25s
- Connector line between steps fills from left to right (progress bar style) as steps complete: `scaleX: 0 → 1`, `transformOrigin: left`
- Active step: indigo filled circle with subtle drop shadow
- Completed step: green filled circle with ✓
- Rejected step: red circle with ✕, all subsequent steps grayed out
- Pending step: gray outlined circle

**Props:** `{ steps: string[], currentStep: number, status: string }`

---

#### 9. `AnimatedSkeletonLoader`

Placeholder shown while data loads. Used on all list pages, dashboard, and detail pages.

**Behavior:**
- Shimmer effect: gradient sweeps left to right repeatedly
- Implement using CSS `@keyframes shimmer` + Tailwind `animate-pulse` as fallback
- Variants:
  - `SkeletonTable` — rows of placeholder table cells
  - `SkeletonCard` — dashboard card placeholder
  - `SkeletonDetailPage` — header block + line items placeholder
  - `SkeletonTimeline` — stacked timeline step placeholders
  - `SkeletonDropdown` — for SAP item search loading state

---

#### 10. `AnimatedItemSearchDropdown`

The SAP item autocomplete dropdown in PR line items.

**Behavior:**
- Results dropdown: `y: -4 → 0`, `opacity: 0 → 1`, duration 0.15s, easeOut — appears just below the input
- Each result row fades in with 0.03s stagger (max 8 visible rows, virtualized if more)
- On no results: show `AnimatedEmptyState` mini variant inside dropdown + `AnimatedModal` trigger for Create New Item
- "Create New Item" button inside the dropdown: entrance `scale: 0.9 → 1`, `opacity: 0 → 1`, duration 0.2s — draws attention without being distracting
- On item select: dropdown fades out, selected row highlights briefly (`bg-indigo-50`) then fades to normal

---

### Page-Level Animation Specifications

#### `/dashboard`
- `AnimatedPageWrapper` wraps page
- KPI cards render in a CSS grid, staggered with `AnimatedDashboardCard`
- Section headers fade in after cards (`delay: 0.3s`)
- Recent activity feed: list items stagger in at `delay: 0.05s` each

#### `/purchase-requests/create`
- Form sections (`fieldset` blocks) fade in sequentially as user scrolls
- Line items table: new row addition animates in with `height: 0 → auto`, `opacity: 0 → 1`, duration 0.2s
- Row removal: `height → 0`, `opacity → 0`, duration 0.15s before DOM removal
- Attachment upload area: drag-over state animates border color and scale (`scale: 1.01`)
- File added: thumbnail slides in from left, `x: -12 → 0`, `opacity: 0 → 1`

#### `/purchase-requests/[id]` and PO/APRI equivalents
- `AnimatedWorkflowStepper` at top
- Header detail section fades in
- Line items table fades in with slight delay
- Tabs (Details / Attachments / Comments / History): tab content fades in on switch, `opacity: 0 → 1`, duration 0.18s
- `AnimatedApprovalTimeline` in History tab

#### `/purchase-requests/[id]/approve` and PO equivalent
- Approve/Reject buttons: confirmation state — button morphs (text changes, color changes) using `AnimatePresence` on button label
- After action submitted: success checkmark animation using `pathLength: 0 → 1` SVG stroke animation

#### All list pages (`/purchase-requests`, `/purchase-orders`, `/ap-reserve-invoices`)
- Table rows: `hover:bg-indigo-50` CSS transition only (no Framer Motion per-row)
- Pagination change: table body fades out and back in, `opacity: 0 → 1`, duration 0.15s
- Filter panel open: `AnimatedDrawer` on mobile, inline expand on desktop

---

### Component File Structure

```
/components
  /ui
    AnimatedPageWrapper.jsx
    AnimatedDashboardCard.jsx
    AnimatedStatusBadge.jsx
    AnimatedApprovalTimeline.jsx
    AnimatedModal.jsx
    AnimatedDrawer.jsx
    AnimatedEmptyState.jsx
    AnimatedWorkflowStepper.jsx
    AnimatedSkeletonLoader.jsx
    AnimatedItemSearchDropdown.jsx
    index.js                      ← re-exports all above
  /layout
    Sidebar.jsx
    TopBar.jsx
    PageHeader.jsx
  /forms
    PRForm.jsx
    POForm.jsx
    APRIForm.jsx
    ItemSearchInput.jsx
    CreateItemModal.jsx
    ApproveModal.jsx
    RejectModal.jsx
  /tables
    DataTable.jsx                 ← generic reusable table
    PRTable.jsx
    POTable.jsx
    APRITable.jsx
  /sap
    SAPStatusIndicator.jsx
    SAPIntegrationLog.jsx
    SAPRetryButton.jsx
```

---

### Tailwind Config Additions

Add to `tailwind.config.js`:

```js
theme: {
  extend: {
    fontFamily: {
      sans: ['Inter', 'sans-serif'],
      mono: ['JetBrains Mono', 'monospace'],
    },
    colors: {
      brand: {
        50: '#eef2ff',
        100: '#e0e7ff',
        500: '#6366f1',
        600: '#4f46e5',
        700: '#4338ca',
        900: '#312e81',
      }
    },
    keyframes: {
      shimmer: {
        '0%': { backgroundPosition: '-200% 0' },
        '100%': { backgroundPosition: '200% 0' },
      },
    },
    animation: {
      shimmer: 'shimmer 1.6s linear infinite',
    },
  },
},
```

---

## IMPLEMENTATION NOTES FOR CURSOR

- Use `framer-motion` for all animations. Import `{ motion, AnimatePresence, useReducedMotion }` only — no other animation libraries.
- Always check `useReducedMotion()` and skip animations when it returns `true`.
- Use `mongoose` for all MongoDB operations. Define models in `/models/`.
- Use `jose` or `jsonwebtoken` for JWT.
- Use `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner` for S3.
- Use `odbc` npm package for HANA connections.
- SAP Service Layer authentication returns a session cookie — store it in memory (module-level variable) and reuse; re-login if 401 is received.
- All approval flow logic must read steps from `approval_matrix` collection, not hardcoded arrays.
- Auto-generate portal document numbers (PR-YYYYMMDD-0001 format) using a counter in `system_settings`.
- Protect all API routes with `withAuth` middleware that checks JWT and required permission string.
- On the frontend, use React Context or Zustand for auth state.
- Use `react-query` or SWR for data fetching with cache invalidation.
- Render approval history as a vertical stepper/timeline component reused across PR, PO, and APRI detail pages.
- The item search autocomplete should debounce at 300ms before calling the API.
- Create New Item modal should be a portal/overlay that does not unmount the PR creation form.
- All list pages must support URL-based filters (query params) so links are shareable.

---

# ADDENDUM — Required Clarifications

This addendum supersedes the original where they overlap.

## Phase 0 — Foundations (run before Phase 1)

1. Pin versions: **Next.js 14.2.x**, **React 18**, **Tailwind 3.4.x**, **Node ≥ 20**.
2. Hosting target: **self-hosted Node** (Docker / VM). NOT Vercel/Edge — `odbc` is a native binding and cannot run on Edge runtimes.
3. Initialize repo with: ESLint (`next/core-web-vitals`) + Prettier (JS-only).
4. Set the full folder structure (below).
5. Define **all 13 Mongoose model files** as empty schemas plus the new `EmailGroup` model.
6. Implement `/lib/health.js` and four connectivity probes (Mongo / SAP SL / HANA / S3 / SMTP). Expose at `/api/health` (Admin-only).
7. Build the seed script (`npm run seed`):
   - Default roles (Admin, Requester, WHS Approver, Project Manager, Finance, Procurement).
   - Default approval matrix rows for PR and PO.
   - Default email groups (one row per event in the Phase 8 table).
   - One **admin user** from `SEED_ADMIN_USERNAME` and `SEED_ADMIN_PASSWORD`. Refuse to run on a non-empty DB.
8. Commit. Pause for review before Phase 1.

## Folder Structure

```
/app                  Next.js App Router routes (pages + /api)
/components
  /ui                 (Animated* components, primitives)
  /layout             (Sidebar, TopBar, PageHeader)
  /forms              (PRForm, POForm, APRIForm, modals)
  /tables             (DataTable + per-doc tables)
  /sap                (SAP-specific UI)
/lib
  mongodb.js
  sapServiceLayer.js
  sapHana.js
  s3.js
  email.js
  auth.js             (signToken, verifyToken, withAuth)
  approvalEngine.js   (reads approval_matrix, advances steps)
  numbering.js        (atomic portal-number generator)
  errors.js           (envelope helpers)
  health.js
  /validators         (Zod schemas, one per resource)
  /sap/mappers        (prToSap.js, poToSap.js, apReserveInvoiceToSap.js)
/middleware
  withAuth.js
/models               (one file per collection, PascalCase, default export)
/seed
  roles.js
  admin.js
  approvalMatrix.js
  emailGroups.js
/tests
  /unit
  /api
  /e2e
```

## Naming Conventions

- Components: `PascalCase.jsx`, one component per file.
- Mongoose models: `PascalCase.js`, one model per file, default-exported.
- Libs / utils: `camelCase.js`.
- API handlers: `app/api/.../route.js` exporting `GET / POST / PUT / DELETE` named functions.
- Zod schemas: `<resource>Schema`, exported from `/lib/validators/<resource>.js`.

## Auth

- Password hashing: **bcrypt**, cost factor **12**.
- JWT transport: **httpOnly + Secure + SameSite=Lax cookie** named `portal_session`. Token never reaches client JS.
- Client auth state: result of `GET /api/auth/me`, kept in **Zustand**.
- Rate limit `/api/auth/login`: 5 attempts / 15 minutes / (IP + username).
- Account lockout: 10 consecutive failures sets `user.lockedUntil = now + 30 min`.
- `withAuth(handler, requiredPermissions[])` runs on every protected route and returns 401 or 403 with the standard error envelope.

## API Contract

- **Success envelope:** `{ success: true, data, pagination?: { page, limit, total, totalPages } }`.
- **Failure envelope:** `{ success: false, message, error, code? }`.
- **Validation failures (400):** `{ success: false, message: 'Validation failed', errors: [{ path, message }] }`.
- **Conflict (409, optimistic lock):** `{ success: false, message: 'Document changed, please reload' }`.
- **List query params (all list endpoints):**
  `?page=1&limit=25&sort=createdAt&order=desc&q=<text>&status=<...>&from=<ISO>&to=<ISO>` plus resource-specific filters.
- Build a shared `parseListQuery(req)` helper in `/lib/errors.js` or a sibling util.
- All POST/PUT bodies validated by Zod **before** any DB work.
- All Mongoose models declared with `{ optimisticConcurrency: true }`. Approve / reject / SAP-create endpoints use `findOneAndUpdate` with explicit `__v` match.

## SAP Mapping (worked examples)

Implement under `/lib/sap/mappers/`. The mappers are the single source of truth for the MongoDB → SAP payload conversion.

### `prToSap.js` — POST `/PurchaseRequests`
```js
{
  ReqType: 12,                       // 12 = pre-defined for SAP B1 user-requester (confirm in env)
  Requester: pr.requester,           // user mapping
  ReqDate:  pr.requiredDate,         // YYYY-MM-DD
  DocDate:  pr.documentDate,
  DocDueDate: pr.requiredDate,
  Comments: pr.remarks,
  BPL_IDAssignedToInvoice: branchIdFor(pr.department),
  U_Department: pr.department,
  DocumentLines: pr.lines.map(l => ({
    ItemCode: l.itemCode,
    Quantity: l.quantity,
    WarehouseCode: l.warehouseCode,
    ProjectCode: l.projectCode,
    CostingCode: l.costCenter,
    UnitPrice: l.estimatedUnitPrice,
    RequiredDate: l.requiredDate,
    U_Department: l.uDepartment,
    U_DelDate: l.uDelDate,
    U_Rate: l.uRate
  }))
}
```

### `poToSap.js` — POST `/PurchaseOrders`
```js
{
  CardCode: po.vendor,
  DocDate: po.documentDate,
  DocDueDate: po.requiredDate,
  Comments: po.remarks,
  BPL_IDAssignedToInvoice: branchIdFor(po.department),
  DocumentLines: po.lines.map(l => ({
    ItemCode: l.itemCode,
    Quantity: l.quantity,
    UnitPrice: l.unitPrice,
    WarehouseCode: l.warehouseCode,
    ProjectCode: l.projectCode,
    CostingCode: l.costCenter,
    U_Department: l.uDepartment,
    U_DelDate: l.uDelDate,
    U_Rate: l.uRate
  }))
}
```

### `apReserveInvoiceToSap.js` — POST `/PurchaseInvoices` (Reserve = true)
**Critical:** lines must reference the source PO via `BaseType / BaseEntry / BaseLine`.
```js
{
  CardCode: apri.vendor,
  DocDate: apri.documentDate,
  DocDueDate: apri.dueDate,
  ReserveInvoice: 'tYES',
  Comments: apri.remarks,
  DocumentLines: apri.lines.map(l => ({
    BaseType: 22,                     // 22 = Purchase Order
    BaseEntry: apri.relatedSAPPODocEntry,
    BaseLine:  l.relatedPOLineNum,    // SAP LineNum from PO
    ItemCode: l.itemCode,
    Quantity: l.quantity,
    WarehouseCode: l.warehouseCode,
    ProjectCode: l.projectCode,
    CostingCode: l.costCenter
  }))
}
```

### UDF Convention
SAP UDFs use **`U_` + PascalCase** (e.g. `U_Department`, `U_DelDate`, `U_Rate`, `U_TaxCode`). Never send camelCase UDF names to SAP.

### Currency / Branch / Tax
- Currency: default to company currency; always set `DocCurrency`; set `DocRate` if non-base.
- Branch (`BPL_IDAssignedToInvoice`): resolved via `system_settings.branch_map[user.department]`.
- Tax: per-line `U_TaxCode` (default from item master).

### HANA Item Search (corrected)
```sql
SELECT ItemCode, ItemName, PurPackMsr, ItmsGrpNam
FROM OITM
WHERE validFor = 'Y'
  AND ( UPPER(ItemCode) LIKE UPPER(?) OR UPPER(ItemName) LIKE UPPER(?) )
LIMIT 20
```

### SAP SL Session
- Single in-memory cookie per Node process.
- Refresh on 401, retry the original request once.
- Single deployment instance per environment (or back the session in Redis if scaling).

## Vendor / PR → PO Conversion

- PR header has **no vendor**; PR lines carry a suggested vendor.
- At PO creation, the user selects a vendor.
- If a PR has lines with **multiple vendors**, the system creates **one PO per vendor** (each PO contains only that vendor's lines).
- PR statuses extended: `'Partially Ordered'` may appear between `Created in SAP` and `Fully Ordered` once partial conversion is tracked (line-level `orderedQty`).

## Attachments

- **Max size:** 25 MB per file.
- **Allowed MIME types:** `application/pdf`, `image/png`, `image/jpeg`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`, `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`, `application/vnd.ms-excel`, `text/csv`.
- **Upload (preferred):** client POSTs to `/api/attachments/sign-upload` to receive a pre-signed PUT URL, uploads directly to S3, then POSTs metadata to the server to persist the `Attachment` row.
- **Download:** server returns short-lived (5 min) pre-signed GET URLs.
- S3 key pattern: `{documentType}/{documentId}/{ulid}-{safeFileName}`.

## MongoDB Indexes (declare in model files)

- `users`: unique `username`, unique `email`.
- `roles`: unique `name`.
- `approval_matrix`: `{ documentType: 1, stepOrder: 1 }` (compound, unique).
- `purchase_requests`: unique `portalPRNumber`; `{ status: 1, currentApprovalStep: 1 }`; `{ requester: 1, createdAt: -1 }`; `sapPRDocEntry`.
- `purchase_orders`: unique `portalPONumber`; `{ status: 1, currentApprovalStep: 1 }`; `relatedPRId`; `sapPODocEntry`.
- `ap_reserve_invoices`: unique `portalAPNumber`; `relatedPOId`; `sapAPDocEntry`.
- `attachments`: `{ documentType: 1, documentId: 1 }`; `s3Key` unique.
- `comments`: `{ documentType: 1, documentId: 1, postedAt: -1 }`.
- `approval_history`: `{ documentType: 1, documentId: 1, actionDate: -1 }`.
- `email_logs`: `{ relatedDocumentType: 1, relatedDocumentId: 1, sentAt: -1 }`.
- `sap_integration_logs`: `{ documentType: 1, documentId: 1, createdAt: -1 }`.
- `email_groups`: unique `eventKey`.

## Portal Numbering (atomic)

`/lib/numbering.js` exposes `nextNumber(prefix, date)`:
```js
const key = `${prefix.toLowerCase()}_seq_${ymd}`   // e.g. pr_seq_20260520
const { value } = await SystemSettings.findOneAndUpdate(
  { key },
  { $inc: { seq: 1 } },
  { upsert: true, new: true, setDefaultsOnInsert: true }
)
return `${prefix}-${ymd}-${String(value.seq).padStart(4,'0')}`
```

## EmailGroup Model (new)

```js
// EmailGroup
{
  eventKey: String,              // e.g. 'pr.created', 'po.sap.failed' (unique)
  recipients: [{
    userId: ObjectId,            // optional - direct user
    email: String,               // optional - raw email
    role: ObjectId               // optional - dynamic resolution
  }],
  ccRoles: [ObjectId],
  isActive: Boolean,
  updatedAt: Date
}
```
- Routes: `GET/POST /api/email-groups`, `PUT /api/email-groups/[id]`.
- Email layer resolves recipients via this override **first**; on empty/inactive group it falls back to role-based resolution.
- If no recipients can be resolved, log an `email_logs` row with `emailStatus: 'Failed'` and `errorMessage: 'No recipients resolved for event <key>'` and notify Admin once per day (dedup key on event).

## Sidebar ↔ Permission Map

| Nav item | Required permission |
|---|---|
| Dashboard | (any authenticated) |
| Purchase Requests | `pr.create` OR `pr.approve.whs` OR `pr.approve.pm` OR `view.all` |
| Purchase Orders | `po.create` OR `po.approve.pm` OR `po.approve.finance` OR `view.all` |
| A/P Reserve Invoices | `apinvoice.create` OR `view.all` |
| Settings → Users | `admin.users` |
| Settings → Roles | `admin.roles` |
| Settings → Approval Matrix | `admin.approval_matrix` |
| Settings → Email Groups | `admin.settings` |
| Settings → SAP Integration | `admin.settings` |
| Settings → System Logs | `admin.settings` OR `view.all` |

## Date / Time / Locale

- Store all dates as UTC `Date` in MongoDB.
- Wire format: ISO 8601 (`YYYY-MM-DDTHH:mm:ssZ`).
- Display: user-local timezone via `Intl.DateTimeFormat`. No moment.js. Use `date-fns` if a helper is needed.
- SAP date fields use `YYYY-MM-DD`.

## Caching SAP Lookups

- `/api/sap/vendors`, `/warehouses`, `/projects`, `/cost-centers`: server-side in-memory cache, TTL **5 minutes**, `Cache-Control: private, max-age=300` on the response.
- `/api/sap/items/search`: **no cache** (live).

## Testing

- **Vitest** for unit tests (validators, mappers, numbering, approval engine).
- **API tests** with `mongodb-memory-server` and a mocked SAP SL client (`/lib/sap/__mocks__/`).
- **Playwright** e2e: one happy-path scenario per phase as it lands; baseline scenario is login → create PR → approve at each step → mock SAP success → assert `Created in SAP`.
- Coverage gate in CI: lines ≥ 70 %, branches ≥ 60 %.
- `npm run lint && npm test` must pass before any phase commit.

## Operational / Security Rules

- Never log SAP password, JWT secret, or any cookie value.
- All ODBC connections closed in `finally` blocks.
- All SAP / S3 / SMTP errors logged with their respective log collections — never thrown raw to the client.
- `/api/health` is Admin-only and returns per-dependency status (mongo, sap, hana, s3, smtp) with latencies.
- Single deployment instance per environment (see SAP SL Session note above).

---

## Definition of Ready (before Phase 1 starts)

- Phase 0 committed and reviewed.
- `.env.local` populated with all variables in this document.
- `npm run seed` succeeds against a fresh database.
- `/api/health` returns `success: true` for every dependency.
- Lint and tests pass.
