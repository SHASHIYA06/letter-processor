// Depot acceptance: the 3D map's depot registry is self-consistent, the API
// serves it, and accounts can be scoped to one depot of their own location.
// Run: node tests/depots-map.mjs   (server must be running on $BASE)
import 'dotenv/config';
import { BEML_LOCATIONS, allDepots, depotStatus, depotTrainsets } from '../locations.js';

const BASE = process.env.BASE || 'http://localhost:3000';
const PASSCODE = process.env.ADMIN_BOOTSTRAP_PASSCODE || '';
const results = [];
const check = (n, ok, d = '') => { results.push(!!ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${d ? '  [' + d + ']' : ''}`); };

const post = async (path, body) => {
  const r = await fetch(BASE + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  let j = null; try { j = await r.json(); } catch { /* non-JSON */ }
  return { status: r.status, json: j };
};

function registryChecks() {
  const depots = allDepots();
  check('every location lists at least 2 depots', BEML_LOCATIONS.every(l => (l.depots || []).length >= 2));
  check('depot ids are globally unique', new Set(depots.map(d => d.id)).size === depots.length, `${depots.length} depots`);
  check('every depot sits inside India', depots.every(d => d.lat > 6 && d.lat < 37 && d.lng > 68 && d.lng < 97));
  check('every depot has a name and line', depots.every(d => d.name && d.line && d.city));
  check('delivered + to-deliver equals the location trainsets',
    BEML_LOCATIONS.every(l => (l.depots || []).reduce((s, d) => s + depotTrainsets(d), 0) === l.trainsets));
  check('derived status is one of the three states',
    depots.every(d => ['delivered', 'in-delivery', 'planned'].includes(depotStatus(d))));
  check('every location has at least one delivered depot',
    BEML_LOCATIONS.every(l => (l.depots || []).some(d => depotStatus(d) === 'delivered')));
}

async function apiChecks() {
  const res = await fetch(BASE + '/api/locations');
  const data = await res.json();
  check('GET /api/locations → success', data.success === true, 'status=' + res.status);
  check('API serves the depot registry', (data.locations || []).every(l => (l.depots || []).length >= 2));
  check('API derives depot status + trainsets server-side',
    (data.locations || []).every(l => (l.depots || []).every(d => d.status && d.trainsets === d.delivered + d.toDeliver)));

  const loc = (data.locations || []).find(l => l.org === 'BMRCL');
  const depot = (loc?.depots || []).find(d => d.status === 'in-delivery') || (loc?.depots || [])[0];
  const stamp = Date.now().toString(36);

  const withDepot = await post('/api/auth/register', {
    locationId: loc.id, depotId: depot.id, name: 'Depot Tester', email: `depot-${stamp}@example.com`,
    username: `deptest-${stamp}`, password: 'TestPass!123', confirmPassword: 'TestPass!123'
  });
  check('register scoped to a depot → success', withDepot.json?.success === true, 'status=' + withDepot.status);
  check('registration echoes the depot', withDepot.json?.depotId === depot.id && !!withDepot.json?.depot, 'depot=' + withDepot.json?.depot);

  const foreign = await post('/api/auth/register', {
    locationId: 'kmrcl-kolkata', depotId: depot.id, name: 'Wrong Depot', email: `wrong-${stamp}@example.com`,
    username: `wrongdepot-${stamp}`, password: 'TestPass!123', confirmPassword: 'TestPass!123'
  });
  check("a depot from another location is rejected", foreign.status === 400 && foreign.json?.success === false, 'status=' + foreign.status);
  check('rejected registration leaks no token', !foreign.json?.token);

  if (PASSCODE) {
    const admin = await post('/api/login', { username: `${depot.id}-admin`, password: PASSCODE });
    check(`depot admin ${depot.id}-admin signs in`, admin.json?.success === true && !!admin.json?.token, 'status=' + admin.status);
    check('depot admin is scoped to its location', admin.json?.role === 'project_admin' && admin.json?.depotId === depot.id, 'projects=' + JSON.stringify(admin.json?.projects));
  } else {
    console.log('SKIP  depot admin login (ADMIN_BOOTSTRAP_PASSCODE not set)');
  }
}

async function main() {
  registryChecks();
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch(BASE + '/api/health')).ok) break; } catch { /* not up yet */ }
    await new Promise(r => setTimeout(r, 500));
  }
  try {
    await apiChecks();
  } catch (err) {
    check('live API depot checks', false, err.message);
  }
  const failed = results.filter(v => !v).length;
  console.log(`\n${results.length - failed}/${results.length} passed`);
  process.exit(failed ? 1 : 0);
}
main().catch(e => { console.error('TEST CRASH:', e); process.exit(3); });
