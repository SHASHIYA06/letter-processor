# IMPLEMENTATION_PLAN — Phased Delivery

- **Version:** 1.0
- **Status:** Active — real status per phase as of commit `2970623`
- **Date:** 2026-10-09

Status legend: ✅ done · 🟡 in progress · ⬜ not started

## Phase 1 — Audit and baseline ✅

- Repository inventory: Express monolith, Sheets data layer, Gemini AI, Vercel deploy,
  PDF/DOCX generators, OCR, import/export — all catalogued (ARCHITECTURE.md, BACKEND_SCHEMA.md).
- Baseline behavior recorded before changes; existing KMRCL records preserved.
- Findings: no tests, no docs, write-route guards missing, Delhi code ambiguity.

## Phase 2 — Documentation & architecture ✅ (initial suite)

- `application-documents/` created: INDEX, PRD, TRD, APP_FLOW, UI_UX_DESIGN_BRIEF,
  BACKEND_SCHEMA, IMPLEMENTATION_PLAN, ARCHITECTURE, DESIGN, MEMORY, RULES, TASKS.
- ⬜ Remaining docs from master spec: DATABASE_SCHEMA, SECURITY, AI/RAG/AGENT/MCP
  ARCHITECTURE, TEMPLATE_ENGINE, INTEGRATIONS, DEPLOYMENT, TEST_PLAN, RUNBOOK,
  GLOSSARY, ACCEPTANCE_CRITERIA, CHANGELOG — created as subsystems stabilize (T-10).

## Phase 3 — Multi-project data model ✅ (core)

- `projects.js`: registry (KMRCL, BMRCL, DMCRL, MMRCL, CMRL), customer config,
  numbering patterns, sheet mapping, `stampProjectId`.
- `project-store.js`: config, sequences, template versions, links, audit — JSON-backed.
- User schema migrated to project-aware fields (boot migration verified).
- ⬜ Relational-grade constraints/indexes N/A for current stores (documented in DESIGN).

## Phase 4 — Authentication & permissions 🟡

- ✅ Bootstrap admin via `ADMIN_BOOTSTRAP_PASSCODE`, roles, JWT membership claims,
  change-password, switch-project, admin users API, audit log, login rate limiting
  + lockout.
- ✅ Read-route enforcement (`requireScopes`, `guardSheet`) on records/search/export/links.
- 🟡 Write-route enforcement: helpers exist (`guardRow`, `stampProjectId`) but are not
  wired into save/update/delete/clear/import/document-create routes — **T-01 (P0)**.

## Phase 5 — Templates & project onboarding 🟡

- ✅ Upload samples → immutable storage → text extraction → draft version →
  admin approve/reject; template types validated; KMRCL approved formats untouched.
- ⬜ AI layout/field extraction proposing structured template config (FR-23).
- ⬜ Template-onboarding **UI** (admin panel).
- ⬜ Sample regeneration + visual regression against originals.

## Phase 6 — Document workflow & graph 🟡

- ✅ Letters/Replies/NCR/Joint Notes: create, numbering, PDF/DOCX, AI drafts.
- ✅ Links + graph API with project scoping.
- ⬜ Graph/tree UI, backlinks panel, timeline.
- ⬜ Full NCR evidence repository (attachment metadata per NCR) — partial (Drive uploads exist).

## Phase 7 — AI & RAG ⬜

- ✅ Baseline preserved: Gemini (default) + OpenAI fallback behind `callAI`.
- ⬜ Project-scoped RAG ingestion/retrieval with permission filtering.
- ⬜ Explicit multi-step workflow orchestration (adopt LangGraph only if justified — RULES R-9).
- ⬜ Evidence citations + "unsupported facts flagged" checks in reply drafts.

## Phase 8 — Synchronization & analytics 🟡

- ✅ Live reads from Sheets; per-project dashboards read real data.
- ⬜ Sync engine (last-synced, retry, idempotency, conflict UI).
- ⬜ Cross-project analytics view for global admins; metric definitions doc.

## Phase 9 — Export & document fidelity ⬜

- ✅ PDF/DOCX generation from saved data (existing, preserved).
- ⬜ Per-project template-driven rendering for non-KMRCL formats.
- ⬜ Visual regression tests rendering outputs vs reference samples.

## Phase 10 — Testing & deployment 🟡

- ✅ Manual API acceptance (auth, registration, portal flow) executed earlier.
- ⬜ Automated test suite (unit/integration/security/E2E via Playwright) — T-06 (P1).
- ✅ Vercel deployment path preserved; ⬜ documented rollback drill.

## Dependency-ordered next steps

1. T-01 write-route guards (blocks all security sign-off)
2. T-02 frontend project switcher + auth scoping in UI
3. T-03 admin panel (users, templates, audit)
4. T-04 graph/tree UI
5. T-06 acceptance test suite
6. T-07 template AI extraction
7. T-10 remaining docs

## Related documents

[TASKS.md](TASKS.md) · [ARCHITECTURE.md](ARCHITECTURE.md) · [PRD.md](PRD.md)
