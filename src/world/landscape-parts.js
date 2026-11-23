import * as THREE from 'three';
import { box, addInstanced, matrixAt } from '../core/primitives.js';
import { obstacles } from '../core/world.js';

// Materials are shared by color
const materials = new Map();
export function lam(color) {
  if (!materials.has(color)) materials.set(color, new THREE.MeshLambertMaterial({ color }));
  return materials.get(color);
}

const WHITE_MAT = new THREE.MeshLambertMaterial({ color: 0xffffff });
const FLOWER_GEO = new THREE.SphereGeometry(0.12, 6, 5);
const TUFT_GEO = new THREE.ConeGeometry(0.07, 0.4, 4);
const POST_GEO = new THREE.BoxGeometry(0.12, 0.9, 0.12);
const FLOWER_COLORS = [0xec407a, 0xffffff, 0xffeb3b, 0xff7043, 0xab47bc, 0xef5350, 0x42a5f5].map((c) => new THREE.Color(c));
const TUFT_COLORS = [0x558b2f, 0x689f38, 0x7cb342, 0x33691e].map((c) => new THREE.Color(c));
const PATCH_COLORS = [0x8bc34a, 0x6aa84f, 0x9ccc65, 0x5fa052];
const HEDGE_COLORS = [0x2e7d32, 0x388e3c, 0x1b5e20];
const POT_COLORS = [0xbf6b3e, 0xcfd8dc, 0x6d4c41, 0x37474f];
const FENCE_COLORS = [0xf5f5f5, 0x8d6e63, 0x2e5d34];
const STONE = 0xbdbdbd;
const SOIL = 0x5d4037;
const WOOD = 0x8d6e63;

/// <summary>Seeded random generator (mulberry32) that returns floats in [0, 1).</summary>
export function mulberry32(seed) {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/// <summary>Creates the build context: the <paramref name="scene"/>, a random generator, and instance batches.</summary>
export function createContext(scene, rng) {
  return {
    scene,
    rng,
    flowers: { m: [], c: [] },
    tufts: { m: [], c: [] },
    posts: { m: [], c: [] },
  };
}

/// <summary>Adds the batched flowers, grass tufts, and fence posts of <paramref name="ctx"/> to its scene.</summary>
export function flushContext(ctx) {
  addInstanced(ctx.scene, FLOWER_GEO, WHITE_MAT, ctx.flowers.m, ctx.flowers.c);
  addInstanced(ctx.scene, TUFT_GEO, WHITE_MAT, ctx.tufts.m, ctx.tufts.c);
  addInstanced(ctx.scene, POST_GEO, WHITE_MAT, ctx.posts.m, ctx.posts.c);
}

/// <summary>Frame at (<paramref name="x"/>, <paramref name="z"/>) turned by <paramref name="rot"/>. pt converts a local point to world.</summary>
export function frame(x, z, rot) {
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  return { x, z, rot, pt: (lx, lz) => ({ x: x + lx * c + lz * s, z: z - lx * s + lz * c }) };
}

const pick = (ctx, list) => list[Math.floor(ctx.rng() * list.length)];

function newGroup(ctx, f) {
  const g = new THREE.Group();
  g.position.set(f.x, 0, f.z);
  g.rotation.y = f.rot;
  ctx.scene.add(g);
  return g;
}

function solidBox(f, lx, lz, hw, hd) {
  const p = f.pt(lx, lz);
  const turned = Math.abs(Math.sin(f.rot)) > 0.5;
  const a = turned ? hd : hw;
  const b = turned ? hw : hd;
  obstacles.push({ box: { minX: p.x - a, maxX: p.x + a, minZ: p.z - b, maxZ: p.z + b } });
}

function solidCircle(f, lx, lz, r) {
  const p = f.pt(lx, lz);
  obstacles.push({ x: p.x, z: p.z, r });
}

function cylinder(rTop, rBottom, h, color, x, y, z) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBottom, h, 14), lam(color));
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

// Random point in an ellipse of radii rx and rz
function inEllipse(ctx, rx, rz) {
  const a = ctx.rng() * Math.PI * 2;
  const k = Math.sqrt(ctx.rng());
  return { x: Math.cos(a) * rx * k, z: Math.sin(a) * rz * k };
}

function scatterFlowers(ctx, f, count, y, rx, rz, lx = 0, lz = 0) {
  for (let i = 0; i < count; i++) {
    const o = inEllipse(ctx, rx, rz);
    const p = f.pt(lx + o.x, lz + o.z);
    const s = 0.8 + ctx.rng() * 0.5;
    ctx.flowers.m.push(matrixAt(p.x, y, p.z, s, s, s));
    ctx.flowers.c.push(pick(ctx, FLOWER_COLORS));
  }
}

