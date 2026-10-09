# UI/UX Design Brief

- **Version:** 1.0
- **Status:** Active — the current UI is **approved**; changes require explicit justification
- **Date:** 2026-10-09

## 1. Design mandate

Preserve the approved visual design of the existing application. The pre-login
animated portal was reviewed and accepted ("UI/UX … looks good"). Enhancements must
be additive: new surfaces (project switcher, admin panel, graph view) inherit the
existing design tokens rather than introducing a second visual language.

## 2. Design tokens (from `public/portal.css` + existing app styles)

| Token | Value family | Usage |
|---|---|---|
| `--bg` deep space navy | `#050810`-range | Portal background, globe stage |
| Accent blue | `#3B82F6` | Primary actions, KMRCL brand marker |
| Accent amber | `#F59E0B` | BEML HQ highlight, warnings |
| Per-project accent | KMRCL `#3B82F6`, BMRCL `#8B5CF6`, DMCRL `#10B981`, MMRCL `#06B6D4`, CMRCL `#EF4444` | Location cards, project switcher chips |
| Surface | translucent white/8–12% over navy | Cards, auth drawer |
| Type | system UI sans (workspace), monospace for ref numbers | Letters, IDs |
| Radius | 12–16 px cards, 10 px inputs | Portal + drawer |

Project colors come from `locations.js` (`color` field) — single source of truth;
UI must not hard-code project colors elsewhere.

## 3. Portal (approved, implemented)

Three-stage cinematic flow, all client-side animated:

1. **Globe stage** — canvas-rendered rotating globe (~15k point samples), BEML wordmark,
   auto-advance countdown ring (10 s). Must stay ≥ 55 fps on mid-range laptops.
2. **India map stage** — SVG outline with pulsing markers for each BEML metro location;
   marker color = project accent; card list with site, city, role, trainset count.
3. **Auth drawer** — slides from right over the map; context header shows selected
   location; tabs for Sign in / Register; password strength meter; auto-suggested
   staff username (`<prefix>-000N`).

Rules:
- Stage transitions are one-way with a visible back affordance; auto-advance pauses
  on user interaction.
- Reduced-motion preference disables parallax/countdown animation (backlog: verify — see §6).
- Portal is pure static assets (`portal.js`, `portal.css`) — no framework runtime.

## 4. Workspace (approved, implemented)

- Tab-based navigation (Letters, NCR, Joint Notes, Records, Import/Export).
- Header: project/organization context + user badge + logout.
- Forms mirror official document fields 1:1 so preview ≈ print output.
- AI actions are visually marked as **draft** (chip/badge) until approved by a human.
- Tables: sticky header, monospace reference numbers, status pills.

## 5. New surfaces (design specs, implementation pending)

### 5.1 Project switcher
- Header chip showing active project code + accent color; dropdown lists only
  JWT-authorized projects; admin sees all + "All projects" aggregate view.
- Switching reloads records/dashboard/templates for the new scope and updates the
  `x-project-id` header; no full page reload.

### 5.2 Admin panel
- Sections: Users (role/status/reset), Templates (upload → draft → approve), Project
  config, Audit log. Follows workspace table + drawer patterns; destructive actions
  use confirm-dialog + red outline.

### 5.3 Correspondence graph
- Obsidian-style: force-directed graph (left) + document detail (right); edge styles:
  solid = reply chain, dashed = NCR/joint-note reference; direction arrows
  incoming/outgoing; project filter chips; click node → open document; breadcrumb tree
  view toggle (timeline ⇄ tree).

## 6. Accessibility & responsiveness

- WCAG AA contrast on text; focus rings on all interactive elements.
- Portal degrades gracefully below 768 px: cards stack, drawer becomes full-screen sheet.
- ⏳ Verify: prefers-reduced-motion handling, keyboard nav through portal stages (TASKS T-08).

## 7. Change control

Any modification to approved surfaces requires: before/after note in CHANGELOG (pending),
preservation of existing layout unless the change fixes a defect, and user review.

## 8. Related documents

[APP_FLOW.md](APP_FLOW.md) · [DESIGN.md](DESIGN.md) · [PRD.md](PRD.md)
