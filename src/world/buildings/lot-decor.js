import * as THREE from 'three';
import { addInstanced, matrixAt } from '../../core/primitives.js';
import { SIDEWALK_WIDTH, obstacles } from '../../core/world.js';
import { mulberry32 } from '../nature/landscape-parts.js';

const SEED = 77123;      // own generator, so the town layout does not change
const SLOT_LEN = 2.6;    // along-street length of one parking space
const CAR_W = 1.8;
const CAR_L = 4.2;
const MAX_CARS = 2;      // cars per lot, 0 to MAX_CARS
const MAX_BIKES = 2;     // motorbikes per lot, 0 to MAX_BIKES
const MIN_OBJECTS = 2;   // street objects around the building per lot
const MAX_OBJECTS = 5;
const PROP_PERP = 1.2;   // distance from the sidewalk edge to the parked vehicles
const EDGE = 0.6;        // space kept from the lot edge and the building
const OBJECT_SPACING = 1.8;

const CAR_COLORS = [0xffffff, 0xc0c4c8, 0x1c1c1e, 0xd62828, 0x1e5fbf, 0xf2c200, 0x2e7d32, 0x6d4c41];
const BIKE_COLORS = [0x1e88e5, 0xe53935, 0x212121, 0xfdd835];
const WHEEL_SPOTS = [
  [-CAR_W / 2, -CAR_L * 0.35],
  [CAR_W / 2, -CAR_L * 0.35],
  [-CAR_W / 2, CAR_L * 0.35],
  [CAR_W / 2, CAR_L * 0.35],
];
const GLASS = 0x263238;
const TIRE = 0x111111;
const LINE = 0xf5f5f5;
const FLOWER_COLORS = [0xec407a, 0xffffff, 0xffeb3b, 0xff7043, 0xab47bc];

const rng = mulberry32(SEED);
const BOX = new THREE.BoxGeometry(1, 1, 1);
const CYL = new THREE.CylinderGeometry(0.5, 0.5, 1, 12);
const CONE = new THREE.ConeGeometry(0.5, 1, 10);
const SPHERE = new THREE.SphereGeometry(0.5, 8, 6);
const WHEEL = new THREE.CylinderGeometry(0.5, 0.5, 1, 12).rotateZ(Math.PI / 2); // axis along X
const material = new THREE.MeshLambertMaterial({ color: 0xffffff }); // per-instance colors do the tinting
const batches = new Map(); // geometry -> { matrices, colors }

const pick = (list) => list[Math.floor(rng() * list.length)];

// Queues one instance of `geo` with a color. Instances are flushed in one batch per geometry.
function add(geo, matrix, color) {
  if (!batches.has(geo)) batches.set(geo, { matrices: [], colors: [] });
  const b = batches.get(geo);
  b.matrices.push(matrix);
  b.colors.push(new THREE.Color(color));
}

// World point at local (lx, lz) of an object at (x, z) turned by rotY
function worldAt(x, z, rotY, lx, lz) {
  const c = Math.cos(rotY);
  const sn = Math.sin(rotY);
  return { x: x + lx * c + lz * sn, z: z - lx * sn + lz * c };
}

// Collision box for an object with half sizes hw (local X) and hd (local Z), turned by rotY
function solid(x, z, hw, hd, rotY) {
  const turned = Math.abs(Math.sin(rotY)) > 0.5;
  const hx = turned ? hd : hw;
  const hz = turned ? hw : hd;
  obstacles.push({ box: { minX: x - hx, maxX: x + hx, minZ: z - hz, maxZ: z + hz } });
}

// Car nose along local Z. Body, cabin, and four wheels.
function addCar(x, z, rotY) {
  add(BOX, matrixAt(x, 0.6, z, CAR_W, 0.7, CAR_L, rotY), pick(CAR_COLORS));
  add(BOX, matrixAt(x, 1.2, z, CAR_W * 0.85, 0.5, CAR_L * 0.5, rotY), GLASS);
  for (const [lx, lz] of WHEEL_SPOTS) {
    const w = worldAt(x, z, rotY, lx, lz);
    add(WHEEL, matrixAt(w.x, 0.3, w.z, 0.22, 0.6, 0.6, rotY), TIRE);
  }
  solid(x, z, CAR_W / 2, CAR_L / 2, rotY);
}

