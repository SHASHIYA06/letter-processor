# MASTER-PROMPT — Complete Rebuild Prompt for the BEML Metro Document Intelligence Platform

> **Purpose:** Paste this entire document into any capable coding AI/development team and
> they should reproduce **the same application** — same features, same data model, same
> security model, same UI behaviour. It is self-contained: it does not require access to
> the original repository.
>
> **Version:** 1.0 · **Synchronised against:** commit `5d99aaf` (main) · **Date:** 2026-10-24
>
> **Honesty labels used throughout:** `IMPLEMENTED` = exists in the real application and
> must be reproduced. `PROPOSED` = blueprint only — **not** in the real application; build
> it only if explicitly asked, and never claim it already exists.

---

## 1. Your mission

Build **"BEML Metro Document Intelligence Platform"** (internal codename *DocVault*): a
single-deployment, multi-project web application for BEML Limited that manages official
metro-rail correspondence — inbound/outbound letters, Non-Conformance Reports (NCR),
Joint Notes — with AI-assisted drafting, per-project data isolation, and Google Sheets as
the record store. Version 4.1.0.

It began as a Kolkata (KMRCL) letter processor and evolved into a platform serving six
BEML locations and 19 metro depots. Reproduce that history-consistent state: per-project
letter tabs, shared NCR/Joint-Note tabs with row-level project scoping, and one
administration account per location and depot.

## 2. Personas

| Persona | Description |
|---|---|
| **Global administrator** | Created from a server-side bootstrap passcode; `projects: ["ALL"]`; manages every project, user, template; all actions audited. |
| **Location/Depot administrator** (`project_admin`) | One account per location (`<prefix>-admin`) and per depot (`<depotId>-admin`), shared operator passcode, scoped to its location's org. |
| **Project user (staff)** | Registers against one location with staff username auto-suggest, designation/department/mobile/email; sees only that project's records. |
| **Portal visitor** | Pre-login user on the animated portal (globe → India map → location cards → auth drawer). |

## 3. Hard rules (non-negotiable — the rebuild fails without these)

1. **No secrets in code, docs, frontend, or logs.** Passwords, API keys, passcodes live
   in environment variables only. Passwords stored as scrypt hashes with per-user salt.
2. **Project isolation is server-side.** JWT carries `role` + `projects[]`; every data
   request resolves scopes server-side; UI selection is never authorization. Deny by default.
3. **AI output is always a draft.** Editable, marked as AI, never auto-issued. AI never
   approves templates, never invents reference numbers, dates, or commitments.
4. **Official formats are sacred.** Documents render from approved template versions only;
   a missing approved template returns an actionable error — never silent generic substitution.
5. **The approved UI is preserved.** The animated portal and workspace styling are frozen;
   new surfaces reuse existing design tokens.
6. **Numbering, dates, access control, status transitions are deterministic server logic** —
   never delegated to AI. Legacy KMRCL reference history is never renumbered.
7. **Deterministic bootstrap:** on a serverless cold start with an empty user store, the
   admin accounts must be recreated from environment configuration — login must never
   depend on ephemeral filesystem state surviving.

## 4. Technology stack (exact — do not substitute)

| Layer | Technology |
|---|---|
| Runtime | Node.js ≥ 18, ESM (`"type": "module"`) |
| HTTP | Express 4, single monolith `server.js` (~4,600 lines) exporting the handler (runs locally via `app.listen` and serverless on Vercel via `export default app` path) |
| Auth | `jsonwebtoken` HS256 JWT (`JWT_SECRET`); scrypt password hashing via Node `crypto` — options `N:16384, r:8, p:1`, 16-byte hex salt, 64-byte hash, stored as `salt:hash` string |
| Record store | **Google Sheets** via `googleapis` (service-account JSON in env, or OAuth2 tokens as fallback). Spreadsheet id from `GOOGLE_SPREADSHEET_ID` |
| User store | `data/users.json` through `user-store.js` (also mirrored to a `Users` sheet tab for cold-start recovery) |
| Project store | `project-store.js` (JSON: config, sequences, template versions, correspondence links, audit) |
| Files | Google Drive (`uploadFileToDrive(org, category)`) + local `uploads/`; `/tmp` on Vercel |
| Document generation | `pdfkit` (PDF, with BEML letterhead header/footer images), `docx` (DOCX incl. letterhead) |
| Extraction / OCR | `pdf-parse`, `pdfjs-dist`, `mammoth` (DOCX), `tesseract.js`, `@google-cloud/vision` |
| Import/export | manual CSV parsing, `xlsx` (Excel) |
| Uploads | `multer` (multipart, buffer storage, size caps, filename sanitisation) |
| Images | `sharp` |
| AI | `callAI()` → Google Gemini REST (`generativelanguage`), default model `gemini-2.0-flash`; OpenAI-compatible fallback selected by `AI_PROVIDER` / key presence |
| Deployment | Vercel: `vercel.json` builds `server.js` with `@vercel/node` + static `public/`; routes `/api/*` and `/uploads/*` → `server.js`, asset regex → `/public/$1`, SPA fallback → `/public/index.html` |
| Tests | Plain Node scripts in `tests/*.mjs` with an assert-style `check()` helper, run against a live server (`node tests/<file>.mjs`, base URL `$BASE` or `http://localhost:3000`) |

