# COMPLETE-BLUEPRINT — BEML Metro Document Intelligence Platform (DocVault)

> **Companion to [MASTER-PROMPT.md](MASTER-PROMPT.md).** Where MASTER-PROMPT is the paste-ready
> rebuild instruction, this document is the full reference: market and goals documents,
> structure, architecture, database, forms, the agent SKILL.md, and the complete
> MCP / RAG / LangChain / Langflow / LangGraph blueprint.
>
> **Version:** 1.0 · **Synchronised against:** commit `5d99aaf` (main) · **Date:** 2026-10-24
>
> **Status labels:** `IMPLEMENTED` (verified in code) · `PROPOSED` (blueprint only — not built).
> PRD, TRD, architecture, flows, design brief, rules and backlog live in the sibling files
> [PRD.md](PRD.md), [TRD.md](TRD.md), [ARCHITECTURE.md](ARCHITECTURE.md),
> [BACKEND_SCHEMA.md](BACKEND_SCHEMA.md), [APP_FLOW.md](APP_FLOW.md),
> [UI_UX_DESIGN_BRIEF.md](UI_UX_DESIGN_BRIEF.md), [RULES.md](RULES.md), [TASKS.md](TASKS.md);
> this file consolidates them and adds the sections that were missing (MRD, GRD,
> database reference, forms reference, SKILL.md, AI-orchestration setups).

## 0. How to use this package

| You want | Use |
|---|---|
| Rebuild the same app with another AI/team | Paste [MASTER-PROMPT.md](MASTER-PROMPT.md) |
| Understand market positioning | §1 MRD below |
| Agree goals, NFRs, acceptance criteria | §2 GRD below |
| Understand the running system | §3 Structure · §4 Architecture · §5 Database · §6 Forms |
| An AI agent working on this repo | §7 SKILL.md (copy to repo root as `SKILL.md` if desired) |
| Add MCP/RAG/LangChain/Langflow/LangGraph | §8–§12 (all PROPOSED — none installed) |

Deltas vs the older documents (which are pinned to commit `2970623`): write-route guards
are now **wired and tested** (T-01 done, `tests/acceptance-write-guards.mjs`); depot-wise
location admins and letterhead DOCX exist; three acceptance suites run; serverless
cold-start bootstrap + `Users`-sheet sync are implemented; `ADMIN_BOOTSTRAP_PASSCODE`
is a required Vercel Production variable. Where older docs say "pending", trust this file.

---

## 1. MRD — Market Requirements Document (PROPOSED framing)

- **Purpose:** position the product for BEML's internal digitisation programme.
- **Problem:** BEML (a public-sector rolling-stock manufacturer) delivers metro projects
  (Kolkata, Bengaluru, Delhi, Mumbai, Chennai) whose official correspondence — letters,
  replies, Non-Conformance Reports, joint notes with metro operators — lives in email
  attachments, Word files and paper files. Reference numbers are hand-maintained in
  registers; locating "the reply to letter KMRCL/LTR/2026/041" takes minutes to hours;
  NCR closure evidence is scattered; formats drift per project and per person.
- **Segment:** engineering, quality and project-management teams inside BEML and its
  metro operating customers; document volume per project is thousands of letters/year.
- **Alternatives today:** manual Word registers, generic ECM/DMS products, custom ERPs.
  None understand metro document formats (letterhead, NCR layout, joint-note structure),
  none are affordable/fast for a single-department rollout, none offer AI drafting that
  respects official formats.
- **Value proposition:** one deployment for all BEML metro projects that (a) keeps
  official formats authoritative via approved templates, (b) numbers and stores every
  document with project isolation, (c) drafts letters/replies/NCRs with AI in seconds
  while a human stays the approver, and (d) traces the full correspondence graph from
  inbound letter to closure evidence.
- **Success measures:** time-to-draft a reply < 2 minutes; 100 % of new documents carry
  correct project-scoped reference numbers; a document chain is retrievable in one query;
  onboarding a new metro project requires configuration + samples, **not** code changes.

## 2. GRD — Goals & Requirements Document

