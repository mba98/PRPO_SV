# Full Project Inventory Report — PRPO_SV

**Generated:** Read-only inventory of the procurement portal (Next.js 14 App Router, MongoDB/Mongoose, SAP B1 Service Layer).  
**Scope:** No application code was modified to produce this report.

---

## 1. Application Pages

### Root & auth (outside portal group)

| Route | File | Purpose | Audience | Main components |
|-------|------|---------|----------|-----------------|
| `/` | `app/page.js` | Redirects to `/dashboard` | System | — |
| `/login` | `app/login/page.js` | Sign-in; server loads session for “Continue as user” / sign-out UX | User-facing (unauthenticated) | `LoginForm`, `SunMoonToggle`, `LanguageSelector` |

**Layouts:** `app/layout.js` (`AppProviders`), `app/loading.js` (`PortalLoader`).

### Portal group `(portal)` — requires valid `portal_session` (`app/(portal)/layout.js`)

| Route | File | Purpose | Audience | Main components |
|-------|------|---------|----------|-----------------|
| `/dashboard` | `app/(portal)/dashboard/page.js` | KPIs and recent activity | User-facing | `SectionPageHeader`, `DashboardView` |
| `/purchase-requests` | `app/(portal)/purchase-requests/page.js` | PR list, filters, export | User-facing | `PrListManager`, `SectionPageHeader` |
| `/purchase-requests/create` | `app/(portal)/purchase-requests/create/page.js` | New PR | User-facing | `PrCreateForm` |
| `/purchase-requests/approved-for-po` | `app/(portal)/purchase-requests/approved-for-po/page.js` | PRs eligible for PO creation | User-facing | `ApprovedForPoManager` |
| `/purchase-requests/[id]` | `app/(portal)/purchase-requests/[id]/page.js` | PR detail (tabs: details, attachments, comments, history) | User-facing | `PrDetailView` |
| `/purchase-requests/[id]/approve` | `app/(portal)/purchase-requests/[id]/approve/page.js` | PR approval step UI | User-facing (approvers) | `PrApproveForm` → `DocumentApproveForm` |
| `/purchase-orders` | `app/(portal)/purchase-orders/page.js` | PO list | User-facing | `PoListManager` |
| `/purchase-orders/[id]` | `app/(portal)/purchase-orders/[id]/page.js` | PO detail + edit | User-facing | `PoDetailView`, `PoEditForm` |
| `/purchase-orders/[id]/approve` | `app/(portal)/purchase-orders/[id]/approve/page.js` | PO approval | User-facing (approvers) | `PoApproveForm` |
| `/purchase-orders/ready-for-ap-reserve-invoice` | `app/(portal)/purchase-orders/ready-for-ap-reserve-invoice/page.js` | POs ready for APRI; inline create | User-facing | Inline page (table + `apiFetch`), `SectionPageHeader` |
| `/ap-reserve-invoices` | `app/(portal)/ap-reserve-invoices/page.js` | APRI list | User-facing | `ApriListManager` |
| `/ap-reserve-invoices/[id]` | `app/(portal)/ap-reserve-invoices/[id]/page.js` | APRI detail | User-facing | `ApriDetailView` |

### Settings (admin/internal) — `app/(portal)/settings/layout.js` wraps `SettingsPageGuard`

| Route | File | Purpose | Audience | Main components |
|-------|------|---------|----------|-----------------|
| `/settings/users` | `app/(portal)/settings/users/page.js` | User CRUD | Admin (`admin.users`) | `UsersManager` |
| `/settings/roles` | `app/(portal)/settings/roles/page.js` | Roles & permissions | Admin (`admin.roles`) | `RolesManager` |
| `/settings/approval-matrix` | `app/(portal)/settings/approval-matrix/page.js` | PR/PO approval steps | Admin (`admin.approval_matrix`) | `ApprovalMatrixManager` |
| `/settings/email-groups` | `app/(portal)/settings/email-groups/page.js` | Notification recipients | Admin (`admin.settings`) | `EmailGroupsManager` |
| `/settings/sap-integration` | `app/(portal)/settings/sap-integration/page.js` | SAP/Mongo health checks | Admin (`admin.settings`) | `HealthCheckGate` → `HealthCheckPanel` |
| `/settings/system-logs` | `app/(portal)/settings/system-logs/page.js` | Email + SAP integration logs | Admin (`admin.settings`, `view.all`) | `SystemLogsManager` |