**Dependencies (package.json v4.1.0):** `@google-cloud/vision`, `cors`, `docx`, `dotenv`,
`express`, `googleapis`, `jsonwebtoken`, `mammoth`, `multer`, `pdf-parse`, `pdfjs-dist`,
`pdfkit`, `sharp`, `tesseract.js`, `xlsx`. **No** LangChain/LangGraph/Langflow/vector-DB/MCP
packages are installed (see §16, PROPOSED only).

## 5. Repository structure (reproduce this layout)

```
letter-processor/
├── server.js              # Express monolith: config, Google auth, all 76 routes,
│                          #   auth block (bootstrap/location/depot admins, lockout,
│                          #   rate limit), sheet layer, AI layer, extraction, exports
├── user-store.js          # users.json store: create/patch/findByUsername, scrypt
│                          #   hashPassword/verifyPassword, upsertFromSheet, USER_COLUMNS
├── project-store.js       # per-project config, sequences, template versions, links, audit
├── projects.js            # project registry: numbering patterns, customer config, sheet maps
├── locations.js           # BEML_LOCATIONS: 6 locations × depots (ids, cities, colors,
│                          #   lat/long, trainsets, userPrefix) — portal + admin accounts
├── ncr-parser.js          # parseNCRContent(): uploaded NCR text → structured fields
├── pdf-generator.js       # pdfkit generators: letter/NCR/joint-note PDFs with BEML
│                          #   letterhead header/footer images
├── public/                # static SPA (no framework, no build step)
│   ├── index.html         # ~3,200 lines: portal stages, auth drawer, workspace tabs,
│   │                      #   all forms, modals, inline CSS + JS
│   ├── portal.js          # ~1,250 lines: globe canvas animation, India map, location
│   │                      #   cards, depot pins, auth drawer wiring, register/sign-in
│   ├── portal.css         # design tokens + portal/workspace styling
│   └── beml-logo.jpg
├── assets/                # beml-header.jpg, beml-logo.{jpg,png},
│   │                      #   beml-letterhead-{header,footer}.png, ncr-header.png
├── data/                  # users.json + audit.log (gitignored; ephemeral on Vercel)
├── uploads/               # generated/uploaded files (gitignored)
├── credentials/           # service-account.json, oauth-config.json, oauth-tokens.json
│                          #   (gitignored; production uses env vars instead)
├── tests/
│   ├── acceptance-write-guards.mjs   # 23 checks: multi-project write isolation
│   ├── auth-location-admins.mjs      # 4 checks: location/depot admin sign-in, registration
│   └── depots-map.mjs                # 17 checks: depot registry consistency, depot scoping
├── application-documents/ # this documentation set
├── vercel.json            # @vercel/node build + static build + routes
├── package.json           # v4.1.0, type: module, start/dev = node server.js
└── .env                   # gitignored — JWT_SECRET, ADMIN_BOOTSTRAP_PASSCODE,
                           #   GOOGLE_*, GEMINI_API_KEY (never committed)
```

## 6. Data model (reproduce exactly)

### 6.1 Google Sheets — tabs and columns (record of truth)

Tab map (`SHEET_NAMES`): `BEML`→`BEML Letters`, `KMRCL`→`KMRCL Letters`,
`Metro Rail`→`Metro Rail Letters`, `BMRCL`→`BMRCL Letters`, `DMCRL`→`DMCRL Letters`,
`MMRCL`→`MMRCL Letters`, `CMRCL`→`CMRCL Letters`; shared tabs `NCR Records`,
`Joint Notes`. A `Users` tab mirrors the user directory (14 columns, header row
auto-created via `ensureHeaders`). Header rows are created idempotently at boot
(local only — not on Vercel).

**Letters tab (25 columns):**
`S.No, Ref. Letter Number, All References, Date, From, To (Addressee), Kind Attention,
Subject, Letter Type, Letter Content, Enclosures, Remarks, Attachment Link, File Name,
Status, Signatory, Designation, Project, Cc, Depot, Priority, Reply Type, Tech Details,
Reply To Ref, Project ID`