*(Interpretation: goals, functional/non-functional requirements, constraints, acceptance
criteria. Functional inventory lives in [PRD.md](PRD.md) §4; this section is the contract.)*

### 2.1 Product goals

| G# | Goal | Measure |
|---|---|---|
| G1 | One deployment serves all metro projects | 6 locations / 19 depots served from one codebase |
| G2 | Bulletproof project isolation | cross-project read/write attempts rejected server-side, audited, proven by 23-check suite |
| G3 | Official formats stay authoritative | documents render only from approved templates |
| G4 | AI speeds up drafting without risking issuance | every AI output is an editable draft; human saves |
| G5 | Works on serverless from a cold start | admin login succeeds on first request after cold start |
| G6 | New project onboardable without code changes | registry + samples + config only |

### 2.2 Non-functional requirements (current status)

| Requirement | Status |
|---|---|
| Server-side authorization on every data route (reads and writes) | IMPLEMENTED |
| Login rate limiting + 5-failure/15-min lockout | IMPLEMENTED |
| Passwords stored as scrypt (N=16384, r=8, p=1) with per-user salt | IMPLEMENTED |
| Audit trail for auth/admin/template/denied events | IMPLEMENTED |
| Deterministic server-side numbering (never AI) | IMPLEMENTED |
| Ephemeral-filesystem resilience (bootstrap + sheet sync) | IMPLEMENTED |
| Automated acceptance suites | IMPLEMENTED (3 suites, 44 checks) |
| JWT TTL/refresh + revocation on password change | NOT implemented (T-09) |
| OpenAPI spec / API versioning | NOT implemented |
| Visual regression for official templates | NOT implemented |

### 2.3 Constraints

1. Vercel serverless: no persistent FS; durable state = Sheets/Drive; JSON stores must be
   re-derivable from environment + sheet mirror.
2. Google API quotas bound write bursts; appends batched per request.
3. Browser print ≠ Word pagination; DOCX generated structurally via `docx`.
4. Indian railway documentation conventions (reference formats, sign-off blocks,
   enclosures lists) must be honoured in content and layout.
5. Security: no secrets in repo; operator passcode only in deployment environment.

### 2.4 Acceptance criteria (release gate)

- All three suites in `tests/` pass against a fresh server.
- Portal → register (location-bound) → login → letter create → AI draft → PDF/DOCX →
  save → dashboard row visible → cross-project access denied — as one scripted journey.
- Production login with the configured operator passcode works after a forced cold start.
- A KMRCL user writing to a BMRCL sheet/row receives 403 and an audit event.

## 3. Structure (file map)

```
server.js              Express monolith (~4,600 lines): config/env, Google auth init,
                       sheet layer (ensureSheetExists/ensureHeaders/getNextSerialNumber),
                       auth block (bootstrap/location/depot admins, rateLimitLogin,
                       lockout, mustChangePassword gate, sheet mirror/sync), all 76
                       routes, extraction/OCR, callAI, exports, Vercel export
user-store.js          users.json CRUD, scrypt hash/verify, upsertFromSheet,
                       USER_COLUMNS, publicProfile
project-store.js       per-project config, sequences, template versions, links, audit
projects.js            project registry: numbering patterns (e.g. KMRCL/LTR/{YEAR}/{NUM}),
                       customer config, sheet maps, stampProjectId
locations.js           BEML_LOCATIONS: 6 locations × 19 depots, prefixes, colors, geo
ncr-parser.js          parseNCRContent(): uploaded NCR text → structured fields
pdf-generator.js       pdfkit letter/NCR/joint-note PDFs with BEML letterhead images
public/index.html      SPA: portal stages, auth drawer, workspace tabs, all forms/modals
public/portal.js       globe canvas, India map, depot pins, auth drawer, register/login
public/portal.css      design tokens + styling
assets/                letterhead header/footer, logos, NCR header images
data/                  users.json + audit.log (gitignored; /tmp on Vercel)
uploads/               generated + uploaded files (gitignored)
credentials/           Google service-account/OAuth files (gitignored; prod uses env)
tests/                 acceptance-write-guards.mjs (23), auth-location-admins.mjs (4),
                       depots-map.mjs (17)
application-documents/ this documentation set
vercel.json            @vercel/node + static builds, /api + /uploads routes, SPA fallback
```

