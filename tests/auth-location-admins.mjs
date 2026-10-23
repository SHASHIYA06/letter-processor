// Auth acceptance: every BEML location/depot admin signs in with the shared
// operator passcode, and registration enforces matching passwords.
// Run: node tests/auth-location-admins.mjs   (server must be running on $BASE)
import 'dotenv/config';

const BASE = process.env.BASE || 'http://localhost:3000';
const PASSCODE = process.env.ADMIN_BOOTSTRAP_PASSCODE || '';
const PREFIXES = ['beml', 'bmrcl', 'kmrcl', 'dmcrl', 'mmrcl', 'cmrcl'];
const results = [];
const check = (n, ok, d = '') => { results.push(!!ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${d ? '  [' + d + ']' : ''}`); };

const post = async (path, body) => {
  const r = await fetch(BASE + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  let j = null; try { j = await r.json(); } catch { /* non-JSON */ }
  return { status: r.status, json: j };
};

async function main() {
  if (!PASSCODE) { console.error('ADMIN_BOOTSTRAP_PASSCODE not set — cannot test admin logins.'); process.exit(2); }
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch(BASE + '/api/health')).ok) break; } catch { /* not up yet */ }
    await new Promise(r => setTimeout(r, 500));
  }

  for (const p of PREFIXES) {
    const r = await post('/api/login', { username: `${p}-admin`, password: PASSCODE });
    check(`${p}-admin login → token`, r.json?.success === true && !!r.json?.token, 'status=' + r.status);
    check(`${p}-admin scoped role`, r.json?.role === 'project_admin' && (r.json?.projects || []).length > 0, 'projects=' + JSON.stringify(r.json?.projects));
  }

  const stamp = Date.now().toString(36);
  const ok = await post('/api/auth/register', { locationId: 'kmrcl-kolkata', name: 'Pw Match', email: `pw-${stamp}@example.com`, username: `pwok-${stamp}`, password: 'TestPass!123', confirmPassword: 'TestPass!123' });
  check('register with matching passwords → success', ok.json?.success === true, 'status=' + ok.status);

  const bad = await post('/api/auth/register', { locationId: 'kmrcl-kolkata', name: 'Pw Diff', email: `pwb-${stamp}@example.com`, username: `pwbad-${stamp}`, password: 'TestPass!123', confirmPassword: 'Different!123' });
  check('register with mismatched passwords → rejected', bad.status === 400 && bad.json?.success === false, 'status=' + bad.status);

  const failed = results.filter(v => !v).length;
  console.log(`\n${results.length - failed}/${results.length} passed`);
  process.exit(failed ? 1 : 0);
}
main().catch(e => { console.error('TEST CRASH:', e); process.exit(3); });