**NCR Records tab (61 columns):**
`S.No, NCR Report No, Date of NCR, Date of Detection, Item Description, NCR Description,
Part Number, Modified/Unmodified FMI, Failure After FMI, Faulty Sl No, Healthy Sl No,
Issued By, Qty, Sub-System, Train No, Car, Responsibility, Status, Item Repaired,
Item Replaced, Date of Repair, Source, Investigation Report Date, NCR Closed By Doc,
Gate Pass No, Remarks, IR Printed, Attachment Link, File Name, Project, Line, OEM,
Train Set, Coach No, NCR Category, NCR Type, Severity, Priority, System, Location,
Vendor, Raised By, Assigned To, Root Cause, Corrective Action, Preventive Action,
Disposition, Closure Date, Closure Authority, Distribution, Assy Dwg No, Rev,
Assy Serial No, Part Serial No, Place, B/L No, Stored At, Invoice No, Material Status,
Disassembled, Approval Scope, Repair Procedure, Project ID`

**Joint Notes tab (14 columns):**
`S.No, Joint Note No, Date, Parties, Subject, Description, Items Discussed, Decisions,
Action Items, Attachments, Attachment Link, File Name, Status, Project ID`

**Users tab (14 columns):**
`S.No, Username, Full Name, Email, Phone, Role, Org Code, Location ID, City, State,
Status, Created At, Last Login, Password Hash`

Sheet-scoping model: **per-project letter tabs** need sheet-level checks; **shared tabs**
(NCR, Joint Notes) carry `Project ID` and need row-level visibility
(`rowVisibleTo(sheet, header, row, scopes)`). Rows with a password hash are the only
`Users` rows synced back into a cold store.

### 6.2 `data/users.json` (user directory)

Record fields: `id (uuid), seq, username (lowercase), name, email, phone, role,
org, locationId, city, state, depotId?, depot?, projects[] (or ['ALL']), status
(active|disabled), createdAt, lastLogin, lastIp, passwordHash (salt:hash),
mustChangePassword, failedLogins, lockedUntil, updatedAt`.
`USER_COLUMNS` mirrors this to the `Users` sheet.

### 6.3 Project store (`project-store.js`)

Per project: configuration (customer name/address, contract reference, numbering
pattern, sheet mapping), `sequences` (monotonic counters per document type),
`templates[type][]` (version manifests with `draft → approved | rejected` state,
immutable sample manifest, approval history), `links[]` (correspondence edges
`{id, fromDoc, toDoc, type, projectId}`), `audit[]`.

### 6.4 Numbering

Deterministic server-side patterns from the project registry — e.g. KMRCL legacy
`KMRCL/LTR/{YEAR}/{NUM}` (never renumbered), NCR and Joint Note patterns per org.
Next-number endpoints are read-only and race-safe per store counter.

## 7. Authentication & authorization (reproduce exactly)

- **Login:** `POST /api/login` {username, password} → scrypt verify → checks in order:
  account lockout (`lockedUntil` in future → 403), account status (non-active → 403),
  password. Success issues HS256 JWT `{sub, username, role, projects[]}` and returns
  `{success, token, username, name, role, org, locationId, city, depotId, depot,
  projects, mustChangePassword, depots}`.
- **Failed password** increments `failedLogins`; at **5 failures → 15-minute lock** and
  the counter resets. **Login rate limiting** returns 429 on bursts. Failures are audited
  without revealing whether the username exists.
- **Bootstrap global admin:** `ADMIN_BOOTSTRAP_PASSCODE` env (server-side only; never in
  code/frontend/docs) + `ADMIN_USERNAME` (default `admin`) → account with
  `role: global_admin, projects: ['ALL'], mustChangePassword: false`. Created at server
  start **and lazily on an unknown-username login when running on Vercel** (serverless
  cold start with an empty `/tmp` store) — then mirrored to the `Users` sheet so sibling
  isolates can sync it back.
- **Location admins:** for every location, `<userPrefix>-admin` with
  `role: project_admin, projects: [<location org scope>]` — same shared operator passcode.
- **Depot admins:** for every depot inside every location, `<depotId>-admin` with
  `role: project_admin`, scoped to the location org plus `depotId`/`depot` fields — same
  shared passcode.
- **Middleware gate:** `authenticateToken` → `req.user`/`req.scopes`; if
  `mustChangePassword` is set, only `/api/auth/change-password*` routes are allowed.
- **Scope resolution:** optional `x-project-id` header ∩ JWT membership; otherwise the
  membership list; `null` ⇒ 403. Helpers: `requireScopes`, `guardSheet` (sheet ∈ scope),
  `guardRow` (row-level `Project ID` check on shared sheets), `canManageProject`,
  `stampProjectId` — wired into **all** write routes (save, auto-save, update, delete,
  clear, imports, letter/NCR/joint-note creates).