## 4. Architecture (current)

### 4.1 Component diagram

```
Browser — public/index.html (SPA) + portal.js/portal.css
   │  fetch /api/*  (Bearer JWT, optional x-project-id)
   ▼
Express server.js
   ├─ authenticateToken → req.user {role, projects[]} → requireScopes
   │    ├─ guardSheet (sheet ∈ scope) · guardRow (Project ID on shared tabs)
   │    ├─ canManageProject (admin ops) · stampProjectId (write path)
   │    └─ mustChangePassword gate → only /api/auth/change-password*
   ├─ Auth & users ──── user-store.js (data/users.json, scrypt) + Users-sheet mirror
   ├─ Projects ──────── project-store.js (config, sequences, templates, links, audit)
   ├─ Registry ──────── locations.js (portal/accounts) + projects.js (numbering/sheets)
   ├─ Records ───────── Google Sheets: per-org Letters tabs + shared NCR/Joint Notes
   ├─ Documents ─────── pdfkit (PDF + letterhead) · docx (DOCX + letterhead)
   │                    extractors: pdf-parse/pdfjs-dist/mammoth/tesseract/vision
   ├─ AI ────────────── callAI() → Gemini gemini-2.0-flash (default) | OpenAI fallback
   └─ Files ─────────── Google Drive + uploads/ (+ /tmp on Vercel)
```

### 4.2 Request lifecycle (data route)

1. JWT verified → role + membership. 2. Scope resolution (`x-project-id` ∩ membership;
null ⇒ 403, deny by default). 3. Capability check (`requireScopes`, `canManageProject`).
4. Sheet/row check (`guardSheet`/`guardRow`; writes stamp `Project ID`).
5. Deterministic business logic (numbering, validation — never AI).
6. Persist to Sheets; audit significant actions. 7. `{success}` or mapped 4xx/5xx with
safe, actionable messages.

### 4.3 Architectural decisions (do not re-litigate)

- **ADR-1** One deployment, multi-project by tab + `Project ID` column (not DB-per-project).
- **ADR-2** Google Sheets stays the record of truth this phase.
- **ADR-3** Approved UI and Gemini integration preserved; AI behind thin `callAI`.
- **ADR-4** Server-side authorization is authoritative; UI selection never is.
- **ADR-5** AI never approves templates or issues documents.
- **ADR-6 (new)** Serverless cold starts re-derive admin accounts from environment and
  the `Users` sheet mirror; login never depends on surviving local files.

### 4.4 Auth model detail

- Bootstrap `admin` (global_admin, projects `['ALL']`) from `ADMIN_BOOTSTRAP_PASSCODE`;
  created at boot and lazily on unknown-username logins when `VERCEL` is set.
- Location admins `<prefix>-admin` and depot admins `<depotId>-admin` (project_admin,
  scoped to the location org) — shared operator passcode; 25 accounts total.
- Users register location-bound with auto-suggested `<prefix>-000N` usernames.
- Lockout 5 fails/15 min; login rate limiting 429; `Users` sheet mirrors
  username/role/scope/last-login (password hash column reserved, sync hash-gated).
- JWT `{sub, username, role, projects[]}`, HS256; no TTL yet (T-09 backlog).

## 5. Database (data-store reference — IMPLEMENTED)

Three persistence layers: Google Sheets (records of truth), `data/users.json`
(directory), `project-store.js` JSON (workflow state). Files on Drive/uploads.

### 5.1 Spreadsheet tabs

| Tab | Kind | Project scoping |
|---|---|---|
| `BEML Letters`, `KMRCL Letters`, `Metro Rail Letters`, `BMRCL Letters`, `DMCRL Letters`, `MMRCL Letters`, `CMRCL Letters` | per-org letters | sheet-level (`guardSheet`) |
| `NCR Records` | shared | row-level `Project ID` (`guardRow`/`rowVisibleTo`) |
| `Joint Notes` | shared | row-level `Project ID` |
| `Users` | shared mirror | read-hash-gated sync into cold stores |