function addMotorbike(x, z, rotY) {
  add(BOX, matrixAt(x, 0.5, z, 0.3, 0.5, 1.2, rotY), pick(BIKE_COLORS));
  for (const lz of [-0.5, 0.5]) {
    const w = worldAt(x, z, rotY, 0, lz);
    add(WHEEL, matrixAt(w.x, 0.3, w.z, 0.12, 0.6, 0.6, rotY), TIRE);
  }
  solid(x, z, 0.2, 0.6, rotY);
}

function addBin(x, z, rotY) {
  add(CYL, matrixAt(x, 0.45, z, 0.6, 0.9, 0.6, rotY), pick([0x2e7d32, 0x607d8b, 0x37474f]));
  solid(x, z, 0.3, 0.3, rotY);
}

function addPlanter(x, z, rotY) {
  add(CYL, matrixAt(x, 0.25, z, 0.8, 0.5, 0.8, rotY), pick([0xbf6b3e, 0xcfd8dc, 0x6d4c41]));
  add(SPHERE, matrixAt(x, 0.85, z, 0.84, 0.84, 0.84, rotY), pick([0x2e7d32, 0x388e3c, 0x558b2f]));
  solid(x, z, 0.4, 0.4, rotY);
}

function addCone(x, z, rotY) {
  add(CONE, matrixAt(x, 0.3, z, 0.4, 0.6, 0.4, rotY), 0xff6d00);
  solid(x, z, 0.2, 0.2, rotY);
}

function addBollard(x, z, rotY) {
  add(CYL, matrixAt(x, 0.4, z, 0.3, 0.8, 0.3, rotY), 0xffc107);
  solid(x, z, 0.15, 0.15, rotY);
}

function addCrates(x, z, rotY) {
  add(BOX, matrixAt(x, 0.3, z, 0.8, 0.6, 0.8, rotY), 0x8d6e63);
  add(BOX, matrixAt(x, 0.9, z, 0.7, 0.6, 0.7, rotY), 0xa1887f);
  solid(x, z, 0.4, 0.4, rotY);
}

// Flower bed with a stone border and a row of flowers on the soil
function addFlowerBed(x, z, rotY) {
  add(BOX, matrixAt(x, 0.13, z, 1.6, 0.26, 1.0, rotY), 0x5d4037);
  const edges = [[0, -0.44, 1.6, 0.12], [0, 0.44, 1.6, 0.12], [-0.74, 0, 0.12, 1.0], [0.74, 0, 0.12, 1.0]];
  for (const [lx, lz, sx, sz] of edges) {
    const w = worldAt(x, z, rotY, lx, lz);
    add(BOX, matrixAt(w.x, 0.15, w.z, sx, 0.3, sz, rotY), 0xbdbdbd);
  }
  for (let i = 0; i < 10; i++) {
    const w = worldAt(x, z, rotY, (rng() * 2 - 1) * 0.6, (rng() * 2 - 1) * 0.36);
    add(SPHERE, matrixAt(w.x, 0.4, w.z, 0.24, 0.24, 0.24, rotY), pick(FLOWER_COLORS));
  }
  solid(x, z, 0.8, 0.5, rotY);
}

// Objects that go beside or behind the building. `half` is the half size each one needs on the ground.
const STREET_OBJECTS = [
  { weight: 3, half: 0.3, place: addBin },
  { weight: 3, half: 0.4, place: addPlanter },
  { weight: 2, half: 0.2, place: addCone },
  { weight: 2, half: 0.15, place: addBollard },
  { weight: 2, half: 0.4, place: addCrates },
  { weight: 3, half: 0.8, place: addFlowerBed },
];
const OBJECT_TOTAL = STREET_OBJECTS.reduce((sum, p) => sum + p.weight, 0);

function pickObject() {
  let roll = rng() * OBJECT_TOTAL;
  for (const p of STREET_OBJECTS) {
    roll -= p.weight;
    if (roll < 0) return p;
  }
  return STREET_OBJECTS[0];
}

// World x, z for a point at `along` the street and `perp` away from its center line
function toWorld(s, along, perp) {
  return s.alongX ? { x: along, z: perp } : { x: perp, z: along };
}

// Rect as [along, across] ranges. Along runs with the street, across is perpendicular to it.
function alongAcross(s, r) {
  return s.alongX
    ? { a0: r.minX, a1: r.maxX, p0: r.minZ, p1: r.maxZ }
    : { a0: r.minZ, a1: r.maxZ, p0: r.minX, p1: r.maxX };
}