- **Admin API:** list users, change role, enable/disable, reset password (sets temp
  password + `mustChangePassword`), query audit — admin-only, audited.
- **Audit:** `auditEvent()` records auth (success/failure/lock/rate-limit), admin,
  template, and denied-access events to `data/audit.log`.
- **Logout/verify/me/change-password/switch-project** round out the session API.

## 8. API inventory — 76 routes (all under `/api` unless noted)

JSON in/out; `Authorization: Bearer <JWT>`; optional `x-project-id` header.
Success `{success:true,...}`; failure HTTP 4xx/5xx + `{success:false, error}`.

**Public (no auth):** `GET /api/health` · `GET /api/auth/status` ·
`GET /api/locations` · `GET /api/auth/username-suggest` · `POST /api/auth/register` ·
`POST /api/login` · `GET /api/auth/verify`

**Session (auth):** `POST /api/logout` · `GET /api/me` ·
`POST /api/auth/switch-project` · `POST /api/auth/change-password`

**Letters:** `GET /api/letter/next-number/:org` · `POST /api/letter/create` ·
`POST /api/letter/generate-pdf` · `POST /api/letter/generate-docx` ·
`POST /api/letter/generate-reply` · `POST /api/save-reply`

**NCR:** `GET /api/ncr/next-number` · `POST /api/ncr/create` · `POST /api/ncr/update` ·
`GET /api/ncr/clone/:idx` · `POST /api/ncr/generate-pdf` · `POST /api/ncr/generate-docx`

**Joint Note:** `GET /api/joint-note/next-number` · `POST /api/joint-note/create` ·
`POST /api/joint-note/generate-pdf` · `POST /api/joint-note/generate-docx`

**Records & transfer (scope-guarded reads AND writes):**
`GET /api/records` · `GET /api/records/:sheetName` · `GET /api/search` ·
`GET /api/export/csv` · `GET /api/export/json` · `POST /api/import/json` ·
`POST /api/import/excel` · `POST /api/import/csv` · `POST /api/save` ·
`POST /api/auto-save` · `PUT /api/update` · `DELETE /api/delete` ·
`DELETE /api/clear/:sheetName`

**Ingestion/extraction:** `POST /api/extract` (file → text; PDF/DOCX/image) ·
`POST /api/ocr-images` · `POST /api/parse-text` · `POST /api/bulk-upload` ·
`POST /api/bulk-reparse` · `POST /api/import-excel`

**AI (draft-only):** `POST /api/ai/generate-letter` · `POST /api/ai/generate-reply` ·
`POST /api/ai/generate-ncr` · `POST /api/ai/improve-content` · `GET /api/ai/status`

**Projects & templates (admin-guarded writes):** `GET /api/projects` ·
`GET /api/projects/:id` · `PUT /api/projects/:id/config` ·
`GET /api/projects/:id/templates` · `GET /api/projects/:id/templates/:type` ·
`POST /api/projects/:id/templates/:type` ·
`POST /api/projects/:id/templates/:type/samples` (multipart, ≤10 files) ·
`POST /api/projects/:id/templates/:type/:version/approve` ·
`POST /api/projects/:id/templates/:type/:version/reject`

**Links & graph (scope-guarded):** `POST /api/links` · `GET /api/links` ·
`GET /api/graph` · `DELETE /api/links/:id`

**Admin (admin-only, audited):** `GET /api/admin/users` ·
`POST /api/admin/users/:id/role` · `POST /api/admin/users/:id/status` ·
`POST /api/admin/users/:id/reset-password` · `GET /api/admin/audit`

**Master data / misc:** `GET /api/master-data` · `GET /api/master-data/:category` ·
`POST /api/master-data/:category` · `GET /api/depots` · `GET /api/vendor-list`

**OAuth (local only):** `GET /auth/google` · `GET /auth/google/callback`

