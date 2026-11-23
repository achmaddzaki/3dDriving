import { SIDEWALK_WIDTH, STREETS, WORLD_LIMIT, ZONES, rectsOverlap, grow } from '../core/world.js';

import { createContext, flushContext, frame, mulberry32, addPond } from './landscape-parts.js';

const SEED = 20240715;
const ITEM_GAP = 1.2;

// Roadside ponds. `size` is the local footprint [along X, along Z]; local +Z faces the road.
// `gap` is the distance from the sidewalk edge, and `clear` is the space kept from other rects.
const ITEMS = [
  { count: 14, size: [4.6, 4.6], gap: (ctx) => 2 + ctx.rng() * 10, clear: ITEM_GAP, build: (ctx, f) => addPond(ctx, f, 1.5 + ctx.rng() * 0.5) },
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

/// <summary>
/// Adds roadside ponds on open ground. <paramref name="lots"/> are the parking, building, and public lots.
/// Returns the rects used, so trees and bushes can keep clear of them.
/// Uses its own seeded generator, so the shared rand() sequence is not touched.
/// </summary>
export function addLandscaping(scene, lots) {
  const ctx = createContext(scene, mulberry32(SEED));
  const taken = [];
  for (const item of ITEMS) placeItems(ctx, item, lots, taken);
  flushContext(ctx);
  return taken;
}

function placeItems(ctx, item, lots, taken) {
  let made = 0;
  for (let n = 0; n < item.count * 40 && made < item.count; n++) {
    const spot = pickRoadsideSpot(ctx, item);
    if (!isFree(spot.rect, taken, lots, item.clear)) continue;
    taken.push(spot.rect);
    item.build(ctx, frame(spot.x, spot.z, spot.rot));
    made++;
  }
}

// Random spot beside a street, a few meters past the sidewalk, with local +Z turned toward the road
function pickRoadsideSpot(ctx, item) {
  const size = item.size;
  const s = STREETS[Math.floor(ctx.rng() * STREETS.length)];
  const sd = ctx.rng() < 0.5 ? -1 : 1;
  const t = (ctx.rng() * 2 - 1) * s.span;
  const dir = s.alongX ? { x: 0, z: -sd } : { x: -sd, z: 0 };
  const rot = Math.atan2(dir.x, dir.z);
  const turned = Math.abs(Math.sin(rot)) > 0.5;
  const hx = (turned ? size[1] : size[0]) / 2;
  const hz = (turned ? size[0] : size[1]) / 2;
  const half = s.alongX ? hz : hx;
  const across = s.offset + sd * (s.halfWidth + SIDEWALK_WIDTH + half + item.gap(ctx));
  const x = s.alongX ? t : across;
  const z = s.alongX ? across : t;
  return { x, z, rot, rect: rectAround(x, z, hx, hz) };
}
