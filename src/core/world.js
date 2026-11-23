// Shared world size, road layout, collision obstacles, and random helpers.

export const WORLD_SIZE = 800;
export const HALF_WORLD = WORLD_SIZE / 2;
export const WORLD_LIMIT = HALF_WORLD - 10;
export const ROAD_HALF_WIDTH = 6;
export const SIDE_ROAD_WIDTH = 8;
export const SIDEWALK_WIDTH = 2.5;
export const SIDEWALK_HEIGHT = 0.15;
// true makes sidewalk curbs solid for driving, except in front of parking lots
export const ROAD_EDGE_COLLISION = false;
// true makes roadside barriers solid for driving, except in front of parking lots
export const ROADSIDE_BARRIER_COLLISION = true;
// true makes street furniture solid for driving
export const STREET_FURNITURE_COLLISION = true;
// Street lamp and traffic light pole positions { x, z }, which street furniture keeps clear of
export const sidewalkFixtures = [];

const TOWN_OFFSETS = [-160, -80, 80, 160];

// alongX true runs along X at z = offset. alongX false runs along Z at x = offset.
export const STREETS = [{ alongX: false, offset: 0, halfWidth: ROAD_HALF_WIDTH }];
for (const o of TOWN_OFFSETS) {
  STREETS.push({ alongX: true, offset: o, halfWidth: SIDE_ROAD_WIDTH / 2 });
  STREETS.push({ alongX: false, offset: o, halfWidth: SIDE_ROAD_WIDTH / 2 });
}

// Rectangle covered by one street
export function streetRect(s) {
  return s.alongX
    ? { minX: -HALF_WORLD, maxX: HALF_WORLD, minZ: s.offset - s.halfWidth, maxZ: s.offset + s.halfWidth }
    : { minX: s.offset - s.halfWidth, maxX: s.offset + s.halfWidth, minZ: -HALF_WORLD, maxZ: HALF_WORLD };
}

// Road plus sidewalk rectangles. Parking, buildings and trees stay out of these.
export const ZONES = STREETS.map((s) => streetRect({ ...s, halfWidth: s.halfWidth + SIDEWALK_WIDTH }));

// Strict overlap, so rectangles that only touch do not count
export const rectsOverlap = (a, b) => a.minX < b.maxX && a.maxX > b.minX && a.minZ < b.maxZ && a.maxZ > b.minZ;
export const inRect = (x, z, r) => x > r.minX && x < r.maxX && z > r.minZ && z < r.maxZ;
export const grow = (r, m) => ({ minX: r.minX - m, maxX: r.maxX + m, minZ: r.minZ - m, maxZ: r.maxZ + m });

// Deterministic random so the layout is the same on every load
let seed = 12345;
export function rand() {
  seed = (seed * 16807) % 2147483647;
  return seed / 2147483647;
}
export function range(a, b) {
  return a + (b - a) * rand();
}

// Collision obstacles: circles { x, z, r } or boxes { box: { minX, maxX, minZ, maxZ } }
export const obstacles = [];
