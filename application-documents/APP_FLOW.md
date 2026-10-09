# APP_FLOW — Features, Navigation and User Journey

- **Version:** 1.0
- **Status:** Active (implemented flows verified; proposed flows marked ⏳)
- **Date:** 2026-10-09

## 1. Pre-login portal (implemented)

```
Landing (portal overlay)
  └─ Stage 1: Rotating globe (canvas, ~15k animated points) + BEML identity
       └─ auto-advance countdown (10 s) or user click
  └─ Stage 2: India map with BEML metro location markers (pulsing, color-coded)
       └─ click a location card → Stage 3
  └─ Stage 3: Location context + auth drawer
       ├─ Sign in (username/password)
       └─ Register (staff ID auto-suggested as <prefix>-000N, strength meter,
            password confirmation) → POST /api/auth/register (project-scoped)
  └─ Success → portal fades out → application workspace loads
```

- Locations served by `GET /api/locations` (registry in `locations.js`).
- Every registration is bound to the selected project/location at creation time.

## 2. Authentication journeys

### 2.1 Project user login
1. Select location → sign in.
2. `POST /api/login` verifies scrypt hash, checks account status and lockout
   (5 failures → 15 min), applies login rate limiting (429 after burst).
3. JWT issued containing `sub`, `role`, `projects[]` (membership).
4. Workspace opens scoped to the user's project(s).

### 2.2 Global administrator login
1. Same entry; server recognizes the bootstrap/admin credential (env-provided —
   never present in frontend code or docs).
2. JWT carries `projects: ["ALL"]` → access to every configured project,
   subject to audit logging.
3. Admin can switch active project via `POST /api/auth/switch-project` (re-issues token).

### 2.3 Session lifecycle
- `GET /api/auth/verify` validates token on load; `POST /api/logout` clears client token.
- `POST /api/auth/change-password` for self-service password change.

## 3. Workspace (implemented, approved UI preserved)

Top-level navigation (single-page `public/index.html`):

| Area | Features |
|---|---|
| Header | Organization/project context, user badge, logout |
| Letters tab | Import letter (PDF/DOCX/OCR → `/api/extract`), generate letter, AI draft (`/api/ai/generate-letter`), edit fields, save (`/api/save`), PDF/DOCX download |
| Reply workflow | Open customer letter → AI reply draft (`/api/ai/generate-reply`) → edit → save (`/api/save-reply`) |
| NCR tab | Create/update/clone NCR, next-number, AI assist (`/api/ai/generate-ncr`), PDF/DOCX |
| Joint Note tab | Create, next-number, PDF/DOCX |
| Records/Dashboard | `/api/records`, `/api/search`, filters, CSV/JSON export |
| Import | CSV / JSON / Excel import, bulk upload |

Project scoping on reads: client may send `x-project-id`; server resolves the
caller's scopes from the JWT and rejects out-of-scope sheets/records with 403.

## 4. Admin journeys

| Journey | Status |
|---|---|
| List users, change role/status, reset password (`/api/admin/*`) | API ⏳ no UI yet |
| Query audit log (`/api/admin/audit`) | API ⏳ no UI yet |
| Create/edit project config (`PUT /api/projects/:id/config`) | API ⏳ no UI yet |
| Template onboarding: upload samples → review draft → approve/reject | API ⏳ no UI yet |
| Project switcher for admins | API ✅ / UI ⏳ |

## 5. Template onboarding flow (API implemented, UI pending)

```
Admin selects project + template type (letter | reply | ncr | joint_note | ...)
  → POST /api/projects/:id/templates/:type/samples  (up to 10 files)
      · files stored immutably under uploads/samples/<project>/<type>/
      · text extracted per file (extractText)
      · draft template version created (status: draft)
  → Admin reviews draft vs original samples
  → POST .../approve  (status → approved)   |   POST .../reject  (status → rejected)
  → Approved version becomes the rendering source for that project/type
```

AI auto-approval is impossible by design: only `approve` (admin-scoped) publishes.
⏳ Pending: AI field/layout extraction proposing structured template config; sample
document generation for comparison.

## 6. Correspondence graph (API implemented, UI pending)

- `POST /api/links` create relationship (incoming letter → reply → NCR → joint note…),
  `GET /api/links`, `GET /api/graph` (project-filtered), `DELETE /api/links/:id`.
- ⏳ Tree/graph visualization UI (Obsidian-style navigation) in the workspace.

## 7. Live synchronization (partial)

- Data reads are live per request (Sheets-backed), so new letters appear on refresh.
- ⏳ Dedicated sync engine: last-synced timestamps, retry/backoff, conflict UI,
  duplicate protection on re-sync — tracked in TASKS.md.

## 8. Error paths

- 401 invalid/expired token → portal re-shown.
- 403 cross-project access → toast + audit event `access.denied*`.
- 429 login burst → wait message.
- AI key missing → `/api/ai/status` reports `configured: false`; endpoints return a
  clear, retryable error (never fabricated content).
- Missing approved template → explicit error; generic substitution is forbidden.

## 9. Related documents

[UI_UX_DESIGN_BRIEF.md](UI_UX_DESIGN_BRIEF.md) · [BACKEND_SCHEMA.md](BACKEND_SCHEMA.md) · [PRD.md](PRD.md)
