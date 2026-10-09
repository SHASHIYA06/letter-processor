# BACKEND_SCHEMA — APIs, Data Stores, Validation and Permissions

- **Version:** 1.0
- **Status:** Active — inventory verified against `server.js` at commit `2970623`
- **Date:** 2026-10-09

## 1. Conventions

- Base path `/api`. JSON in/out. Auth: `Authorization: Bearer <JWT>`.
- Optional `x-project-id: <PROJECT>` header narrows the active scope; otherwise the
  membership list in the JWT is used.
- Success: `{ success: true, ... }`; failure: HTTP status + `{ success: false, error }`.
- Roles: `global_admin`/`admin` (bootstrap/global, `projects: ["ALL"]`),
  `project_admin` (scoped manager), `user` (project member). Bootstrap admin is
  created with `role: global_admin`, `projects: ["ALL"]`, `mustChangePassword: true`.

## 2. Permission matrix

| Capability | admin | user (member) | anon |
|---|---|---|---|
| Read records/search/export for project P | ✅ all projects | ✅ only P | ❌ 401 |
| Write (save/update/delete/import) to sheet of P | ✅ | ✅ pending guard wiring (T-01) | ❌ |
| Links / graph | ✅ | ✅ scoped | ❌ |
| Template upload/approve/reject | ✅ only | ❌ 403 | ❌ |
| Project config write | ✅ only | ❌ 403 | ❌ |
| Admin users/audit | ✅ only | ❌ 403 | ❌ |
| Register / login / locations / health | — | — | ✅ |

Enforcement helpers (server-side, authoritative):
`authenticateToken` → `req.scopes` (null = denied) · `requireScopes` · `guardSheet`
(sheet ∈ scope) · `guardRow` (row-level `Project ID` check on shared sheets) ·
`canManageProject` · `auditEvent`.

## 3. Route inventory (74 routes)

### Auth & session
`GET /api/auth/status` · `GET /api/locations` · `GET /api/auth/username-suggest` ·
`POST /api/auth/register` · `POST /api/login` · `GET /api/auth/verify` ·
`POST /api/logout` · `GET /api/me` · `POST /api/auth/switch-project` ·
`POST /api/auth/change-password`

Rate limiting + lockout apply to `POST /api/login` (429 on burst; 5 failures → 15-min lock).

### Projects & templates (admin-guarded writes)
`GET /api/projects` · `GET /api/projects/:id` · `PUT /api/projects/:id/config` ·
`GET /api/projects/:id/templates` · `GET /api/projects/:id/templates/:type` ·
`POST /api/projects/:id/templates/:type` ·
`POST /api/projects/:id/templates/:type/samples` (multipart, ≤10 files) ·
`POST /api/projects/:id/templates/:type/:version/approve` ·
`POST /api/projects/:id/templates/:type/:version/reject`

### Correspondence links / graph (scope-guarded)
`POST /api/links` · `GET /api/links` · `GET /api/graph` · `DELETE /api/links/:id`

### Letters
`GET /api/letter/next-number/:org` · `POST /api/letter/create` ·
`POST /api/letter/generate-pdf` · `POST /api/letter/generate-docx` ·
`POST /api/letter/generate-reply` · `POST /api/save-reply`

### NCR
`GET /api/ncr/next-number` · `POST /api/ncr/create` · `POST /api/ncr/update` ·
`GET /api/ncr/clone/:idx` · `POST /api/ncr/generate-pdf` · `POST /api/ncr/generate-docx`

### Joint Note
`GET /api/joint-note/next-number` · `POST /api/joint-note/create` ·
`POST /api/joint-note/generate-pdf` · `POST /api/joint-note/generate-docx`

### Ingestion / extraction
`POST /api/extract` (file → text) · `POST /api/ocr-images` · `POST /api/parse-text` ·
`POST /api/bulk-upload` · `POST /api/bulk-reparse` · `POST /api/import-excel`

### Records CRUD & transfer (read routes scope-guarded; write guards pending T-01)
`GET /api/records` · `GET /api/records/:sheetName` · `GET /api/search` ·
`GET /api/export/csv` · `GET /api/export/json` · `POST /api/import/json` ·
`POST /api/import/excel` · `POST /api/import/csv` · `POST /api/save` ·
`POST /api/auto-save` · `PUT /api/update` · `DELETE /api/delete` ·
`DELETE /api/clear/:sheetName`

### AI (Gemini default / OpenAI fallback)
`POST /api/ai/generate-letter` · `POST /api/ai/generate-reply` ·
`POST /api/ai/generate-ncr` · `POST /api/ai/improve-content` · `GET /api/ai/status`

### Admin
`GET /api/admin/users` · `POST /api/admin/users/:id/role` ·
`POST /api/admin/users/:id/status` · `POST /api/admin/users/:id/reset-password` ·
`GET /api/admin/audit`

### Misc
`GET /api/health` · `GET /api/master-data` · `GET /api/master-data/:category` ·
`POST /api/master-data/:category` · `GET /api/depots` · `GET /api/vendor-list`

## 4. Data stores

### 4.1 Google Sheets (records of truth)
- Per-org letter tabs (e.g. `KMRCL Letters`, fallback `<ORG> Letters`) mapped in
  `SHEET_NAMES`; shared tabs `NCR Records`, `Joint Notes` carry a `Project ID` column.
- Columns defined by `LETTER_COLUMNS`, `NCR_COLUMNS`, `JOINT_NOTE_COLUMNS`; header row
  auto-created (`ensureHeaders`); rows appended idempotently per request.
- Row-level visibility: `rowVisibleTo(sheet, header, row, scopes)`.

### 4.2 `data/users.json` (via `user-store.js`)
Fields: `id, username, staffId, name, designation, department, mobile, email,
projects[], role, status, passwordHash (scrypt+salt), lastLogin, createdAt, updatedAt`.
Boot-time migration upgrades legacy records to the project-aware schema.

### 4.3 Project store (via `project-store.js`)
Per project: configuration (customer, address, contract, numbering patterns,
sheet mapping), `sequences` (monotonic counters), `templates[type][version]`
(`draft → approved | rejected`, source sample manifest, approval history),
`links[]` (correspondence relationships), `audit[]`.

### 4.4 Files
- Originals/outputs: Drive (`uploadFileToDrive(org, category)`) + local `uploads/`.
- Template samples: immutable under `uploads/samples/<projectId>/<type>/`.

## 5. Validation & error handling

- Template type whitelist (`TEMPLATE_TYPES`), file count/size caps via multer,
  filename sanitization on every stored file.
- Passwords: scrypt with per-user salt, constant-time compare; never logged.
- AI prompts echo structured fields only; AI errors surfaced verbatim with retry guidance.
- Missing approved template → 4xx with actionable message (generic substitution forbidden).

## 6. Known gaps

1. Write-route guards not yet wired (`guardRow`, `stampProjectId` defined but unused) — T-01.
2. `POST /api/import/*` and `/api/clear/:sheetName` need scope+row checks and audit events.
3. No API versioning; no OpenAPI spec (backlog).
4. Idempotency keys for imports not yet implemented (duplicate risk on retry).

## 7. Related documents

[ARCHITECTURE.md](ARCHITECTURE.md) · [DESIGN.md](DESIGN.md) · [TRD.md](TRD.md) · [TASKS.md](TASKS.md)
