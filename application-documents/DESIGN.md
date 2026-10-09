# DESIGN — Detailed Application Design

- **Version:** 1.0
- **Status:** Active
- **Date:** 2026-10-09
- **Scope:** Module design, state machines, data relationships, error strategy.

## 1. Module map

| Module | File | Responsibility |
|---|---|---|
| HTTP app / business logic | `server.js` | Routing, auth, guards, Sheets layer, AI calls, PDF/DOCX, admin |
| Portal location registry | `locations.js` | BEML metro locations (id, org, coordinates, color, projects, trainsets) for `/api/locations` |
| Project registry | `projects.js` | Static project definitions: customer config, numbering patterns, sheet maps, `stampProjectId`, scope helpers |
| Project store | `project-store.js` | Durable JSON: config, sequences, template versions, links, audit |
| User store | `user-store.js` | Durable JSON: users, scrypt hashing/verify, profile patch, public profile |
| Frontend | `public/index.html`, `public/portal.js`, `public/portal.css` | Workspace SPA + animated portal |

## 2. Core models

### 2.1 Project
```
Project {
  id (e.g. KMRCL), name, customer { name, address, contact },
  numbering { letter, ncr, jointNote } patterns + counters,
  sheets { letters: <tab>, shared: [NCR Records, Joint Notes] },
  color, status
}
```

### 2.2 Template version
```
TemplateVersion { type, version, status: draft|approved|rejected,
  samples: [{ name, storedAs, uploadedAt }], extractedText,
  createdBy, approvedBy, approvedAt, notes, createdAt }
```
State machine: `draft →(admin approve)→ approved` / `draft →(admin reject)→ rejected`.
Invariant: at most one `approved` version per (project, type) — approval supersedes the
previous approved version (previous kept in history, never deleted). Documents already
issued are immutable: re-rendering uses the approved version current **at issue time**
(issue timestamp recorded on the document row).

### 2.3 Correspondence link
```
Link { id, projectId, from: { docId, kind, ref }, to: { docId, kind, ref },
  rel: reply|clarification|joint_note|ncr|closure|attachment, createdBy, createdAt }
```
`GET /api/graph` groups nodes by document and returns edges filtered by caller scopes.
Links are real records — no parsing of reference text inside documents.

### 2.4 User
```
User { id, username, staffId, name, designation, department, mobile, email,
  projects: [KMRCL|...|ALL], role: global_admin|admin|project_admin|user,
  status: active|disabled,
  passwordHash, mustChangePassword, failedAttempts, lockedUntil,  // see server.js auth block
  lastLogin, createdAt, updatedAt }
```

### 2.5 Audit event
```
Audit { ts, actor, action (e.g. auth.login, access.denied_template,
  template.approve, admin.role_change), project?, meta }
```
Append-only; exposed via `GET /api/admin/audit` (admin only).

## 3. Numbering engine

- Per project, per document type, pattern + monotonic counter in the project store.
- Legacy KMRCL sequences preserved to avoid renumbering issued documents.
- Generation is synchronous server logic under a compute-then-write guard; on Vercel
  concurrency, counters are re-read before write (last-write-wins risk documented —
  migrate to Sheets-stored sequences if concurrent issuance becomes common).

## 4. Sheets layer design

- `ensureHeaders` creates the header row once per tab; `appendToSheet` maps objects →
  column order; `readSheet`/range getters fetch `A1:Z` windows.
- Shared tabs include `Project ID`; `rowVisibleTo` enforces per-row scope.
- Per-project letter tabs are inherently isolated; `guardSheet` validates the target
  tab against `req.scopes`.
- Header drift across tabs is tolerated by name-based column mapping (no positional
  assumptions beyond header row).

## 5. Error strategy

- Route-level try/catch → 500 with `{ success:false, error }`; client shows toast.
- Auth errors: 401 (bad token) / 403 (scope) / 429 (login burst) / 423-style lockout
  message on too many failures.
- AI errors: surfaced with provider message + retry hint; `configured:false` reported
  by `/api/ai/status` so UI can disable buttons.
- File extraction failures fall back gracefully (e.g. OCR path) without losing the
  original upload.

## 6. Frontend design notes

- Single HTML file, no framework build step; `authFetch()` wrapper injects JWT and
  `x-project-id`; state kept in plain JS objects (approved UI untouched).
- Portal isolated from workspace styling (portal.css) so workspace remains byte-stable.
- New UI (switcher, admin, graph) will be additive sections/tabs following existing
  table+drawer patterns.

## 7. Scaling considerations

- Sheets API latency dominates: reads are cached per request only; a short-TTL cache
  is a future optimization.
- Generated PDFs written per request to `/tmp` (Vercel) — no reuse expected.
- JSON stores suit single-instance operation; multi-instance writes would require
  moving users/projects to Sheets or a hosted DB (documented risk in TRD §7).

## 8. Related documents

[ARCHITECTURE.md](ARCHITECTURE.md) · [BACKEND_SCHEMA.md](BACKEND_SCHEMA.md) · [UI_UX_DESIGN_BRIEF.md](UI_UX_DESIGN_BRIEF.md)
