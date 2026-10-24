// ══════════════════════════════════════════════════════════════
//  DocVault Pre-Login Portal
//  Stage 1: rotating dot-matrix globe  →  Stage 2: 3D tilted India
//  map with BEML metro business locations  →  Stage 3: location +
//  depot scoped account creation / sign-in
// ══════════════════════════════════════════════════════════════
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);

  // Offline fallback (mirrors server locations.js — depots need the live API)
  const FALLBACK_LOCATIONS = [
    { id: 'beml-bengaluru-hq', org: 'BEML', code: 'BEML', name: 'BEML South Complex', city: 'Bengaluru', state: 'Karnataka', lat: 12.9955, lng: 77.6350, hq: true, color: '#F59E0B', projects: ['Metro Rolling Stock Manufacturing'], trainsets: 420, depots: [], users: 0, letters: 0 },
    { id: 'bmrcl-bengaluru', org: 'BMRCL', code: 'BMRCL', name: 'BMRCL Metro Depot', city: 'Bengaluru', state: 'Karnataka', lat: 12.9960, lng: 77.6820, color: '#8B5CF6', projects: ['Bangalore Metro Phase 1 & 2'], trainsets: 214, depots: [], users: 0, letters: 0 },
    { id: 'kmrcl-kolkata', org: 'KMRCL', code: 'KMRCL', name: 'KMRCL East-West Depot', city: 'Kolkata', state: 'West Bengal', lat: 22.5697, lng: 88.4330, color: '#14B8A6', projects: ['Kolkata Metro East-West RS-3R'], trainsets: 168, depots: [], users: 0, letters: 0 },
    { id: 'dmcrl-delhi', org: 'DMCRL', code: 'DMCRL', name: 'Delhi Metro Operations', city: 'New Delhi', state: 'Delhi', lat: 28.6139, lng: 77.2090, color: '#10B981', projects: ['Delhi Metro Rolling Stock'], trainsets: 340, depots: [], users: 0, letters: 0 },
    { id: 'mmrcl-mumbai', org: 'MMRCL', code: 'MMRCL', name: 'Mumbai Metro Aqua Line', city: 'Mumbai', state: 'Maharashtra', lat: 19.0760, lng: 72.8777, color: '#06B6D4', projects: ['Mumbai Metro Line 3 Trainsets'], trainsets: 95, depots: [], users: 0, letters: 0 },
    { id: 'cmrcl-chennai', org: 'CMRCL', code: 'CMRCL', name: 'Chennai Metro Depot', city: 'Chennai', state: 'Tamil Nadu', lat: 13.0827, lng: 80.2707, color: '#EF4444', projects: ['Chennai Metro Phase 2 Rolling Stock'], trainsets: 120, depots: [], users: 0, letters: 0 }
  ];

  // ── Simplified India outline (lng, lat) ──
  const INDIA_OUTLINE = [
    [74.0,34.6],[75.0,34.9],[76.0,35.5],[77.5,35.4],[78.9,34.4],[79.6,33.0],[78.8,32.5],
    [79.2,30.9],[80.2,30.0],[80.8,28.9],[82.0,27.9],[83.5,27.4],[84.6,27.3],[86.0,26.6],
    [87.2,26.5],[88.2,26.6],[88.9,27.3],[89.8,26.8],[90.6,26.9],[92.0,27.5],[92.6,28.2],
    [94.5,29.4],[95.6,29.1],[96.4,28.4],[97.4,28.2],[96.9,27.2],[95.5,26.0],[94.8,24.5],
    [93.4,23.0],[92.7,21.9],[92.3,23.7],[91.6,23.0],[91.3,24.1],[90.0,25.2],[88.9,25.3],
    [88.1,26.4],[88.0,25.2],[88.2,24.2],[88.9,21.8],[87.5,21.6],[86.9,20.7],[85.0,19.5],
    [83.0,18.2],[82.3,16.9],[80.9,15.7],[80.2,13.8],[79.9,11.9],[79.8,10.3],[78.9,9.2],
    [78.1,9.1],[77.5,8.1],[76.5,9.6],[75.6,11.5],[74.7,12.9],[73.8,15.4],[73.1,17.9],
    [72.8,19.0],[72.7,21.0],[72.2,21.6],[72.8,22.4],[71.8,22.8],[70.5,22.8],[69.1,22.3],
    [68.9,23.2],[68.2,23.7],[70.3,24.3],[71.1,24.6],[70.1,25.7],[70.6,26.6],[70.0,27.4],
    [71.0,28.0],[72.3,28.9],[73.9,29.9],[74.6,30.9],[74.5,31.9],[74.0,32.5],[74.5,33.5]
  ];

  // ── Coarse world landmasses for the dotted globe (lng, lat) ──
  const WORLD_LAND = [
    // Eurasia (incl. Indian subcontinent)
    [[-9,43],[-1,44],[-4,48],[2,51],[5,53],[8,54],[10,57],[12,56],[11,58],[5,59],[5,62],[11,64],[14,67],[18,69],[25,71],[30,70],[33,68],[40,66],[44,66],[50,68],[55,68],[60,70],[66,71],[70,72],[80,73],[95,78],[105,77],[113,73],[120,73],[130,72],[140,72],[150,70],[160,69],[170,67],[178,65],[175,62],[170,60],[163,58],[158,55],[156,51],[153,55],[147,54],[142,54],[138,50],[133,45],[131,43],[128,40],[126,38],[126,34],[122,39],[118,39],[121,36],[122,31],[118,25],[114,22],[110,21],[108,18],[106,10],[104,9],[103,1],[100,6],[98,8],[97,16],[95,16],[94,18],[92,21],[90,22],[87,21],[85,19],[82,16],[80,12],[79,10],[78,8],[77,8],[75,10],[73,15],[70,20],[69,22],[68,24],[67,25],[61,25],[57,26],[56,26],[50,29],[55,24],[59,22],[57,18],[52,15],[45,13],[43,13],[40,17],[38,22],[35,28],[34,31],[34,32],[36,36],[32,36],[28,37],[26,40],[21,39],[18,40],[16,41],[12,44],[8,44],[4,43],[0,40],[-2,37],[-6,36],[-9,38]],
    // Africa
    [[-17,14],[-16,20],[-13,28],[-9,32],[-2,35],[9,37],[19,31],[25,32],[33,31],[35,28],[37,22],[39,15],[43,11],[48,8],[51,11],[45,3],[42,-1],[40,-8],[39,-13],[36,-18],[34,-24],[31,-29],[26,-34],[19,-34],[15,-27],[12,-18],[13,-11],[9,-1],[9,4],[3,6],[-4,5],[-8,4],[-13,8]],
    // Australia
    [[114,-22],[114,-34],[118,-35],[124,-33],[130,-32],[135,-35],[138,-35],[141,-38],[146,-39],[150,-37],[153,-32],[153,-27],[146,-19],[142,-11],[136,-12],[132,-11],[130,-13],[126,-14],[122,-17]],
    // North America
    [[-168,66],[-165,60],[-158,58],[-150,60],[-140,60],[-133,55],[-127,50],[-124,40],[-121,35],[-117,32],[-114,28],[-110,24],[-106,23],[-99,19],[-95,16],[-92,15],[-88,16],[-87,21],[-90,21],[-94,19],[-97,22],[-97,26],[-94,29],[-90,29],[-84,30],[-82,25],[-80,27],[-81,32],[-76,35],[-74,39],[-70,42],[-66,45],[-60,47],[-56,51],[-64,58],[-78,62],[-85,66],[-95,68],[-105,68],[-115,69],[-125,70],[-135,69],[-145,70],[-155,71],[-165,68]],
    // South America
    [[-81,-4],[-80,0],[-77,8],[-72,11],[-62,10],[-52,5],[-50,0],[-44,-2],[-35,-5],[-38,-12],[-40,-20],[-48,-25],[-53,-34],[-58,-38],[-62,-40],[-65,-45],[-68,-50],[-70,-55],[-75,-50],[-74,-44],[-73,-37],[-71,-30],[-70,-23],[-71,-18],[-76,-14],[-81,-6]],
    // Greenland
    [[-45,60],[-42,64],[-22,70],[-18,75],[-32,83],[-58,82],[-72,78],[-55,68]],
    // British Isles
    [[-6,50],[-3,51],[0,52],[1,53],[-1,55],[-3,58],[-5,58],[-5,55],[-4,53],[-6,52]],
    // Japan
    [[130,31],[132,34],[136,35],[140,36],[141,39],[141,42],[144,44],[145,43],[142,41],[139,37],[135,33],[132,31]],
    // Sumatra
    [[95,5],[100,0],[104,-6],[101,-6],[97,1]],
    // Borneo
    [[109,2],[114,4],[117,7],[119,1],[116,-3],[110,-3]],
    // Java
    [[105,-6],[112,-7],[115,-8],[112,-8],[106,-7]],
    // New Guinea
    [[131,-1],[138,-2],[146,-6],[150,-10],[141,-8],[135,-4]],
    // Madagascar
    [[44,-12],[50,-16],[47,-25],[44,-22],[43,-17]],
    // New Zealand
    [[173,-35],[176,-38],[174,-39],[172,-43],[167,-46],[166,-45],[171,-41],[172,-40]],
    // Philippines
    [[120,14],[122,16],[124,18],[126,10],[122,6],[120,10]]
  ];

  function inPoly(lon, lat, poly) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
      if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }

  // ── tiny tween engine ──
  const activeTweens = new Set();
  function tween({ from, to, dur, ease, onUpdate, onDone }) {
    const t0 = performance.now();
    const rec = { cancelled: false };
    function frame(now) {
      if (rec.cancelled) { activeTweens.delete(rec); return; }
      let p = Math.min(1, (now - t0) / dur);
      const e = ease ? ease(p) : p;
      onUpdate(from + (to - from) * e, p);
      if (p < 1) requestAnimationFrame(frame);
      else { activeTweens.delete(rec); onDone && onDone(); }
    }
    requestAnimationFrame(frame);
    activeTweens.add(rec);
    return rec;
  }
  const easeInOut = (p) => p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
  const easeOut = (p) => 1 - Math.pow(1 - p, 3);
  const easeIn = (p) => p * p * p;
  function cancelTweens() { activeTweens.forEach(t => t.cancelled = true); activeTweens.clear(); }

  // ═══════════════ state ═══════════════
  const state = {
    running: false,
    stage: 'globe',          // globe | map
    view: 'locations',       // locations | depots
    locations: FALLBACK_LOCATIONS.map(l => ({ ...l })),
    depots: [],
    selected: null,          // location id
    selectedDepot: null,     // depot id
    hit: [],                 // screen-space pins for pointer hit-testing
    live: { users: 0, ncr: 0 },
    pollTimer: null,
    countdownTimer: null,
    countdown: 10,
    enteringMapAt: 0,
    enteringDepotsAt: 0
  };

  let starsCanvas, starsCtx, globeCanvas, globeCtx, indiaCanvas, indiaCtx;
  let landDots = null;
  let rotLon = 0.6, tilt = -0.32, globeR = 0, globeAdvancing = false;
  let animHandle = null;
  let mapView = { k: 1, fx: 0, fy: 0 };
  let mapProj = null;         // { project(lng,lat)->{x,y} flat map coords }
  let pointer = { x: -1, y: -1 };

  // ═══════════════ canvas helpers ═══════════════
  function fitCanvas(canvas) {
    if (!canvas) return null;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const r = canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr; canvas.height = h * dpr;
    }
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, w, h };
  }

  function hexA(hex, a) {
    const h = String(hex || '#0D9488').replace('#', '');
    const r = parseInt(h.substring(0, 2), 16), g = parseInt(h.substring(2, 4), 16), b = parseInt(h.substring(4, 6), 16);
    return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, a)).toFixed(3)})`;
  }

  // ═══════════════ starfield ═══════════════
  let stars = [];
  function initStars() {
    starsCanvas = $('portalStars');
    const fit = fitCanvas(starsCanvas);
    if (!fit) return;
    const { w, h } = fit;
    stars = [];
    const n = Math.min(220, Math.floor((w * h) / 7000));
    for (let i = 0; i < n; i++) {
      stars.push({
        x: Math.random() * w, y: Math.random() * h,
        r: Math.random() * 1.4 + 0.2,
        tw: Math.random() * Math.PI * 2,
        sp: 0.4 + Math.random() * 1.2,
        drift: 0.004 + Math.random() * 0.01
      });
    }
  }
  function drawStars(t) {
    const fit = fitCanvas(starsCanvas);
    if (!fit) return;
    const { ctx, w, h } = fit;
    ctx.clearRect(0, 0, w, h);
    for (const s of stars) {
      const a = 0.25 + 0.65 * (0.5 + 0.5 * Math.sin(t * 0.001 * s.sp + s.tw));
      s.y -= s.drift; if (s.y < -2) { s.y = h + 2; s.x = Math.random() * w; }
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(191,219,254,${a.toFixed(3)})`;
      ctx.fill();
    }
  }

  // ═══════════════ globe ═══════════════
  function buildLandDots() {
    landDots = [];
    for (let lat = -56; lat <= 80; lat += 2.2) {
      const stepLon = 2.2 / Math.max(0.25, Math.cos(lat * Math.PI / 180));
      for (let lon = -180; lon <= 180; lon += stepLon) {
        let land = false;
        for (const poly of WORLD_LAND) { if (inPoly(lon, lat, poly)) { land = true; break; } }
        if (land) {
          const φ = lat * Math.PI / 180, λ = lon * Math.PI / 180;
          landDots.push({ x: Math.cos(φ) * Math.cos(λ), y: Math.sin(φ), z: Math.cos(φ) * Math.sin(λ) });
        }
      }
    }
  }

  function globeProject(lat, lng) {
    const φ = lat * Math.PI / 180, λ = lng * Math.PI / 180;
    let x = Math.cos(φ) * Math.cos(λ), y = Math.sin(φ), z = Math.cos(φ) * Math.sin(λ);
    const ca = Math.cos(rotLon), sa = Math.sin(rotLon);
    const x2 = x * ca + z * sa, z2 = -x * sa + z * ca;
    const ct = Math.cos(tilt), st = Math.sin(tilt);
    const y2 = y * ct - z2 * st, z3 = y * st + z2 * ct;
    return { x: x2, y: y2, z: z3 };
  }

  function drawGlobe(t) {
    const fit = fitCanvas(globeCanvas);
    if (!fit) return;
    const { ctx, w, h } = fit;
    ctx.clearRect(0, 0, w, h);
    const cx = w / 2, cy = h * 0.52;
    const baseR = Math.min(w, h) * (w < 640 ? 0.32 : 0.27);
    if (!globeR) globeR = baseR;
    const R = globeR;

    // atmosphere
    const atmo = ctx.createRadialGradient(cx, cy, R * 0.85, cx, cy, R * 1.35);
    atmo.addColorStop(0, 'rgba(59,130,246,0.16)');
    atmo.addColorStop(1, 'rgba(59,130,246,0)');
    ctx.fillStyle = atmo;
    ctx.beginPath(); ctx.arc(cx, cy, R * 1.35, 0, Math.PI * 2); ctx.fill();

    // ocean sphere
    const sphere = ctx.createRadialGradient(cx - R * 0.35, cy - R * 0.4, R * 0.1, cx, cy, R);
    sphere.addColorStop(0, 'rgba(30,58,110,0.95)');
    sphere.addColorStop(0.6, 'rgba(13,27,58,0.97)');
    sphere.addColorStop(1, 'rgba(5,11,28,0.99)');
    ctx.fillStyle = sphere;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(96,165,250,0.35)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // graticule (faint)
    ctx.strokeStyle = 'rgba(96,165,250,0.08)';
    for (let lat = -60; lat <= 60; lat += 30) {
      ctx.beginPath();
      let pen = false;
      for (let lon = -180; lon <= 180; lon += 6) {
        const p = globeProject(lat, lon);
        if (p.z > 0.02) {
          const sx = cx + p.x * R, sy = cy - p.y * R;
          pen ? ctx.lineTo(sx, sy) : ctx.moveTo(sx, sy); pen = true;
        } else pen = false;
      }
      ctx.stroke();
    }

    // land dots
    if (!landDots) buildLandDots();
    for (const d of landDots) {
      const ca = Math.cos(rotLon), sa = Math.sin(rotLon);
      const x2 = d.x * ca + d.z * sa, z2 = -d.x * sa + d.z * ca;
      const ct = Math.cos(tilt), st = Math.sin(tilt);
      const y2 = d.y * ct - z2 * st, z3 = d.y * st + z2 * ct;
      if (z3 <= 0.02) continue;
      const sx = cx + x2 * R, sy = cy - y2 * R;
      const a = 0.12 + 0.8 * z3;
      const size = 0.5 + 1.4 * z3;
      ctx.fillStyle = z3 > 0.65 ? `rgba(125,211,252,${a.toFixed(3)})` : `rgba(96,165,250,${a.toFixed(3)})`;
      ctx.beginPath(); ctx.arc(sx, sy, size, 0, Math.PI * 2); ctx.fill();
    }

    // BEML India beacon (blinks when facing viewer)
    const ind = globeProject(22.3, 79.8);
    if (ind.z > 0.05) {
      const sx = cx + ind.x * R, sy = cy - ind.y * R;
      const pulse = 0.5 + 0.5 * Math.sin(t * 0.004);
      const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, 22 + pulse * 10);
      glow.addColorStop(0, 'rgba(245,158,11,0.9)');
      glow.addColorStop(0.4, 'rgba(245,158,11,0.25)');
      glow.addColorStop(1, 'rgba(245,158,11,0)');
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.arc(sx, sy, 22 + pulse * 10, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#FCD34D';
      ctx.beginPath(); ctx.arc(sx, sy, 3, 0, Math.PI * 2); ctx.fill();
    }

    // orbit ring
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-0.42);
    ctx.strokeStyle = 'rgba(148,163,184,0.16)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(0, 0, R * 1.28, R * 0.34, 0, 0, Math.PI * 2); ctx.stroke();
    const sat = (t * 0.00035) % (Math.PI * 2);
    const sxx = Math.cos(sat) * R * 1.28, syy = Math.sin(sat) * R * 0.34;
    ctx.fillStyle = 'rgba(125,211,252,0.95)';
    ctx.beginPath(); ctx.arc(sxx, syy, 2.4, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  // ═══════════════ India map — 3D tilted projection ═══════════════
  // Flat map coords come from mapProj.project(); cam3() then lifts them into
  // a 3D camera: screen-y compresses by sin(elev), height lifts by cos(elev),
  // and a mild perspective divide gives the extruded landmass real depth.
  const MAP_BOX = { lng0: 66.5, lng1: 97.5, lat0: 6.0, lat1: 37.5 };
  const LAT_STRETCH = 1.18;
  const CAM = {
    elev: 0.99,               // camera elevation over the map plane (rad)
    elevFrom: 0.24,           // start of the tilt-up reveal
    yaw: -0.10,               // turntable rotation of the plane
    dist: 2200,               // perspective distance
    slab: 15,                 // landmass extrusion, screen px
    pinH: 34,                 // location pillar height, px
    depotH: 20,               // depot pillar height, px
    maxK: 34                  // deepest zoom (depot cluster view)
  };
  const DEPOT_STATUS = {
    delivered: { label: 'Delivered', color: '#10B981' },
    'in-delivery': { label: 'In delivery', color: '#F59E0B' },
    planned: { label: 'Planned', color: '#5EEAD4' }
  };
  let mapFrame = { w: 0, h: 0 };

  function buildMapProjection(w, h) {
    mapFrame = { w, h };
    const pad = Math.min(w, h) * 0.10;
    const bw = MAP_BOX.lng1 - MAP_BOX.lng0;
    const bh = (MAP_BOX.lat1 - MAP_BOX.lat0) * LAT_STRETCH;
    const s = Math.min((w - 2 * pad) / bw, (h - 2 * pad) / bh);
    const ox = (w - bw * s) / 2, oy = (h - bh * s) / 2;
    mapProj = {
      s,
      project(lng, lat) {
        return { x: ox + (lng - MAP_BOX.lng0) * s, y: oy + (MAP_BOX.lat1 - lat) * LAT_STRETCH * s };
      }
    };
    return mapProj;
  }

  // flat map point + screen-space height → screen point
  function cam3(fx, fy, hgt) {
    const k = mapView.k;
    const wx = (fx - mapView.fx) * k;
    const wy = (mapView.fy - fy) * k;                 // north is +
    const wz = hgt || 0;                              // up is +
    const cy = Math.cos(CAM.yaw), sy = Math.sin(CAM.yaw);
    const x1 = wx * cy - wy * sy;
    const y1 = wx * sy + wy * cy;
    const ce = Math.cos(CAM.elev), se = Math.sin(CAM.elev);
    const depth = y1 * ce - wz * se;
    const sc = CAM.dist / (CAM.dist + depth);
    return {
      x: mapFrame.w / 2 + x1 * sc,
      y: mapFrame.h / 2 - (y1 * se + wz * ce) * sc,
      s: sc,
      d: depth
    };
  }

  const pinOf = (lng, lat, hgt) => {
    const p = mapProj.project(lng, lat);
    return { base: cam3(p.x, p.y, 0), top: cam3(p.x, p.y, hgt), flat: p };
  };

  const CITY_DOTS = [
    { name: 'Delhi', lat: 28.61, lng: 77.21 }, { name: 'Mumbai', lat: 19.08, lng: 72.88 },
    { name: 'Kolkata', lat: 22.57, lng: 88.36 }, { name: 'Chennai', lat: 13.08, lng: 80.27 },
    { name: 'Bengaluru', lat: 12.97, lng: 77.59 }, { name: 'Hyderabad', lat: 17.39, lng: 78.49 },
    { name: 'Ahmedabad', lat: 23.02, lng: 72.57 }, { name: 'Pune', lat: 18.52, lng: 73.86 }
  ];

  // ── drawing helpers ──
  function roundRectPath(ctx, x, y, w, h, r) {
    ctx.beginPath();
    if (ctx.roundRect) { ctx.roundRect(x, y, w, h, r); return; }
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function groundRing(ctx, p, r, color, a) {
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, r * p.s, r * 0.42 * p.s, 0, 0, Math.PI * 2);
    ctx.strokeStyle = hexA(color, 0.38 * a);
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  function pillar(ctx, base, top, color, a) {
    const g = ctx.createLinearGradient(base.x, base.y, top.x, top.y);
    g.addColorStop(0, hexA(color, 0.08 * a));
    g.addColorStop(1, hexA(color, 0.8 * a));
    ctx.strokeStyle = g;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(base.x, base.y);
    ctx.lineTo(top.x, top.y);
    ctx.stroke();
  }

  function orb(ctx, p, r, color, a, glow) {
    const gr = r * (glow || 3);
    const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, gr);
    g.addColorStop(0, hexA(color, 0.9 * a));
    g.addColorStop(0.35, hexA(color, 0.24 * a));
    g.addColorStop(1, hexA(color, 0));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(p.x, p.y, gr, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = hexA(color, a);
    ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = `rgba(255,255,255,${(0.55 * a).toFixed(3)})`;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(p.x, p.y, r + 1.5, 0, Math.PI * 2); ctx.stroke();
  }

  function drawLabel(ctx, x, y, main, sub, a, strong) {
    ctx.textAlign = 'left';
    ctx.shadowColor = 'rgba(0,0,0,0.9)';
    ctx.shadowBlur = 6;
    ctx.font = `${strong ? 700 : 600} ${strong ? 12.5 : 11}px Inter, sans-serif`;
    ctx.fillStyle = `rgba(241,245,249,${(0.96 * a).toFixed(3)})`;
    ctx.fillText(main, x, y);
    if (sub) {
      ctx.font = '500 9.5px Inter, sans-serif';
      ctx.fillStyle = `rgba(148,163,184,${(0.9 * a).toFixed(3)})`;
      ctx.fillText(sub, x, y + 11.5);
    }
    ctx.shadowBlur = 0;
  }

  function drawIndia(t) {
    const fit = fitCanvas(indiaCanvas);
    if (!fit || !mapProj) return;
    const { ctx, w, h } = fit;
    ctx.clearRect(0, 0, w, h);
    state.hit = [];

    const age = t - state.enteringMapAt;
    const reveal = Math.min(1, age / 1500);
    const dashP = Math.min(1, age / 1900);

    // idle turntable keeps the 3D view alive while nothing is selected
    if (!state.selected) CAM.yaw = -0.10 + Math.sin(t * 0.00013) * 0.055;

    const mid = mapProj.project((MAP_BOX.lng0 + MAP_BOX.lng1) / 2, (MAP_BOX.lat0 + MAP_BOX.lat1) / 2);
    const cScreen = cam3(mid.x, mid.y, 0);
    const glowR = Math.min(w, h) * 0.7;
    const bg = ctx.createRadialGradient(cScreen.x, cScreen.y, 0, cScreen.x, cScreen.y, glowR);
    bg.addColorStop(0, 'rgba(37,99,235,0.17)');
    bg.addColorStop(0.55, 'rgba(30,64,175,0.07)');
    bg.addColorStop(1, 'rgba(3,7,18,0)');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    // landmass: top face (h=0) and extruded wall (h=-slab)
    const top = [], bot = [];
    for (const [lng, lat] of INDIA_OUTLINE) {
      const p = mapProj.project(lng, lat);
      top.push(cam3(p.x, p.y, 0));
      bot.push(cam3(p.x, p.y, -CAM.slab));
    }
    // the slab fades away as the camera dives into a depot cluster
    const slabA = Math.max(0, Math.min(1, (13 - mapView.k) / 6));

    ctx.globalAlpha = reveal * slabA;

    for (let i = 0; i < top.length; i++) {
      const j = (i + 1) % top.length;
      const g = ctx.createLinearGradient(top[i].x, top[i].y, bot[j].x, bot[j].y);
      g.addColorStop(0, 'rgba(15,34,72,0.94)');
      g.addColorStop(1, 'rgba(2,8,22,0.98)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(top[i].x, top[i].y);
      ctx.lineTo(top[j].x, top[j].y);
      ctx.lineTo(bot[j].x, bot[j].y);
      ctx.lineTo(bot[i].x, bot[i].y);
      ctx.closePath();
      ctx.fill();
    }

    // ground grid on the plane (screen density stays constant at any zoom)
    const step = Math.max(1.2, 40 / mapView.k);
    const spanX = (w / 2 + 80) / mapView.k;
    const spanY = (h / 2 + 80) / (mapView.k * Math.max(0.2, Math.sin(CAM.elev)));
    for (let gx = Math.floor((mapView.fx - spanX) / step) * step; gx <= mapView.fx + spanX; gx += step) {
      for (let gy = Math.floor((mapView.fy - spanY) / step) * step; gy <= mapView.fy + spanY; gy += step) {
        const q = cam3(gx, gy, 0);
        if (q.x < -30 || q.x > w + 30 || q.y < -30 || q.y > h + 30) continue;
        const tw = 0.5 + 0.5 * Math.sin(t * 0.0016 + gx * 0.02 + gy * 0.03);
        ctx.fillStyle = `rgba(96,165,250,${(0.05 + 0.05 * tw).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(q.x, q.y, 1.1, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // top face
    ctx.beginPath();
    ctx.moveTo(top[0].x, top[0].y);
    for (let i = 1; i < top.length; i++) ctx.lineTo(top[i].x, top[i].y);
    ctx.closePath();
    const bb = top.reduce((b, p) => ({
      x0: Math.min(b.x0, p.x), x1: Math.max(b.x1, p.x),
      y0: Math.min(b.y0, p.y), y1: Math.max(b.y1, p.y)
    }), { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity });
    const fg = ctx.createLinearGradient(bb.x0, bb.y0, bb.x1, bb.y1);
    fg.addColorStop(0, 'rgba(37,99,235,0.30)');
    fg.addColorStop(0.55, 'rgba(99,102,241,0.34)');
    fg.addColorStop(1, 'rgba(6,182,212,0.28)');
    ctx.fillStyle = fg;
    ctx.fill();

    // outline: glow + self-drawing bright stroke
    let plen = 0;
    for (let i = 1; i < top.length; i++) plen += Math.hypot(top[i].x - top[i - 1].x, top[i].y - top[i - 1].y);
    ctx.shadowColor = 'rgba(56,189,248,0.55)';
    ctx.shadowBlur = 18;
    ctx.strokeStyle = 'rgba(125,211,252,0.28)';
    ctx.lineWidth = 2.4;
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.setLineDash([plen, plen]);
    ctx.lineDashOffset = plen * (1 - dashP);
    ctx.strokeStyle = 'rgba(191,219,254,0.95)';
    ctx.lineWidth = 1.7;
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.globalAlpha = 1;

    // delivery corridors: BEML HQ → each project location, arcing off the plane
    const hq = state.locations.find(l => l.hq) || state.locations[0];
    if (hq) {
      const a = mapProj.project(hq.lng, hq.lat);
      state.locations.forEach((loc, i) => {
        if (loc.id === hq.id) return;
        const appear = Math.min(1, Math.max(0, (age - 1600 - i * 140) / 900));
        if (appear <= 0) return;
        const b = mapProj.project(loc.lng, loc.lat);
        const N = 26, pts = [];
        for (let s = 0; s <= N; s++) {
          const f = s / N;
          pts.push(cam3(a.x + (b.x - a.x) * f, a.y + (b.y - a.y) * f, Math.sin(f * Math.PI) * 40));
        }
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (const p of pts.slice(1)) ctx.lineTo(p.x, p.y);
        ctx.strokeStyle = hexA(loc.color || '#14B8A6', 0.3 * appear);
        ctx.lineWidth = 1.1;
        ctx.setLineDash([5, 6]);
        ctx.stroke();
        ctx.setLineDash([]);
        // travelling delivery pulse
        const ph = (t * 0.00019 + i * 0.21) % 1;
        const p = pts[Math.min(N, Math.round(ph * N))];
        orb(ctx, p, 2.6, loc.color || '#5EEAD4', 0.85 * appear, 3.2);
      });
    }

    // context cities
    ctx.font = '9px Inter, sans-serif';
    ctx.textAlign = 'left';
    for (const c of CITY_DOTS) {
      if (state.locations.some(l => l.city === c.name)) continue;
      const p = pinOf(c.lng, c.lat, 0).base;
      ctx.fillStyle = 'rgba(148,163,184,0.32)';
      ctx.beginPath(); ctx.arc(p.x, p.y, 1.8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(148,163,184,0.38)';
      ctx.fillText(c.name, p.x + 5, p.y + 3);
    }

    if (state.view === 'locations') drawLocationPins(ctx, t, age);
    else drawDepotPins(ctx, t);

    // watermark
    ctx.font = '700 11.5px Inter, sans-serif';
    ctx.fillStyle = 'rgba(148,163,184,0.32)';
    ctx.textAlign = 'center';
    ctx.fillText(state.view === 'locations'
      ? 'BEML METRO BUSINESS MAP · 3D · INDIA'
      : 'DEPOT VIEW · CLICK A DEPOT TO SIGN IN', w / 2, h - 16);
    ctx.textAlign = 'left';
  }

  function drawLocationPins(ctx, t, age) {
    state.locations
      .map((loc, i) => ({ loc, i, pin: pinOf(loc.lng, loc.lat, CAM.pinH) }))
      .sort((a, b) => b.pin.top.d - a.pin.top.d)
      .forEach(({ loc, i, pin }) => {
        const appear = Math.min(1, Math.max(0, (age - 900 - i * 120) / 500));
        if (appear <= 0) return;
        const isSel = state.selected === loc.id;
        const push = isSel ? 1.12 : 1;
        const color = loc.color || '#0D9488';
        const pulse = 0.5 + 0.5 * Math.sin(t * 0.003 + i * 1.4);
        const base = { x: pin.base.x, y: pin.base.y, s: pin.base.s };
        const top = { x: pin.base.x + (pin.top.x - pin.base.x) * push, y: pin.base.y + (pin.top.y - pin.base.y) * push, s: pin.base.s };

        groundRing(ctx, base, 11 + pulse * 9, color, appear);
        pillar(ctx, base, top, color, appear);
        orb(ctx, top, (isSel ? 6.4 : 5) * push, color, appear, isSel ? 3.6 : 2.7);
        if (loc.hq) {
          ctx.beginPath();
          ctx.arc(top.x, top.y, 12, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(252,211,77,0.75)';
          ctx.lineWidth = 1.2;
          ctx.setLineDash([3, 4]);
          ctx.stroke();
          ctx.setLineDash([]);
        }
        drawLabel(ctx, top.x + 12, top.y - 2, loc.code, loc.city.toUpperCase(), appear, isSel);
        if (loc.hq) drawLabel(ctx, top.x + 12, top.y + 14, 'HQ', '', appear * 0.9, false);
        state.hit.push({ kind: 'location', id: loc.id, x: top.x, y: top.y });
        state.hit.push({ kind: 'location', id: loc.id, x: base.x, y: base.y });
      });
  }

  function drawDepotPins(ctx, t) {
    const loc = state.locations.find(l => l.id === state.selected);
    if (!loc) return;

    // every other location stays as a faint ground anchor
    for (const other of state.locations) {
      if (other.id === loc.id) continue;
      const p = pinOf(other.lng, other.lat, 0).base;
      ctx.fillStyle = hexA(other.color || '#0D9488', 0.5);
      ctx.beginPath(); ctx.arc(p.x, p.y, 2.4, 0, Math.PI * 2); ctx.fill();
    }

    const dAge = performance.now() - state.enteringDepotsAt;
    state.depots
      .map((d, i) => ({ d, i, pin: pinOf(d.lng, d.lat, CAM.depotH) }))
      .sort((a, b) => b.pin.top.d - a.pin.top.d)
      .forEach(({ d, i, pin }) => {
        const appear = Math.min(1, Math.max(0, (dAge - i * 110) / 520));
        if (appear <= 0) return;
        const meta = DEPOT_STATUS[d.status] || DEPOT_STATUS.delivered;
        const isSel = state.selectedDepot === d.id;
        const push = isSel ? 1.25 : 1;
        const base = pin.base;
        const top = { x: base.x + (pin.top.x - base.x) * push, y: base.y + (pin.top.y - base.y) * push, s: base.s };
        const pulse = 0.5 + 0.5 * Math.sin(t * 0.0035 + i);

        groundRing(ctx, base, (isSel ? 13 : 8) + pulse * 4, meta.color, appear);
        // returning line from the city anchor to the depot
        ctx.strokeStyle = hexA(meta.color, 0.16 * appear);
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 5]);
        ctx.beginPath();
        ctx.moveTo(base.x, base.y);
        ctx.lineTo(top.x, top.y);
        ctx.stroke();
        ctx.setLineDash([]);
        pillar(ctx, base, top, meta.color, appear);

        const bs = (isSel ? 8 : 6.6) * push;
        roundRectPath(ctx, top.x - bs, top.y - bs * 0.8, bs * 2, bs * 1.6, 3);
        ctx.save();
        ctx.shadowColor = meta.color;
        ctx.shadowBlur = isSel ? 22 : 12;
        ctx.fillStyle = hexA(meta.color, 0.95 * appear);
        ctx.fill();
        ctx.restore();
        roundRectPath(ctx, top.x - bs, top.y - bs * 0.8, bs * 2, bs * 1.6, 3);
        ctx.strokeStyle = `rgba(255,255,255,${(0.6 * appear).toFixed(3)})`;
        ctx.lineWidth = 1;
        ctx.stroke();

        drawLabel(ctx, top.x + 13, top.y - 1, d.name,
          `${meta.label} · ${d.delivered}/${d.trainsets} trainsets`, appear, isSel);
        state.hit.push({ kind: 'depot', id: d.id, x: top.x, y: top.y });
        state.hit.push({ kind: 'depot', id: d.id, x: base.x, y: base.y });
      });
  }

  // ── pointer hit-testing happens in screen space, so it always matches
  //    exactly what the tilted projection drew ──
  function hitTest(px, py) {
    let best = null, bestD = Infinity;
    for (const c of state.hit) {
      const d = Math.hypot(c.x - px, c.y - py);
      if (d < 26 && d < bestD) { best = c; bestD = d; }
    }
    return best;
  }

  // ═══════════════ main loop ═══════════════
  function loop(t) {
    if (!state.running) { animHandle = null; return; }
    drawStars(t);
    if (state.stage === 'globe') {
      if (!globeAdvancing) rotLon += 0.0016;
      drawGlobe(t);
    } else {
      drawIndia(t);
    }
    animHandle = requestAnimationFrame(loop);
  }

  // ═══════════════ stage machine ═══════════════
  function gotoStage(name) {
    state.stage = name;
    const g = $('stage-globe'), m = $('stage-map');
    if (name === 'globe') {
      g.classList.add('active'); m.classList.remove('active');
    } else {
      state.enteringMapAt = performance.now();
      m.classList.add('active'); g.classList.remove('active');
      requestAnimationFrame(() => {
        const fit = fitCanvas(indiaCanvas);
        if (!fit) return;
        buildMapProjection(fit.w, fit.h);
        const mid = mapProj.project((MAP_BOX.lng0 + MAP_BOX.lng1) / 2, (MAP_BOX.lat0 + MAP_BOX.lat1) / 2);
        mapView = { k: 1, fx: mid.x, fy: mid.y };
        // the map stands up into 3D and settles
        CAM.elev = CAM.elevFrom;
        tween({ from: CAM.elevFrom, to: 0.99, dur: 1700, ease: easeInOut, onUpdate: v => CAM.elev = v });
      });
    }
  }

  function startCountdown() {
    stopCountdown();
    state.countdown = 10;
    const el = $('autoCount');
    if (el) el.textContent = state.countdown;
    state.countdownTimer = setInterval(() => {
      state.countdown--;
      if (el) el.textContent = Math.max(0, state.countdown);
      if (state.countdown <= 0) { stopCountdown(); advance(); }
    }, 1000);
  }
  function stopCountdown() {
    if (state.countdownTimer) { clearInterval(state.countdownTimer); state.countdownTimer = null; }
  }

  function advance() {
    if (state.stage !== 'globe' || globeAdvancing) return;
    globeAdvancing = true;
    stopCountdown();
    const intro = $('portalIntro'), bottom = document.querySelector('.portal-bottom');
    if (intro) intro.style.transition = 'opacity .6s', intro.style.opacity = '0';
    if (bottom) bottom.style.transition = 'opacity .6s', bottom.style.opacity = '0';
    // rotate so India faces the viewer, zoom in, then hand over to the map stage
    const indiaLon = 79.8 * Math.PI / 180;
    const twoPi = Math.PI * 2;
    let target = indiaLon - (rotLon % twoPi);
    if (target < 0) target += twoPi;
    target += rotLon;
    tween({
      from: rotLon, to: target, dur: 2100, ease: easeInOut,
      onUpdate: (v) => { rotLon = v; },
      onDone: () => {
        const fit = fitCanvas(globeCanvas);
        const base = fit ? Math.min(fit.w, fit.h) * (fit.w < 640 ? 0.32 : 0.27) : 200;
        tween({
          from: base, to: base * 2.9, dur: 850, ease: easeIn,
          onUpdate: (v) => { globeR = v; },
          onDone: () => {
            globeR = 0; globeAdvancing = false;
            if (intro) intro.style.opacity = ''; if (bottom) bottom.style.opacity = '';
            gotoStage('map');
          }
        });
      }
    });
  }

  function backToGlobe() {
    clearLocation();
    globeR = 0;
    gotoStage('globe');
    startCountdown();
  }

  // ═══════════════ data ═══════════════
  async function loadLocations() {
    try {
      const res = await fetch('/api/locations');
      const data = await res.json();
      if (data.success && Array.isArray(data.locations) && data.locations.length) {
        state.locations = data.locations;
        state.live.users = data.totalUsers || 0;
        state.live.ncr = data.ncrCount || 0;
        if (state.selected) {
          const loc = state.locations.find(l => l.id === state.selected);
          state.depots = (loc && loc.depots) || [];
        }
      }
    } catch { /* keep fallback */ }
    renderSidePanel();
    renderLiveBadge();
    renderStats();
    updateLegend();
  }

  function depotSummary(depots) {
    let delivered = 0, toDeliver = 0;
    const counts = { delivered: 0, 'in-delivery': 0, planned: 0 };
    for (const d of depots) {
      counts[d.status] = (counts[d.status] || 0) + 1;
      delivered += d.delivered || 0;
      toDeliver += d.toDeliver || 0;
    }
    const total = delivered + toDeliver;
    return { delivered, toDeliver, total, counts, pct: total ? Math.round((delivered / total) * 100) : 0 };
  }

  function renderLiveBadge() {
    const badge = $('mapLive');
    if (!badge) return;
    const totalUsers = state.locations.reduce((s, l) => s + (l.users || 0), 0) || state.live.users;
    const depots = state.locations.reduce((s, l) => s + ((l.depots || []).length), 0);
    badge.innerHTML = `<span class="live-dot"></span>LIVE · ${state.locations.length} LOCATIONS · ${depots} DEPOTS · ${totalUsers} USERS`;
  }

  function renderStats() {
    const depots = state.locations.reduce((s, l) => s + ((l.depots || []).length), 0);
    const trainsets = state.locations.reduce((s, l) => s + (l.trainsets || 0), 0);
    const set = (id, v) => { const el = $(id); if (el) el.textContent = v; };
    set('statLocations', state.locations.length);
    set('statDepots', depots);
    set('statTrainsets', trainsets);
  }

  function updateLegend() {
    const el = $('mapLegend');
    if (!el) return;
    const loc = state.locations.find(l => l.id === state.selected);
    if (state.view === 'depots' && loc) {
      const s = depotSummary(state.depots);
      el.innerHTML = `<b>${esc(loc.org)} · ${esc(loc.city)}</b>` +
        Object.keys(DEPOT_STATUS).map(k =>
          `<span><i style="background:${DEPOT_STATUS[k].color}"></i>${DEPOT_STATUS[k].label} ${s.counts[k] || 0}</span>`).join('');
      el.classList.add('expanded');
    } else {
      el.innerHTML = `<b>BEML Metro Business Map</b>` +
        `<span><i style="background:#F59E0B"></i>BEML HQ</span>` +
        `<span><i style="background:#14B8A6"></i>Metro location</span>` +
        `<span><i style="background:#94A3B8"></i>Delivery corridor</span>`;
      el.classList.remove('expanded');
    }
  }

  function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function el(tag, cls, html) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }

  // ═══════════════ side panel: locations → depots ═══════════════
  function renderSidePanel() {
    const wrap = $('locationCards');
    if (!wrap) return;
    const loc = state.locations.find(l => l.id === state.selected);
    const heading = $('mapHeading'), sub = $('mapSub');
    if (heading) {
      heading.innerHTML = loc
        ? `${esc(loc.org)} <em>${esc(loc.city)}</em> depots`
        : `Select your <em>BEML</em> location`;
    }
    if (sub) {
      sub.textContent = loc
        ? `${loc.name} · ${state.depots.length} depot${state.depots.length === 1 ? '' : 's'} carrying ${loc.trainsets} trainsets`
        : 'Pick a city on the 3D map to see every BEML depot there — delivered, in delivery and planned rolling stock.';
    }
    wrap.innerHTML = '';

    if (!loc) {
      for (const l of state.locations) {
        const card = el('div', 'loc-card' + (state.selected === l.id ? ' selected' : ''), `
          <h4>${esc(l.code)} ${l.hq ? '<span class="hq-badge">HQ</span>' : ''}</h4>
          <div class="loc-city">${esc(l.name)} · ${esc(l.city)}, ${esc(l.state || '')}</div>
          <div class="loc-meta">
            <span><b>${(l.depots || []).length}</b> depots</span>
            <span><b>${l.trainsets || 0}</b> trainsets</span>
            <span><b>${(l.projects || []).length}</b> projects</span>
          </div>`);
        card.style.setProperty('--loc', l.color || '#0D9488');
        card.onclick = () => selectLocation(l.id);
        wrap.appendChild(card);
      }
      return;
    }

    const back = el('button', 'map-back depot-back', '← All locations');
    back.type = 'button';
    back.onclick = () => clearLocation();
    wrap.appendChild(back);

    if (!state.depots.length) {
      wrap.appendChild(el('div', 'depot-empty', 'Depot list needs a live connection. Reconnecting…'));
      return;
    }

    const s = depotSummary(state.depots);
    const summary = el('div', 'depot-summary', `
      <div class="depot-summary-top"><b>${s.delivered}</b> of <b>${s.total}</b> trainsets delivered
        <span>${s.pct}%</span></div>
      <div class="depot-bar"><i style="width:${s.pct}%"></i></div>
      <div class="depot-chips">
        ${Object.keys(DEPOT_STATUS).map(k => `<span class="chip s-${k}"><i></i>${DEPOT_STATUS[k].label} ${s.counts[k] || 0}</span>`).join('')}
      </div>
      <button type="button" class="depot-continue">Continue with ${esc(loc.org)} · ${esc(loc.city)} →</button>`);        summary.style.setProperty('--loc', loc.color || '#0D9488');
    summary.querySelector('.depot-continue').onclick = () => openDrawer(loc, null);
    wrap.appendChild(summary);

    for (const d of state.depots) {
      const meta = DEPOT_STATUS[d.status] || DEPOT_STATUS.delivered;
      const card = el('div', 'loc-card depot-card' + (state.selectedDepot === d.id ? ' selected' : ''), `
        <h4>${esc(d.name)}</h4>
        <div class="loc-city">${esc(d.line)}</div>
        <div class="loc-meta">
          <span class="chip s-${d.status}"><i></i>${meta.label}</span>
          <span><b>${d.delivered}</b> delivered</span>
          <span><b>${d.toDeliver}</b> to deliver</span>
        </div>`);
      card.style.setProperty('--loc', meta.color);
      card.onclick = () => selectDepot(d.id);
      wrap.appendChild(card);
    }
  }

  // fly the camera to a flat map point at a given zoom
  function flyTo(fx, fy, k, dur) {
    tween({ from: mapView.fx, to: fx, dur, ease: easeInOut, onUpdate: v => mapView.fx = v });
    tween({ from: mapView.fy, to: fy, dur, ease: easeInOut, onUpdate: v => mapView.fy = v });
    tween({ from: mapView.k, to: k, dur, ease: easeInOut, onUpdate: v => mapView.k = v });
  }

  // zoom that fits a location's depot cluster in frame
  function zoomForDepots(loc) {
    const pts = (loc.depots && loc.depots.length ? loc.depots : [loc]).map(d => mapProj.project(d.lng, d.lat));
    const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
    const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
    const r = Math.max(0.6, ...pts.map(p => Math.hypot(p.x - cx, p.y - cy)));
    const target = Math.min(mapFrame.w, mapFrame.h) * 0.34;
    return { cx, cy, k: Math.max(1.2, Math.min(CAM.maxK, target / r)) };
  }

  function selectLocation(id) {
    const loc = state.locations.find(l => l.id === id);
    if (!loc) return;
    state.selected = id;
    state.selectedDepot = null;
    state.view = 'depots';
    state.depots = loc.depots || [];
    state.enteringDepotsAt = performance.now();
    if (mapProj) {
      const t = zoomForDepots(loc);
      flyTo(t.cx, t.cy, t.k, 1000);
    }
    renderSidePanel();
    updateLegend();
  }

  function selectDepot(id) {
    const d = state.depots.find(x => x.id === id);
    const loc = state.locations.find(l => l.id === state.selected);
    if (!d || !loc) return;
    state.selectedDepot = id;
    renderSidePanel();
    openDrawer(loc, d);
  }

  function clearLocation() {
    closeDrawer();
    state.selected = null;
    state.selectedDepot = null;
    state.view = 'locations';
    state.depots = [];
    if (mapProj) {
      const mid = mapProj.project((MAP_BOX.lng0 + MAP_BOX.lng1) / 2, (MAP_BOX.lat0 + MAP_BOX.lat1) / 2);
      flyTo(mid.x, mid.y, 1, 750);
    }
    renderSidePanel();
    updateLegend();
  }

  // ═══════════════ auth drawer ═══════════════
  function openDrawer(loc, depot) {
    const d = $('authDrawer');
    if (!d) return;        d.style.setProperty('--loc', (depot && (DEPOT_STATUS[depot.status] || {}).color) || loc.color || '#0D9488');
    $('authLocOrg').textContent = loc.org;
    $('authLocName').textContent = depot ? depot.name : loc.name;
    $('authLocCity').textContent = depot
      ? `${depot.line} · ${loc.city}, ${loc.state || 'India'}`
      : `${loc.city}, ${loc.state || 'India'} · ${loc.role || ''}`;
    const depotLine = $('authLocDepot');
    if (depotLine) {
      depotLine.style.display = depot ? 'flex' : 'none';
      depotLine.innerHTML = depot
        ? `<i></i>${esc((DEPOT_STATUS[depot.status] || {}).label || '')} · ${depot.delivered}/${depot.trainsets} trainsets`
        : '';
    }
    $('authLocProjects').innerHTML = (loc.projects || []).slice(0, 5).map(p => `<span>${esc(p)}</span>`).join('');
    $('regLocChip').textContent = depot ? `${loc.org} · ${depot.name}` : `${loc.org} · ${loc.city}`;
    $('signinLocChip').textContent = depot ? `${loc.org} · ${depot.name}` : `${loc.org} · ${loc.city}`;
    const adminHint = $('signinAdminHint');
    if (adminHint) {
      if (depot) {
        $('signinAdminId').textContent = `${depot.id}-admin`;
        adminHint.style.display = 'block';
        $('signinUsername').value = `${depot.id}-admin`;
      } else {
        adminHint.style.display = 'none';
      }
    }
    $('authError').style.display = 'none';
    d.classList.add('open');
    switchTab('register');
    suggestUsername(loc.id);
  }

  function closeDrawer() {
    const d = $('authDrawer');
    if (d) d.classList.remove('open');
  }

  function switchTab(tab) {
    document.querySelectorAll('.auth-tabs button').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    $('formRegister').classList.toggle('active', tab === 'register');
    $('formSignin').classList.toggle('active', tab === 'signin');
    $('authError').style.display = 'none';
  }

  function authError(msg) {
    const el = $('authError');
    el.textContent = msg;
    el.style.display = 'block';
  }

  async function submitRegister(e) {
    e.preventDefault();
    const btn = $('regSubmit'), errEl = $('authError');
    const loc = state.locations.find(l => l.id === state.selected);
    if (!loc) { authError('Please pick your BEML location on the map first.'); return; }
    const payload = {
      locationId: state.selected,
      depotId: state.selectedDepot || null,
      name: $('regName').value.trim(),
      email: $('regEmail').value.trim(),
      phone: $('regPhone').value.trim(),
      staffId: $('regStaffId').value.trim(),
      password: $('regPassword').value,
      confirmPassword: $('regConfirm').value
    };
    if (payload.password !== payload.confirmPassword) {
      authError('Passwords do not match.'); return;
    }
    btn.disabled = true; btn.textContent = 'Creating your workspace…';
    errEl.style.display = 'none';
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success && data.pending) {
        // Registered, but NOT granted access yet — no token, workspace stays locked.
        showPending(data, loc);
      } else if (data.success) {
        showSuccess(data, loc, 'created');
      } else {
        authError(data.error || 'Registration failed.');
      }
    } catch {
      authError('Connection error. Please try again.');
    } finally {
      btn.disabled = false; btn.textContent = 'Create Account & Enter →';
    }
  }

  async function submitSignin(e) {
    e.preventDefault();
    const btn = $('signinSubmit'), errEl = $('authError');
    const loc = state.locations.find(l => l.id === state.selected);
    btn.disabled = true; btn.textContent = 'Signing in…';
    errEl.style.display = 'none';
    try {
      const res = await fetch('/api/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: $('signinUsername').value.trim(), password: $('signinPassword').value })
      });
      const data = await res.json();
      if (data.success) {
        showSuccess(data, loc, 'welcome');
      } else {
        authError(data.error || 'Invalid credentials.');
      }
    } catch {
      authError('Connection error. Please try again.');
    } finally {
      btn.disabled = false; btn.textContent = 'Sign In →';
    }
  }

  function showPending(data, loc) {
    const s = $('authSuccess');
    $('successTitle').textContent = 'Registration Received';
    $('successMsg').innerHTML =
      `Your BEML staff number <b style="color:#5EEAD4">${esc(data.username || '')}</b> has been registered for ` +
      `<span class="success-loc">${esc(loc?.org || 'BEML')} · ${esc(loc?.city || '')}</span>.<br><br>` +
      `<b style="color:#FBBF24">Awaiting administrator approval.</b><br>` +
      `You can sign in once an administrator permits your account. If you were denied, you can register again with the same staff number.`;
    s.classList.add('show');
    // No portalAuthenticated() call — the workspace is intentionally NOT entered.
    setTimeout(() => { s.classList.remove('show'); switchTab('signin'); }, 3200);
  }

  function showSuccess(data, loc, kind) {
    const s = $('authSuccess');
    $('successTitle').textContent = kind === 'created' ? 'Account Created' : 'Welcome Back';
    $('successMsg').innerHTML =
      (kind === 'created'
        ? `Your secure workspace for <span class="success-loc">${esc(data.org || loc?.org || '')} · ${esc(data.city || loc?.city || '')}</span> is ready.<br>User ID: <b style="color:#5EEAD4">${esc(data.username)}</b>`
        : `Signed in as <b style="color:#5EEAD4">${esc(data.name || data.username)}</b><br><span class="success-loc">${esc(data.org || '')} · ${esc(data.city || '')}</span>`)
      + (data.depot ? `<br><span class="success-loc">Depot: ${esc(data.depot)}</span>` : '');
    s.classList.add('show');
    setTimeout(() => {
      s.classList.remove('show');
      if (typeof window.portalAuthenticated === 'function') window.portalAuthenticated(data);
    }, 1500);
  }

  // ═══════════════ public API ═══════════════
  function start() {
    if (!starsCanvas) initStars();
    if (!globeCanvas) globeCanvas = $('globeCanvas');
    if (!indiaCanvas) indiaCanvas = $('indiaCanvas');
    const wasRunning = state.running;
    state.running = true;
    if (!wasRunning) {
      loadLocations();
      state.pollTimer = setInterval(loadLocations, 30000);
    }
    if (!wasRunning) { gotoStage('globe'); startCountdown(); }
    if (!animHandle) animHandle = requestAnimationFrame(loop);

    // wire once
    if (!start.wired) {
      start.wired = true;
      window.addEventListener('resize', () => {
        if (state.stage === 'map' && mapProj) {
          const fit = fitCanvas(indiaCanvas);
          if (fit) {
            const old = mapProj;
            buildMapProjection(fit.w, fit.h);
            mapView.fx = old.s ? mapView.fx * (mapProj.s / old.s) : mapView.fx;
            mapView.fy = old.s ? mapView.fy * (mapProj.s / old.s) : mapView.fy;
          }
        }
      });
      const explore = $('exploreBtn');
      if (explore) explore.onclick = advance;
      const back = $('mapBack');
      if (back) back.onclick = backToGlobe;
      const close = $('authClose');
      if (close) close.onclick = closeDrawer;
      document.querySelectorAll('.auth-tabs button').forEach(b => b.onclick = () => switchTab(b.dataset.tab));
      const reg = $('formRegister'); if (reg) reg.onsubmit = submitRegister;
      const sin = $('formSignin'); if (sin) sin.onsubmit = submitSignin;
      wirePasswordToggles();
      if (indiaCanvas) {
        const pos = (e) => {
          const r = indiaCanvas.getBoundingClientRect();
          return { x: e.clientX - r.left, y: e.clientY - r.top };
        };
        indiaCanvas.addEventListener('pointermove', (e) => {
          const p = pos(e); pointer = p;
          const hit = hitTest(p.x, p.y);
          indiaCanvas.style.cursor = hit ? 'pointer' : (state.view === 'depots' ? 'zoom-out' : 'grab');
          const tip = $('mapTooltip');
          if (!tip) return;
          if (!hit) { tip.style.display = 'none'; return; }
          tip.style.display = 'block';
          tip.style.left = p.x + 'px';
          tip.style.top = p.y + 'px';
          if (hit.kind === 'location') {
            const loc = state.locations.find(l => l.id === hit.id);
            const depots = loc.depots || [];
            tip.innerHTML = `<b>${esc(loc.code)} · ${esc(loc.city)}</b><span>${esc(loc.name)}</span>
              <i>${depots.length} depots · ${loc.trainsets || 0} trainsets · click to open</i>`;
          } else {
            const d = state.depots.find(x => x.id === hit.id);
            const meta = DEPOT_STATUS[d.status] || DEPOT_STATUS.delivered;
            tip.innerHTML = `<b>${esc(d.name)}</b><span>${esc(d.line)}</span>
              <i>${meta.label} · ${d.delivered}/${d.trainsets} trainsets · click to sign in</i>`;
          }
        });
        indiaCanvas.addEventListener('pointerleave', () => {
          const tip = $('mapTooltip'); if (tip) tip.style.display = 'none';
        });
        indiaCanvas.addEventListener('click', (e) => {
          const p = pos(e);
          const hit = hitTest(p.x, p.y);
          if (!hit) { if (state.view === 'depots') clearLocation(); return; }
          if (hit.kind === 'location') selectLocation(hit.id);
          else selectDepot(hit.id);
        });
      }
      document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
        if ($('authDrawer')?.classList.contains('open')) closeDrawer();
        else if (state.stage === 'map' && state.view === 'depots') clearLocation();
      });
    }
  }

  function wirePasswordToggles() {
    document.querySelectorAll('.pw-toggle').forEach(btn => {
      btn.onclick = () => {
        const input = btn.parentElement.querySelector('input');
        if (!input) return;
        const show = input.type === 'password';
        input.type = show ? 'text' : 'password';
        btn.textContent = show ? '🙈' : '👁';
      };
    });
    const pw = $('regPassword'), meter = $('pwStrength');
    if (pw && meter) {
      pw.addEventListener('input', () => {
        const v = pw.value;
        let score = 0;
        if (v.length >= 8) score++;
        if (/[A-Z]/.test(v) && /[a-z]/.test(v)) score++;
        if (/\d/.test(v)) score++;
        if (/[^A-Za-z0-9]/.test(v) || v.length >= 12) score++;
        meter.className = 'pw-strength' + (v ? ' s' + score : '');
      });
    }
  }

  function stop() {
    state.running = false;
    stopCountdown();
    if (state.pollTimer) { clearInterval(state.pollTimer); state.pollTimer = null; }
    cancelTweens();
    if (animHandle) { cancelAnimationFrame(animHandle); animHandle = null; }
  }

  function reset() {
    stop();
    cancelTweens();
    state.selected = null;
    state.selectedDepot = null;
    state.view = 'locations';
    state.depots = [];
    globeR = 0; globeAdvancing = false;
    closeDrawer();
    document.querySelectorAll('.auth-form input').forEach(i => { i.value = ''; });
    const meter = $('pwStrength'); if (meter) meter.className = 'pw-strength';
    gotoStage('globe');
    start();
  }

  window.DocVaultPortal = { start, stop, reset, selectLocation, selectDepot };

  document.addEventListener('DOMContentLoaded', () => {
    globeCanvas = $('globeCanvas');
    indiaCanvas = $('indiaCanvas');
    start();
  });
})();
