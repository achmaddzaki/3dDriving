import * as THREE from 'three';
import { WORLD_LIMIT, ZONES, inRect, grow, range, rand, obstacles } from '../../core/world.js';
import { groundHeight } from '../../core/terrain.js';

const ROCK_COUNT = 1500;
// Random size of each placed rock, as a multiple of the model's base size
const MIN_SCALE = 0.5;
const MAX_SCALE = 2.5;
const VARIANTS_PER_MODEL = 3;

// Materials are shared by color so every rock reuses them
const materials = new Map();
function stone(color) {
  if (!materials.has(color)) {
    materials.set(color, new THREE.MeshLambertMaterial({ color }));
  }
  return materials.get(color);
}

// Irregular rock: an icosahedron with each vertex pushed in or out by a deterministic amount.
// `seed` picks a different shape, and `squash` flattens the height.
function rockGeometry(radius, seed, squash) {
  const g = new THREE.IcosahedronGeometry(radius, 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    const k = 1 + 0.22 * Math.sin(x * 1.9 + seed) * Math.cos(y * 2.3 - z * 1.7 + seed * 2);
    p.setXYZ(i, x * k, y * k * squash, z * k);
  }
  g.computeVertexNormals();
  return g;
}

// `size` is the base radius, `solid` makes the rock a collision circle, and `clearance` is the gap kept from roads and lots at scale 1.
function rockModel(name, color, size, squash, solid) {
  const geometries = [];
  for (let s = 0; s < VARIANTS_PER_MODEL; s++) geometries.push(rockGeometry(size, s + 1, squash));
  return { name, color, size, solid, geometries };
}

export const ROCK_MODELS = [
  rockModel('Granite', 0x7d7d7d, 1.0, 0.7, true),
  rockModel('Sandstone', 0xb08d57, 1.3, 0.6, true),
  rockModel('Slate', 0x5f6b73, 0.8, 0.45, true),
  rockModel('Mossy Boulder', 0x6b7f5a, 1.1, 0.8, true),
  rockModel('Large Boulder', 0x8a8a8a, 2.2, 0.65, true),
  rockModel('Pebble', 0x9e9e9e, 0.35, 0.6, false),
];

// Rocks only on grass, kept clear of roads, sidewalks, parking, and buildings
export function addRocks(scene, lots) {
  const blockers = [...ZONES, ...lots];
  for (let i = 0; i < ROCK_COUNT; i++) {
    const x = range(-WORLD_LIMIT, WORLD_LIMIT);
    const z = range(-WORLD_LIMIT, WORLD_LIMIT);
    const model = ROCK_MODELS[Math.floor(rand() * ROCK_MODELS.length)];
    const scale = range(MIN_SCALE, MAX_SCALE);
    const clearance = model.size * scale + 1;
    if (blockers.some((r) => inRect(x, z, grow(r, clearance)))) continue;
    const geometry = model.geometries[Math.floor(rand() * model.geometries.length)];
    addRock(scene, model, geometry, x, z, scale, range(0, Math.PI * 2));
  }
}

/// <summary>Places a rock of <paramref name="model"/> at (<paramref name="x"/>, <paramref name="z"/>), scaled and turned, with collision when it is solid.</summary>
export function addRock(scene, model, geometry, x, z, scale, rotY) {
  const mesh = new THREE.Mesh(geometry, stone(model.color));
  mesh.position.set(x, groundHeight(x, z), z);
  mesh.rotation.y = rotY;
  mesh.scale.setScalar(scale);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  if (model.solid) obstacles.push({ x, z, r: model.size * scale * 0.9 });
}
