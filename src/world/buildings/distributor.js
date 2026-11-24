import { box } from '../../core/primitives.js';
import { obstacles } from '../../core/world.js';
import { addFacades, addRoofTrim } from './facade.js';
import { TREE_MODELS, addTree } from '../nature/tree.js';
import {
  addChimney,
  addContainer,
  addDrum,
  addFenceRun,
  addFloodlight,
  addForklift,
  addLoadingDock,
  addPalletStack,
  addSawtoothHall,
  addSign,
  addSilo,
  createBatch,
  lam,
} from './factory-parts.js';
import { addLogo3D } from './logo.js';

const SPOT_U = 16; // depth of the parked vehicles from the road side
const SPOT_SPACING = 6;
const BAY_LINE_LEN = 7;
const LINE_COLOR = 0xffffff;
const YARD_COLOR = 0xa9a9a9;
const DARK_COLOR = 0x37474f;
const PILLAR_COLOR = 0x9e9e9e;
const FENCE_INSET = 0.4;
const GATE_V0 = 42;
const GATE_V1 = 58;
const GATE_U = 0.9;
const SIGN_TEXT = 'PT. Simple Mandiri';
const SIGN_BLUE = 0x1565c0;
const ROAD_SIDE = { nx: 1, nz: 0 }; // the main road is on the +X side of the lot
const OFFICE = { u0: 3, u1: 15, v0: 4, v1: 26, h: 14 };
const OFFICE_COLOR = 0xd7dde1;
const HALL = { u0: 30, u1: 54, v0: 12, v1: 88, wallH: 9, teeth: 4, rise: 4 };
const DOCK_V = [26, 36, 46, 54, 64, 74];
const SILO_U = [35, 44.5, 54];
const SILO_V = 6;
const SILO_R = 3.1;
const SILO_H = 13;
const PIPE_COLOR = 0x90a4ae;
const CHIMNEYS = [
  { u: 36, v: 94, h: 26, smoke: true },
  { u: 48, v: 94, h: 18, smoke: false },
];
const CONTAINER_U = 56.4;
const CONTAINER_V0 = 14;
const CONTAINER_LEN = 6.06;
const CONTAINER_H = 2.59;
const CONTAINER_HALF_W = 1.22;
const CONTAINER_COLORS = [0xb71c1c, 0x1565c0, 0x2e7d32, 0xeceff1];
const STACK_INDEXES = [0, 2];
const STACK_COLORS = [0xef6c00, 0x1565c0];
const DRUMS = [[56.4, 90.5], [57.6, 90.5], [56.4, 91.7], [57.6, 91.7]];
const PALLETS = [[22, 81.5], [22, 85.5], [26, 83.5]];
const FORKLIFT = [22, 20];
const FLOODLIGHTS = [[20, 3], [20, 97], [58.3, 50], [58.3, 76]];
const TREES = [
  { model: 'Fir', u: 26, v: 2.5 },
  { model: 'Oak', u: 26, v: 97.5 },
];

const LOGO = { u: 12, v: 92, height: 6 }; // logo position in the north yard, in front of the fence

/// <summary>Maps depth <paramref name="u"/> from the road side and position <paramref name="v"/> along the lot to world x and z.</summary>
function yardFrame(lot) {
  return {
    depth: lot.maxX - lot.minX,
    along: lot.maxZ - lot.minZ,
    x: (u) => lot.maxX - u,
    z: (v) => lot.minZ + v,
    rect: (u0, u1, v0, v1) => ({
      minX: lot.maxX - u1, maxX: lot.maxX - u0, minZ: lot.minZ + v0, maxZ: lot.minZ + v1,
    }),
  };
}

/// <summary>Builds the distributor factory yard on <paramref name="lot"/> and returns one parking spot per vehicle.</summary>
export function buildDistributor(scene, lot, spotCount) {
  const yard = yardFrame(lot);
  const batch = createBatch();
  addYard(scene, lot);
  addFence(scene, batch, yard);
  addGate(scene, batch, yard);
  addOffice(scene, batch, yard);
  addHall(scene, batch, yard);
  addSilos(scene, batch, yard);
  CHIMNEYS.forEach((c) => addChimney(scene, batch, yard.x(c.u), yard.z(c.v), c.h, c.smoke));
  addContainers(scene, yard);
  DRUMS.forEach(([u, v]) => addDrum(batch, yard.x(u), yard.z(v)));
  PALLETS.forEach(([u, v]) => addPalletStack(batch, yard.x(u), yard.z(v)));
  addForklift(batch, yard.x(FORKLIFT[0]), yard.z(FORKLIFT[1]));
  FLOODLIGHTS.forEach(([u, v]) => addFloodlight(batch, yard.x(u), yard.z(v)));
  addBayLines(batch, yard, spotCount);
  addTrees(scene, yard);
  addLogo(scene, yard);
  batch.flush(scene);
  return parkingSpots(yard, spotCount);
}

// Concrete yard over the whole lot, drawn above the asphalt slab
function addYard(scene, lot) {
  const yard = box(
    lot.maxX - lot.minX, 0.02, lot.maxZ - lot.minZ, lam(YARD_COLOR),
    (lot.minX + lot.maxX) / 2, 0.035, (lot.minZ + lot.maxZ) / 2
  );
  yard.castShadow = false;
  scene.add(yard);
}

// Chain-link fence around the yard. The road side has a gap for the gate.
function addFence(scene, batch, yard) {
  const near = FENCE_INSET;
  const far = yard.depth - FENCE_INSET;
  const south = FENCE_INSET;
  const north = yard.along - FENCE_INSET;
  const run = (u0, v0, u1, v1) => addFenceRun(scene, batch, yard.x(u0), yard.z(v0), yard.x(u1), yard.z(v1));
  run(near, south, near, GATE_V0);
  run(near, GATE_V1, near, north);
  run(far, south, far, north);
  run(far, south, near, south);
  run(far, north, near, north);
}