**Route protection:** `middleware.js` validates JWT on pages; portal layout also verifies cookie and loads user into `AuthProvider` + `PortalShell`.

---

## 2. API Routes

**57** `route.js` files under `app/api/`.

### Auth model

| Category | Detail |
|----------|--------|
| **withAuth protected** | 54 route modules (all business/SAP/admin/export routes) |
| **Public allowlist** | `lib/apiPublicRoutes.js`: `POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/logout` |
| **Middleware** | Invalid session cookie on non-allowlisted `/api/*` → **401** + cookie clear |
| **Potentially unsafe** | None identified; `tests/unit/apiAuthCoverage.test.js` enforces withAuth or allowlist on every route |

`/api/auth/me` is allowlisted for middleware but **requires a valid session in the handler** (returns 401 if missing).

### Auth

| Method | Route | File | Purpose | Auth | Service / model |
|--------|-------|------|---------|------|-----------------|
| POST | `/api/auth/login` | `app/api/auth/login/route.js` | Sign-in, set cookie | Public allowlist | `authLogin.authenticateUser`, `auth.setSessionCookie` |
| GET | `/api/auth/me` | `app/api/auth/me/route.js` | Current user | Public allowlist (session required) | `auth`, `authLogin.sanitizeUser` |
| POST | `/api/auth/logout` | `app/api/auth/logout/route.js` | Clear session | Public allowlist | `auth.clearSessionCookie` |

### Purchase requests

| Method | Route | File | Purpose | Auth perms | Service / model |
|--------|-------|------|---------|------------|-----------------|
| GET, POST | `/api/purchase-requests` | `purchase-requests/route.js` | List, create | `pr.create`, approvers, `view.all` | `purchaseRequestsService`, `PurchaseRequest` |
| GET, PUT | `/api/purchase-requests/[id]` | `.../[id]/route.js` | Get, update draft | `pr.create`, `view.all` | `purchaseRequestsService` |
| POST | `.../[id]/submit` | submit | Submit for approval | `pr.create` | `purchaseRequestsService` |
| POST | `.../[id]/approve` | approve | Approve step | `pr.approve.*`, `view.all` | `purchaseRequestsService`, `approvalEngine` |
| POST | `.../[id]/reject` | reject | Reject | same | same |
| POST | `.../[id]/create-sap-pr` | create SAP PR | `admin.settings`, `view.all` | `sap/prSap`, `PurchaseRequest` |
| POST | `.../[id]/retry-sap` | Retry SAP PR | `admin.settings`, `view.all` | `purchaseRequestsService` |
| GET | `/api/purchase-requests/approved-for-po` | approved-for-po | PRs for PO | `po.create`, `view.all` | `purchaseOrdersService.listPrsReadyForPo` |

### Purchase orders

| Method | Route | File | Purpose | Auth perms | Service / model |
|--------|-------|------|---------|------------|-----------------|
| GET | `/api/purchase-orders` | `purchase-orders/route.js` | List | PO list perms | `purchaseOrdersService`, `PurchaseOrder` |
| GET, PUT | `/api/purchase-orders/[id]` | `[id]/route.js` | Get, edit | `po.create`, `view.all`, `admin.settings` | `purchaseOrdersService` |
| POST | `.../approve`, `.../reject` | approve/reject | Workflow | `po.approve.*`, `view.all` | `purchaseOrdersService`, `approvalEngine` |
| POST | `.../from-pr/[prId]` | from-pr | Create PO from PR | `po.create`, `view.all` | `purchaseOrdersService` |
| POST | `.../create-sap-po`, `.../retry-sap` | SAP PO | Admin retry/create | `sap/poSap`, `PurchaseOrder` |
| GET | `/api/purchase-orders/ready-for-ap-reserve-invoice` | ready list | APRI readiness | `apinvoice.create`, `view.all` | `apReserveInvoicesService`, `poApriReadiness` |

### AP reserve invoices

| Method | Route | File | Purpose | Auth perms | Service / model |
|--------|-------|------|---------|------------|-----------------|
| GET | `/api/ap-reserve-invoices` | `ap-reserve-invoices/route.js` | List | `apinvoice.create`, `view.all` | `apReserveInvoicesService`, `APReserveInvoice` |
| GET | `/api/ap-reserve-invoices/[id]` | `[id]/route.js` | Detail (sanitized; no `sapResponse` in API) | same | `apReserveInvoicesService` |
| POST | `.../from-po/[poId]` | from-po | Create APRI | `apinvoice.create` | `apReserveInvoicesService`, `sap/apriSap` |
| POST | `.../[id]/retry-sap` | retry | SAP APRI | `admin.settings`, `view.all` | `apReserveInvoicesService` |