/// <summary>Rectangular flower bed with a stone border, centered at local (<paramref name="lx"/>, <paramref name="lz"/>).</summary>
export function addFlowerBed(ctx, f, lx, lz, w, d) {
  const g = newGroup(ctx, f);
  const t = 0.2;
  g.add(box(w, 0.25, d, lam(SOIL), lx, 0.125, lz));
  g.add(box(w, 0.3, t, lam(STONE), lx, 0.15, lz - d / 2 + t / 2));
  g.add(box(w, 0.3, t, lam(STONE), lx, 0.15, lz + d / 2 - t / 2));
  g.add(box(t, 0.3, d, lam(STONE), lx - w / 2 + t / 2, 0.15, lz));
  g.add(box(t, 0.3, d, lam(STONE), lx + w / 2 - t / 2, 0.15, lz));
  scatterFlowers(ctx, f, Math.round(w * d * 2.2), 0.32, w / 2 - 0.3, d / 2 - 0.3, lx, lz);
  solidBox(f, lx, lz, w / 2, d / 2);
}

/// <summary>Round flower bed of radius <paramref name="r"/> with a shrub in the middle.</summary>
export function addRoundBed(ctx, f, lx, lz, r) {
  const g = newGroup(ctx, f);
  g.add(cylinder(r, r, 0.3, STONE, lx, 0.15, lz));
  g.add(cylinder(r - 0.2, r - 0.2, 0.33, SOIL, lx, 0.165, lz));
  const shrub = new THREE.Mesh(new THREE.SphereGeometry(r * 0.35, 10, 8), lam(0x2e7d32));
  shrub.position.set(lx, 0.55, lz);
  shrub.castShadow = true;
  g.add(shrub);
  scatterFlowers(ctx, f, Math.round(r * r * 6), 0.36, r - 0.4, r - 0.4, lx, lz);
  solidCircle(f, lx, lz, r);
}

/// <summary>Flat patch of lawn with grass tufts, radius <paramref name="r"/>.</summary>
export function addGrassPatch(ctx, f, lx, lz, r) {
  const g = newGroup(ctx, f);
  const patch = cylinder(r, r, 0.03, pick(ctx, PATCH_COLORS), lx, 0.03, lz);
  patch.scale.z = 0.7 + ctx.rng() * 0.5;
  patch.castShadow = false;
  g.add(patch);
  for (let i = 0; i < Math.round(r * r * 3); i++) {
    const o = inEllipse(ctx, r * 0.9, r * 0.9 * patch.scale.z);
    const p = f.pt(lx + o.x, lz + o.z);
    const s = 0.7 + ctx.rng() * 0.8;
    ctx.tufts.m.push(matrixAt(p.x, 0.2 * s, p.z, s, s, s, ctx.rng() * Math.PI));
    ctx.tufts.c.push(pick(ctx, TUFT_COLORS));
  }
}

/// <summary>Hedge of length <paramref name="len"/> running along the local X axis.</summary>
export function addHedge(ctx, f, lx, lz, len) {
  const g = newGroup(ctx, f);
  g.add(box(len, 0.95, 0.8, lam(pick(ctx, HEDGE_COLORS)), lx, 0.475, lz));
  solidBox(f, lx, lz, len / 2, 0.4);
}

/// <summary>Hedge run between two world points on the same X or Z line.</summary>
export function addHedgeRun(ctx, x0, z0, x1, z1) {
  const horizontal = Math.abs(x1 - x0) >= Math.abs(z1 - z0);
  const len = horizontal ? Math.abs(x1 - x0) : Math.abs(z1 - z0);
  const f = frame((x0 + x1) / 2, (z0 + z1) / 2, horizontal ? 0 : Math.PI / 2);
  addHedge(ctx, f, 0, 0, len);
}

