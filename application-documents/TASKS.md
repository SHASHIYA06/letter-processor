# TASKS — Implementation Backlog

- **Version:** 1.0 (living)
- **Last updated:** 2026-10-09
- **Priority:** P0 = security/correctness · P1 = core value · P2 = enhancement · P3 = advanced

| ID | Task | Pri | Depends on | Acceptance criteria | Status |
|---|---|---|---|---|---|
| T-01 | Wire write-route guards: `guardRow` + `stampProjectId` into `/api/save`, `/api/save-reply`, `/api/auto-save`, `/api/update`, `/api/delete`, `/api/clear/:sheetName`, `/api/import/*`, `/api/letter/create`, `/api/ncr/create|update`, `/api/joint-note/create` + audit events | P0 | — | KMRCL user writing to BMRCL sheet/row → 403 + audit event; admin writes all; existing KMRCL save flow still works (API test) | 🟡 helpers ready, not wired |
| T-02 | Frontend project switcher: authorized-project chip/dropdown, `x-project-id` propagation, dashboard reload on switch | P1 | Phase 4 | Switching reloads scoped data; unauthorized project not listed; UI matches design tokens | ⬜ |
| T-03 | Admin panel UI: users (role/status/reset), audit log view, project config editor | P1 | T-02 | Admin can perform all `/api/admin/*` ops from UI; user sees 403 pages | ⬜ |
| T-04 | Template onboarding UI: upload samples per project/type, draft review, approve/reject | P1 | T-03 | Full FR flow through UI; KMRCL approved template untouched by other-project onboarding | ⬜ API ready |
| T-05 | Correspondence graph/tree UI (Obsidian-style): nodes, edges, backlinks, timeline | P2 | links API (done) | Navigate customer letter → reply → NCR chain visually; project-filtered | ⬜ API ready |
| T-06 | Automated test suite: unit (stores, numbering, scope helpers) + API integration + Playwright E2E | P1 | T-01 | 25 master acceptance scenarios executed with real results; CI-runnable | ⬜ |
| T-07 | AI template extraction: uploaded samples → proposed field/layout config → admin review | P2 | T-04 | Extraction never auto-approves; admin can correct mapping; sample regeneration works | ⬜ |
| T-08 | Accessibility pass: prefers-reduced-motion, keyboard portal nav, focus rings | P2 | — | Verified in browser | ⬜ |
| T-09 | Session expiry (JWT TTL + refresh), token revocation on password change | P1 | — | Expired token → 401 → portal; password change invalidates old token | ⬜ |
| T-10 | Remaining docs: DATABASE_SCHEMA, SECURITY, AI/RAG/AGENT/MCP ARCHITECTURE, TEMPLATE_ENGINE, INTEGRATIONS, DEPLOYMENT, TEST_PLAN, RUNBOOK, GLOSSARY, ACCEPTANCE_CRITERIA, CHANGELOG, MRD | P2 | subsystems stable | Doc-vs-code comparison performed per doc | ⬜ |
| T-11 | Verify/standardize Delhi project code (DMRC vs DMCRL) across registry, docs, seeds | P1 | — | One verified code everywhere; migration note if renamed | ⬜ open issue |
| T-12 | Sync engine: last-synced timestamps, retry/backoff, idempotent imports, conflict UI | P2 | T-01 | Re-running an import creates no duplicates; sync status visible | ⬜ |
| T-13 | RAG pipeline (project-scoped): chunk → embed → index → permission-filtered retrieval → cited answers | P3 | T-06 | Cross-project retrieval blocked by test; citations shown | ⬜ proposed |
| T-14 | Visual regression: render generated letter/NCR → image → compare vs reference samples | P2 | T-07 | Deviation report per template | ⬜ |
| T-15 | JSON store durability decision for Vercel (Sheets-backed tables or hosted DB) | P1 | — | No data loss across serverless instances | ⬜ open risk |
| T-16 | Google credential rotation if repo history contains keys | P1 | — | Old keys revoked; new keys only in env settings | ⬜ advisory |
| T-17 | NCR evidence repository: structured attachments per NCR (report/photo/closure), persistent IDs | P2 | T-01 | Attachments survive revisions; searchable | 🟡 Drive uploads exist, not NCR-linked | 
| T-18 | Cross-project analytics for global admins + metric definitions | P2 | T-02 | Metrics computed from real data, documented definitions | ⬜ |

## Definition of done (any task)

1. Code + guards per RULES.
2. Verification run (syntax, boot, API test) with real output.
3. Affected docs updated in same change.
4. Committed only when asked; only intended files staged.

## Related documents

[IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) · [RULES.md](RULES.md) · [MEMORY.md](MEMORY.md)
