// Venues Reckless has used. Coordinates WGS84. inSlice = walkable in prototype 0.1.
export const LAT0 = 54.6050, LON0 = -5.9310;
export const KX = Math.cos(LAT0 * Math.PI / 180) * 111320, KZ = 110540;
export const ll2xz = (lat, lon) => ({ x: (lon - LON0) * KX, z: (lat - LAT0) * KZ });
export const VENUES = [
  { id: 'temple', name: 'THE TEMPLE', sub: '8 CARLISLE CIRCUS', lat: 54.60708, lon: -5.93657, pin: 'T', inSlice: true, enter: true },
  { id: 'warehouse', name: 'WARE-HOUSE XL', sub: 'COMMON MARKET · DUNBAR ST', lat: 54.602432, lon: -5.926183, pin: 'W', inSlice: true },
  { id: 'thompsons', name: "THOMPSON'S GARAGE", sub: '3 PATTERSONS PLACE, BT1 4HW', lat: 54.59725, lon: -5.92905, pin: 'G', inSlice: false },
  { id: 'halt', name: 'HALT', sub: 'WEAVERS CROSS', lat: 54.59536, lon: -5.93811, pin: 'H', inSlice: false },
  { id: 'marcusward', name: 'THE MARCUS WARD', sub: 'ORMEAU', lat: 54.592212, lon: -5.931085, pin: 'M', inSlice: false },
  { id: 'locationx', name: 'LOCATION X', sub: 'SECRET', lat: 54.583353, lon: -5.945171, pin: 'X', inSlice: false },
].map(v => ({ ...v, ...ll2xz(v.lat, v.lon) }));
// Districts for the GTA-style area label
export const DISTRICTS = [
  { name: 'CARLISLE CIRCUS', x: -365, z: 275, r: 120 },
  { name: 'CARRICK HILL', x: -230, z: 160, r: 150 },
  { name: 'SMITHFIELD', x: -150, z: -90, r: 170 },
  { name: 'CATHEDRAL QUARTER', x: 150, z: -220, r: 230 },
  { name: 'CITY QUAYS', x: 380, z: -230, r: 200 },
  { name: 'NEW LODGE', x: -60, z: 420, r: 260 },
  { name: 'CITY CENTRE', x: 0, z: -400, r: 300 },
];
// Poster spots (wheat-paste walls) — logs poster_placed test events only.
export const POSTER_SPOTS = [
  { id: 'carlisle-circus-wall', x: -338, z: 262 },
  { id: 'clifton-st-gable', x: -262, z: 196 },
  { id: 'donegall-st-hoarding', x: 95, z: -175 },
  { id: 'hill-st-shutter', x: 205, z: -245 },
  { id: 'dunbar-st-depot', x: 300, z: -262 },
];