// Gate pillars and an arch sign across the gap, with the company name facing the road
function addGate(scene, batch, yard) {
  const x = yard.x(GATE_U);
  const mid = yard.z((GATE_V0 + GATE_V1) / 2);
  for (const v of [GATE_V0, GATE_V1]) {
    const z = yard.z(v);
    batch.box([1.0, 4.5, 1.0], [x, 2.25, z], PILLAR_COLOR);
    batch.box([1.25, 0.3, 1.25], [x, 4.65, z], DARK_COLOR);
    obstacles.push({ box: { minX: x - 0.5, maxX: x + 0.5, minZ: z - 0.5, maxZ: z + 0.5 } });
  }
  const span = GATE_V1 - GATE_V0 + 1;
  batch.box([0.4, 1.5, span], [x, 5.25, mid], SIGN_BLUE);
  addSign(scene, { text: SIGN_TEXT, bg: SIGN_BLUE, size: [span, 1.5], pos: [x + 0.25, 5.25, mid], rotY: Math.PI / 2 });
}

// Four-floor office block beside the gate, with an entrance canopy on the road side
function addOffice(scene, batch, yard) {
  const r = yard.rect(OFFICE.u0, OFFICE.u1, OFFICE.v0, OFFICE.v1);
  const w = r.maxX - r.minX;
  const d = r.maxZ - r.minZ;
  const cx = (r.minX + r.maxX) / 2;
  const cz = (r.minZ + r.maxZ) / 2;
  scene.add(box(w, OFFICE.h, d, lam(OFFICE_COLOR), cx, OFFICE.h / 2, cz));
  addRoofTrim(scene, cx, cz, w, OFFICE.h, d);
  addFacades(scene, cx, cz, w, OFFICE.h, d, ROAD_SIDE);
  batch.box([2.5, 0.25, 3.4], [r.maxX + 1.25, 3.0, cz], DARK_COLOR);
  for (const dz of [-1.5, 1.5]) batch.cylinder(0.08, 2.9, [r.maxX + 2.3, 1.45, cz + dz], DARK_COLOR);
  obstacles.push({ box: r });
}

// Production hall with a sawtooth roof, loading docks on the road side, and the company sign above them
function addHall(scene, batch, yard) {
  const r = yard.rect(HALL.u0, HALL.u1, HALL.v0, HALL.v1);
  addSawtoothHall(scene, batch, r, HALL.wallH, HALL.teeth, HALL.rise);
  DOCK_V.forEach((v, i) => addLoadingDock(scene, batch, { x: r.maxX, z: yard.z(v), bay: i + 1 }));
  const cz = (r.minZ + r.maxZ) / 2;
  addSign(scene, { text: SIGN_TEXT, bg: SIGN_BLUE, size: [24, 1.2], pos: [r.maxX + 0.02, 7.0, cz], rotY: Math.PI / 2 });
}

// Three silos along the south edge of the hall, each piped to the hall wall
function addSilos(scene, batch, yard) {
  const hallZ = yard.z(HALL.v0);
  for (const u of SILO_U) {
    const x = yard.x(u);
    const z = yard.z(SILO_V);
    addSilo(scene, batch, x, z, SILO_R, SILO_H);
    const from = z + SILO_R;
    batch.cylinder(0.22, hallZ - from, [x, 5, (from + hallZ) / 2], PIPE_COLOR, [Math.PI / 2, 0, 0]);
  }
}

// Four shipping containers in the back strip, two of them stacked
function addContainers(scene, yard) {
  const x = yard.x(CONTAINER_U);
  const zOf = (i) => yard.z(CONTAINER_V0 + (i + 0.5) * CONTAINER_LEN);
  CONTAINER_COLORS.forEach((color, i) => {
    const z = zOf(i);
    addContainer(scene, x, 0, z, color);
    obstacles.push({
      box: {
        minX: x - CONTAINER_HALF_W, maxX: x + CONTAINER_HALF_W,
        minZ: z - CONTAINER_LEN / 2, maxZ: z + CONTAINER_LEN / 2,
      },
    });
  });
  STACK_INDEXES.forEach((i, k) => addContainer(scene, x, CONTAINER_H, zOf(i), STACK_COLORS[k]));
}

// White lines between the parking spots
function addBayLines(batch, yard, spotCount) {
  const cz = yard.z(yard.along / 2);
  for (let k = 0; k <= spotCount; k++) {
    const z = cz + (k - spotCount / 2) * SPOT_SPACING;
    batch.box([BAY_LINE_LEN, 0.02, 0.12], [yard.x(SPOT_U), 0.05, z], LINE_COLOR);
  }
}

// Red 3D logo on a plinth in the south yard, facing the road
function addLogo(scene, yard) {
  addLogo3D(scene, { x: yard.x(LOGO.u), z: yard.z(LOGO.v), height: LOGO.height });
}

// Trees near the south and north fences
function addTrees(scene, yard) {
  for (const t of TREES) {
    const model = TREE_MODELS.find((m) => m.name === t.model);
    addTree(scene, model, yard.x(t.u), yard.z(t.v));
  }
}

// Parking spots in one row across the yard, nose toward the road
function parkingSpots(yard, spotCount) {
  const cz = yard.z(yard.along / 2);
  const spots = [];
  for (let i = 0; i < spotCount; i++) {
    spots.push({ x: yard.x(SPOT_U), z: cz + (i - (spotCount - 1) / 2) * SPOT_SPACING, heading: Math.PI / 2 });
  }
  return spots;
}
