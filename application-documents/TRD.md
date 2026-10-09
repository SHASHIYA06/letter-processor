# TRD — Technical Requirements Document

- **Version:** 1.0
- **Status:** Active
- **Date:** 2026-10-09
- **Scope:** Runtime, stack, environment, constraints for the multi-project platform.

## 1. Stack (actual, verified)

| Layer | Technology |
|---|---|
| Runtime | Node.js ≥ 18 (ESM, `"type": "module"`) |
| HTTP framework | Express 4 |
| Auth | JWT (`jsonwebtoken`), HS256 with `JWT_SECRET`; scrypt password hashing (Node `crypto`) |
| Primary data store | Google Sheets (spreadsheet API via `googleapis`, service-account or OAuth credentials) |
| Secondary stores | `data/users.json` (user directory, via `user-store.js`), project store JSON (via `project-store.js`) |
| File storage | Google Drive (`uploadFileToDrive`), local `uploads/` (or `/tmp` on Vercel) |
| Document generation | `pdfkit` (PDF), `docx` (DOCX) |
| Text extraction / OCR | `pdf-parse`, `pdfjs-dist`, `mammoth` (DOCX), `tesseract.js`, `@google-cloud/vision` |
| Import/export | `csv`-manual parsing, `xlsx` |
| AI | Gemini `generativelanguage` REST (default, model `gemini-2.0-flash`) with OpenAI-compatible fallback |
| Uploads | `multer` (multipart, buffer storage) |
| Deployment | Vercel (`@vercel/node` build of `server.js` + static `public/`), `vercel.json` routes `/api/*` → `server.js` |
| Image processing | `sharp` |

## 2. Process model

- Single Express app (`server.js`, ~4,400 lines) exporting the handler; runs locally via `npm start` and serverless on Vercel.
- In-memory singletons: `sheets` client, `userStore`, `projectStore`, AI config. Vercel `/tmp` used for generated files when `VERCEL=1`.
- Stateless auth: JWT carried in `Authorization: Bearer`; no server session store.

## 3. Environment variables (names only — values never committed)

| Variable | Purpose |
|---|---|
| `JWT_SECRET` | Signs/verifies access tokens |
| `ADMIN_BOOTSTRAP_PASSCODE` | One-time bootstrap admin credential (server-side only) |
| `ADMIN_USERNAME`, `ADMIN_PASSWORD` | Legacy admin credentials (still honored; see MEMORY.md) |
| `GOOGLE_SPREADSHEET_ID` | Primary spreadsheet (records of truth) |
| `GOOGLE_SERVICE_ACCOUNT` | Service-account JSON path/content |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`, `GOOGLE_ACCESS_TOKEN`, `GOOGLE_OAUTH_EXPIRY`, `GOOGLE_REDIRECT_URI` | Drive/Sheets OAuth alternative |
| `GOOGLE_DRIVE_FOLDER_ID` | Root Drive folder |
| `AI_PROVIDER`, `AI_MODEL`, `AI_API_KEY`, `GEMINI_API_KEY`, `OPENAI_API_KEY` | AI provider selection |
| `PORT`, `VERCEL` | Runtime |

`.env` is gitignored. Secrets are injected per environment (Vercel project settings).

## 4. Data model summary

Full detail in BACKEND_SCHEMA.md:

- **Spreadsheet tabs:** per-organization letter sheets (e.g. `KMRCL Letters`), shared
  `NCR Records` and `Joint Notes` with a `Project ID` column for row-level visibility
  (`rowVisibleTo`), plus header-driven column mapping (`LETTER_COLUMNS`, `NCR_COLUMNS`…).
- **User directory:** JSON file; fields include staffId, name, designation, department,
  mobile, email, `projects[]`, role, status, passwordHash (scrypt+salt), lastLogin,
  timestamps; auto-migrated to project-aware schema on boot.
- **Project store:** JSON file with per-project config, template versions, number
  sequences, correspondence links, audit events.

## 5. Numbering

Project-configured patterns with per-project sequences (legacy KMRCL patterns preserved
for continuity: `ORG/LTR/YEAR/NUM` style). Number generation is deterministic server-side
logic — never AI-generated.

## 6. Non-functional requirements

| Requirement | Status |
|---|---|
| Server-side project authorization on every data route | Partial — read routes done, write routes pending (TASKS T-01) |
| Login rate limiting + 5-failure/15-min lockout | Implemented (`server.js:2041`) |
| Passwords stored hashed (scrypt, per-user salt) | Implemented |
| Audit trail for auth/admin/template events | Implemented (JSON audit log) |
| Automated test suite | **Not implemented** (blocking for release sign-off) |
| Horizontal scaling | Sheets API quotas bound throughput; caching layer is a future item |

## 7. Constraints

1. Vercel serverless: no persistent local FS — durable state lives in Sheets/Drive/JSON
   stores must be treated carefully (see MEMORY.md open risk on `data/*.json` in serverless).
2. Google API quotas limit write-heavy bursts; appends are batched per request.
3. Browser print ≠ Word pagination: DOCX is generated structurally via `docx`, not HTML.

## 8. Dependencies (from `package.json` v4.1.0)

`@google-cloud/vision`, `cors`, `docx`, `dotenv`, `express`, `googleapis`,
`jsonwebtoken`, `mammoth`, `multer`, `pdf-parse`, `pdfjs-dist`, `pdfkit`, `sharp`,
`tesseract.js`, `xlsx`. Managed by npm; lockfile updated on every dependency change.
No LangChain/LangGraph/Langflow/vector-DB/MCP packages installed (proposed only).

## 9. Open issues

- Serverless persistence of JSON stores (`data/`) — decide migration to Sheets-backed
  tables or a hosted DB before production multi-tenant rollout.
- Google credential rotation if repo history contains keys.
- Delhi project code verification (DMCRL vs DMRC).

## 10. Related documents

[ARCHITECTURE.md](ARCHITECTURE.md) · [BACKEND_SCHEMA.md](BACKEND_SCHEMA.md) · [PRD.md](PRD.md) · [MEMORY.md](MEMORY.md)