### Attachments, comments, approval history

| Method | Route | Purpose | Auth | Service / model |
|--------|-------|---------|------|-----------------|
| POST | `/api/attachments/sign-upload` | Presigned PUT URL | Doc-type perms | `attachmentsService`, `s3`, `Attachment` |
| POST | `/api/attachments/complete-upload` | Persist metadata | same | `attachmentsService`, `auditHistory` |
| GET | `/api/attachments/[documentType]/[documentId]` | List/download | same | `attachmentsService`, `documentAccess` |
| GET, POST | `/api/comments`, `.../[type]/[id]` | Comments | Doc perms | `commentsService`, `Comment` |
| GET | `/api/approval-history/[documentType]/[documentId]` | Timeline | Doc perms | `approvalHistoryService`, `ApprovalHistory` |

### SAP lookups & items

| Method | Route | Purpose | Auth | Service |
|--------|-------|---------|------|---------|
| GET | `/api/sap/vendors`, `warehouses`, `projects`, `cost-centers` | Lookups | PR/PO create perms | `sapLookups`, `sapLookupApi` |
| GET | `/api/sap/items/search`, `/api/sap/items/[itemCode]` | Item search/detail | Item perms | `sapItems` |
| POST | `/api/sap/items/create` | Create item in SAP | `items.create` | `sapItems`, `ItemCreationLog` |
| GET, POST | `/api/sap/connection-test` | SL connectivity | `admin.settings` | `sapServiceLayer` |
| GET | `/api/sap/integration-logs` | SAP logs | `admin.settings`, `view.all` | `sapIntegrationLogsService` |

### Dashboard, export, admin

| Method | Route | Purpose | Auth | Service |
|--------|-------|---------|------|---------|
| GET | `/api/dashboard/summary`, `/api/dashboard/recent` | Dashboard data | Broad read perms | `dashboardService` |
| GET | `/api/export/purchase-requests`, `purchase-orders`, `ap-reserve-invoices` | Excel export | Module list perms | `excelExport` |
| GET, POST | `/api/users`, PUT/DELETE `users/[id]` | Users | `admin.users` | `usersService`, `User` |
| GET | `/api/users/picklist` | User picklist | Picklist perms | `usersService` |
| GET, POST | `/api/roles`, PUT/DELETE `roles/[id]` | Roles | `admin.roles` | `rolesService`, `Role` |
| GET | `/api/roles/picklist` | Role picklist | Admin picklist | `rolesService` |
| GET, POST | `/api/approval-matrix`, PUT `[id]` | Matrix | `admin.approval_matrix` | `approvalMatrixService` |
| GET, POST | `/api/email-groups`, PUT `[id]` | Email groups | `admin.settings` | `emailGroupsService` |
| GET | `/api/email/logs` | Email logs | `admin.settings`, `view.all` | `emailLogsService` |
| POST | `/api/email/test` | SMTP test | `admin.settings` | `email` |
| GET | `/api/health` | Dependency health | `admin.settings` | `health` |
| GET | `/api/lookups/departments` | Department list | PR/PO perms | `lookups/departments` |

---

## 3. Core Components

### Layout (`components/layout/`)

| Component | Purpose | Used by |
|-----------|---------|---------|
| `PortalShell` | Sidebar + top bar + main content | `(portal)/layout.js` |
| `Sidebar`, `SidebarNav`, `SidebarIdentity`, `SidebarSignOut` | Navigation, branding, logout confirm | `PortalShell` |
| `TopBar` | Logos, mobile menu trigger, quick actions | `PortalShell` |
| `QuickActionsMenu` | Theme, locale, accent, sign-out | `TopBar` |
| `MobileNav` | Mobile drawer nav | `PortalShell` |
| `SectionPageHeader` | i18n page titles | Most list/settings pages |
| `PageHeader` | Title/description/actions shell | Via `SectionPageHeader` |
| `PortalBrandLogo` | SPC/SV logos | `TopBar` |

### Auth / login

| Component | Purpose | Used by |
|-----------|---------|---------|
| `LoginForm` | Credentials, continue-as, sign-out | `app/login/page.js` |
| `AuthProvider` | Client session / permissions | `(portal)/layout.js` |
| `AppProviders` | Theme, locale, transition overlay | `app/layout.js` |