function shuffledIndices(n) {
  const out = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// Parking spaces in the strip between the sidewalk and the building. Cars and motorbikes take the spaces.
// `t` and `lotAlong` give the lot's span along the street. `lot` and `building` are rects.
function addParkingRow(s, side, t, lotAlong) {
  const near = s.halfWidth + SIDEWALK_WIDTH;
  const stripDepth = CAR_L + 0.8;
  const stripPerp = s.offset + side * (near + 0.2 + stripDepth / 2);
  const carPerp = s.offset + side * (near + 0.4 + CAR_L / 2);
  const bikePerp = s.offset + side * (near + PROP_PERP);
  const rotY = s.alongX ? 0 : Math.PI / 2;
  const slots = Math.floor(lotAlong / SLOT_LEN);

  for (let k = 0; k <= slots; k++) {
    const p = toWorld(s, t + k * SLOT_LEN, stripPerp);
    const line = s.alongX
      ? matrixAt(p.x, 0.04, p.z, 0.12, 0.02, stripDepth)
      : matrixAt(p.x, 0.04, p.z, stripDepth, 0.02, 0.12);
    add(BOX, line, LINE);
  }

  const order = shuffledIndices(slots);
  const carCount = Math.floor(rng() * (MAX_CARS + 1));
  const bikeCount = Math.floor(rng() * (MAX_BIKES + 1));
  order.slice(0, carCount).forEach((k) => {
    const p = toWorld(s, t + (k + 0.5) * SLOT_LEN, carPerp);
    addCar(p.x, p.z, rotY);
  });
  order.slice(carCount, carCount + bikeCount).forEach((k) => {
    const p = toWorld(s, t + (k + 0.5) * SLOT_LEN, bikePerp);
    addMotorbike(p.x, p.z, rotY);
  });
}

// Free zones beside (left and right) and behind the building, as [along, across] ranges
function freeZones(s, side, lot, building) {
  const L = alongAcross(s, lot);
  const B = alongAcross(s, building);
  const backLo = side > 0 ? B.p1 + EDGE : L.p0 + EDGE;
  const backHi = side > 0 ? L.p1 - EDGE : B.p0 - EDGE;
  return [
    { a0: L.a0 + EDGE, a1: B.a0 - EDGE, p0: B.p0, p1: B.p1 },
    { a0: B.a1 + EDGE, a1: L.a1 - EDGE, p0: B.p0, p1: B.p1 },
    { a0: B.a0, a1: B.a1, p0: backLo, p1: backHi },
  ];
}

// Random objects beside and behind the building, kept apart from each other.
// Each object is placed only in a zone that fits its footprint.
function addStreetObjects(s, side, lot, building) {
  const zones = freeZones(s, side, lot, building);
  if (zones.length === 0) return;
  const count = MIN_OBJECTS + Math.floor(rng() * (MAX_OBJECTS - MIN_OBJECTS + 1));
  const placed = [];
  for (let attempt = 0; attempt < count * 10 && placed.length < count; attempt++) {
    const kind = pickObject();
    const fits = zones.filter((z) => z.a1 - z.a0 >= 2 * kind.half && z.p1 - z.p0 >= 2 * kind.half);
    if (fits.length === 0) continue;
    const z = fits[Math.floor(rng() * fits.length)];
    const a = z.a0 + kind.half + rng() * (z.a1 - z.a0 - 2 * kind.half);
    const p = z.p0 + kind.half + rng() * (z.p1 - z.p0 - 2 * kind.half);
    if (placed.some((q) => Math.hypot(q.a - a, q.p - p) < OBJECT_SPACING)) continue;
    placed.push({ a, p });
    const w = toWorld(s, a, p);
    kind.place(w.x, w.z, rng() * Math.PI * 2);
  }
}

// Parking row in the strip, then the street objects around the building.
// `t` and `lotAlong` give the lot's span along the street. `lot` and `building` are rects.
export function addParking(s, side, t, lotAlong, lot, building) {
  addParkingRow(s, side, t, lotAlong);
  addStreetObjects(s, side, lot, building);
}

// Adds every queued part in one instanced batch per geometry
export function flushParking(scene) {
  for (const [geo, b] of batches) addInstanced(scene, geo, material, b.matrices, b.colors);
  batches.clear();
}
