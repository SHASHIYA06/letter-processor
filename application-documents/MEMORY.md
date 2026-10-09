# MEMORY — Durable Project Context

- **Version:** 1.0 (living document — keep concise and current)
- **Last updated:** 2026-10-09 · commit `2970623` (main)

## What this application is

BEML Metro Document Management & Correspondence Intelligence Platform. Started as a
Kolkata (KMRCL) letter processor; now mid-upgrade to a **multi-project** platform
(KMRCL, BMRCL, DMCRL, MMRCL, CMRL) in one deployment. Express + static SPA, Google
Sheets as record store, Drive for files, Gemini AI for drafts, deployed on Vercel.

## Hard decisions (do not re-litigate casually)

1. **UI is approved.** Portal (globe → India map → location cards → auth drawer) and
   workspace styling were reviewed and accepted. Additive changes only.
2. **Gemini integration is preserved.** `callAI()` defaults to Gemini
   (`gemini-2.0-flash`), OpenAI-compatible fallback. Don't swap providers.
3. **Sheets stays the record of truth this phase** (ADR-2). Per-project letter tabs +
   shared NCR/Joint-Note tabs with `Project ID` column + row-level visibility.
4. **Server-side project isolation is the security boundary** — JWT membership claims
   resolved per request (`req.scopes`); UI selection is never authorization.
5. **Bootstrap admin passcode** lives only in `ADMIN_BOOTSTRAP_PASSCODE` env var.
   Never in code, frontend, docs, or logs. Same rule for all secrets.
6. **AI never approves templates or issues documents** — draft requires human approval.
7. **LangChain / LangGraph / Langflow / MCP / vector DBs are NOT installed** and must
   not be added to satisfy a checklist (RULES R-9). Gemini REST works today.
8. **KMRCL numbering history is preserved** — new patterns must not renumber old refs.

## Current state (verified)

**Working:** portal + location-wise register/login; JWT roles (admin/user) + membership
scopes; read-route project guards; projects API + project store + template
draft/approve API; links/graph API; letter/NCR/joint-note create + PDF/DOCX; AI draft
endpoints; import/export (CSV/JSON/Excel); OCR/text extraction; admin users API; audit
log; login rate-limit + 5-failure lockout; boot migration of legacy users to
project-aware schema; Google Sheets/Drive integration; Vercel deploy config.

**Incomplete (honest list):**
- Write-route guards: `guardRow`/`stampProjectId` exist but are **not wired** into
  save/update/delete/clear/import/document-create routes (P0 — TASKS T-01).
- No frontend for project switcher, admin panel, template onboarding, graph view.
- No automated tests; no visual regression for official templates.
- RAG, sync engine, AI template extraction: designed, not built.
- Delhi project code ambiguity: code uses `DMCRL`; official is likely `DMRC` — verify.
- `data/*.json` persistence on Vercel serverless is ephemeral risk — decide migration.

## People & process

- Repo: github.com/SHASHIYA06/letter-processor (main). Push only when asked; never
  stage `.DS_Store`, `data/`, `uploads/`, `.env`.
- Google credentials may exist in old history — rotate if repo is public.
- Reference samples: official BEML letter + NCR samples = KMRCL format authority;
  other projects must onboard their own samples (never copy Kolkata formats blindly).

## Recurring pitfalls

- Anchor mismatches when editing `server.js` (huge file) — re-grep exact strings first.
- `SHEET_NAMES[org] || "<ORG> Letters"` fallback can create unexpected tabs for unknown
  orgs — always resolve org through the project registry.
- Shared sheets need row-level checks; per-project tabs need sheet-level checks.

## Related documents

[RULES.md](RULES.md) · [TASKS.md](TASKS.md) · [ARCHITECTURE.md](ARCHITECTURE.md)