### Purchase requests (`components/purchase-requests/`)

| Component | Purpose | Used by |
|-----------|---------|---------|
| `PrListManager` | List, filters, pagination, export | `/purchase-requests` |
| `PrDetailView` | Detail tabs, SAP retry, create PO panel | `/purchase-requests/[id]` |
| `PrCreateForm` | Create + submit PR | `/purchase-requests/create` |
| `PrApproveForm` | PR approval wrapper | approve page |
| `ApprovedForPoManager` | Approved PR → PO flow | approved-for-po page |
| `CreatePoFromPrPanel` | PO from PR on detail | `PrDetailView` |
| `CreateItemModal` | SAP item creation | `PrCreateForm` |
| `ItemSearchInput` | Re-export of lookups | `PrCreateForm` (legacy path) |

### Purchase orders (`components/purchase-orders/`)

| Component | Purpose | Used by |
|-----------|---------|---------|
| `PoListManager` | PO list | `/purchase-orders` |
| `PoDetailView` | PO detail, edit, tabs | `/purchase-orders/[id]` |
| `PoEditForm` | Draft PO edit | `PoDetailView` |
| `PoApproveForm` | PO approval wrapper | approve page |

### AP reserve invoices (`components/ap-reserve-invoices/`)

| Component | Purpose | Used by |
|-----------|---------|---------|
| `ApriListManager` | APRI list | `/ap-reserve-invoices` |
| `ApriDetailView` | APRI detail, email log tab | `/ap-reserve-invoices/[id]` |

### Settings (`components/settings/`)

| Component | Purpose | Used by |
|-----------|---------|---------|
| `SettingsPageGuard` | Path-based settings ACL | `settings/layout.js` |
| `UsersManager`, `RolesManager`, `ApprovalMatrixManager` | Admin CRUD | settings pages |
| `EmailGroupsManager`, `EmailLogsManager` | Email config/logs | settings pages |
| `HealthCheckGate`, `HealthCheckPanel` | SAP/Mongo checks | sap-integration |
| `SapIntegrationLogsManager`, `SystemLogsManager` | Log viewers | system-logs |
| `SettingsTable` | Shared table wrapper | managers |

### Shared / cross-cutting

| Group | Components | Purpose |
|-------|------------|---------|
| **Approval** | `DocumentApproveForm`, `ApprovalTimeline`, `ApprovalHistoryDrawer` | Approve/reject + history |
| **Attachments** | `AttachmentPanel`, `AttachmentDropzone` | S3 upload flow |
| **Comments** | `CommentsPanel` | Document comments |
| **Workflow** | `WorkflowStepper` | Step UI on PR/PO/APRI |
| **Lookups** | `ItemSearchInput`, `VendorSelect`, `WarehouseSelect`, `ProjectSelect`, `CostCenterSelect`, `DepartmentSelect`, `SapLookupCombobox` | SAP/portal lookups in forms |
| **Lists** | `ListPagination` | URL-synced pagination |
| **Dashboard** | `DashboardView` | Dashboard cards |
| **UI** (`components/ui/`) | `Button`, `Input`, `PasswordInput`, `PortalLoader`, `AnimatedTabs`, `AnimatedStatusBadge`, modals, drawers, theme/locale controls, `DataTable`, etc. | Design system used app-wide |

**Review candidates (exported but little/no runtime use):**

- `components/navigation/PoPageQuickLinks.jsx` — no imports found in codebase.
- `components/ui/ThemeSelector.jsx`, `ColorModeSelector.jsx` — superseded by `SunMoonToggle` / quick menu (only in `ui/index.js` exports).

---

## 4. Services and Libraries (`lib/`)

Approximately **114** JS modules. Grouped by role; **critical for production** noted.

### Auth & security (critical)

| File | Purpose | Used by |
|------|---------|---------|
| `auth.js` | JWT, `withAuth`, cookies, session | All protected APIs, portal layout |
| `authLogin.js` | Login, bcrypt, `sanitizeUser` | `/api/auth/login` |
| `jwtConfig.js` | Secret validation, cookie options | `auth`, `sessionJwt`, `instrumentation` |
| `sessionJwt.js` | Edge JWT verify | `middleware.js` |
| `apiPublicRoutes.js` | Public API allowlist | `middleware`, tests |
| `effectivePermissions.js`, `permissions.js` | Permission resolution | Auth, nav, services |
| `rateLimit.js` | Login throttling | `authLogin` |
| `documentAccess.js` | Document ACL | Attachments, comments, history |

