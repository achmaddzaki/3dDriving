import * as THREE from 'three';
import { WORLD_SIZE, ZONES } from './world.js';

// Rolling ground: gentle hills and valleys on open grass and lawn lots, flat on roads, sidewalks, and lots.
const AMPLITUDE = 3;      // meters the ground rises or dips at most
const FADE = 15;          // meters over which the ground eases from flat to rolling
const GRID = 2;           // meters between ground vertices
const LAWN_LIFT = 0.015;  // keeps lawn patches just above the ground, as the old lot slabs were
const GRASS_COLOR = 0x4a8f3a;

// Rects that stay flat. Roads and sidewalks are always flat. Lots are added by setFlatRects.
let flatRects = ZONES;

/// <summary>Sets the lot rects that stay flat, on top of the roads and sidewalks.</summary>
export function setFlatRects(rects) {
  flatRects = [...ZONES, ...rects];
}

// Distance from (<paramref name="x"/>, <paramref name="z"/>) to the nearest flat rect, zero inside one
function distanceToFlat(x, z) {
  let best = Infinity;
  for (const r of flatRects) {
    const dx = Math.max(r.minX - x, 0, x - r.maxX);
    const dz = Math.max(r.minZ - z, 0, z - r.maxZ);
    best = Math.min(best, Math.hypot(dx, dz));
    if (best === 0) break;
  }
  return best;
}

/// <summary>Ground height in meters at (<paramref name="x"/>, <paramref name="z"/>). Zero on flat areas, rolling elsewhere.</summary>
export function groundHeight(x, z) {
  const wave = (Math.sin(x * 0.021 + 1.1) * Math.cos(z * 0.017 - 0.4)
    + 0.6 * Math.sin(x * 0.047 - z * 0.039 + 2.3)
    + 0.4 * Math.cos(z * 0.061 + x * 0.013 - 0.8)) / 2;
  const t = Math.min(distanceToFlat(x, z) / FADE, 1);
  return AMPLITUDE * wave * t * t * (3 - 2 * t);
}

/// <summary>Adds the rolling ground over the whole world.</summary>
export function buildGround(scene) {
  const segments = WORLD_SIZE / GRID;
  const geo = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE, segments, segments);
  geo.rotateX(-Math.PI / 2);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, groundHeight(p.getX(i), p.getZ(i)));
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: GRASS_COLOR }));
  mesh.receiveShadow = true;
  scene.add(mesh);
}

/// <summary>Adds a lawn surface over <paramref name="lot"/> that follows the ground.</summary>
export function addLawnPatch(scene, lot, mat) {
  const w = lot.maxX - lot.minX;
  const d = lot.maxZ - lot.minZ;
  const geo = new THREE.PlaneGeometry(w, d, Math.ceil(w), Math.ceil(d));
  geo.rotateX(-Math.PI / 2);
  geo.translate((lot.minX + lot.maxX) / 2, 0, (lot.minZ + lot.maxZ) / 2);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, groundHeight(p.getX(i), p.getZ(i)) + LAWN_LIFT);
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  scene.add(mesh);
}
