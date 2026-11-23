import {
  STREETS,
  WORLD_LIMIT,
  SIDEWALK_WIDTH,
  rectsOverlap,
  inRect,
  grow,
} from '../core/world.js';

// Street furniture kinds in placement order. fl runs along the street, fw runs across it, v is the center offset from the curb.
export const FURNITURE_TYPES = [
  { id: 'streetLamp', fl: 0.3, fw: 0.3, v: 0.6, gap: 40, target: 120, colors: null },
  { id: 'bench', fl: 1.8, fw: 0.6, v: 1.2, gap: 30, target: 60, colors: null },
  { id: 'trashBin', fl: 0.6, fw: 0.6, v: 0.9, gap: 15, target: 90, colors: [0x2e7d32, 0x1565c0, 0x5d4037, 0x455a64] },
  { id: 'busShelter', fl: 2.4, fw: 1.2, v: 0.9, gap: 200, target: 12, colors: null },
  { id: 'mailbox', fl: 0.45, fw: 0.4, v: 0.6, gap: 40, target: 60, colors: [0x1e88e5, 0xc62828, 0x2e7d32] },
  { id: 'newspaperStand', fl: 0.6, fw: 0.5, v: 0.8, gap: 60, target: 40, colors: [0xf9a825, 0x2e7d32, 0xc62828] },
  { id: 'vendingMachine', fl: 0.8, fw: 0.7, v: 1.0, gap: 80, target: 30, colors: [0x1976d2, 0xd81b60, 0x388e3c] },
  { id: 'electricalBox', fl: 0.6, fw: 0.35, v: 0.7, gap: 60, target: 50, colors: [0x607d8b, 0x78909c, 0x546e7a] },
  { id: 'fireHydrant', fl: 0.3, fw: 0.3, v: 0.6, gap: 80, target: 40, colors: null },
  { id: 'adBoard', fl: 0.7, fw: 0.5, v: 0.9, gap: 60, target: 40, colors: [0xf5f5f5, 0xffe082, 0x80cbc4] },
];

const SIDE_CLEAR = 0.3;
const CROSS_CLEAR = SIDEWALK_WIDTH + 2;
const LOT_CLEAR = 3;
const FIXTURE_CLEAR = 1.5;
const GAP_CLEAR = 0.3;
const JITTER = 0.15;
const ATTEMPTS_PER_TARGET = 400;
const SEED = 20240601;

// Seeded generator (mulberry32) that returns floats in [0, 1)
function mulberry32(seed) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// True when two [lo, hi] ranges share any length
const rangesOverlap = (a, b) => a[0] < b[1] && a[1] > b[0];

// The [min, max] range a rect covers along a street that runs along X (alongX) or Z
const alongRange = (alongX, r) => (alongX ? [r.minX, r.maxX] : [r.minZ, r.maxZ]);

// Rotation so the object's long side follows the street and its front faces the side it stands on
function facing(alongX, sd) {
  if (alongX) return sd > 0 ? 0 : Math.PI;
  return sd > 0 ? Math.PI / 2 : -Math.PI / 2;
}

// Builds the world position, facing, and footprint of a candidate on street si
function placement(type, si, sd, t, v, colorDraw) {
  const s = STREETS[si];
  const across = s.offset + sd * (s.halfWidth + v);
  const along = [t - type.fl / 2, t + type.fl / 2];
  const cross = [across - type.fw / 2, across + type.fw / 2];
  const rect = s.alongX
    ? { minX: along[0], maxX: along[1], minZ: cross[0], maxZ: cross[1] }
    : { minX: cross[0], maxX: cross[1], minZ: along[0], maxZ: along[1] };
  return {
    type: type.id,
    x: s.alongX ? t : across,
    z: s.alongX ? across : t,
    rotY: facing(s.alongX, sd),
    color: type.colors ? Math.floor(colorDraw * type.colors.length) : -1,
    rect,
    si,
    sd,
    t,
  };
}

// The footprint must lie between the curb and the sidewalk edge, with SIDE_CLEAR on both sides
function inSidewalkBand(type, v) {
  return v - type.fw / 2 >= SIDE_CLEAR && v + type.fw / 2 <= SIDEWALK_WIDTH - SIDE_CLEAR;
}

// True when the footprint reaches a crossing street plus its clearance
function nearCrossing(s, rect) {
  const along = alongRange(s.alongX, rect);
  return STREETS.some((o) => {
    if (o.alongX === s.alongX) return false;
    return rangesOverlap(along, [o.offset - o.halfWidth - CROSS_CLEAR, o.offset + o.halfWidth + CROSS_CLEAR]);
  });
}

// True when the footprint, grown by LOT_CLEAR, touches a parking lot or building lot
function nearLot(rect, lots) {
  const grown = grow(rect, LOT_CLEAR);
  return lots.some((lot) => rectsOverlap(lot, grown));
}

// True when a street lamp or traffic light pole is within FIXTURE_CLEAR of the footprint
function nearFixture(rect, fixtures) {
  const grown = grow(rect, FIXTURE_CLEAR);
  return fixtures.some((f) => inRect(f.x, f.z, grown));
}

// True when another object of the same kind is too close on the same street side
function tooCloseSameKind(p, type, placed) {
  return placed.some((q) => q.type === p.type && q.si === p.si && q.sd === p.sd && Math.abs(q.t - p.t) < type.gap);
}

// True when any placed object is within GAP_CLEAR of the footprint
function crowded(p, placed) {
  const grown = grow(p.rect, GAP_CLEAR);
  return placed.some((q) => rectsOverlap(grown, q.rect));
}

// True when a candidate passes every clearance rule
function isClear(p, type, placed, lots, fixtures) {
  if (nearCrossing(STREETS[p.si], p.rect)) return false;
  if (nearLot(p.rect, lots) || nearFixture(p.rect, fixtures)) return false;
  if (tooCloseSameKind(p, type, placed)) return false;
  return !crowded(p, placed);
}

// Draws one random candidate and returns it when it is clear, otherwise null
function tryPlace(type, rng, placed, lots, fixtures) {
  const si = Math.floor(rng() * STREETS.length);
  const sd = rng() < 0.5 ? -1 : 1;
  const t = -WORLD_LIMIT + rng() * 2 * WORLD_LIMIT;
  const v = type.v + (rng() * 2 - 1) * JITTER;
  const colorDraw = rng();
  if (!inSidewalkBand(type, v)) return null;
  const p = placement(type, si, sd, t, v, colorDraw);
  return isClear(p, type, placed, lots, fixtures) ? p : null;
}

/// <summary>
/// Places street furniture on the sidewalks, one kind at a time, until each kind reaches its target or runs out of attempts.
/// <paramref name="lots"/> are the parking and building lots; <paramref name="fixtures"/> are the lamp and signal pole positions { x, z }.
/// Uses its own seeded generator, so the shared rand() sequence is not touched.
/// </summary>
export function layoutFurniture(lots, fixtures) {
  const rng = mulberry32(SEED);
  const placed = [];
  for (const type of FURNITURE_TYPES) {
    const attempts = type.target * ATTEMPTS_PER_TARGET;
    let count = 0;
    for (let n = 0; n < attempts && count < type.target; n++) {
      const p = tryPlace(type, rng, placed, lots, fixtures);
      if (!p) continue;
      placed.push(p);
      count++;
    }
  }
  return placed;
}