### Domain services (critical)

| File | Purpose | Routes / components |
|------|---------|---------------------|
| `purchaseRequestsService.js` | PR CRUD, approval, SAP hooks | PR APIs, `PrDetailView` |
| `purchaseOrdersService.js` | PO CRUD, from-PR, SAP | PO APIs |
| `apReserveInvoicesService.js` | APRI list/detail/create/retry | APRI APIs |
| `approvalEngine.js` | Approve/reject state machine | PR/PO approve APIs |
| `approvalMatrixService.js` | Matrix CRUD | settings + engine |
| `approvalHistoryService.js` | History list | history API, timeline |
| `attachmentsService.js` | S3 sign/complete/list | attachment APIs |
| `commentsService.js` | Comments | comment APIs |
| `usersService.js`, `rolesService.js` | Admin users/roles | user/role APIs |
| `dashboardService.js` | Dashboard aggregates | dashboard APIs |
| `emailGroupsService.js`, `emailLogsService.js` | Notifications | email APIs |
| `email.js`, `emailNotify.js`, `emailTemplates.js` | SMTP send | notifications |
| `numbering.js` | Portal document numbers | PR/PO/APRI create |
| `auditHistory.js` | History logging helper | services |

### SAP integration (critical)

| Path | Purpose |
|------|---------|
| `sapServiceLayer.js` | B1 Service Layer HTTP client |
| `sap/prSap.js`, `sap/poSap.js`, `sap/apriSap.js` | Create/retry documents |
| `sap/mappers/prToSap.js`, `poToSap.js`, `apReserveInvoiceToSap.js` | Payload mapping |
| `sapLookups.js`, `sapLookupApi.js`, `sapItems.js` | Lookups & items |
| `sap/sapErrors.js`, `sapIntegrationLog.js` | Errors & logging |
| `poApriReadiness.js`, `prPoReadiness.js` | Business readiness rules |

### Infrastructure (critical)

| File | Purpose |
|------|---------|
| `mongodb.js`, `mongodbUri.js` | DB connection |
| `s3.js` | S3 presign |
| `errors.js`, `apiHelpers.js`, `apiClient.js` | API envelope & client |
| `listQuery.js`, `listUrl.js`, `visibilityFilters.js` | List/query helpers |
| `health.js` | Health check |
| `excelExport.js` | Exports |

### UI / i18n / theme (production UI)

| Path | Purpose |
|------|---------|
| `i18n/en.js`, `i18n/ar.js`, `i18n/index.js` | Bilingual UI |
| `hooks/useI18n.js`, `useEffectivePermissions.js` | Client hooks |
| `navigation.js`, `appRoutes.js`, `settingsRoutePermissions.js` | Nav & route guards |
| `theme/*`, `branding/portalLogos.js` | Theme & logos |

### Validators (`lib/validators/`) — critical for input safety

`auth`, `purchaseRequest`, `purchaseOrder`, `apReserveInvoice`, `user`, `role`, `attachment`, `comment`, `approvalMatrix`, `emailGroup`, `sapLookup`, `health`, `common`.

### Lower priority / supporting

`logRedaction.js`, `loadEnvLocal.js`, `formatDate.js`, `dateUtils.js`, `attachmentDisplayName.js`, `attachmentUploadHelpers.js`, `uploadClient.js`, `sap/__mocks__/*` (tests only).

### Related client stores (`stores/`)

`authStore.js`, `languageStore.js`, `themeStore.js`, `colorModeStore.js`, `navigationLoadingStore.js`, `uiTransitionStore.js` — used by layout and UI components (not under `lib/` but production-critical).

---

## 5. Models

