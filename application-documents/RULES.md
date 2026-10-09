# RULES — Mandatory Engineering Rules

- **Version:** 1.0
- **Status:** Active — enforceable in review
- **Date:** 2026-10-09

## Security

- **R-1** No secrets (API keys, passcodes, passwords, tokens) in source, docs, logs,
  frontend bundles, or commits. Secrets live in environment variables only.
- **R-2** Every data route authenticates (`authenticateToken`) and enforces project
  scope **server-side** before reading or writing. New routes are denied by default.
- **R-3** Passwords are stored only as scrypt hashes with per-user salt; never logged,
  never echoed, never documented.
- **R-4** Admin-only operations require `canManageProject`/admin role + an audit event.
- **R-5** Uploads are size-capped, type-checked, and stored with sanitized filenames.
- **R-6** Login endpoints apply rate limiting and lockout; failures are audited without
  leaking whether the username exists.

## Data & projects

- **R-7** Every business record created or mutated must carry its project identifier
  (per-project tab or stamped `Project ID` on shared tabs). Write without project ⇒ bug.
- **R-8** Never hard-code a KMRCL/customer-specific value in business logic. Customer
  details, addresses, numbering, and sheet names resolve from the project registry.
- **R-9** New dependencies (LangChain, LangGraph, Langflow, vector DBs, MCP, test
  frameworks…) require: a defined problem it solves, runtime compatibility proof,
  test coverage, and lockfile update. Never install to satisfy a checklist.

## Documents & templates

- **R-10** Official documents render from an **approved** template version only.
  Missing template ⇒ actionable error. Generic substitution is forbidden.
- **R-11** AI output is always a draft: editable, marked as AI, human-approved before
  official issue. AI never approves templates, never invents refs/dates/commitments.
- **R-12** Uploaded reference samples are immutable; template versions and approval
  history are append-only.

## Code quality

- **R-13** Numbering, dates, access control, and status transitions are deterministic
  server logic — never delegated to AI.
- **R-14** Idempotency: retried imports/syncs must not duplicate records.
- **R-15** Errors surface to the caller with actionable messages; never swallow
  silently; never fabricate success or placeholder data in dashboards.

## Documentation & git

- **R-16** Update the affected `application-documents/` file in the same change as any
  architecture/schema/API/workflow change. Docs describe reality or are labelled
  Proposed.
- **R-17** Implemented vs proposed must be explicit in every document.
- **R-18** Never commit `node_modules/`, `.env`, `data/`, `uploads/`, `server-portal.log`,
  `.DS_Store`. `node_modules` is package-manager-generated, not a documentation file.
- **R-19** Stage only intended files (no `git add -A`); push only on explicit request;
  preserve lockfile consistency on dependency changes.
- **R-20** A feature is not "done" until its verification (syntax check, boot test, API
  test) has actually run and passed. Report failures as failures.

## Related documents

[MEMORY.md](MEMORY.md) · [TASKS.md](TASKS.md) · [ARCHITECTURE.md](ARCHITECTURE.md)
