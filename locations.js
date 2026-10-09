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
    trainsets: 120,
    emailDomain: 'beml.co.in'
  }
];

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
