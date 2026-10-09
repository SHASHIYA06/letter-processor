// ══════════════════════════════════════════════════════════════
//  BEML MULTI-PROJECT REGISTRY
//  One application, many metro projects — stable project IDs,
//  legacy org aliases, per-project letters sheets, and the
//  server-side isolation helpers used by every data route.
//
//  Scopes ("tenant keys"):
//    KMRCL | BMRCL | DMRC | MMRCL | CMRL  → metro projects
//    BEML                                 → internal BEML org scope
//    (global_admin role sees ALL scopes)
// ══════════════════════════════════════════════════════════════

export const PROJECTS = [
  {
    id: 'KMRCL',
    code: 'KMRCL',
    name: 'Kolkata Metro — KMRCL RS(3R)',
    customer: 'Kolkata Metro Rail Corporation Limited',
    customerShort: 'KMRCL',
    city: 'Kolkata',
    state: 'West Bengal',
    color: '#3B82F6',
    lettersSheet: 'KMRCL Letters',
    org: 'KMRCL',                       // legacy "organization" value used by letter forms
    depotCodes: ['KMRCL'],              // legacy Depot column spellings that belong here
    aliases: ['KMRCL', 'Kolkata Metro', 'KMRCL RS-3R', 'KMRCL RS(3R)', 'East-West'],
    refPattern: 'KMRCL/LTR/{YEAR}/{NUM}',   // preserves existing legacy numbering
    ncrPattern: 'NCR-{YEAR}-{NUM}',           // existing NCR-2026-001 convention continues
    jnPattern: 'JN-{YEAR}-{NUM}',
    status: 'active',
    reference: true                     // reference implementation (existing data)
  },
  {
    id: 'BMRCL',
    code: 'BMRCL',
    name: 'Bengaluru Metro — BMRCL',
    customer: 'Bangalore Metro Rail Corporation Limited',
    customerShort: 'BMRCL',
    city: 'Bengaluru',
    state: 'Karnataka',
    color: '#8B5CF6',
    lettersSheet: 'BMRCL Letters',
    org: 'BMRCL',
    depotCodes: ['BMRCL'],
    aliases: ['BMRCL', 'Bangalore Metro', 'Bengaluru Metro', 'Namma Metro'],
    refPattern: 'BMRCL/LTR/{YEAR}/{NUM}',
    ncrPattern: 'NCR-BMRCL-{YEAR}-{NUM}',
    jnPattern: 'JN-BMRCL-{YEAR}-{NUM}',
    status: 'active'
  },
  {
    id: 'DMRC',
    code: 'DMRC',
    name: 'Delhi Metro — DMRC',
    customer: 'Delhi Metro Rail Corporation Limited',
    customerShort: 'DMRC',
    city: 'New Delhi',
    state: 'Delhi',
    color: '#10B981',
    lettersSheet: 'DMCRL Letters',      // legacy sheet name preserved (existing data)
    org: 'DMCRL',                       // legacy org/depot spelling in existing rows
    depotCodes: ['DMCRL', 'DMRC'],
    aliases: ['DMRC', 'DMCRL', 'Delhi Metro'],
    refPattern: 'DMRC/LTR/{YEAR}/{NUM}',
    ncrPattern: 'NCR-DMRC-{YEAR}-{NUM}',
    jnPattern: 'JN-DMRC-{YEAR}-{NUM}',
    status: 'active'
  },
  {
    id: 'MMRCL',
    code: 'MMRCL',
    name: 'Mumbai Metro — MMRCL',
    customer: 'Mumbai Metro Rail Corporation Limited',
    customerShort: 'MMRCL',
    city: 'Mumbai',
    state: 'Maharashtra',
    color: '#06B6D4',
    lettersSheet: 'MMRCL Letters',
    org: 'MMRCL',
    depotCodes: ['MMRCL'],
    aliases: ['MMRCL', 'Mumbai Metro', 'Line 3', 'Aqua Line'],
    refPattern: 'MMRCL/LTR/{YEAR}/{NUM}',
    ncrPattern: 'NCR-MMRCL-{YEAR}-{NUM}',
    jnPattern: 'JN-MMRCL-{YEAR}-{NUM}',
    status: 'active'
  },
  {
    id: 'CMRL',
    code: 'CMRL',
    name: 'Chennai Metro — CMRL',
    customer: 'Chennai Metro Rail Limited',
    customerShort: 'CMRL',
    city: 'Chennai',
    state: 'Tamil Nadu',
    color: '#EF4444',
    lettersSheet: 'CMRCL Letters',      // legacy sheet name preserved
    org: 'CMRCL',
    depotCodes: ['CMRCL', 'CMRL'],
    aliases: ['CMRL', 'CMRCL', 'Chennai Metro'],
    refPattern: 'CMRL/LTR/{YEAR}/{NUM}',
    ncrPattern: 'NCR-CMRL-{YEAR}-{NUM}',
    jnPattern: 'JN-CMRL-{YEAR}-{NUM}',
    status: 'active'
  }
];

// Internal BEML org scope (corporate HQ letters). Not a customer metro project.
export const BEML_SCOPE = {
  id: 'BEML',
  code: 'BEML',
  name: 'BEML Limited — Internal',
  customer: 'BEML Limited',
  customerShort: 'BEML',
  city: 'Bengaluru',
  color: '#F59E0B',
  lettersSheet: 'BEML Letters',
  org: 'BEML',
  depotCodes: ['BEML'],
  aliases: ['BEML', 'BEML Limited'],
  refPattern: 'BEML/LTR/{YEAR}/{NUM}',
  ncrPattern: 'NCR-BEML-{YEAR}-{NUM}',
  jnPattern: 'JN-BEML-{YEAR}-{NUM}',
  status: 'active',
  internal: true
};

