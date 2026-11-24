import { box } from '../../core/primitives.js';
import { SIDEWALK_WIDTH } from '../../core/world.js';
import { groundHeight } from '../../core/terrain.js';
import { TREE_MODELS, addTree } from '../nature/tree.js';
import {
  lam,
  createContext,
  flushContext,
  frame,
  mulberry32,
  addFlowerBed,
  addRoundBed,
  addHedgeRun,
  addPlanter,
  addPlanterRow,
  addSeatingArea,
  addGardenPlot,
  addPlaza,
} from '../nature/landscape-parts.js';

const SEATING_DEPTH = 3.4;  // footprint of a seating area across the street, from its sidewalk side
const SEATING_GAP = 0.3;    // space between the sidewalk edge and the seating area
const PATH_WIDTH = 2;
const ENTRY_HALF = 1.6;     // half width of the gate gap in a pocket park border

// Lot contents for public spaces. Seating sits at the sidewalk edge, garden plots and pocket parks fill the lot.
export function addPublicContents(scene, s, side, lot, kind) {
  if (kind === 'pocket') return addPocketPark(scene, lot);
  const cx = (lot.minX + lot.maxX) / 2;
  const cz = (lot.minZ + lot.maxZ) / 2;
  const ctx = createContext(scene, mulberry32(Math.floor(cx * 29 + cz * 13)));
  // Local +Z of the contents faces the street
  const toRoad = s.alongX ? { x: 0, z: -side } : { x: -side, z: 0 };
  const rot = Math.atan2(toRoad.x, toRoad.z);
  if (kind === 'seating') {
    const near = s.halfWidth + SIDEWALK_WIDTH;
    const perp = s.offset + side * (near + SEATING_GAP + SEATING_DEPTH / 2);
    const x = s.alongX ? cx : perp;
    const z = s.alongX ? perp : cz;
    addSeatingArea(ctx, frame(x, z, rot));
  } else {
    addGardenPlot(ctx, frame(cx, cz, rot));
  }
  flushContext(ctx);
}

// Cross paths, round bed in the middle, four corner features, and a fence or hedge border with gates.
// The lot already has the lawn surface.
function addPocketPark(scene, lot) {
  const cx = (lot.minX + lot.maxX) / 2;
  const cz = (lot.minZ + lot.maxZ) / 2;
  const w = lot.maxX - lot.minX;
  const d = lot.maxZ - lot.minZ;
  const ctx = createContext(scene, mulberry32(Math.floor(cx * 31 + cz * 17)));
  addPathStrip(scene, true, cx, cz, w);
  addPathStrip(scene, false, cx, cz, d);
  addPlaza(ctx, cx, cz, 2.4);
  addRoundBed(ctx, frame(cx, cz, 0), 0, 0, 1.3);
  addCornerFeatures(ctx, cx, cz, w, d);
  addBorder(ctx, cx, cz, w, d);
  flushContext(ctx);
}

// Paved path through the center of a pocket park, cut into 2 m pieces so it follows the ground
function addPathStrip(scene, alongX, cx, cz, len) {
  const pieces = Math.ceil(len / 2);
  const step = len / pieces;
  for (let i = 0; i < pieces; i++) {
    const a = -len / 2 + (i + 0.5) * step;
    const x = alongX ? cx + a : cx;
    const z = alongX ? cz : cz + a;
    const w = alongX ? step : PATH_WIDTH;
    const d = alongX ? PATH_WIDTH : step;
    scene.add(box(w, 0.04, d, lam(0xcfc7bd), x, groundHeight(x, z) + 0.02, z));
  }
}

const randomTree = (ctx) => TREE_MODELS[Math.floor(ctx.rng() * TREE_MODELS.length)];

// One seating area, then random beds, trees, or planter rows in the other quadrants
function addCornerFeatures(ctx, cx, cz, w, d) {
  const quadrants = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
  const seatingAt = Math.floor(ctx.rng() * 4);
  quadrants.forEach(([sx, sz], i) => {
    const qx = cx + sx * (w / 4 + 0.3);
    const qz = cz + sz * (d / 4 + 0.5);
    if (i === seatingAt) return addSeatingArea(ctx, frame(qx, qz, sz > 0 ? Math.PI : 0));
    const kind = Math.floor(ctx.rng() * 3);
    if (kind === 0) return addFlowerBed(ctx, frame(qx, qz, 0), 0, 0, 5, 3);
    if (kind === 1) return addTree(ctx.scene, randomTree(ctx), cx + sx * (w / 2 - 2.4), cz + sz * (d / 2 - 2.4));
    addPlanterRow(ctx, frame(qx, qz, 0));
  });
}

// Hedge border on all four sides with a gate gap where each path enters, and planters beside the top and bottom gates
function addBorder(ctx, cx, cz, w, d) {
  const run = (a, b, c, e) => addHedgeRun(ctx, a, b, c, e);
  const x0 = cx - w / 2 + 0.5;
  const x1 = cx + w / 2 - 0.5;
  const z0 = cz - d / 2 + 0.5;
  const z1 = cz + d / 2 - 0.5;
  for (const z of [z0, z1]) {
    run(x0, z, cx - ENTRY_HALF, z);
    run(cx + ENTRY_HALF, z, x1, z);
  }
  for (const x of [x0, x1]) {
    run(x, z0, x, cz - ENTRY_HALF);
    run(x, cz + ENTRY_HALF, x, z1);
  }
  for (const z of [z0 + 1, z1 - 1]) {
    for (const sx of [-1, 1]) addPlanter(ctx, frame(cx + sx * (ENTRY_HALF + 0.7), z, 0), 0, 0);
  }
}