| Model | Collection purpose | Critical fields | Indexes | Related routes/services |
|-------|-------------------|-----------------|---------|-------------------------|
| **User** | Portal accounts | `username`, `email`, `passwordHash`, `role`, `sapRequesterCode`, `permissions`, lockout | `username`, `email` unique | `usersService`, auth |
| **Role** | RBAC | `name`, `permissions` | `name` unique | `rolesService` |
| **PurchaseRequest** | PR documents | `portalPRNumber`, `status`, `currentApprovalStep`, `lines`, `sapPRDocEntry/Num`, `sapResponse` (DB) | `portalPRNumber` unique; status, requester, SAP, dept, dates | PR APIs, `purchaseRequestsService` |
| **PurchaseOrder** | PO documents | `portalPONumber`, `relatedPRId`, `vendor`, `status`, SAP fields | `portalPONumber` unique; status, relatedPR, SAP | PO APIs, `purchaseOrdersService` |
| **APReserveInvoice** | AP reserve invoices | `portalAPNumber`, `relatedPOId`, SAP AP fields | `portalAPNumber` unique; PO, status, vendor | APRI APIs, `apReserveInvoicesService` |
| **ApprovalMatrix** | PR/PO step config | `documentType`, `stepOrder`, `requiredPermission` | `(documentType, stepOrder)` unique | matrix API, `approvalEngine` |
| **ApprovalHistory** | Audit timeline | `documentType`, `documentId`, `action`, `actionBy` | `(documentType, documentId, actionDate)` | history API, timeline UI |
| **Attachment** | S3 file metadata | `documentType`, `documentId`, `s3Key` | `s3Key` unique; `(documentType, documentId)` | attachment APIs |
| **Comment** | Document comments | `documentType`, `documentId`, `comment` | `(documentType, documentId, postedAt)` | comment APIs |
| **EmailGroup** | Event → recipients | `eventKey`, `recipients` | `eventKey` unique | email groups API |
| **EmailLog** | Sent email audit | `relatedDocument*`, `emailStatus` | document, eventKey, status | email logs API, APRI detail |
| **SapIntegrationLog** | SAP request/response log | `documentType`, `documentId`, payloads | document + `createdAt` | integration logs API |
| **SystemSettings** | Sequences/config keys | `key`, `seq`, `value` | `key` unique | `numbering` |
| **ItemCreationLog** | SAP item create audit | `itemCode`, `sapResponse` | none declared | item create API |

`models/index.js` registers all models for populate/refs.

---

## 6. Tests Inventory (`tests/unit/`)

**~105 test files**, **636 tests** (passing at last full run). Classifications: **Keep**, **Update** (when UI changes), **Review**, **Candidate for deletion** (approval required).

### Security, auth, permissions — Keep

| Test file | Tests | Related source |
|-----------|-------|----------------|
| `auth.test.js` | Auth helpers | `lib/auth.js` |
| `jwtConfig.test.js` | JWT config | `lib/jwtConfig.js` |
| `sessionJwt.test.js` | Edge JWT | `lib/sessionJwt.js` |
| `apiAuthCoverage.test.js` | API withAuth scan | `app/api/**` |
| `apiClient.test.js` | Client fetch | `lib/apiClient.js` |
| `rateLimit.test.js` | Login limit | `lib/rateLimit.js` |
| `effectivePermissions.test.js` | Permissions merge | `lib/effectivePermissions.js` |
| `permissions.test.js`, `permissionsGroups.test.js` | Permission catalog | `lib/permissions.js` |
| `prPermissions.test.js`, `poPermissions.test.js` | Module ACL | `lib/prPermissions.js`, `poPermissions.js` |
| `settingsRoutePermissions.test.js` | Settings paths | `lib/settingsRoutePermissions.js` |
| `documentAccess.test.js` | Doc ACL | `lib/documentAccess.js` |
| `adminSettingsApi.source.test.js` (API section) | Admin route perms | settings APIs |
| `validators/auth.test.js` | Login schema | `lib/validators/auth.js` |

### Approval workflow & SAP guards — Keep

| Test file | Related source |
|-----------|----------------|
| `approvalEngine.test.js` | `lib/approvalEngine.js` |
| `workflowSteps.test.js` | `lib/workflowSteps.js` |
| `workflowStepper.test.js` | `WorkflowStepper.jsx` |
| `approvalHistoryService.test.js` | `approvalHistoryService` |
| `approvalTimeline.test.js` | `ApprovalTimeline.jsx` |
| `prApprovalForm.test.js`, `prPoApprovalDetail.test.js` | `DocumentApproveForm` |
| `prPendingApproval.test.js`, `poPendingApproval.test.js` | visibility filters |
| `poApproval.test.js` | PO approval |
| `sapDuplicateGuards.test.js` | SAP services |
| `apriDuplicateGuard.test.js` | APRI create |
| `apriSanitize.test.js` | `sanitizeApri` |
| `prSap.test.js`, `poSap.test.js`, `poToSap.test.js`, `prToSap.test.js` | SAP mappers |
| `apReserveInvoiceToSap.test.js` | APRI mapper |
| `poPrFollowUpSap.test.js`, `poFromPrFlow.test.js` | PO-from-PR SAP |
| `sapErrors.test.js`, `sapServiceLayer.test.js` | SAP client |
| `sapIntegrationLog.test.js` | SAP logging |

