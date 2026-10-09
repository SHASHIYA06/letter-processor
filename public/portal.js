// ══════════════════════════════════════════════════════════════
//  DocVault Pre-Login Portal
//  Stage 1: rotating dot-matrix globe  →  Stage 2: India map with
//  live BEML metro business locations  →  Stage 3: location-scoped
//  account creation / sign-in
// ══════════════════════════════════════════════════════════════
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);

  // Offline fallback (mirrors server locations.js)
  const FALLBACK_LOCATIONS = [
    { id: 'beml-bengaluru-hq', org: 'BEML', code: 'BEML', name: 'BEML South Complex', city: 'Bengaluru', state: 'Karnataka', lat: 12.9955, lng: 77.6350, hq: true, color: '#F59E0B', projects: ['Metro Rolling Stock Manufacturing'], trainsets: 420, users: 0, letters: 0 },
    { id: 'bmrcl-bengaluru', org: 'BMRCL', code: 'BMRCL', name: 'BMRCL Metro Depot', city: 'Bengaluru', state: 'Karnataka', lat: 12.9960, lng: 77.6820, color: '#8B5CF6', projects: ['Bangalore Metro Phase 1 & 2'], trainsets: 214, users: 0, letters: 0 },
    { id: 'kmrcl-kolkata', org: 'KMRCL', code: 'KMRCL', name: 'KMRCL East-West Depot', city: 'Kolkata', state: 'West Bengal', lat: 22.5697, lng: 88.4330, color: '#3B82F6', projects: ['Kolkata Metro East-West RS-3R'], trainsets: 168, users: 0, letters: 0 },
    { id: 'dmcrl-delhi', org: 'DMCRL', code: 'DMCRL', name: 'Delhi Metro Operations', city: 'New Delhi', state: 'Delhi', lat: 28.6139, lng: 77.2090, color: '#10B981', projects: ['Delhi Metro Rolling Stock'], trainsets: 340, users: 0, letters: 0 },
    { id: 'mmrcl-mumbai', org: 'MMRCL', code: 'MMRCL', name: 'Mumbai Metro Aqua Line', city: 'Mumbai', state: 'Maharashtra', lat: 19.0760, lng: 72.8777, color: '#06B6D4', projects: ['Mumbai Metro Line 3 Trainsets'], trainsets: 95, users: 0, letters: 0 },
    { id: 'cmrcl-chennai', org: 'CMRCL', code: 'CMRCL', name: 'Chennai Metro Depot', city: 'Chennai', state: 'Tamil Nadu', lat: 13.0827, lng: 80.2707, color: '#EF4444', projects: ['Chennai Metro Phase 2 Rolling Stock'], trainsets: 120, users: 0, letters: 0 }
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
  function cancelTweens() { activeTweens.forEach(t => t.cancelled = true); activeTweens.clear(); }

  // ═══════════════ state ═══════════════
  const state = {
    running: false,
    stage: 'globe',          // globe | map
    locations: FALLBACK_LOCATIONS.map(l => ({ ...l })),
    selected: null,
    live: { users: 0, ncr: 0 },
    pollTimer: null,
    countdownTimer: null,
    countdown: 10,
    enteringMapAt: 0
  };

  let starsCanvas, starsCtx, globeCanvas, globeCtx, indiaCanvas, indiaCtx;
  let landDots = null;
  let rotLon = 0.6, tilt = -0.32, globeR = 0, globeAdvancing = false;
  let animHandle = null;
  let mapView = { k: 1, fx: 0, fy: 0 };
  let mapProj = null;         // {project(lng,lat)->{x,y}, unproject(x,y)}
  let mapHover = null;
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

  // ═══════════════ India map ═══════════════
  const MAP_BOX = { lng0: 66.5, lng1: 97.5, lat0: 6.0, lat1: 37.5 };
  const LAT_STRETCH = 1.18;

  function buildMapProjection(w, h) {
    const pad = Math.min(w, h) * 0.07;
    const bw = MAP_BOX.lng1 - MAP_BOX.lng0;
    const bh = (MAP_BOX.lat1 - MAP_BOX.lat0) * LAT_STRETCH;
    const s = Math.min((w - 2 * pad) / bw, (h - 2 * pad) / bh);
    const ox = (w - bw * s) / 2, oy = (h - bh * s) / 2;
    mapProj = {
      s,
      project(lng, lat) {
        return { x: ox + (lng - MAP_BOX.lng0) * s, y: oy + (MAP_BOX.lat1 - lat) * LAT_STRETCH * s };
      },
      unproject(px, py) {
        return { lng: (px - ox) / s + MAP_BOX.lng0, lat: MAP_BOX.lat1 - (py - oy) / (s * LAT_STRETCH) }
      }
    };
    return mapProj;
  }

  // view transform: screen = (map - focus) * k + canvasCenter
  function toScreen(p, w, h) {
    return { x: (p.x - mapView.fx) * mapView.k + w / 2, y: (p.y - mapView.fy) * mapView.k + h / 2 };
  }
  function toMap(px, py, w, h) {
    return { x: (px - w / 2) / mapView.k + mapView.fx, y: (py - h / 2) / mapView.k + mapView.fy };
  }

  const CITY_DOTS = [
    { name: 'Delhi', lat: 28.61, lng: 77.21 }, { name: 'Mumbai', lat: 19.08, lng: 72.88 },
    { name: 'Kolkata', lat: 22.57, lng: 88.36 }, { name: 'Chennai', lat: 13.08, lng: 80.27 },
    { name: 'Bengaluru', lat: 12.97, lng: 77.59 }, { name: 'Hyderabad', lat: 17.39, lng: 78.49 },
    { name: 'Ahmedabad', lat: 23.02, lng: 72.57 }, { name: 'Pune', lat: 18.52, lng: 73.86 }
  ];

  function drawIndia(t) {
    const fit = fitCanvas(indiaCanvas);
    if (!fit || !mapProj) return;
    const { ctx, w, h } = fit;
    ctx.clearRect(0, 0, w, h);

    const age = t - state.enteringMapAt;
    const drawP = Math.min(1, age / 1400);
    const pathLen = INDIA_OUTLINE.reduce((acc, p, i, arr) => {
      if (i === 0) return 0;
      const a = mapProj.project(arr[i - 1][0], arr[i - 1][1]);
      const b = mapProj.project(p[0], p[1]);
      return acc + Math.hypot(b.x - a.x, b.y - a.y);
    }, 0);

    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.scale(mapView.k, mapView.k);
    ctx.translate(-mapView.fx, -mapView.fy);

    // subtle dot grid inside canvas bounds
    const tl = toMap(0, 0, w, h), br = toMap(w, h, w, h);
    ctx.fillStyle = 'rgba(96,165,250,0.05)';
    for (let x = Math.floor(tl.x / 26) * 26; x < br.x; x += 26) {
      for (let y = Math.floor(tl.y / 26) * 26; y < br.y; y += 26) {
        ctx.beginPath(); ctx.arc(x, y, 1, 0, Math.PI * 2); ctx.fill();
      }
    }

    // India polygon
    const first = mapProj.project(INDIA_OUTLINE[0][0], INDIA_OUTLINE[0][1]);
    ctx.beginPath();
    ctx.moveTo(first.x, first.y);
    for (let i = 1; i < INDIA_OUTLINE.length; i++) {
      const p = mapProj.project(INDIA_OUTLINE[i][0], INDIA_OUTLINE[i][1]);
      ctx.lineTo(p.x, p.y);
    }
    ctx.closePath();

    const bbox = INDIA_OUTLINE.reduce((b, [lng, lat]) => {
      const p = mapProj.project(lng, lat);
      b.x0 = Math.min(b.x0, p.x); b.x1 = Math.max(b.x1, p.x);
      b.y0 = Math.min(b.y0, p.y); b.y1 = Math.max(b.y1, p.y);
      return b;
    }, { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity });
    const grad = ctx.createLinearGradient(bbox.x0, bbox.y0, bbox.x1, bbox.y1);
    grad.addColorStop(0, `rgba(37,99,235,${(0.16 * drawP).toFixed(3)})`);
    grad.addColorStop(0.55, `rgba(99,102,241,${(0.20 * drawP).toFixed(3)})`);
    grad.addColorStop(1, `rgba(6,182,212,${(0.16 * drawP).toFixed(3)})`);
    ctx.fillStyle = grad;
    ctx.fill();

    // animated outline draw-in
    ctx.strokeStyle = `rgba(125,211,252,${(0.55 + 0.35 * drawP).toFixed(3)})`;
    ctx.lineWidth = 1.6;
    ctx.setLineDash([pathLen, pathLen]);
    ctx.lineDashOffset = pathLen * (1 - drawP);
    ctx.shadowColor = 'rgba(56,189,248,0.55)';
    ctx.shadowBlur = 12;
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.setLineDash([]);

    // connection arcs HQ → each location
    const hq = state.locations.find(l => l.hq) || state.locations[0];
    if (hq) {
      const a = mapProj.project(hq.lng, hq.lat);
      state.locations.forEach((loc, i) => {
        if (loc.id === hq.id) return;
        const appear = Math.min(1, Math.max(0, (age - 1500 - i * 160) / 900));
        if (appear <= 0) return;
        const b = mapProj.project(loc.lng, loc.lat);
        const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2 - Math.hypot(b.x - a.x, b.y - a.y) * 0.22;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.quadraticCurveTo(mx, my, b.x, b.y);
        ctx.strokeStyle = `rgba(148,163,184,${(0.22 * appear).toFixed(3)})`;
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 6]);
        ctx.lineDashOffset = -t * 0.02;
        ctx.stroke();
        ctx.setLineDash([]);
      });
    }

    // city dots (context)
    ctx.font = '9px Inter, sans-serif';
    for (const c of CITY_DOTS) {
      if (state.locations.some(l => l.city === c.name)) continue;
      const p = mapProj.project(c.lng, c.lat);
      ctx.fillStyle = 'rgba(148,163,184,0.35)';
      ctx.beginPath(); ctx.arc(p.x, p.y, 1.8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(148,163,184,0.4)';
      ctx.fillText(c.name, p.x + 5, p.y + 3);
    }

    // BEML location markers
    state.locations.forEach((loc, i) => {
      const appear = Math.min(1, Math.max(0, (age - 900 - i * 130) / 500));
      if (appear <= 0) return;
      const p = mapProj.project(loc.lng, loc.lat);
      const isSel = state.selected === loc.id;
      const pulse = 0.5 + 0.5 * Math.sin(t * 0.003 + i * 1.4);

      // pulse ring
      ctx.beginPath();
      ctx.arc(p.x, p.y, (8 + pulse * 10) * appear, 0, Math.PI * 2);
      ctx.strokeStyle = hexA(loc.color, (0.5 - pulse * 0.32) * appear);
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // marker
      ctx.beginPath();
      ctx.arc(p.x, p.y, (isSel ? 6.5 : 4.6) * appear, 0, Math.PI * 2);
      ctx.fillStyle = hexA(loc.color, appear);
      ctx.shadowColor = loc.color;
      ctx.shadowBlur = isSel ? 18 : 10;
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.arc(p.x, p.y, ((isSel ? 6.5 : 4.6) + 3) * appear, 0, Math.PI * 2);
      ctx.strokeStyle = hexA('#ffffff', 0.5 * appear);
      ctx.lineWidth = 1;
      ctx.stroke();

      // label
      const labelA = Math.min(1, Math.max(0, (age - 1300 - i * 130) / 500));
      if (labelA > 0) {
        ctx.font = `${isSel ? '700' : '600'} ${isSel ? 12 : 10.5}px Inter, sans-serif`;
        ctx.fillStyle = `rgba(241,245,249,${(0.92 * labelA).toFixed(3)})`;
        ctx.shadowColor = 'rgba(0,0,0,0.9)';
        ctx.shadowBlur = 6;
        ctx.fillText(loc.code, p.x + 11, p.y - 6);
        ctx.font = `500 8.5px Inter, sans-serif`;
        ctx.fillStyle = `rgba(148,163,184,${(0.75 * labelA).toFixed(3)})`;
        ctx.fillText(loc.city.toUpperCase(), p.x + 11, p.y + 5);
        ctx.shadowBlur = 0;
      }
    });

    ctx.restore();

    // title watermark
    ctx.font = '700 12px Inter, sans-serif';
    ctx.fillStyle = 'rgba(148,163,184,0.35)';
    ctx.textAlign = 'center';
    ctx.fillText('BEML METRO BUSINESS MAP · INDIA', w / 2, h - 16);
    ctx.textAlign = 'left';
  }

  function hexA(hex, a) {
    const h = hex.replace('#', '');
    const r = parseInt(h.substring(0, 2), 16), g = parseInt(h.substring(2, 4), 16), b = parseInt(h.substring(4, 6), 16);
    return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, a)).toFixed(3)})`;
  }

  function markerAt(px, py) {
    if (!mapProj) return null;
    const fit = fitCanvas(indiaCanvas);
    if (!fit) return null;
    const { w, h } = fit;
    const m = toMap(px, py, w, h);
    for (const loc of state.locations) {
      const p = mapProj.project(loc.lng, loc.lat);
      if (Math.hypot(p.x - m.x, p.y - m.y) < 13 / mapView.k) return loc;
    }
    return null;
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
        if (fit) {
          buildMapProjection(fit.w, fit.h);
          const c = mapProj.unproject(fit.w / 2, fit.h / 2);
          mapView = { k: 1, fx: (mapProj.project(c.lng, c.lat).x), fy: (mapProj.project(c.lng, c.lat).y) };
          const mid = mapProj.project((MAP_BOX.lng0 + MAP_BOX.lng1) / 2, (MAP_BOX.lat0 + MAP_BOX.lat1) / 2);
          mapView.fx = mid.x; mapView.fy = mid.y;
        }
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
  const easeIn = (p) => p * p * p;

  function backToGlobe() {
    closeDrawer();
    globeR = 0;
    gotoStage('globe');
    startCountdown();
  }

  // ═══════════════ locations UI ═══════════════
  async function loadLocations() {
    try {
      const res = await fetch('/api/locations');
      const data = await res.json();
      if (data.success && Array.isArray(data.locations) && data.locations.length) {
        state.locations = data.locations;
        state.live.users = data.totalUsers || 0;
        state.live.ncr = data.ncrCount || 0;
      }
    } catch { /* keep fallback */ }
    renderLocationCards();
    renderLiveBadge();
  }

  function renderLiveBadge() {
    const badge = $('mapLive');
    if (!badge) return;
    const totalUsers = state.locations.reduce((s, l) => s + (l.users || 0), 0) || state.live.users;
    badge.innerHTML = `<span class="live-dot"></span>LIVE · ${state.locations.length} LOCATIONS · ${totalUsers} USERS`;
  }

  function renderLocationCards() {
    const wrap = $('locationCards');
    if (!wrap) return;
    wrap.innerHTML = '';
    for (const loc of state.locations) {
      const card = document.createElement('div');
      card.className = 'loc-card' + (state.selected === loc.id ? ' selected' : '');
      card.style.setProperty('--loc', loc.color || '#2563EB');
      card.innerHTML = `
        <h4>${esc(loc.code)} ${loc.hq ? '<span class="hq-badge">HQ</span>' : ''}</h4>
        <div class="loc-city">${esc(loc.name)} · ${esc(loc.city)}, ${esc(loc.state || '')}</div>
        <div class="loc-meta">
          <span><b>${loc.users || 0}</b> users</span>
          <span><b>${loc.letters || 0}</b> letters</span>
          <span><b>${(loc.projects || []).length}</b> projects</span>
        </div>`;
      card.onclick = () => selectLocation(loc.id);
      wrap.appendChild(card);
    }
  }

  function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function selectLocation(id) {
    const loc = state.locations.find(l => l.id === id);
    if (!loc) return;
    state.selected = id;
    renderLocationCards();

    // fly the camera to the marker
    const fit = fitCanvas(indiaCanvas);
    if (fit && mapProj) {
      const p = mapProj.project(loc.lng, loc.lat);
      tween({ from: mapView.fx, to: p.x, dur: 900, ease: easeInOut, onUpdate: v => mapView.fx = v });
      tween({ from: mapView.fy, to: p.y, dur: 900, ease: easeInOut, onUpdate: v => mapView.fy = v });
      tween({ from: mapView.k, to: 1.55, dur: 900, ease: easeInOut, onUpdate: v => mapView.k = v });
    }

    openDrawer(loc);
  }

  // ═══════════════ auth drawer ═══════════════
  function openDrawer(loc) {
    const d = $('authDrawer');
    if (!d) return;
    d.style.setProperty('--loc', loc.color || '#2563EB');
    $('authLocOrg').textContent = loc.org;
    $('authLocName').textContent = loc.name;
    $('authLocCity').textContent = `${loc.city}, ${loc.state || 'India'} · ${loc.role || ''}`;
    $('authLocProjects').innerHTML = (loc.projects || []).slice(0, 5).map(p => `<span>${esc(p)}</span>`).join('');
    $('regLocChip').textContent = `${loc.org} · ${loc.city}`;
    $('signinLocChip').textContent = `${loc.org} · ${loc.city}`;
    $('authError').style.display = 'none';
    d.classList.add('open');
    switchTab('register');
    suggestUsername(loc.id);
  }

  function closeDrawer() {
    const d = $('authDrawer');
    if (d) d.classList.remove('open');
    state.selected = null;
    renderLocationCards();
    // ease camera back out
    if (mapProj) {
      const mid = mapProj.project((MAP_BOX.lng0 + MAP_BOX.lng1) / 2, (MAP_BOX.lat0 + MAP_BOX.lat1) / 2);
      tween({ from: mapView.fx, to: mid.x, dur: 700, ease: easeInOut, onUpdate: v => mapView.fx = v });
      tween({ from: mapView.fy, to: mid.y, dur: 700, ease: easeInOut, onUpdate: v => mapView.fy = v });
      tween({ from: mapView.k, to: 1, dur: 700, ease: easeInOut, onUpdate: v => mapView.k = v });
    }
  }

  function switchTab(tab) {
    document.querySelectorAll('.auth-tabs button').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    $('formRegister').classList.toggle('active', tab === 'register');
    $('formSignin').classList.toggle('active', tab === 'signin');
    $('authError').style.display = 'none';
  }

  async function suggestUsername(locationId) {
    const input = $('regUsername');
    if (!input) return;
    try {
      const res = await fetch(`/api/auth/username-suggest?locationId=${encodeURIComponent(locationId)}`);
      const data = await res.json();
      if (data.success && data.username) input.value = data.username;
    } catch { /* leave as-is */ }
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
    const payload = {
      locationId: state.selected,
      name: $('regName').value.trim(),
      email: $('regEmail').value.trim(),
      phone: $('regPhone').value.trim(),
      username: $('regUsername').value.trim(),
      password: $('regPassword').value,
      confirmPassword: $('regConfirm').value
    };
    if (payload.password !== payload.confirm) {
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
      if (data.success) {
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

  function showSuccess(data, loc, kind) {
    const s = $('authSuccess');
    $('successTitle').textContent = kind === 'created' ? 'Account Created' : 'Welcome Back';
    $('successMsg').innerHTML =
      (kind === 'created'
        ? `Your secure workspace for <span class="success-loc">${esc(data.org || loc?.org || '')} · ${esc(data.city || loc?.city || '')}</span> is ready.<br>User ID: <b style="color:#93C5FD">${esc(data.username)}</b>`
        : `Signed in as <b style="color:#93C5FD">${esc(data.name || data.username)}</b><br><span class="success-loc">${esc(data.org || '')} · ${esc(data.city || '')}</span>`);
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
    if (state.stage === 'map' && state.selected) { /* keep */ }
    else if (!wasRunning) { gotoStage('globe'); startCountdown(); }
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
      const sugg = $('regUsernameSuggest');
      if (sugg) sugg.onclick = () => suggestUsername(state.selected);
      // password toggles + strength
      wirePasswordToggles();
      // canvas interaction
      if (indiaCanvas) {
        indiaCanvas.addEventListener('pointermove', (e) => {
          const r = indiaCanvas.getBoundingClientRect();
          pointer.x = e.clientX - r.left; pointer.y = e.clientY - r.top;
          const loc = markerAt(pointer.x, pointer.y);
          mapHover = loc;
          indiaCanvas.style.cursor = loc ? 'pointer' : 'grab';
          const tip = $('mapTooltip');
          if (loc && tip) {
            tip.style.display = 'block';
            tip.style.left = (e.clientX - r.left) + 'px';
            tip.style.top = (e.clientY - r.top) + 'px';
            tip.innerHTML = `<b>${esc(loc.code)} · ${esc(loc.city)}</b><span>${esc(loc.name)}</span><i>${loc.users || 0} users · ${loc.letters || 0} letters · click to select</i>`;
          } else if (tip) tip.style.display = 'none';
        });
        indiaCanvas.addEventListener('pointerleave', () => {
          mapHover = null;
          const tip = $('mapTooltip'); if (tip) tip.style.display = 'none';
        });
        indiaCanvas.addEventListener('click', (e) => {
          const r = indiaCanvas.getBoundingClientRect();
          const loc = markerAt(e.clientX - r.left, e.clientY - r.top);
          if (loc) selectLocation(loc.id);
        });
      }
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && state.stage === 'map' && state.selected) closeDrawer();
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
    globeR = 0; globeAdvancing = false;
    closeDrawer();
    document.querySelectorAll('.auth-form input').forEach(i => { i.value = ''; });
    const meter = $('pwStrength'); if (meter) meter.className = 'pw-strength';
    gotoStage('globe');
    start();
  }

  window.DocVaultPortal = { start, stop, reset, selectLocation };

  document.addEventListener('DOMContentLoaded', () => {
    globeCanvas = $('globeCanvas');
    indiaCanvas = $('indiaCanvas');
    start();
  });
})();