// Legacy sheet that predates project scoping — global admins only.
export const LEGACY_SHEETS = ['Metro Rail Letters'];

export const SHARED_SHEETS = ['NCR Records', 'Joint Notes'];

const ALL_SCOPES = [...PROJECTS, BEML_SCOPE];

export function getProject(id) {
  if (!id) return null;
  const key = String(id).trim().toUpperCase();
  return ALL_SCOPES.find(p => p.id === key || p.code === key) || null;
}

export function isProjectScope(id) {
  const p = getProject(id);
  return !!p && !p.internal;
}

// Legacy organization / depot code → canonical scope id
export function scopeFromLegacyOrg(org) {
  if (!org) return null;
  const key = String(org).trim();
  const hit = ALL_SCOPES.find(p =>
    p.org === key ||
    p.depotCodes.includes(key) ||
    p.aliases.some(a => a.toLowerCase() === key.toLowerCase())
  );
  return hit ? hit.id : null;
}

export function allScopeIds() {
  return ALL_SCOPES.map(p => p.id);
}

export function projectScopeIds() {
  return PROJECTS.map(p => p.id);
}

// ── Sheet-level authorization ─────────────────────────────────
// Returns the set of sheet names a scope may read/write.
export function allowedSheetsFor(scopeIds) {
  if (!scopeIds || scopeIds.includes('ALL')) {
    return new Set(Object.values({
      BEML: 'BEML Letters', KMRCL: 'KMRCL Letters', BMRCL: 'BMRCL Letters',
      DMCRL: 'DMCRL Letters', MMRCL: 'MMRCL Letters', CMRCL: 'CMRCL Letters',
      NCR: 'NCR Records', JN: 'Joint Notes', METRO: 'Metro Rail Letters'
    }));
  }
  const out = new Set([...SHARED_SHEETS]);
  for (const id of scopeIds) {
    const p = getProject(id);
    if (p) out.add(p.lettersSheet);
  }
  return out;
}

// Resolve + validate a requested sheet name for a scope. Returns { ok, sheet, error }.
export function checkSheetAccess(scopeIds, sheetName) {
  const allowed = allowedSheetsFor(scopeIds);
  if (allowed.has(sheetName)) return { ok: true, sheet: sheetName };
  return {
    ok: false,
    sheet: sheetName,
    error: `Access denied: sheet "${sheetName}" is not part of your authorized project(s).`
  };
}

// ── Row-level authorization for shared sheets ─────────────────
// Explicit "Project ID" column wins; legacy rows fall back to
// alias inference; rows with no signal are admin-only.

function rowText(row) {
  return (row || []).map(c => String(c || '')).join(' | ');
}

function matchesAlias(text, aliases) {
  if (!text) return false;
  return aliases.some(a => {
    const re = new RegExp(`(^|[^A-Za-z0-9])${a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^A-Za-z0-9]|$)`, 'i');
    return re.test(text);
  });
}

// projectIdOf: canonical scope id owning a shared-sheet row, or null (admin-only).
export function projectIdOfRow(sheetName, header, row, explicitProjectId) {
  if (explicitProjectId) {
    const p = getProject(explicitProjectId);
    if (p) return p.id;
    const legacy = scopeFromLegacyOrg(explicitProjectId);
    if (legacy) return legacy;
  }
  if (!SHARED_SHEETS.includes(sheetName)) {
    // Letters sheets are per-scope by construction
    return scopeFromLegacyOrg(sheetName.replace(/\s+Letters$/i, ''));
  }
  const text = rowText(row);
  // Prefer the dedicated "Project" column when present
  if (header) {
    const idx = header.findIndex(h => /^project$/i.test(String(h || '')));
    if (idx >= 0 && row[idx]) {
      const fromCol = scopeFromLegacyOrg(row[idx]) ||
        (matchesAlias(row[idx], ['KMRCL', 'Kolkata']) ? 'KMRCL'
          : matchesAlias(row[idx], ['BMRCL', 'Bangalore', 'Bengaluru']) ? 'BMRCL'
          : matchesAlias(row[idx], ['DMRC', 'DMCRL', 'Delhi']) ? 'DMRC'
          : matchesAlias(row[idx], ['MMRCL', 'Mumbai']) ? 'MMRCL'
          : matchesAlias(row[idx], ['CMRL', 'CMRCL', 'Chennai']) ? 'CMRL'
          : matchesAlias(row[idx], ['BEML']) ? 'BEML' : null);
      if (fromCol) return fromCol;
    }
  }
  for (const p of ALL_SCOPES) {
    if (matchesAlias(text, p.aliases) || p.depotCodes.some(d => text.includes(d))) return p.id;
  }
  return null;
}

export function rowVisibleTo(sheetName, header, row, scopeIds) {
  if (!scopeIds || scopeIds.includes('ALL')) return true;
  if (!SHARED_SHEETS.includes(sheetName)) return allowedSheetsFor(scopeIds).has(sheetName);
  const owner = projectIdOfRow(sheetName, header, row, null);
  if (!owner) return false;              // unmapped legacy row → admin-only
  return scopeIds.includes(owner);
}

// Stamp the canonical project id for new writes
export function stampProjectId(scopeIds, data = {}) {
  const primary = scopeIds && !scopeIds.includes('ALL') ? scopeIds[0] : (data.projectId || null);
  if (primary) data.projectId = primary;
  return data;
}