### Attachments, comments, exports — Keep

| Test file | Related source |
|-----------|----------------|
| `attachmentsService.test.js` | `lib/attachmentsService.js` |
| `attachmentUploadHelpers.test.js`, `attachmentDisplayName.test.js` | attachment helpers/UI |
| `validators/attachment.test.js` | attachment validation |
| `commentsService.test.js`, `validators/comment.test.js` | comments |
| `excelExport.test.js`, `exportService.test.js` | exports |

### Domain services & validators — Keep

| Test file | Related source |
|-----------|----------------|
| `purchaseRequestsApi.test.js` | PR API helpers |
| `poUpdateService.test.js`, `poEnhancements.test.js`, `poEditForm.test.js` | PO service/UI |
| `dashboardService.test.js`, `dashboardI18n.test.js` | dashboard |
| `rolesService.test.js`, `validators/user.test.js`, `validators/role.test.js` | admin |
| `validators/purchaseRequest.test.js`, `validators/purchaseOrder.test.js`, `validators/apReserveInvoice.test.js` | input validation |
| `validators/approvalMatrix.test.js`, `emailGroupValidator.test.js` | settings validation |
| `numbering.test.js`, `listQuery.test.js`, `listUrl.test.js`, `errors.test.js` | shared |
| `health.test.js`, `mongodbUri.test.js` | infra |
| `email.test.js`, `emailNotify.test.js`, `emailTemplates.test.js` | email |

### UI / layout / theme source tests — Keep (Update when UI changes)

| Test file | Classification | Reason |
|-----------|----------------|--------|
| `layoutShell.test.js` | Keep / Update | Top bar, quick menu, logos |
| `loginForm.test.js` | Keep | Login UX, i18n |
| `themeMotion.test.js`, `phase12cTheme.test.js` | Keep | Theme/overlay |
| `topbarControls.test.js`, `sunMoonToggle.test.js` | Keep | Quick actions |
| `mobileNav.test.js`, `navigation.test.js`, `navigationLoading.test.js` | Keep | Nav/RTL/loading |
| `phase12Ui.test.js`, `phase12bUi.test.js` | Keep | RTL/i18n conventions |
| `colorMode.test.js` | Keep | Light/dark |
| `logoutAndLoader.test.js` | Keep | Sign-out modal |
| `listManagers.source.test.js` | Keep | URL sync on lists |
| `detailViewsCommentsHistory.source.test.js` | Keep | Detail tabs |
| `poDetailView.source.test.js`, `settingsPageGuard.source.test.js` | Keep | Source contracts |
| `healthCheckPanel.source.test.js` | Keep | No secrets in health UI |
| `prCreateForm.test.js`, `approvedForPoI18n.test.js` | Keep | Form i18n |

### Review (not delete without approval)

| Test file | Classification | Reason |
|-----------|----------------|--------|
| `adminSettingsApi.source.test.js` — “cursor-prompt phase markers” | Review | Asserts phases 0–11 in `cursor-prompt-procurement-portal.merged.md`; not app behavior |
| `seed-data.test.js` | Review | Tied to `seed/` scripts |
| `modelsRegister.test.js` | Keep | Mongoose ref registration |

### Validators subdirectory (`tests/unit/validators/`)

Nine files — all **Keep** (input validation for API safety).

### Candidate for deletion

| Test file | Classification | Reason |
|-----------|----------------|--------|
| *(none strongly recommended)* | — | No clear duplicate coverage; doc-coupled tests are the only non-runtime assertions |

---

## 7. Recommended Cleanup Plan

| Phase | Action | Risk |
|-------|--------|------|
| **A — Documentation** | Update `cursor-prompt-procurement-portal.merged.md` deploy section (`ecosystem.config.cjs`); trim or relocate phase-marker test in `adminSettingsApi.source.test.js` | Low |
| **B — Dead UI** | Confirm then remove `PoPageQuickLinks.jsx`; deprecate unused `ThemeSelector` / `ColorModeSelector` exports if truly unused | Low–medium |
| **C — Test consolidation** | Over time merge `phase12Ui` / `phase12bUi` / `phase12cTheme` into fewer theme/RTL suites | Low |
| **D — Page refactor** | Extract `ready-for-ap-reserve-invoice/page.js` table into a dedicated component (like other list pages) | Low (maintainability only) |
| **E — Do not touch** | Auth, SAP mappers, approval engine, duplicate guards, `apiAuthCoverage`, attachment pipeline | High if changed wrongly |

