// Acceptance tests for multi-project WRITE guards (TASKS T-01).
// Run: node tests/acceptance-write-guards.mjs   (server must be running on $BASE)
// Exits non-zero on any failure. Never prints secrets.

import 'dotenv/config';

const BASE = process.env.BASE || 'http://localhost:3000';
const results = [];

function check(name, pass, detail = '') {
  results.push({ name, pass: !!pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? '  [' + detail + ']' : ''}`);
}

async function api(method, path, { token, body, form } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload;
  if (form) { payload = form; }
  else if (body !== undefined) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
  const res = await fetch(BASE + path, { method, headers, body: payload });
  let json = null;
  try { json = await res.json(); } catch { /* non-JSON */ }
  return { status: res.status, json };
}

function formField(obj) {
  const fd = new FormData();
  fd.append('data', JSON.stringify(obj));
  return fd;
}

async function waitForHealth() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(BASE + '/api/health');
      if (r.ok) return true;
    } catch { /* not up yet */ }
    await new Promise(r => setTimeout(r, 500));
  }
  return false;
}

async function login(username, password) {
  const r = await api('POST', '/api/login', { body: { username, password } });
  return { ok: r.json?.success, token: r.json?.token, status: r.status, projects: r.json?.projects };
}

async function main() {
  console.log('── Multi-project WRITE-guard acceptance tests ──');
  if (!(await waitForHealth())) {
    console.error('Server not reachable at ' + BASE);
    process.exit(2);
  }

  // 1. Anonymous read is rejected
  let r = await api('GET', '/api/records');
  check('anonymous read → 401', r.status === 401, 'status=' + r.status);

  // 2. Admin login (bootstrap/legacy admin from env — values never printed)
  let adminToken = null;
  const tries = [
    [process.env.ADMIN_USERNAME, process.env.ADMIN_BOOTSTRAP_PASSCODE],
    [process.env.ADMIN_USERNAME, process.env.ADMIN_PASSWORD],
  ].filter(([u, p]) => u && p);
  for (const [u, p] of tries) {
    const out = await login(String(u).trim().toLowerCase(), p);
    if (out.ok && out.token) { adminToken = out.token; break; }
  }
  check('admin login → token', !!adminToken, adminToken ? '' : 'no admin credential worked');

  // 3. Register a KMRCL-scoped test user (fresh identity each run)
  const stamp = Date.now().toString(36);
  const regBody = {
    locationId: 'kmrcl-kolkata',
    name: 'Write Guard Tester',
    email: `itest-${stamp}@example.com`,
    phone: '9000000000',
    username: `itest-${stamp}`,
    password: 'TestPass!123',
    confirmPassword: 'TestPass!123',
  };
  r = await api('POST', '/api/auth/register', { body: regBody });
  let userToken = r.json?.token;
  if (!userToken) {
    // Fall back to login if registration was rejected for a known reason
    const out = await login(regBody.username, regBody.password);
    userToken = out.token;
  }
  check('register KMRCL user → token', !!userToken, 'status=' + r.status);
  if (!userToken) return finish();

  const U = userToken;

  // 4. Cross-project writes must be denied
  r = await api('POST', '/api/save', { token: U, form: formFor({ organization: 'BMRCL', docType: 'letter', refNumber: 'X', subject: 'should be blocked' }) });
  check('scoped user save to BMRCL → 403', r.status === 403, 'status=' + r.status);

  r = await api('POST', '/api/letter/create', { token: U, body: { organization: 'BMRCL', refNumber: 'X' } });
  check('scoped user letter/create BMRCL → 403', r.status === 403, 'status=' + r.status);

  r = await api('POST', '/api/letter/create', { token: U, body: { organization: 'Nagpur Metro', refNumber: 'X' } });
  check('unknown project sheet denied → 403', r.status === 403, 'status=' + r.status);

  r = await api('PUT', '/api/update', { token: U, body: { sheetName: 'BMRCL Letters', rowIndex: 1, field: 'Status', value: 'HACK' } });
  check('scoped user update BMRCL row → 403', r.status === 403, 'status=' + r.status);

  r = await api('DELETE', '/api/delete', { token: U, body: { sheetName: 'BMRCL Letters', rowIndex: 1 } });
  check('scoped user delete BMRCL row → 403', r.status === 403, 'status=' + r.status);

  r = await api('DELETE', '/api/clear/' + encodeURIComponent('BMRCL Letters'), { token: U });
  check('non-admin clear sheet → 403', r.status === 403, 'status=' + r.status);

  r = await api('GET', '/api/records/' + encodeURIComponent('BMRCL Letters'), { token: U });
  check('scoped user READ BMRCL (regression) → 403', r.status === 403, 'status=' + r.status);

  // 5. Positive: scoped user writes into OWN project sheet
  const testRef = 'ITEST/REF/' + stamp.toUpperCase();
  r = await api('POST', '/api/letter/create', {
    token: U,
    body: { organization: 'KMRCL', refNumber: testRef, subject: 'WRITE GUARD ACCEPTANCE ROW', status: 'Open' },
  });
  const sno = r.json?.sheet?.sno;
  check('scoped user letter/create KMRCL → 200', r.json?.success === true, 'status=' + r.status + ' sno=' + sno);

  r = await api('GET', '/api/records/' + encodeURIComponent('KMRCL Letters'), { token: U });
  const sawOwn = JSON.stringify(r.json || {}).includes(testRef);
  check('own record visible in KMRCL records', r.status === 200 && sawOwn, 'status=' + r.status);

  // 6. Positive: shared sheet write (NCR) + row visibility + cleanup
  const testNcr = 'ITEST-NCR-' + stamp.toUpperCase();
  r = await api('POST', '/api/ncr/create', { token: U, body: { ncrNo: testNcr, status: 'Open', project: 'KMRCL RS-3R' } });
  check('scoped user ncr/create (shared sheet) → 200', r.json?.success === true, 'status=' + r.status);

  r = await api('GET', '/api/records/' + encodeURIComponent('NCR Records'), { token: U });
  const sawNcr = JSON.stringify(r.json || {}).includes(testNcr);
  check('scoped user sees own NCR row', r.status === 200 && sawNcr, 'status=' + r.status);

  // 7. Admin cross-project READ allowed
  if (adminToken) {
    r = await api('GET', '/api/records/' + encodeURIComponent('BMRCL Letters'), { token: adminToken });
    check('admin reads BMRCL → 200', r.status === 200, 'status=' + r.status);

    r = await api('GET', '/api/admin/audit', { token: adminToken });
    const audit = JSON.stringify(r.json || {});
    const hasCreated = audit.includes('document.created');
    const hasDenied = audit.includes('access.denied') || audit.includes('403');
    check('audit log contains document.created', r.status === 200 && hasCreated, 'status=' + r.status);
    check('audit log contains denial events', r.status === 200 && hasDenied, 'status=' + r.status);

    // 8. Cleanup: admin deletes the test letter row (positive guardRow for admin)
    const rows = extractRows(r = await api('GET', '/api/records/' + encodeURIComponent('KMRCL Letters'), { token: adminToken }));
    const idx = rows.findIndex(row => JSON.stringify(row).includes(testRef));
    if (idx >= 0) {
      const del = await api('DELETE', '/api/delete', { token: adminToken, body: { sheetName: 'KMRCL Letters', rowIndex: idx } });
      check('admin deletes test row (row guard passes)', del.json?.success === true, 'status=' + del.status);
    } else {
      note2('test letter row not locatable in records (cache?) — left in sheet: ' + testRef);
      check('cleanup of test letter row', false, 'row not found');
    }

    // 8b. Cleanup NCR test row
    const ncrRows = extractRows(await api('GET', '/api/records/' + encodeURIComponent('NCR Records'), { token: adminToken }));
    const nidx = ncrRows.findIndex(row => JSON.stringify(row).includes(testNcr));
    if (nidx >= 0) {
      const del = await api('DELETE', '/api/delete', { token: adminToken, body: { sheetName: 'NCR Records', rowIndex: nidx } });
      check('admin deletes test NCR row', del.json?.success === true, 'status=' + del.status);
    } else {
      note2('test NCR row not locatable — left in sheet: ' + testNcr);
      check('cleanup of test NCR row', false, 'row not found');
    }
  } else {
    check('admin cross-project tests', false, 'skipped: no admin token');
  }

  finish();
}

function formFor(obj) {
  const fd = new FormData();
  fd.append('data', JSON.stringify(obj));
  return fd;
}

function note2(m) { console.log('  · ' + m); }

function extractRows(res) {
  const j = res.json;
  if (Array.isArray(j)) return j;
  if (Array.isArray(j?.rows)) return j.rows;
  if (Array.isArray(j?.records)) return j.records;
  if (Array.isArray(j?.data)) return j.data;
  if (Array.isArray(j?.values)) return j.values;
  return [];
}

function finish() {
  const failed = results.filter(r => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length ? 1 : 0);
}

main().catch(err => { console.error('TEST CRASH:', err); process.exit(3); });
