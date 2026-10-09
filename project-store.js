// ══════════════════════════════════════════════════════════════
//  PROJECT STORE
//  Durable per-project data on the existing storage stack:
//    data/project-config.json   → customer/contract/numbering config
//    data/templates.json        → template versions + approval state
//    data/sequences.json        → per-project document numbering
//    data/links.json            → correspondence relationship edges
//    data/audit.log             → append-only JSONL audit trail
//  On Vercel (ephemeral FS) the critical sets are mirrored to
//  Google Sheets where available; local disk remains source of
//  truth in self-hosted deployments, mirroring the existing
//  user-store pattern.
// ══════════════════════════════════════════════════════════════

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export const TEMPLATE_TYPES = ['letter', 'reply', 'ncr', 'joint_note', 'minutes', 'technical_note', 'report', 'incoming', 'internal'];

function readJson(file, fallback) {
  try {
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    console.log('⚠️  project-store read failed:', file, err.message);
  }
  return fallback;
}

function writeJson(file, value) {
  try {
    const dir = path.dirname(file);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const tmp = file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(value, null, 2));
    fs.renameSync(tmp, file);
    return true;
  } catch (err) {
    console.log('⚠️  project-store write failed:', file, err.message);
    return false;
  }
}

export function createProjectStore(dataDir) {
  const files = {
    config: path.join(dataDir, 'project-config.json'),
    templates: path.join(dataDir, 'templates.json'),
    sequences: path.join(dataDir, 'sequences.json'),
    links: path.join(dataDir, 'links.json'),
    audit: path.join(dataDir, 'audit.log')
  };

  let config = readJson(files.config, { version: 1, projects: {} });
  let templates = readJson(files.templates, { version: 1, projects: {} });
  let sequences = readJson(files.sequences, { version: 1, projects: {} });
  let links = readJson(files.links, { version: 1, links: [] });

  // ── Project configuration ──────────────────────────────────
  function getConfig(projectId, defaults = {}) {
    return { ...defaults, ...(config.projects[projectId] || {}) };
  }

  function updateConfig(projectId, patch) {
    config.projects[projectId] = { ...(config.projects[projectId] || {}), ...patch, updatedAt: new Date().toISOString() };
    writeJson(files.config, config);
    return config.projects[projectId];
  }

  // ── Templates: versions + approval workflow ────────────────
  function getTemplateState(projectId, type) {
    const p = templates.projects[projectId] = templates.projects[projectId] || {};
    const t = p[type] = p[type] || { activeVersion: null, versions: [] };
    return t;
  }

  function listTemplates(projectId) {
    return templates.projects[projectId] || {};
  }

  function getActiveTemplate(projectId, type) {
    const t = (templates.projects[projectId] || {})[type];
    if (!t || !t.activeVersion) return null;
    return t.versions.find(v => v.version === t.activeVersion) || null;
  }

  function addTemplateVersion(projectId, type, { config: tplConfig, createdBy, sourceSamples = [], extractedText = '', proposal = null }) {
    const t = getTemplateState(projectId, type);
    const version = (t.versions.length ? Math.max(...t.versions.map(v => v.version)) : 0) + 1;
    const record = {
      version,
      status: 'draft',                    // draft → pending → approved | rejected
      config: tplConfig || {},
      sourceSamples,                      // immutable references to uploaded originals
      extractedText: String(extractedText || '').slice(0, 20000),
      proposal,
      createdBy: createdBy || 'unknown',
      createdAt: new Date().toISOString(),
      reviewedBy: null,
      reviewedAt: null,
      reviewNotes: null
    };
    t.versions.push(record);
    writeJson(files.templates, templates);
    return record;
  }

  function setTemplateStatus(projectId, type, version, status) {
    const t = getTemplateState(projectId, type);
    const rec = t.versions.find(v => v.version === Number(version));
    if (!rec) return null;
    rec.status = status;
    writeJson(files.templates, templates);
    return rec;
  }

  function reviewTemplateVersion(projectId, type, version, { approve, reviewer, notes }) {
    const t = getTemplateState(projectId, type);
    const rec = t.versions.find(v => v.version === Number(version));
    if (!rec) return { error: 'Template version not found' };
    if (rec.status === 'approved') return { error: 'Already approved' };
    rec.status = approve ? 'approved' : 'rejected';
    rec.reviewedBy = reviewer || 'unknown';
    rec.reviewedAt = new Date().toISOString();
    rec.reviewNotes = notes || null;
    if (approve) t.activeVersion = rec.version;
    else if (t.activeVersion === rec.version) t.activeVersion = null;
    writeJson(files.templates, templates);
    return { record: rec, activeVersion: t.activeVersion };
  }

  // ── Numbering sequences (project-scoped) ───────────────────
  function nextSequence(projectId, kind) {
    const year = new Date().getFullYear();
    sequences.projects[projectId] = sequences.projects[projectId] || {};
    const slot = sequences.projects[projectId][kind] = sequences.projects[projectId][kind] || { year, counter: 0 };
    if (slot.year !== year) { slot.year = year; slot.counter = 0; }
    slot.counter += 1;
    writeJson(files.sequences, sequences);
    return slot.counter;
  }

  function peekSequence(projectId, kind) {
    const year = new Date().getFullYear();
    const slot = (sequences.projects[projectId] || {})[kind];
    if (!slot || slot.year !== year) return 0;
    return slot.counter;
  }

  // ── Correspondence links (graph edges) ─────────────────────
  function addLink({ project, from, to, type, createdBy }) {
    if (!project || !from || !to) return { error: 'project, from and to are required' };
    const edge = {
      id: crypto.randomUUID(),
      project,
      from: normalizeEndpoint(from),
      to: normalizeEndpoint(to),
      type: String(type || 'reference').toLowerCase(),
      createdBy: createdBy || 'unknown',
      createdAt: new Date().toISOString()
    };
    const dup = links.links.find(l =>
      l.project === edge.project &&
      sameEndpoint(l.from, edge.from) && sameEndpoint(l.to, edge.to) && l.type === edge.type);
    if (dup) return { link: dup, duplicate: true };   // idempotent writes
    links.links.push(edge);
    writeJson(files.links, links);
    return { link: edge };
  }

  function listLinks(project, endpoint) {
    return links.links.filter(l => {
      if (project && l.project !== project) return false;
      if (endpoint) {
        const ep = normalizeEndpoint(endpoint);
        return sameEndpoint(l.from, ep) || sameEndpoint(l.to, ep);
      }
      return true;
    });
  }

  function removeLink(id, project) {
    const idx = links.links.findIndex(l => l.id === id && (!project || l.project === project));
    if (idx === -1) return false;
    links.links.splice(idx, 1);
    writeJson(files.links, links);
    return true;
  }

  // ── Audit log (append-only JSONL) ──────────────────────────
  function audit(entry) {
    try {
      if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
      const line = JSON.stringify({ ts: new Date().toISOString(), ...entry }) + '\n';
      fs.appendFileSync(files.audit, line);
      // rotate past 5 MB so the file never grows unbounded
      const st = fs.statSync(files.audit);
      if (st.size > 5 * 1024 * 1024) {
        fs.renameSync(files.audit, files.audit + '.1');
      }
      return true;
    } catch (err) {
      console.log('⚠️  audit write failed:', err.message);
      return false;
    }
  }

  function tailAudit(limit = 100) {
    try {
      if (!fs.existsSync(files.audit)) return [];
      const raw = fs.readFileSync(files.audit, 'utf8').trim().split('\n').filter(Boolean);
      return raw.slice(-Number(limit)).reverse().map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
    } catch { return []; }
  }

  return {
    files, getConfig, updateConfig,
    listTemplates, getActiveTemplate, addTemplateVersion, reviewTemplateVersion, setTemplateStatus,
    nextSequence, peekSequence,
    addLink, listLinks, removeLink,
    audit, tailAudit
  };
}

function normalizeEndpoint(ep) {
  const { sheet, row, ref, docId } = ep || {};
  return {
    sheet: sheet ? String(sheet) : null,
    row: row === undefined || row === null ? null : Number(row),
    ref: ref ? String(ref) : null,
    docId: docId ? String(docId) : null
  };
}

function sameEndpoint(a, b) {
  if (!a || !b) return false;
  if (a.docId && b.docId) return a.docId === b.docId;
  if (a.sheet && b.sheet && a.row !== null && b.row !== null) return a.sheet === b.sheet && a.row === b.row;
  if (a.ref && b.ref) return a.ref.toLowerCase() === b.ref.toLowerCase();
  return false;
}