---

## 8. Files Safe to Keep

- All **models** and **`models/index.js`**
- All **domain services** (`purchase*`, `apReserve*`, `approval*`, `attachments*`, `auth*`, `jwt*`, `sessionJwt*`)
- All **API routes** under `app/api/` and **`middleware.js`**
- All **portal pages** and **settings** managers
- **Security and workflow tests** (auth, API coverage, permissions, SAP guards, attachments, approval engine)
- **`seed/`** if environments rely on `npm run seed`
- **`ecosystem.config.cjs`**, **`instrumentation.js`**, **`next.config.js`**
- **`stores/`** (auth, theme, locale, navigation loading)
- **`components/ui/`** design system and layout shell

---

## 9. Files Candidate for Deletion

| Item | Reason |
|------|--------|
| `components/navigation/PoPageQuickLinks.jsx` | Zero imports in codebase |
| `components/ui/ThemeSelector.jsx` | Superseded by Sun/Moon + quick menu; only barrel-exported |
| `components/ui/ColorModeSelector.jsx` | Same as above |
| `components/purchase-requests/ItemSearchInput.jsx` | Thin re-export of `lookups/ItemSearchInput`; optional merge instead of delete |
| `tests/unit/adminSettingsApi.source.test.js` — **phase-marker `describe` block only** | Tests markdown doc phases, not application behavior (delete block only, not whole file, if admin API tests kept) |

**Note:** No test files are recommended for full deletion without explicit approval. Security and SAP tests must remain.

---

## 10. Files That Need Review Before Deletion

| Item | Why review |
|------|------------|
| `cursor-prompt-procurement-portal.merged.md` | Large spec (1506 lines); may still be team reference |
| `phase12Ui.test.js`, `phase12bUi.test.js`, `phase12cTheme.test.js` | Historical naming; still useful regression anchors |
| `seed-data.test.js` | Depends on seed script stability and whether seed is used in CI/dev |
| `lib/sap/__mocks__/sapServiceLayer.js` | Test-only; keep while SAP unit tests exist |
| `ecosystem.config.js` (if present) | Deprecated in favor of `ecosystem.config.cjs` |
| Duplicate Windows path casing (`app\login` vs `app/login`) | Same files; tooling noise only |

---

## 11. High-Risk Files That Must Not Be Deleted

| Category | Files / paths |
|----------|----------------|
| **Auth** | `lib/auth.js`, `lib/authLogin.js`, `lib/jwtConfig.js`, `lib/sessionJwt.js`, `middleware.js`, `app/api/auth/*`, `instrumentation.js` |
| **Approval / SAP** | `lib/approvalEngine.js`, `lib/workflowSteps.js`, `lib/sap/prSap.js`, `lib/sap/poSap.js`, `lib/sap/apriSap.js`, `lib/sap/mappers/*` |
| **Guards** | `lib/documentAccess.js`, `lib/apiPublicRoutes.js`, `tests/unit/apiAuthCoverage.test.js`, `tests/unit/sapDuplicateGuards.test.js`, `tests/unit/apriDuplicateGuard.test.js` |
| **Data** | All `models/*.js`, `lib/mongodb.js` |
| **Attachments** | `lib/attachmentsService.js`, `lib/s3.js`, `app/api/attachments/**` |
| **Secrets / config** | `.env`, `.env.local` (never commit); production `JWT_SECRET` |
| **Client session** | `stores/authStore.js`, `components/providers/AuthProvider.jsx` |

---

## Summary

The project is a cohesive **PR → PO → APRI** procurement portal with admin settings, SAP B1 integration, bilingual UI (EN/AR), and a broad unit-test suite (~636 tests). Runtime surface includes **21 user-facing routes**, **57 API endpoints** (almost all `withAuth`-protected), and middleware JWT validation. Main cleanup opportunities are **unused navigation/theme components** and **documentation-coupled test assertions**—not removal of security, approval, or SAP workflow code.

**Related artifacts (out of scope but referenced):** `seed/`, `scripts/`, `stores/`, `cursor-prompt-procurement-portal.merged.md`, `ecosystem.config.cjs`.

---

*End of report. No application code was modified to create this file.*