Header rows are auto-created (`ensureHeaders`) at boot on local runs. Column order is
fixed (append-only API writes by index), so column arrays below are the schema.

### 5.2 Letters tab — 25 columns

`S.No | Ref. Letter Number | All References | Date | From | To (Addressee) |
Kind Attention | Subject | Letter Type | Letter Content | Enclosures | Remarks |
Attachment Link | File Name | Status | Signatory | Designation | Project | Cc |
Depot | Priority | Reply Type | Tech Details | Reply To Ref | Project ID`

Reply fields (`Reply Type`, `Tech Details`, `Reply To Ref`) are filled by the reply
workflow on the same row set; `Attachment Link`/`File Name` carry Drive references.

### 5.3 NCR Records tab — 61 columns

`S.No | NCR Report No | Date of NCR | Date of Detection | Item Description |
NCR Description | Part Number | Modified/Unmodified FMI | Failure After FMI |
Faulty Sl No | Healthy Sl No | Issued By | Qty | Sub-System | Train No | Car |
Responsibility | Status | Item Repaired | Item Replaced | Date of Repair | Source |
Investigation Report Date | NCR Closed By Doc | Gate Pass No | Remarks | IR Printed |
Attachment Link | File Name | Project | Line | OEM | Train Set | Coach No |
NCR Category | NCR Type | Severity | Priority | System | Location | Vendor |
Raised By | Assigned To | Root Cause | Corrective Action | Preventive Action |
Disposition | Closure Date | Closure Authority | Distribution | Assy Dwg No | Rev |
Assy Serial No | Part Serial No | Place | B/L No | Stored At | Invoice No |
Material Status | Disassembled | Approval Scope | Repair Procedure | Project ID`