/// <summary>Garden fence between two world points on the same X or Z line: posts, two rails, and collision.</summary>
export function addFenceRun(ctx, x0, z0, x1, z1) {
  const horizontal = Math.abs(x1 - x0) >= Math.abs(z1 - z0);
  const len = horizontal ? Math.abs(x1 - x0) : Math.abs(z1 - z0);
  const cx = (x0 + x1) / 2;
  const cz = (z0 + z1) / 2;
  const color = FENCE_COLORS[Math.floor(Math.abs(cx * 7 + cz * 13)) % FENCE_COLORS.length];
  const c = new THREE.Color(color);
  const posts = Math.max(2, Math.ceil(len / 1.4) + 1);
  for (let i = 0; i < posts; i++) {
    const k = i / (posts - 1) - 0.5;
    const px = horizontal ? cx + k * len : cx;
    const pz = horizontal ? cz : cz + k * len;
    ctx.posts.m.push(matrixAt(px, 0.45, pz, 1, 1, 1));
    ctx.posts.c.push(c);
  }
  for (const y of [0.35, 0.72]) {
    ctx.scene.add(box(horizontal ? len : 0.06, 0.08, horizontal ? 0.06 : len, lam(color), cx, y, cz));
  }
  const hw = horizontal ? len / 2 : 0.1;
  const hd = horizontal ? 0.1 : len / 2;
  obstacles.push({ box: { minX: cx - hw, maxX: cx + hw, minZ: cz - hd, maxZ: cz + hd } });
}

/// <summary>Decorative planter pot at local (<paramref name="lx"/>, <paramref name="lz"/>) with flowers or a shrub.</summary>
export function addPlanter(ctx, f, lx, lz) {
  const g = newGroup(ctx, f);
  g.add(cylinder(0.42, 0.32, 0.6, pick(ctx, POT_COLORS), lx, 0.3, lz));
  g.add(cylinder(0.36, 0.36, 0.04, SOIL, lx, 0.6, lz));
  if (ctx.rng() < 0.5) {
    scatterFlowers(ctx, f, 7, 0.68, 0.28, 0.28, lx, lz);
  } else {
    const shrub = new THREE.Mesh(new THREE.SphereGeometry(0.38, 8, 6), lam(0x388e3c));
    shrub.position.set(lx, 0.9, lz);
    shrub.castShadow = true;
    g.add(shrub);
  }
  solidCircle(f, lx, lz, 0.45);
}

function addBench(g, f, lx, lz) {
  g.add(box(1.6, 0.1, 0.5, lam(WOOD), lx, 0.45, lz));
  g.add(box(1.6, 0.45, 0.08, lam(WOOD), lx, 0.75, lz - 0.22));
  g.add(box(0.1, 0.45, 0.45, lam(0x455a64), lx - 0.7, 0.225, lz));
  g.add(box(0.1, 0.45, 0.45, lam(0x455a64), lx + 0.7, 0.225, lz));
  solidBox(f, lx, lz, 0.8, 0.28);
}

/// <summary>Seating area: paved pad, two benches facing local +Z, and a planter at each end. Footprint 6.4 x 3.4.</summary>
export function addSeatingArea(ctx, f) {
  const g = newGroup(ctx, f);
  g.add(box(6.4, 0.04, 3.4, lam(0xcfc7bd), 0, 0.02, 0));
  addBench(g, f, -1.2, -0.4);
  addBench(g, f, 1.2, -0.4);
  addPlanter(ctx, f, -2.7, -0.4);
  addPlanter(ctx, f, 2.7, -0.4);
}

/// <summary>Row of three planters along the local X axis.</summary>
export function addPlanterRow(ctx, f) {
  for (const lx of [-1.4, 0, 1.4]) addPlanter(ctx, f, lx, 0);
}

/// <summary>Fenced garden 8 x 6 with a gate gap on the local +Z side, a flower bed, and planters.</summary>
export function addGardenPlot(ctx, f) {
  const hw = 4;
  const hd = 3;
  const gate = 1.2;
  const run = (ax, az, bx, bz) => {
    const a = f.pt(ax, az);
    const b = f.pt(bx, bz);
    addFenceRun(ctx, a.x, a.z, b.x, b.z);
  };
  run(-hw, -hd, hw, -hd);
  run(-hw, -hd, -hw, hd);
  run(hw, -hd, hw, hd);
  run(-hw, hd, -gate, hd);
  run(gate, hd, hw, hd);
  addFlowerBed(ctx, f, 0, -0.6, 5, 2.6);
  addPlanter(ctx, f, -hw + 0.8, hd - 0.8);
  addPlanter(ctx, f, hw - 0.8, hd - 0.8);
}

/// <summary>Flat stone disc of radius <paramref name="r"/> at (<paramref name="x"/>, <paramref name="z"/>).</summary>
export function addPlaza(ctx, x, z, r) {
  ctx.scene.add(cylinder(r, r, 0.05, 0xcfc7bd, x, 0.025, z));
}
