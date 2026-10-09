# PRD — BEML Metro Document Intelligence Platform

- **Version:** 1.0
- **Status:** Active (living document)
- **Date:** 2026-10-09
- **Scope:** One deployment serving all BEML metro projects with strict project data isolation.

## 1. Purpose

Upgrade the existing Kolkata/KMRCL-specific letter processing application into a
centralized, multi-project BEML Metro Document Intelligence Platform: one frontend,
one backend, one authentication system, project-scoped data, project-specific letter
formats, and AI-assisted correspondence — while preserving the approved UI and the
working Gemini AI integration.

## 2. Personas

| Persona | Description |
|---|---|
| **Global administrator** | Logs in with the bootstrap admin credential; may access and manage every configured project, all users, all templates. All actions audited. |
| **Project user (staff)** | Registered against one project (e.g. KMRCL) with staff ID, designation, department, mobile, email; sees only that project's records. |
| **Portal visitor** | Pre-login user exploring the animated portal (globe → India map → BEML locations) before registering/signing in. |
| **Template approver (admin)** | Uploads official sample letters/NCRs for a new project, reviews extracted template drafts, approves versions. |

## 3. Product principles

1. One application, many projects — never duplicate the codebase per metro.
2. Project isolation is enforced **server-side** on every request; UI selection alone is never authorization.
3. Approved official formats are sacred: no generic document may silently substitute a missing official template.
4. AI output is always a draft requiring human review before official issue.
5. The approved UI and the working Gemini integration are preserved.

## 4. Feature inventory

### 4.1 Implemented (verified in code at commit `2970623`)

| ID | Feature | Evidence |
|---|---|---|
| FR-1 | Animated pre-login portal: rotating globe → India map → live BEML location cards → auth drawer | `public/portal.js`, `public/portal.css` |
| FR-2 | Location-wise registration/login (staff ID auto-suggest, scrypt password hashing, JWT) | `POST /api/auth/register`, `POST /api/login`, `user-store.js` |
| FR-3 | Bootstrap global administrator via server-side env var (`ADMIN_BOOTSTRAP_PASSCODE`), never in frontend or repo | `server.js` auth block |
| FR-4 | Roles (admin/user), project membership in JWT claims, per-request scope resolution | `authenticateToken`, `x-project-id` handling |
| FR-5 | Project master registry: KMRCL, BMRCL, DMCRL (Delhi), MMRCL, CMRL with customer config, numbering patterns, coordinates | `locations.js`, `projects.js` |
| FR-6 | Persistent project store: config, sequences, correspondence links, audit log | `project-store.js` |
| FR-7 | Project-scoped read enforcement on records/search/export routes | `requireScopes`, `guardSheet` on read routes |
| FR-8 | Template onboarding API: upload samples per project/type, text extraction, draft version, admin approve/reject | `POST /api/projects/:id/templates/:type/samples`, `.../approve`, `.../reject` |
| FR-9 | Correspondence links + graph API (`/api/links`, `/api/graph`) | `server.js` |
| FR-10 | Letter generation: PDF (pdfkit) and DOCX (docx) with per-org numbering | `/api/letter/*`, `/api/generate*` |
| FR-11 | NCR module: create/update/clone, next-number, PDF/DOCX generation | `/api/ncr/*` |
| FR-12 | Joint Note module: create, next-number, PDF/DOCX | `/api/joint-note/*` |
| FR-13 | AI endpoints (Gemini default, OpenAI-compatible fallback): generate letter, generate reply, generate NCR, improve content, status | `/api/ai/*`, `server.js:4002-4176` |
| FR-14 | Import/export: CSV, JSON, Excel; bulk upload; PDF/DOCX/OCR text extraction | `/api/import/*`, `/api/export/*`, `/api/extract`, `/api/ocr-images` |
| FR-15 | Google Sheets as primary record store with per-org sheets + shared sheets (NCR Records, Joint Notes) | `server.js` sheet layer |
| FR-16 | Google Drive file upload organized by organization/category | `uploadFileToDrive` |
| FR-17 | Admin user management API: list users, change role, enable/disable, reset password, audit query | `/api/admin/*` |
| FR-18 | Audit events for auth, admin, template, and denied-access actions | `auditEvent` |
| FR-19 | Dashboard records/search with filters | `/api/records`, `/api/search`, frontend tabs |
| FR-29 | Login rate limiting + account lockout (5 failures → 15 min) | `server.js:2041` `rateLimitLogin` |

### 4.2 In progress (partially implemented)

| ID | Feature | Gap |
|---|---|---|
| FR-20 | Project enforcement on **write** routes (save, update, delete, clear, imports, document creates) | `guardRow`/`stampProjectId` helpers exist but are not yet wired into these routes — see TASKS.md T-01 |
| FR-21 | Frontend project switcher + admin panel | Backend `/api/projects`, `/api/auth/switch-project` exist; no UI yet |
| FR-22 | Correspondence graph/tree **UI** | API ready; no visualization in `index.html` yet |

### 4.3 Proposed / not implemented

| ID | Feature | Note |
|---|---|---|
| FR-23 | AI layout extraction for uploaded samples (fields, header/footer, numbering detection) | Only raw text extraction is implemented; AI parsing proposed |
| FR-24 | RAG pipeline (chunk → embed → vector index → permission-filtered retrieval) | No vector store installed |
| FR-25 | LangChain / LangGraph / Langflow orchestration | Not installed; add only where a defined problem exists (see RULES.md R-9) |
| FR-26 | MCP server + Playwright test automation | Not installed; test suite absent |
| FR-27 | Real-time live synchronization (websocket/polling with retry, idempotency, sync status UI) | Data reads are live per request; no sync engine/last-synced UI yet |
| FR-28 | Visual regression tests for official templates | Not implemented |
| FR-30 | JWT session expiry (TTL) + revocation on password change | Not implemented — TASKS T-09 |

## 5. Project master (initial registry)

| Code | Customer / Metro | Status |
|---|---|---|
| KMRCL | Kolkata Metro (RS-3R) — reference implementation | Active, historical data preserved |
| BMRCL | Bengaluru Metro | Registry entry, no templates yet |
| DMCRL | Delhi Metro | Registry entry — **open issue:** verify official abbreviation (DMRC vs DMCRL) |
| MMRCL | Mumbai Metro | Registry entry, no templates yet |
| CMRL | Chennai Metro | Registry entry, no templates yet |

Each project carries its own customer details, address, contract reference, numbering
pattern, sheet mapping, and template versions. KMRCL values are never hard-coded as
defaults for other projects.

## 6. Non-goals

- Replacing Google Sheets as the record store in this phase (documented decision; see MEMORY.md).
- Replacing the working Gemini integration.
- Redesigning the approved UI.
- Separate deployments per metro project.

## 7. Success metrics

- Acceptance scenarios 1–5 (project isolation) pass against the live API.
- New project onboarded end-to-end (create → samples → approve → generate) without code changes.
- All 25 acceptance tests in the master specification executed with real results.

## 8. Open issues

1. Delhi project code discrepancy (DMCRL vs DMRC).
2. Write-route guards incomplete (FR-20).
3. No automated test suite yet.
4. Google credential rotation recommended if repository history contains keys.
5. Login rate limiting/lockout not yet implemented.

## 9. Related documents

[TRD.md](TRD.md) · [APP_FLOW.md](APP_FLOW.md) · [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) · [TASKS.md](TASKS.md) · [ACCEPTANCE (see TASKS.md)](#)
