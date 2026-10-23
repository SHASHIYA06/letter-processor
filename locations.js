// ══════════════════════════════════════════════════════════════
//  BEML METRO BUSINESS LOCATIONS REGISTRY
//  Location-wise master data for the pre-login portal & user DB
// ══════════════════════════════════════════════════════════════

export const BEML_LOCATIONS = [
  {
    id: 'beml-bengaluru-hq',
    org: 'BEML',
    code: 'BEML',
    userPrefix: 'beml',
    name: 'BEML South Complex',
    site: 'BEML Township, K.R. Puram',
    city: 'Bengaluru',
    state: 'Karnataka',
    lat: 12.9955,
    lng: 77.6350,
    hq: true,
    color: '#F59E0B',
    established: 1964,
    role: 'Corporate HQ & Rolling Stock Manufacturing',
    projects: [
      'Metro Rolling Stock Manufacturing',
      'Project Management & Engineering',
      'Metro Train Testing & Commissioning'
    ],
    // Manufacturing units & yards (delivered / still to deliver)
    depots: [
      { id: 'beml-rail-complex', name: 'BEML Rail & Metro Complex', line: 'K.R. Puram · Rolling Stock Manufacturing', city: 'Bengaluru', lat: 12.9965, lng: 77.6620, delivered: 300, toDeliver: 34 },
      { id: 'beml-test-track', name: 'BEML Test Track & Commissioning Yard', line: 'Athipalayam · Static & Dynamic Testing', city: 'Bengaluru', lat: 13.0080, lng: 77.6500, delivered: 74, toDeliver: 0 },
      { id: 'beml-spares-hub', name: 'BEML Spares & Retrofit Hub', line: 'Bengaluru · Overhaul, Spares & Field Support', city: 'Bengaluru', lat: 12.9800, lng: 77.6450, delivered: 12, toDeliver: 0 }
    ],
    trainsets: 420,
    emailDomain: 'beml.co.in'
  },
  {
    id: 'bmrcl-bengaluru',
    org: 'BMRCL',
    code: 'BMRCL',
    userPrefix: 'bmrcl',
    name: 'BMRCL Metro Depot',
    site: 'Baiyappanahalli Depot, Purple Line',
    city: 'Bengaluru',
    state: 'Karnataka',
    lat: 12.9960,
    lng: 77.6820,
    color: '#8B5CF6',
    established: 2011,
    role: 'Bangalore Metro Rolling Stock Support',
    projects: [
      'Bangalore Metro Phase 1 (Purple & Green Lines)',
      'Bangalore Metro Phase 2 (KR Puram–Whitefield)',
      'Bangalore Metro Phase 3 Corridor Support'
    ],
    depots: [
      { id: 'bmrcl-baiyappanahalli', name: 'Baiyappanahalli Depot', line: 'Purple Line (East–West)', city: 'Bengaluru', lat: 12.9905, lng: 77.6800, delivered: 96, toDeliver: 0 },
      { id: 'bmrcl-peenya', name: 'Peenya Depot', line: 'Green Line (North–South)', city: 'Bengaluru', lat: 13.0300, lng: 77.5200, delivered: 70, toDeliver: 0 },
      { id: 'bmrcl-kadugodi', name: 'Kadugodi (Whitefield) Depot', line: 'Phase 2 · Yellow Line', city: 'Bengaluru', lat: 12.9900, lng: 77.7500, delivered: 28, toDeliver: 20 }
    ],
    trainsets: 214,
    emailDomain: 'beml.co.in'
  },
  {
    id: 'kmrcl-kolkata',
    org: 'KMRCL',
    code: 'KMRCL',
    userPrefix: 'kmrcl',
    name: 'KMRCL East-West Depot',
    site: 'Salt Lake Sector V, Kolkata Metro East-West',
    city: 'Kolkata',
    state: 'West Bengal',
    lat: 22.5697,
    lng: 88.4330,
    color: '#3B82F6',
    established: 2019,
    role: 'Kolkata Metro East-West Corridor (RS-3R)',
    projects: [
      'KMRCL RS-3R Phase 1',
      'KMRCL RS-3R Phase 2',
      'KMRCL RS-3R Phase 3',
      'Howrah–Salt Lake Link Corridor'
    ],
    depots: [
      { id: 'kmrcl-central-park', name: 'Central Park Depot', line: 'East–West Metro · Salt Lake', city: 'Kolkata', lat: 22.5850, lng: 88.4100, delivered: 84, toDeliver: 12 },
      { id: 'kmrcl-howrah-maidan', name: 'Howrah Maidan Stabling Yard', line: 'East–West Metro · Howrah', city: 'Kolkata', lat: 22.5850, lng: 88.3300, delivered: 54, toDeliver: 0 },
      { id: 'kmrcl-noapara', name: 'Noapara Car Shed', line: 'Blue Line · Rolling Stock Support', city: 'Kolkata', lat: 22.6600, lng: 88.3800, delivered: 18, toDeliver: 0 }
    ],
    trainsets: 168,
    emailDomain: 'beml.co.in'
  },
  {
    id: 'dmcrl-delhi',
    org: 'DMCRL',
    code: 'DMCRL',
    userPrefix: 'dmcrl',
    name: 'Delhi Metro Operations',
    site: 'Magenta Line Operations Control, New Delhi',
    city: 'New Delhi',
    state: 'Delhi',
    lat: 28.6139,
    lng: 77.2090,
    color: '#10B981',
    established: 2015,
    role: 'Delhi Metro Rolling Stock Operations',
    projects: [
      'Delhi Metro Magenta Line Fleet',
      'Delhi Metro Phase 3 Fleet Support',
      'Delhi Metro Phase 4 Rolling Stock'
    ],
    depots: [
      { id: 'dmcrl-najafgarh', name: 'Najafgarh Depot', line: 'Magenta Line', city: 'New Delhi', lat: 28.5700, lng: 76.9500, delivered: 132, toDeliver: 0 },
      { id: 'dmcrl-kalindi-kunj', name: 'Kalindi Kunj Depot', line: 'Magenta Line', city: 'New Delhi', lat: 28.5400, lng: 77.3100, delivered: 96, toDeliver: 0 },
      { id: 'dmcrl-mundka', name: 'Mundka Depot', line: 'Green Line', city: 'New Delhi', lat: 28.6800, lng: 77.0300, delivered: 68, toDeliver: 0 },
      { id: 'dmcrl-phase4', name: 'Phase 4 Stabling (Janakpuri West)', line: 'Phase 4 · New Corridors', city: 'New Delhi', lat: 28.6300, lng: 77.0800, delivered: 0, toDeliver: 44 }
    ],
    trainsets: 340,
    emailDomain: 'beml.co.in'
  },
  {
    id: 'mmrcl-mumbai',
    org: 'MMRCL',
    code: 'MMRCL',
    userPrefix: 'mmrcl',
    name: 'Mumbai Metro Aqua Line',
    site: 'Line 3 (Aqua) Depot, Mumbai',
    city: 'Mumbai',
    state: 'Maharashtra',
    lat: 19.0760,
    lng: 72.8777,
    color: '#06B6D4',
    established: 2023,
    role: 'Mumbai Metro Line 3 Rolling Stock',
    projects: [
      'Mumbai Metro Line 3 (Aqua) Trainsets',
      'Mumbai Metro Underground Fleet Support',
      'Mumbai Metro Depot Equipment'
    ],
    depots: [
      { id: 'mmrcl-sariput-nagar', name: 'Sariput Nagar (Aarey) Depot', line: 'Line 3 · Aqua', city: 'Mumbai', lat: 19.1300, lng: 72.8700, delivered: 60, toDeliver: 0 },
      { id: 'mmrcl-kanjurmarg', name: 'Kanjurmarg Depot', line: 'Line 3 · Aqua', city: 'Mumbai', lat: 19.1200, lng: 72.9400, delivered: 31, toDeliver: 0 },
      { id: 'mmrcl-bkc', name: 'BKC Stabling Yard', line: 'Line 3 · Aqua (Phase 2 stock)', city: 'Mumbai', lat: 19.0650, lng: 72.8650, delivered: 0, toDeliver: 4 }
    ],
    trainsets: 95,
    emailDomain: 'beml.co.in'
  },
  {
    id: 'cmrcl-chennai',
    org: 'CMRCL',
    code: 'CMRCL',
    userPrefix: 'cmrcl',
    name: 'Chennai Metro Depot',
    site: 'Chennai Metro Phase 2 Depot, Chennai',
    city: 'Chennai',
    state: 'Tamil Nadu',
    lat: 13.0827,
    lng: 80.2707,
    color: '#EF4444',
    established: 2024,
    role: 'Chennai Metro Rolling Stock',
    projects: [
      'Chennai Metro Phase 2 Rolling Stock',
      'Chennai Metro Corridor Extension Support',
      'Chennai Metro Maintenance Training'
    ],
    depots: [
      { id: 'cmrcl-koyambedu', name: 'Koyambedu Depot', line: 'Phase 1 · Blue Line', city: 'Chennai', lat: 13.0700, lng: 80.1950, delivered: 60, toDeliver: 0 },
      { id: 'cmrcl-wimco-nagar', name: 'Wimco Nagar Depot', line: 'Phase 1 Extension · Blue Line', city: 'Chennai', lat: 13.1300, lng: 80.3000, delivered: 24, toDeliver: 0 },
      { id: 'cmrcl-poonamallee', name: 'Poonamallee Depot', line: 'Phase 2 · Corridor 4', city: 'Chennai', lat: 13.0500, lng: 80.1100, delivered: 0, toDeliver: 36 }
    ],
    trainsets: 120,
    emailDomain: 'beml.co.in'
  }
];

// ── Depot helpers ─────────────────────────────────────────────
// Status is derived, never stored, so counts and labels can't drift apart.
export function depotStatus(d) {
  if (!d || !d.toDeliver) return 'delivered';
  return d.delivered > 0 ? 'in-delivery' : 'planned';
}

export const DEPOT_STATUS_LABEL = {
  delivered: 'Delivered',
  'in-delivery': 'In delivery',
  planned: 'Planned'
};

export function depotTrainsets(d) {
  return (d?.delivered || 0) + (d?.toDeliver || 0);
}

export function getDepot(locationId, depotId) {
  const loc = getLocationById(locationId);
  if (!loc || !depotId) return null;
  return (loc.depots || []).find(d => d.id === depotId) || null;
}

export function allDepots() {
  return BEML_LOCATIONS.flatMap(loc => (loc.depots || []).map(d => ({ ...d, locationId: loc.id, org: loc.org })));
}

export function getLocationById(id) {
  return BEML_LOCATIONS.find(l => l.id === id) || null;
}

export function getLocationByOrg(org) {
  if (!org) return null;
  return BEML_LOCATIONS.find(l => l.org === org) || null;
}

export function isKnownOrg(org) {
  return !!getLocationByOrg(org);
}
