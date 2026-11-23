import { box } from '../core/primitives.js';
import { STREETS, SIDEWALK_WIDTH, WORLD_LIMIT, ZONES, rectsOverlap, grow } from '../core/world.js';
import { TREE_MODELS, addTree } from './tree.js';
import {
  lam,
  mulberry32,
  createContext,
  flushContext,
  frame,
  addFlowerBed,
  addRoundBed,
  addGrassPatch,
  addHedge,
  addHedgeRun,
  addFenceRun,
  addPlanter,
  addPlanterRow,
  addSeatingArea,
  addGardenPlot,
  addPlaza,
} from './landscape-parts.js';

const SEED = 20240715;
const PARK_COUNT = 16;
const PARK_GAP = 4;
const ITEM_GAP = 1.2;
const ENTRY_HALF = 1.6;
const PATH_WIDTH = 2;

// Roadside items. `size` is the local footprint [along X, along Z]; local +Z faces the road.
const ITEMS = [
  { count: 22, size: [6.4, 3.4], build: (ctx, f) => addSeatingArea(ctx, f) },
  { count: 24, size: [8, 6], build: (ctx, f) => addGardenPlot(ctx, f) },
  { count: 40, size: [5, 3], build: (ctx, f) => addFlowerBed(ctx, f, 0, 0, 5, 3) },
  { count: 34, size: [6, 1.2], build: (ctx, f) => addHedge(ctx, f, 0, 0, 6) },
  { count: 60, size: [4, 4], build: (ctx, f) => addGrassPatch(ctx, f, 0, 0, 1.8 + ctx.rng()) },
  { count: 30, size: [4.5, 1.2], build: (ctx, f) => addPlanterRow(ctx, f) },
];

const rectAround = (x, z, hx, hz) => ({ minX: x - hx, maxX: x + hx, minZ: z - hz, maxZ: z + hz });

// True when the rect is inside the world and keeps `gap` from roads, lots, and taken rects
function isFree(rect, taken, lots, gap) {
  const inside = rect.minX >= -WORLD_LIMIT && rect.maxX <= WORLD_LIMIT
    && rect.minZ >= -WORLD_LIMIT && rect.maxZ <= WORLD_LIMIT;
  if (!inside) return false;
  const g = grow(rect, gap);
  return ![...ZONES, ...lots, ...taken].some((r) => rectsOverlap(r, g));
}

const randomTree = (ctx) => TREE_MODELS[Math.floor(ctx.rng() * TREE_MODELS.length)];

/// <summary>
/// Adds neighborhood parks, flower beds, hedges, grass patches, planters, seating areas, and garden fences on open grass.
/// <paramref name="lots"/> are the parking and building lots. Returns the rects used, so trees and bushes can keep clear of them.
/// Uses its own seeded generator, so the shared rand() sequence is not touched.
/// </summary>
export function addLandscaping(scene, lots) {
  const ctx = createContext(scene, mulberry32(SEED));
  const taken = [];
  placeParks(ctx, lots, taken);
  for (const item of ITEMS) placeItems(ctx, item, lots, taken);
  flushContext(ctx);
  return taken;
}

function placeParks(ctx, lots, taken) {
  let made = 0;
  for (let n = 0; n < PARK_COUNT * 80 && made < PARK_COUNT; n++) {
    const w = 16 + ctx.rng() * 6;
    const d = 14 + ctx.rng() * 4;
    const cx = (ctx.rng() * 2 - 1) * (WORLD_LIMIT - w / 2);
    const cz = (ctx.rng() * 2 - 1) * (WORLD_LIMIT - d / 2);
    const rect = rectAround(cx, cz, w / 2, d / 2);
    if (!isFree(rect, taken, lots, PARK_GAP)) continue;
    taken.push(rect);
    buildPocketPark(ctx, cx, cz, w, d, made % 2 === 0);
    made++;
  }
}

// Lawn, cross paths, round bed in the middle, four corner features, and a fence or hedge border with gates
function buildPocketPark(ctx, cx, cz, w, d, useFence) {
  const { scene } = ctx;
  const f = frame(cx, cz, 0);
  scene.add(box(w, 0.02, d, lam(0x7ccd70), cx, 0.015, cz));
  scene.add(box(w, 0.04, PATH_WIDTH, lam(0xcfc7bd), cx, 0.02, cz));
  scene.add(box(PATH_WIDTH, 0.04, d, lam(0xcfc7bd), cx, 0.02, cz));
  addPlaza(ctx, cx, cz, 2.4);
  addRoundBed(ctx, f, 0, 0, 1.3);
  addCornerFeatures(ctx, cx, cz, w, d);
  addBorder(ctx, cx, cz, w, d, useFence);
}

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
    if (kind === 1) return addTreeCorner(ctx, cx + sx * (w / 2 - 2.4), cz + sz * (d / 2 - 2.4), qx, qz);
    addGrassPatch(ctx, frame(qx, qz, 0), 0, 0, 2.2);
    addPlanterRow(ctx, frame(qx, qz, 0));
  });
}

function addTreeCorner(ctx, tx, tz, gx, gz) {
  addTree(ctx.scene, randomTree(ctx), tx, tz);
  addGrassPatch(ctx, frame(gx, gz, 0), 0, 0, 2);
}

// Border runs on all four sides with a gate gap where each path enters, and planters beside the top and bottom gates
function addBorder(ctx, cx, cz, w, d, useFence) {
  const run = useFence ? (a, b, c, e) => addFenceRun(ctx, a, b, c, e) : (a, b, c, e) => addHedgeRun(ctx, a, b, c, e);
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
  for (const [z, sz] of [[z0 + 1, 1], [z1 - 1, -1]]) {
    for (const sx of [-1, 1]) addPlanter(ctx, frame(cx + sx * (ENTRY_HALF + 0.7), z, 0), 0, 0);
  }
}

function placeItems(ctx, item, lots, taken) {
  let made = 0;
  for (let n = 0; n < item.count * 40 && made < item.count; n++) {
    const spot = pickRoadsideSpot(ctx, item.size);
    if (!isFree(spot.rect, taken, lots, ITEM_GAP)) continue;
    taken.push(spot.rect);
    item.build(ctx, frame(spot.x, spot.z, spot.rot));
    made++;
  }
}

// Random spot beside a street, a few meters past the sidewalk, with local +Z turned toward the road
function pickRoadsideSpot(ctx, size) {
  const s = STREETS[Math.floor(ctx.rng() * STREETS.length)];
  const sd = ctx.rng() < 0.5 ? -1 : 1;
  const t = (ctx.rng() * 2 - 1) * WORLD_LIMIT;
  const dir = s.alongX ? { x: 0, z: -sd } : { x: -sd, z: 0 };
  const rot = Math.atan2(dir.x, dir.z);
  const turned = Math.abs(Math.sin(rot)) > 0.5;
  const hx = (turned ? size[1] : size[0]) / 2;
  const hz = (turned ? size[0] : size[1]) / 2;
  const half = s.alongX ? hz : hx;
  const across = s.offset + sd * (s.halfWidth + SIDEWALK_WIDTH + half + 2 + ctx.rng() * 10);
  const x = s.alongX ? t : across;
  const z = s.alongX ? across : t;
  return { x, z, rot, rect: rectAround(x, z, hx, hz) };
}
