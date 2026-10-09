# ARCHITECTURE — BEML Metro Document Intelligence Platform

- **Version:** 1.0
- **Status:** Active (describes implemented architecture; proposals labelled)
- **Date:** 2026-10-09

## 1. Architectural decision record

**ADR-1: One deployment, many projects (multi-tenant by column + per-project tabs).**
The application stays a single Express app + single static frontend. Every business
record carries a stable project identifier; shared tabs (NCR, Joint Notes) use a
`Project ID` column with row-level checks, while letter data uses per-project sheet
tabs. Alternative (database-per-project) rejected: unnecessary for the current stack.

**ADR-2: Google Sheets remains the record of truth this phase.** Replacing it with a
relational DB was rejected as an unnecessary migration risk; Sheets is extended with
project scoping. Reconsider if write volume/quotas become binding (see TRD §7).

**ADR-3: Preserve approved UI and working Gemini integration.** New features are
additive surfaces using existing design tokens. AI stays behind a thin provider
abstraction (`callAI`) so additional providers can be added without touching business
logic.

**ADR-4: Server-side authorization is authoritative.** JWT carries membership
(`projects[]`, `role`); every data request resolves `req.scopes` server-side. Client
project selection is a convenience, never a security boundary.

**ADR-5: AI never approves official templates or issues documents.** Draft → human
approve is enforced in the template state machine and letter workflow.

## 2. System diagram

```
Browser (public/index.html SPA + portal.js/portal.css)
   │  fetch /api/*  (Bearer JWT, optional x-project-id)
   ▼
Express server.js ──────────────────────────────────────────────
   │ authenticateToken → req.scopes (role, projects[])
   │ requireScopes / guardSheet / guardRow / canManageProject
   ├─ Auth & users ─────── data/users.json (scrypt) + audit
   ├─ Projects & config ── project-store.js (config, sequences,
   │                       templates, links, audit)
   ├─ Registry ─────────── locations.js (portal) + projects.js
   │                       (numbering, customers, sheet maps)
   ├─ Records layer ────── Google Sheets (per-org tabs + shared tabs)
   ├─ Documents ────────── pdfkit (PDF) · docx (DOCX) · extractors
   ├─ AI ───────────────── callAI() → Gemini (default) | OpenAI
   └─ Files ────────────── Google Drive + uploads/ (+ /tmp on Vercel)
```

## 3. Request lifecycle (data route)

1. JWT verified → `req.user` with `role`, `projects[]`.
2. Scope resolution: `x-project-id` header ∩ membership, else membership list;
   `null` ⇒ 403 (deny by default).
3. Capability check (`requireScopes`, `canManageProject` for admin ops).
4. Sheet/row check (`guardSheet` / `guardRow`) before read or write.
5. Business logic (numbering, validation) — deterministic, never AI.
6. Persist (Sheets append/update), audit event where the action is significant.
7. Response `{ success, ... }`; errors mapped to 4xx/5xx with safe messages.

## 4. Authentication architecture

- Issue: `POST /api/login` → verify scrypt hash, status, lockout, rate limit →
  HS256 JWT `{ sub, username, role, projects[] }`.
- Bootstrap admin: `ADMIN_BOOTSTRAP_PASSCODE` env (server-side only) yields a token
  with `projects: ["ALL"]`. Password change is required after first use (enforced flag
  in user record — see server auth block).
- Registration: location/project-bound at creation; username auto-suggest prevents
  cross-project collision.
- Admin re-auth for privileged routes: role claim + `canManageProject` + audit.

## 5. Template subsystem

- Registry: `project-store.templates[type][]` with immutable source-sample manifests.
- State machine (implemented): `draft → approved | rejected`; only admin can transition;
  the latest **approved** version renders official documents.
- ⏳ Proposed: AI extraction of layout fields from samples → structured draft config;
  side-by-side sample regeneration for review; visual regression harness.

## 6. Correspondence graph

- Real relationships stored as edges: `links[] { id, fromDoc, toDoc, type, projectId }`
  with types covering incoming letter → reply → clarification → joint note → NCR →
  closure evidence.
- `GET /api/graph?project=` returns nodes+edges filtered by caller scopes.
- ⏳ UI: force-directed graph + tree view (spec in UI_UX_DESIGN_BRIEF §5.3).

## 7. AI layer

- `callAI({ system, prompt, ... })` — provider selected by `AI_PROVIDER` /
  presence of `GEMINI_API_KEY`; default model `gemini-2.0-flash`.
- Endpoints produce **drafts** (letter, reply, NCR, improve-text); responses are
  structured JSON, editable in the UI, never auto-issued.
- ⏳ Proposed evolution: LangGraph-style explicit workflow
  (extract → validate → retrieve → draft → check → human review → render → save),
  project-scoped RAG retrieval with permission filtering, evidence citations.
  LangChain/LangGraph/Langflow are **not** installed; adoption requires a defined
  problem + compatibility test (RULES R-9).

## 8. Synchronization model

- Reads are live (Sheets-backed): dashboard refresh sees latest data. Writes append
  server-side in one request (no client-side bulk sync).
- ⏳ Proposed: sync engine with last-synced timestamps, retry/backoff, idempotency
  keys on imports, conflict surface, Drive folder tree per project/category.

## 9. Deployment

- Vercel: `vercel.json` builds `server.js` (`@vercel/node`) + static `public/`,
  routes `/api/*` and `/uploads/*` → `server.js`, SPA fallback → `index.html`.
- Local: `npm start` (Node ≥ 18). Secrets via Vercel env settings; `.env` gitignored.
- Rollback: redeploy previous git SHA; Sheets data unaffected by code rollback
  (schema-less columns — verify header compatibility before rollback).

## 10. Security boundaries

- Passwords hashed (scrypt+salt), never logged or documented.
- Login rate limiting + lockout implemented; audit log covers auth/admin/template events.
- Frontend never receives secrets; AI keys server-side only.
- Open: write-route guards (T-01), import idempotency, security test suite.

## 11. Related documents

[DESIGN.md](DESIGN.md) · [BACKEND_SCHEMA.md](BACKEND_SCHEMA.md) · [TRD.md](TRD.md) · [MEMORY.md](MEMORY.md)