Server-owned dropdown dictionaries (`NCR_MASTER_DATA`, served by `/api/master-data`):
oem (20 vendors), trainSets (TS#1–26), cars (DMC/TC/M/T/RMC/RIC variants), lines,
projects, systems (24), subsystems (41), locations (20 depots/shops), ncrCategories (10),
ncrTypes (8), priorities (7), dispositions (10), rootCauses (15), departments (18),
severities (Critical/Major/Minor), materialStatuses (5), disassembledOptions (5).
Clients never free-type values for these fields.

### 5.4 Joint Notes tab — 14 columns

`S.No | Joint Note No | Date | Parties | Subject | Description | Items Discussed |
Decisions | Action Items | Attachments | Attachment Link | File Name | Status | Project ID`

### 5.5 Users tab mirror — 14 columns

`S.No | Username | Full Name | Email | Phone | Role | Org Code | Location ID |
City | State | Status | Created At | Last Login | Password Hash`

### 5.6 `data/users.json` record

`id (uuid) · seq · username (lowercase) · name · email · phone · role
(global_admin|project_admin|user) · org · locationId · city · state · depotId? · depot?
· projects[] (or ['ALL']) · status (active|disabled) · createdAt · lastLogin · lastIp
· passwordHash (salt:hash) · mustChangePassword · failedLogins · lockedUntil · updatedAt`

### 5.7 Project store

Per project: config (customer, address, contract, numbering patterns, sheet mapping),
`sequences` (monotonic counters), `templates[type][]` (version manifests,
`draft → approved | rejected`, immutable sample manifest, approval history),
`links[]` (`{id, fromDoc, toDoc, type, projectId}`), `audit[]`.

### 5.8 Files

Drive root `GOOGLE_DRIVE_FOLDER_ID`, organized `uploadFileToDrive(org, category)`;
local `uploads/` mirror (`/tmp` on Vercel); template samples immutable under
`uploads/samples/<projectId>/<type>/`; letterhead/logo images in `assets/`.

## 6. Forms details (field tables — IMPLEMENTED)

IDs are the HTML↔JS contract in `public/index.html` unless noted.

### 6.1 Sign-in (`formSignin`)

| Field id | Type | Notes |
|---|---|---|
| `signinUsername` | text | admin or `<prefix>-NNNN` |
| `signinPassword` | password | |
| `signinLocChip` | chip | reflects selected location |
| `signinAdminId` / `signinAdminHint` | text/hint | admin quick-entry hint |
| `signinSubmit` | button | `POST /api/login` |

### 6.2 Registration (`formRegister`)

| Field id | Type | Notes |
|---|---|---|
| `regUsername` | text | auto-suggested via `/api/auth/username-suggest` |
| `regUsernameSuggest` | chip | accept-suggestion control |
| `regName` · `regEmail` · `regPhone` | text | staff identity |
| `regPassword` | password | strength meter `pwStrength` |
| `regConfirm` | password | must match (server rejects mismatch) |
| `regLocChip` · `regSubmit` | chip/button | `POST /api/auth/register`, location-bound |

### 6.3 Letter form

`letter_refNumber` (auto from `/api/letter/next-number/:org`) · `letter_allReferences` ·
`letter_date` · `letter_from` · `letter_to` · `letter_kindAttn` · `letter_subject` ·
`letter_letterContent` (textarea) · `letter_enclosures` · `letter_remarks` ·
`letter_signatory` · `letter_designation` · `letter_org` · `letter_project` ·
`letter_cc` · `letter_depot` · `letter_priority`.
Filters: `letterOrgFilter`, `letterDepotFilter`, `letterStatusFilter`, `letterSearch`;
table `lettersTable`; preview `letterPreview`; save `/api/save` (sheet by org);
download via `generate-pdf`/`generate-docx` (BEML letterhead).

### 6.4 Reply form

`reply_select` (pick inbound letter) · `reply_from` · `reply_to` · `reply_ref` ·
`reply_subject` · `reply_date` · `reply_org` · `reply_depot` · `reply_priority` ·
`reply_attention` · `reply_techDetails` · `reply_instructions` · `reply_content`.
Draft via `/api/ai/generate-reply`; persisted via `/api/save-reply`.

### 6.5 NCR form (44 inputs + master-data dropdowns)

Identity: `ncr_ncrNo` (auto), `ncr_date`, `ncr_detectionDate`, `ncr_place`,
`ncr_product`, `ncr_project`, `ncr_vendor`.
Item: `ncr_item`, `ncr_ncrDesc`, `ncr_partNo`, `ncr_partSerialNo`, `ncr_faultySl`,
`ncr_healthySl`, `ncr_qty`, `ncr_issuedBy`.
Rolling stock: `ncr_train`, `ncr_car`, `ncr_vehicleNo`, `ncr_coachNo`,
`ncr_assyDwgNo`, `ncr_assySerialNo`, `ncr_rev`.
Logistics: `ncr_blNo`, `ncr_invoiceNo`, `ncr_storedAt`, `ncr_gatePassNo`.
Repair: `ncr_itemRepaired`, `ncr_itemReplaced`, `ncr_dateOfRepair`,
`ncr_repairProcedure`, `ncr_correction`.
Investigation/closure: `ncr_investigationDate`, `ncr_rootCause`, `ncr_cause`,
`ncr_preventiveAction`, `ncr_decision`, `ncr_closureDate`, `ncr_closureAuthority`,
`ncr_distribution`, `ncr_approvalScope`, `ncr_status`, `ncr_team`, `ncr_assignedTo`,
`ncr_remarks`, `ncr_context`.
Filters: `ncrProjectFilter`, `ncrSeverityFilter`, `ncrStatusFilter`, `ncrSearch`;
table `ncrTable`; preview `ncrPreview`; source-file upload prefills via `ncr-parser.js`.

### 6.6 Joint Note form

`jn_number` (auto) · `jn_date` · `jn_parties` · `jn_subject` · `jn_description` ·
`jn_itemsDiscussed` · `jn_decisions` · `jn_actionItems` · `jn_status` · `jn_remarks`;
table `jnTable`; preview `jnPreview`; downloads `jnPdfDownload`/`jnDocxDownload`.

### 6.7 AI draft panel

Basic: `ai_org`, `ai_subject`, `ai_recipient`, `ai_context`, `ai_tone`, `ai_type`,
`ai_full` (+`ai_full_hint`). Advanced (`ai_advanced`, toggle `ai_advToggle`):
`ai_lang`, `ai_length`, `ai_paras`, `ai_numbering` (roman|numeric|arabic-paren|none),
`ai_spacing`, `ai_refs`, `ai_extra`, `ai_signoff` (`closing|For |role`).
NCR AI: `aiNcr_project`, `aiNcr_vendor`, `aiNcr_item`, `aiNcr_car`, `aiNcr_train`,
`aiNcr_severity`, `aiNcr_context`. Outputs: `aiLetterResult`, `aiNcrResult`,
`replyResult` — editable drafts, never auto-saved.

### 6.8 Upload / import / search / chrome

Upload modal: `uploadModal`, `uploadForm`, `uploadFile`, `uploadDropZone`, `uploadBtn`,
`uploadOrg`, `uploadType`, `uploadProgress`/`uploadProgressBar`/`uploadProgressText`,
`uploadStatus` → `/api/extract`.
Excel import: `importExcelBtn`, `importExcelDropZone`, `importExcelFile`,
`importExcelPreview`, `importOrgExcel`, `importTypeExcel` → `/api/import/excel`.
Search: `globalSearch`, `searchQuery`, `searchSheet`, `searchResults` → `/api/search`.
Modals: `detailModal`/`detailTitle`/`detailBody`, `viewerModal`/`viewerDownload`.
Portal chrome: `globeCanvas`, `indiaCanvas`, `portalStars`, `locationCards`,
`stage-globe`, `stage-map`, `mapBack`, `exploreBtn`, `authDrawer`, `depotSelector`,
`userBadge`, `logoutBtn`, `toast`, `statLocations`, `statDepots`, `statTrainsets`.

## 7. SKILL.md — agent skill for working on this repository (IMPLEMENTED as a document)

Copy this section to the repo root as `SKILL.md` to give any coding agent the operating
knowledge it needs. Condensed from [RULES.md](RULES.md) and [MEMORY.md](MEMORY.md).

```
---
name: docvault-maintenance
description: Work on the BEML Metro Document Intelligence Platform (DocVault) — Express
  monolith + Google Sheets record store + Gemini AI drafts + Vercel deploy.
---

# DocVault maintenance skill

## What this app is
Single Express monolith (server.js) serving a static SPA (public/index.html + portal.js).
Google Sheets = record of truth; data/users.json = user directory (mirrored to the
Users sheet tab); project-store.js = workflow state. Gemini gemini-2.0-flash drafts
letters/replies/NCRs behind callAI(). Deployed on Vercel (Git-connected, main branch).

## Before you write code
1. Read application-documents/RULES.md — it is binding. Key rules:
   - No secrets in code/docs/logs. Operator passcode lives only in
     ADMIN_BOOTSTRAP_PASSCODE (Vercel Production env).
   - Every data route authenticates AND enforces project scope server-side.
     Deny by default. Helpers: requireScopes, guardSheet, guardRow, stampProjectId.
   - AI output is always a draft; never auto-issue, never let AI number/date documents.
   - Official documents render only from approved template versions.
   - Never hard-code KMRCL/customer values — resolve from locations.js/projects.js.
2. server.js is ~4,600 lines: grep exact anchor strings before editing; never reformat.
3. Sheet columns are positional appends — changing a column array breaks existing
   sheets. Add columns at the end only, with a doc update.

## How to run and verify
- npm install && npm start → http://localhost:3000 (bootstraps admin, ensures headers).
- node --check server.js — always.
- node tests/acceptance-write-guards.mjs   (23 checks, needs live server)
- node tests/auth-location-admins.mjs      (4 checks)
- node tests/depots-map.mjs                (17 checks)
- Serverless facts: /tmp is ephemeral; login lazily bootstraps operator accounts on
  Vercel; env-var changes require a redeploy to take effect.

## Recurring pitfalls
- SHEET_NAMES[org] fallback can create surprise tabs — resolve org via the registry.
- Shared tabs need row-level Project ID checks; per-org tabs need sheet-level checks.
- Lockout: 5 wrong passwords locks an account 15 minutes — don't hammer test logins.
- Never stage .env, data/, uploads/, credentials/, *.log, .DS_Store, node_modules/.
- Git: push only when asked; commit only intended files (no git add -A).

## Definition of done
Code + guards + the three suites actually run and pass + affected
application-documents/ files updated in the same change. Report failures as failures.
```

## 8. MCP server setup (PROPOSED — not installed)

**Goal:** let MCP-aware agents/IDEs operate DocVault through the same authorization
model as the HTTP API.

- **Transport:** a thin MCP server (streamable HTTP, same Express process or a sibling
  Worker) mounted at `/mcp`; every tool call requires a user JWT (`Authorization`
  bearer) — no anonymous tools.
- **Tool surface (read-heavy, write-draft-only):**

| Tool | Args | Guard | Effect |
|---|---|---|---|
| `search_records` | `sheet, query, projectId?` | `requireScopes` + `guardSheet` | scoped `/api/search` equivalent |
| `get_letter` / `get_ncr` | `ref` or row index | `guardRow` | single record, project-checked |
| `next_reference_number` | `org` | scope | deterministic counter read |
| `list_templates` | `projectId, type` | scope | template versions + states |
| `create_letter_draft` | letter fields | scope + `stampProjectId` | creates a row with Status=Draft |
| `get_project_config` | `projectId` | `canManageProject` for writes | numbering/sheet mapping |

- **Rules:** read-only by default; `create_letter_draft` never issues (Status=Draft);
  every call runs `auditEvent('mcp.<tool>')`; rate-limited like login; tokens are
  short-lived; no tool may bypass `guardRow`/`guardSheet`.
- **Config (client side):** register the server URL + bearer token in the MCP client
  config; agent docs must state that cross-project calls return 403 by design.
- **Verification:** a non-member asking for another project's records must get a denial
  test; every tool call must appear in the audit log.

## 9. RAG setup (PROPOSED — no vector store installed)

**Goal:** answers grounded in the project's own official documents, with citations,
never leaking across projects.

- **Corpus:** approved template samples, saved Letters/NCR/Joint Notes rows (text
  columns), uploaded source files (extracted text from `/api/extract`).
- **Pipeline:** ingest (per project) → clean/normalise → chunk (≈500 tokens, 50 overlap,
  keep ref-number headers as metadata) → embed (provider-agnostic; choice open) →
  vector index **per project** (namespace = projectId; depot-scoped queries can narrow
  further) → retrieval (top-k with metadata filter = caller's `projects[]`) → answer
  generation via `callAI` with a citation-required prompt → response includes chunk
  provenance (ref number + tab + row).
- **Permission filtering (the critical part):** retrieval filters are derived from the
  JWT server-side, exactly like `guardRow`; the client never supplies the filter.
  Cross-project retrieval must be impossible and proven by a test.
- **Freshness:** re-index on save/delete (event hook in the write path) and nightly;
  deleted rows must drop from the index; template approval triggers re-index of that
  type's samples.
- **Guardrails:** retrieval never fabricates; no grounded chunks → explicit
  "no supporting document" answer; citations mandatory in reply drafts (backlog item:
  flag unsupported sentences).
- **Ops:** index rebuild command; index size/quota monitoring; embeddings cost budget
  per project; never index password hashes or audit secrets.

## 10. LangChain setup (PROPOSED — not installed)

**Goal:** provider-agnostic plumbing without changing business logic.

- Wrap `callAI` as a ChatModel so the rest of the app keeps its current function shape.
- Prompt templates (versioned in repo) for: letter draft, reply draft, NCR draft,
  improve-content — encoding the existing advanced options (language, length,
  paragraphs, numbering style, spacing, verbatim `references` echo, sign-off block).
- Output parsers producing the exact JSON draft shape the UI already renders; parse
  failure ⇒ retry once ⇒ actionable error (never a half-draft saved silently).
- Retrieval integrations only for the §9 RAG layer; business routes stay deterministic.
- Adoption gate (RULES R-9): a defined problem, runtime compatibility with Node ≥ 18 +
  Vercel serverless (bundle size, no native addons), tests, lockfile update.

## 11. Langflow setup (PROPOSED — not installed)

**Goal:** non-developer iteration on prompts/retrieval, versioned beside the code.

- A flow mirroring the LangGraph graph: input form → retrieval (project filter) →
  prompt template → model → output parser → JSON draft the UI can consume.
- Export the flow JSON into the repo (`flows/`), reviewed like code; production runs
  the code path (§10/§12), not the designer runtime — the flow is a design artifact.
- Any prompt change proven in the flow must be back-ported into the versioned templates.
- Never connect the flow designer directly to production keys; use a scoped dev key.

## 12. LangGraph setup (PROPOSED — not installed)

**Goal:** an explicit, auditable draft workflow instead of one-shot prompting.

- **State:** `{user, project, docType, fields, retrieved[], draft, issues[], citations[],
  status}`. Deterministic fields (ref number, date, scopes) are filled by code before
  the graph starts and are immutable to the model.
- **Nodes:** `retrieve` (§9 RAG, permission-filtered) → `draft` (`callAI` + prompt
  template) → `validate` (schema + rule checks: required fields, ref format, no invented
  numbers/dates) → `fact_check` (claims must appear in retrieved context; else flag) →
  `human_review` (the UI draft editor — hard gate, no auto-advance) → `render`
  (pdfkit/docx from approved template) → `persist` (existing `/api/save*` with
  `stampProjectId` + audit).
- **Edges:** validate/fact-check failures route back to `draft` with the issue list
  (max 2 retries, then surface to the human); model/provider errors fall back
  Gemini → OpenAI-compatible; every node records `auditEvent('ai.graph.<node>')`.
- **Invariants:** the graph may never call approve/issue/save-final; `human_review`
  cannot be skipped in configuration; numbering/date/scope nodes are pure code.
- **Observability:** per-node timing and token counts into the audit log; a per-document
  trace id returned to the UI for support.

---

## 13. Blueprint delivery status (honest summary)

| Area | Status |
|---|---|
| Portal, auth, roles, location/depot admins, lockout, rate limit | IMPLEMENTED |
| Project isolation on reads **and writes** (23-check suite) | IMPLEMENTED |
| Letters/Replies/NCR/Joint Notes: create, numbering, PDF/DOCX w/ letterhead | IMPLEMENTED |
| AI drafts (Gemini default + OpenAI fallback, advanced options) | IMPLEMENTED |
| Import/export, OCR/text extraction, Drive uploads | IMPLEMENTED |
| Admin users API, audit log, Users-sheet mirror, cold-start bootstrap | IMPLEMENTED |
| Template onboarding + correspondence graph | API IMPLEMENTED, UI pending |
| Admin panel UI, project switcher UI, graph UI | PENDING (designs in UI_UX_DESIGN_BRIEF) |
| JWT TTL/revocation, OpenAPI, visual regression | PENDING (TASKS.md) |
| MCP server · RAG · LangChain · Langflow · LangGraph | PROPOSED only (§8–§12) |

**Related documents:** [MASTER-PROMPT.md](MASTER-PROMPT.md) · [PRD.md](PRD.md) ·
[TRD.md](TRD.md) · [ARCHITECTURE.md](ARCHITECTURE.md) · [BACKEND_SCHEMA.md](BACKEND_SCHEMA.md) ·
[APP_FLOW.md](APP_FLOW.md) · [UI_UX_DESIGN_BRIEF.md](UI_UX_DESIGN_BRIEF.md) ·
[DESIGN.md](DESIGN.md) · [RULES.md](RULES.md) · [MEMORY.md](MEMORY.md) · [TASKS.md](TASKS.md)