NCR master data served by `/api/master-data` (dropdown dictionaries, server-owned,
never client-invented): oem, trainSets (TS#1–TS#26), cars (DMC/TC/M/RMC/RIC…), lines,
projects, systems, subsystems, locations (depots/workshops), ncrCategories, ncrTypes,
priorities, dispositions, rootCauses, departments, severities, materialStatuses,
disassembledOptions.

## 9. Forms & fields (reproduce 1:1 — form mirrors the official document)

All in `public/index.html` unless noted. IDs are the contract between HTML and JS.

### 9.1 Sign-in drawer (portal stage 3)
`formSignin`: `signinUsername`, `signinPassword`, `signinSubmit`, `signinLocChip`
(selected location), `signinAdminId` + `signinAdminHint` (admin quick-hint).

### 9.2 Registration (same drawer, Register tab)
`formRegister`: `regUsername` (auto-suggested `<prefix>-000N` via
`/api/auth/username-suggest`, editable), `regUsernameSuggest`, `regName`, `regEmail`,
`regPhone`, `regPassword` (strength meter `pwStrength`), `regConfirm` (must match —
server also rejects mismatched passwords), `regLocChip`, `regSubmit`. Registration is
bound to the selected location/project at creation.

### 9.3 Letter form
`letter_refNumber`, `letter_allReferences`, `letter_date`, `letter_from`, `letter_to`,
`letter_kindAttn`, `letter_subject`, `letter_letterContent`, `letter_enclosures`,
`letter_remarks`, `letter_signatory`, `letter_designation`, `letter_org`,
`letter_project`, `letter_cc`, `letter_depot`, `letter_priority`.
Filters/search: `letterOrgFilter`, `letterDepotFilter`, `letterStatusFilter`,
`letterSearch`. Table `lettersTable`; preview `letterPreview`; save uses
`/api/save` (sheet = org Letters tab) and downloads via generate-pdf/generate-docx.

### 9.4 Reply workflow
`reply_select` (open inbound letter), `reply_from`, `reply_to`, `reply_ref`,
`reply_subject`, `reply_date`, `reply_org`, `reply_depot`, `reply_priority`,
`reply_attention`, `reply_techDetails`, `reply_instructions`, `reply_content`.
Preview `replyPreview`/`replyResult`; persisted via `/api/save-reply` into the same
Letters tab with `Reply Type`/`Tech Details`/`Reply To Ref` columns filled.

### 9.5 NCR form (largest — 51 inputs)
`ncr_ncrNo` (auto next-number), `ncr_date`, `ncr_detectionDate`, `ncr_place`,
`ncr_product`, `ncr_ncrDesc`, `ncr_partNo`, `ncr_partSerialNo`, `ncr_faultySl`,
`ncr_healthySl`, `ncr_issuedBy`, `ncr_qty`, `ncr_train`, `ncr_car`, `ncr_vehicleNo`,
`ncr_coachNo`, `ncr_assyDwgNo`, `ncr_assySerialNo`, `ncr_rev`, `ncr_blNo`,
`ncr_invoiceNo`, `ncr_storedAt`, `ncr_itemRepaired`, `ncr_itemReplaced`,
`ncr_dateOfRepair`, `ncr_investigationDate`, `ncr_gatePassNo`, `ncr_closureDate`,
`ncr_closureAuthority`, `ncr_distribution`, `ncr_team`, `ncr_assignedTo`,
`ncr_rootCause`, `ncr_cause`, `ncr_correction`, `ncr_preventiveAction`, `ncr_decision`,
`ncr_repairProcedure`, `ncr_approvalScope`, `ncr_status`, `ncr_remarks`,
`ncr_project`, `ncr_context`, `ncr_vendor`, `ncr_item`.
Dropdown values come from the server master-data dictionaries (never free-typed).
Filters: `ncrProjectFilter`, `ncrSeverityFilter`, `ncrStatusFilter`, `ncrSearch`;
table `ncrTable`; preview `ncrPreview`. Upload of source NCR files feeds
`ncr-parser.js` to prefill fields.

### 9.6 Joint Note form
`jn_number` (auto), `jn_date`, `jn_parties`, `jn_subject`, `jn_description`,
`jn_itemsDiscussed`, `jn_decisions`, `jn_actionItems`, `jn_status`, `jn_remarks`.
Table `jnTable`, preview `jnPreview`, downloads `jnPdfDownload`/`jnDocxDownload`.

### 9.7 AI draft panel (Letters + NCR)
Basic: `ai_org`, `ai_subject`, `ai_recipient`, `ai_context`, `ai_tone`, `ai_type`,
`ai_full` (+ hint `ai_full_hint`). Advanced (`ai_advanced`, toggled by `ai_advToggle`):
`ai_lang` (language), `ai_length` (e.g. Standard 1–2 pages), `ai_paras` (paragraph count),
`ai_numbering` (roman | numeric | arabic-paren | none), `ai_spacing`, `ai_refs`
(reference numbers echoed verbatim), `ai_extra` (extra instructions),
`ai_signoff` (pipe-separated `closing|For |role`). NCR-specific: `aiNcr_project`,
`aiNcr_vendor`, `aiNcr_item`, `aiNcr_car`, `aiNcr_train`, `aiNcr_severity`,
`aiNcr_context`. Results render into `aiLetterResult` / `aiNcrResult` / `replyResult`
as editable drafts before saving.

### 9.8 Upload / import / search
- Upload modal `uploadModal`/`uploadForm`: `uploadFile`+`uploadDropZone`+`uploadBtn`,
  `uploadOrg`, `uploadType`, progress bar (`uploadProgress*`), status `uploadStatus`;
  calls `/api/extract` then prefills the active form.
- Excel import: `importExcelBtn`/`importExcelDropZone`/`importExcelFile`, preview
  `importExcelPreview`, `importOrgExcel`, `importTypeExcel` → `/api/import/excel`.
- Search: `globalSearch`, `searchQuery`, `searchSheet`, `searchResults` → `/api/search`.
- Detail/viewer modals `detailModal`/`viewerModal` render saved records and Drive links.

## 10. Locations & depots registry (`locations.js`)

Six BEML locations, each with `id, name, org, city, state, userPrefix, color,
latitude/longitude, trainset counts, depots[]`. Depot: `id, name, city, code`.
Served to the portal by `GET /api/locations` and to the workspace by `GET /api/depots`;
the map, admin accounts, and depot scoping all derive from this one registry.

| Location id | Name | Org | City | Prefix | Accent | Depots |
|---|---|---|---|---|---|---|
| `beml-bengaluru-hq` | BEML South Complex | BEML | Bengaluru | `beml` | `#F59E0B` | beml-rail-complex, beml-test-track, beml-spares-hub |
| `bmrcl-bengaluru` | BMRCL Metro Depot | BMRCL | Bengaluru | `bmrcl` | `#8B5CF6` | bmrcl-baiyappanahalli, bmrcl-peenya, bmrcl-kadugodi |
| `kmrcl-kolkata` | KMRCL East-West Depot | KMRCL | Kolkata | `kmrcl` | `#3B82F6` | kmrcl-central-park, kmrcl-howrah-maidan, kmrcl-noapara |
| `dmcrl-delhi` | Delhi Metro Operations | DMCRL | New Delhi | `dmcrl` | `#10B981` | dmcrl-najafgarh, dmcrl-kalindi-kunj, dmcrl-mundka, dmcrl-phase4 |
| `mmrcl-mumbai` | Mumbai Metro Aqua Line | MMRCL | Mumbai | `mmrcl` | `#06B6D4` | mmrcl-sariput-nagar, mmrcl-kanjurmarg, mmrcl-bkc |
| `cmrcl-chennai` | Chennai Metro Depot | CMRCL | Chennai | `cmrcl` | `#EF4444` | cmrcl-koyambedu, cmrcl-wimco-nagar, cmrcl-poonamallee |

Totals: **6 locations, 19 depots** → 25 administration accounts (6 location + 19 depot)
plus the global `admin`, all on the shared operator passcode.

Project registry (`projects.js`): KMRCL (reference implementation, legacy numbering
`KMRCL/LTR/{YEAR}/{NUM}`, historical data preserved), BMRCL, DMCRL, MMRCL, CMRCL —
per-project customer config, address, contract reference, numbering patterns, sheet
mapping. Known open issue: Delhi code `DMCRL` vs official `DMRC` — keep `DMCRL` to
match the deployed app, flag for verification.

## 11. Templates, links/graph, synchronization

- **Template onboarding (API implemented, UI pending):** admin uploads up to 10 samples
  per project/type (`letter|reply|ncr|joint_note|…`) → stored immutably under
  `uploads/samples/<projectId>/<type>/` → text extracted → `draft` version created →
  admin `approve`/`reject`. Only approved versions render official documents.
- **Correspondence graph (API implemented, UI pending):** edges
  `{id, fromDoc, toDoc, type, projectId}` model incoming letter → reply → clarification →
  joint note → NCR → closure evidence. `GET /api/graph?project=` is scope-filtered.
- **Synchronization:** reads are live per request (Sheets-backed). Users table mirrors
  to the `Users` sheet tab (append on create, last-login update, hash-gated sync back).
  No offline sync engine (PROPOSED).

## 12. AI layer (reproduce exactly)

- `callAI({system, prompt})` → Gemini REST `generativelanguage`, model
  `gemini-2.0-flash` by default; OpenAI-compatible fallback when `AI_PROVIDER`/keys
  select it. Key from `GEMINI_API_KEY`/`AI_API_KEY`/`OPENAI_API_KEY` — **server-side only**,
  never exposed to the browser.
- Endpoints return structured JSON drafts the UI renders as editable text:
  letter, reply, NCR, improve-content. `GET /api/ai/status` reports `{configured, provider, model}`.
- The generate-letter prompt honours the advanced options in §9.7 (language, length,
  paragraphs, numbering style, spacing, verbatim reference echo, extra instructions,
  pipe-separated sign-off). System prompt defaults to expert BEML railway documentation
  assistant, formal Indian-railway style.
- **Rules:** drafts are marked AI-assisted, editable, never auto-saved as issued;
  reference numbers/dates come from the server, never from the model; missing key →
  clear retryable error, never fabricated content.

## 13. Frontend & design tokens (approved UI — reproduce faithfully)

- **Portal (pre-login):** Stage 1 rotating canvas globe (~15k animated points, BEML
  wordmark, 10 s auto-advance countdown ring) → Stage 2 India map with pulsing
  per-location markers + location cards (site, city, trainsets) → Stage 3 location
  context + sliding auth drawer (Sign in / Register tabs, staff-ID auto-suggest,
  password strength meter, depot-aware chips). Elements: `globeCanvas`, `indiaCanvas`,
  `portalStars`, `locationCards`, `stage-globe`, `stage-map`, `mapBack`, `authDrawer`,
  `statLocations`/`statDepots`/`statTrainsets`, `exploreBtn`.
- **Workspace (post-login SPA):** tab navigation — Letters (import, AI draft, edit,
  save, PDF/DOCX), Reply, NCR, Joint Note, Records/Dashboard (`lettersTable`,
  `ncrTable`, `jnTable`, stats, `recentDocs`), Import/Export, global search. Header:
  org/project context, `userBadge`, `logoutBtn`, `depotSelector` (users may be scoped
  to one depot of their own location).
- **Tokens:** deep-space navy `#050810` background; accent blue `#3B82F6` (primary/KMRCL),
  amber `#F59E0B` (BEML HQ/warnings); per-project accents from `locations.js` `color`
  field (single source of truth); translucent white surfaces 8–12 %; 12–16 px card
  radius, 10 px inputs; monospace for reference numbers; status pills; sticky table
  headers. Toasts via `toast`; modals `detailModal`, `viewerModal`, `uploadModal`.
- **Behaviour:** `x-project-id` follows the active project; scope switch reloads data
  without full page reload; 401 → portal re-shown; 403 → toast + audit; AI results get
  a visible draft chip until a human saves.

## 14. Configuration & deployment

### 14.1 Environment variables (names only — never commit values)

| Variable | Purpose |
|---|---|
| `JWT_SECRET` | HS256 signing key (repo has a insecure fallback default — production must set it) |
| `ADMIN_BOOTSTRAP_PASSCODE` | **The operator passcode** that creates/validates `admin` + all location/depot admins. Server-side only. **Must be set in the deployment environment (Vercel Production) or no admin account can exist and login fails.** |
| `ADMIN_USERNAME` | Bootstrap admin username (default `admin`) |
| `ADMIN_PASSWORD` | Legacy alias, still honoured if `ADMIN_BOOTSTRAP_PASSCODE` absent |
| `GOOGLE_SPREADSHEET_ID` | Primary spreadsheet (record of truth) |
| `GOOGLE_SERVICE_ACCOUNT` | Service-account JSON content (production path) |
| `GOOGLE_CLIENT_ID/SECRET/REDIRECT_URI`, `GOOGLE_ACCESS_TOKEN/REFRESH_TOKEN/OAUTH_EXPIRY` | OAuth2 alternative |
| `GOOGLE_DRIVE_FOLDER_ID` | Root Drive folder |
| `AI_PROVIDER`, `AI_MODEL`, `AI_API_KEY`, `GEMINI_API_KEY`, `OPENAI_API_KEY` | AI selection |
| `PORT`, `VERCEL`, `DATA_DIR` | Runtime (`DATA_DIR` defaults to `./data`, `/tmp/docvault-data` on Vercel) |

### 14.2 Vercel deployment — hard-won operational facts (reproduce this behaviour)

1. `vercel.json`: `version: 2`, `outputDirectory: public`, builds
   `server.js` (`@vercel/node`, `includeFiles: assets/**, ncr-parser.js, pdf-generator.js`)
   + `public/**` (`@vercel/static`); routes `/api/(.*)` and `/uploads/(.*)` → `server.js`,
   static-asset regex → `/public/$1`, fallback → `/public/index.html`.
2. **Serverless filesystem is ephemeral.** `/tmp` wipes on every cold start, and
   `startServer()` (which bootstraps admins) races the first request. Therefore the
   login handler **lazily bootstraps** the operator accounts when an unknown username
   arrives on Vercel (gated on `VERCEL` + `ADMIN_BOOTSTRAP_PASSCODE`) and mirrors the
   created account to the `Users` sheet so sibling isolates can sync it back.
3. **Environment variables are baked at deployment.** Adding/changing
   `ADMIN_BOOTSTRAP_PASSCODE` (or any env var) does nothing until a **redeployment**.
4. Google credentials come from env (`GOOGLE_SERVICE_ACCOUNT` JSON), never from the
   `credentials/` folder on Vercel.
5. Local run: `npm install && npm start` → `http://localhost:3000`; header rows and
   bootstrap admin are created at boot when not on Vercel.
6. GitHub: repo `SHASHIYA06/letter-processor`, branch `main`; Vercel is Git-connected
   so pushing to `main` deploys; never commit `.env`, `data/`, `uploads/`, `credentials/`,
   `node_modules/`, `*.log`, `.DS_Store`.

## 15. Tests & acceptance criteria (reproduce and keep passing)

Three assert-style suites in `tests/`, run against a live server
(`node tests/<file>.mjs`):

1. **`acceptance-write-guards.mjs` (23 checks)** — multi-project WRITE isolation:
   a user of project A cannot write to project B's sheet or rows; shared-tab writes
   stamp `Project ID`; cross-project delete/update → 403 + audit; admin writes all;
   the existing KMRCL save flow still works.
2. **`auth-location-admins.mjs` (4 checks)** — every location/depot admin signs in with
   the shared operator passcode; registration rejects mismatched passwords.
3. **`depots-map.mjs` (17 checks)** — depot registry self-consistency, `GET /api/depots`
   serves it, accounts can be scoped to one depot of their own location.

**Definition of done for the rebuild:** `node --check server.js` clean; all three suites
pass against a running local server; portal → register → login → letter create → AI
draft → PDF/DOCX → save → dashboard → cross-project denial works end-to-end; production
login with the configured operator passcode works after a cold start.

## 16. AI-orchestration extension — MCP, RAG, LangChain, Langflow, LangGraph (PROPOSED blueprint)

**Status: NOT implemented in the real application.** The app calls Gemini directly via
REST. These specifications are the approved direction if/when these subsystems are
added; reproduce them only on explicit request, and label them PROPOSED in any doc.
Never install these packages just to satisfy a checklist — each adoption needs a defined
problem, runtime-compatibility proof, tests, and a lockfile update.

- **MCP server:** expose DocVault as a Model Context Protocol server with tools
  `search_records`, `get_letter`, `create_letter_draft`, `get_ncr`, `next_reference_number`,
  `list_templates`, `get_project_config` — each requiring a user JWT and enforcing the
  same scope rules (`requireScopes`/`guardRow`) as the HTTP API; read-only tools by
  default; audit every tool call.
- **RAG:** project-scoped pipeline — chunk official letters/NCRs/templates → embed →
  vector index per project → **permission-filtered retrieval** (the caller's
  `projects[]` is the filter) → answers with citations to source documents. Cross-project
  retrieval must be blocked by test. Vector store choice is open (never assume one).
- **LangChain:** provider-agnostic wrappers around `callAI` (chat model, prompt
  templates for letter/reply/NCR, output parsers returning the existing JSON draft
  shape) so providers stay swappable without touching business logic.
- **LangGraph:** explicit draft workflow as a state machine —
  `extract → validate fields → retrieve (RAG) → draft → fact-check vs references →
  human review → render (PDF/DOCX) → save` — with deterministic nodes for numbering,
  dates, and access control (AI never owns these), retry/fallback edges, and an audit
  trail per node.
- **Langflow:** an exported flow mirroring that graph for non-developer iteration on
  prompts/retrieval, versioned in the repo; production still runs the code path above.

## 17. Rebuild checklist (verify before declaring done)

- [ ] Structure of §5 exists; `package.json` v4.1.0 with exactly the §4 dependencies.
- [ ] All 76 routes of §8 exist with the auth/scope behaviour of §7.
- [ ] Sheet tabs, column arrays, and `Users` mirror of §6 match verbatim.
- [ ] Forms of §9 render with those IDs and post to those endpoints.
- [ ] Locations/depots registry of §10 drives portal, map, admin accounts, depot scoping.
- [ ] Bootstrap + lazy cold-start bootstrap + sheet sync of §7/§14.2 work on a cold server.
- [ ] AI endpoints return editable drafts with the advanced options of §12.
- [ ] Portal 3-stage animation + workspace tabs match §13 tokens.
- [ ] All three test suites of §15 pass.
- [ ] No secrets anywhere in the tree; `.gitignore` covers `.env`, `data/`, `uploads/`,
      `credentials/`, logs, `.DS_Store`, `node_modules/`.

---

*End of MASTER-PROMPT. Companion document with full rationale, market/goal documents,
database reference, SKILL.md and the AI-orchestration blueprint:
[COMPLETE-BLUEPRINT.md](COMPLETE-BLUEPRINT.md).*
