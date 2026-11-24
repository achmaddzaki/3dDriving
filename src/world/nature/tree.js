import * as THREE from 'three';
import { WORLD_LIMIT, ZONES, inRect, grow, range, rand, obstacles } from '../../core/world.js';
import { groundHeight } from '../../core/terrain.js';

const TREE_COUNT = 6000;
const TRUNK_COLOR = 0x6b4423;
// Random size of each placed tree, as a multiple of the model's base size
const MIN_SCALE = 0.6;
const MAX_SCALE = 2.0;

// One material shared by every tree. Colors come from vertex colors baked into each model's geometry.
const treeMaterial = new THREE.MeshLambertMaterial({ vertexColors: true });

// Sets a flat color on every vertex, then stretches the geometry by sy in height and moves it to (x, y, z)
function part(geometry, color, x = 0, y = 0, z = 0, sy = 1) {
  geometry.scale(1, sy, 1);
  geometry.translate(x, y, z);
  const count = geometry.attributes.position.count;
  const c = new THREE.Color(color);
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) colors.set([c.r, c.g, c.b], i * 3);
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geometry;
}

function trunk(h, r, color = TRUNK_COLOR) {
  return part(new THREE.CylinderGeometry(r * 0.7, r, h, 12), color, 0, h / 2);
}

// Sphere with a smooth, deterministic bumpy surface so foliage is not a perfect ball
function lumpy(r) {
  const g = new THREE.SphereGeometry(r, 16, 12);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    const k = 1 + 0.12 * Math.sin(x * 2.1 + y * 1.7) * Math.cos(z * 2.3 - y * 1.3);
    p.setXYZ(i, x * k, y * k, z * k);
  }
  g.computeVertexNormals();
  return g;
}

function blob(r, color, x, y, z, sy = 1) {
  return part(lumpy(r), color, x, y, z, sy);
}

function cone(r, h, color, y) {
  return part(new THREE.ConeGeometry(r, h, 14), color, 0, y);
}

// Branch that starts on the trunk axis at height y0 and runs to the tip at offset (dx, dy), so it stays attached
function branch(y0, dx, dy, r) {
  const len = Math.hypot(dx, dy);
  const g = new THREE.CylinderGeometry(r * 0.6, r, len, 6);
  g.rotateZ(Math.atan2(-dx, dy));
  return part(g, TRUNK_COLOR, dx / 2, y0 + dy / 2, 0);
}

// Log lying on the ground along X, with lighter cut ends
function fallenLog(len, r) {
  const body = new THREE.CylinderGeometry(r, r * 0.9, len, 10);
  body.rotateZ(Math.PI / 2);
  const cutEnd = (x) => {
    const g = new THREE.CylinderGeometry(r * 0.9, r * 0.9, 0.04, 10);
    g.rotateZ(Math.PI / 2);
    return part(g, 0xc8a27a, x, r, 0);
  };
  return [part(body, TRUNK_COLOR, 0, r), cutEnd(len / 2 + 0.02), cutEnd(-len / 2 - 0.02)];
}

// Joins colored parts into one indexed geometry so a tree draws in a single call
function mergeParts(parts) {
  const vertexTotal = parts.reduce((n, g) => n + g.attributes.position.count, 0);
  const indexTotal = parts.reduce((n, g) => n + g.index.count, 0);
  const position = new Float32Array(vertexTotal * 3);
  const normal = new Float32Array(vertexTotal * 3);
  const color = new Float32Array(vertexTotal * 3);
  const index = new Uint32Array(indexTotal);
  let v = 0;
  let k = 0;
  for (const g of parts) {
    position.set(g.attributes.position.array, v * 3);
    normal.set(g.attributes.normal.array, v * 3);
    color.set(g.attributes.color.array, v * 3);
    for (const i of g.index.array) index[k++] = i + v;
    v += g.attributes.position.count;
  }
  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.BufferAttribute(position, 3));
  merged.setAttribute('normal', new THREE.BufferAttribute(normal, 3));
  merged.setAttribute('color', new THREE.BufferAttribute(color, 3));
  merged.setIndex(new THREE.BufferAttribute(index, 1));
  merged.computeBoundingSphere();
  merged.computeBoundingBox();
  return merged;
}

// `crown` is the clearance kept from roads and lots, `trunkRadius` is the collision circle, both at scale 1.
function model(name, crown, trunkRadius, parts) {
  return { name, crown, trunkRadius, geometry: mergeParts(parts) };
}

export const TREE_MODELS = [
  model('Fir', 2.2, 1.2, [trunk(2, 0.35), cone(2.2, 5, 0x2e7d32, 4.5)]),
  model('Oak', 2.6, 1.0, [trunk(2.5, 0.4), blob(2.4, 0x3f8f3a, 0, 4.3, 0)]),
  model('Pine', 1.8, 1.0, [trunk(1.5, 0.3), cone(1.8, 3, 0x1b5e20, 3), cone(1.4, 2.5, 0x1b5e20, 5)]),
  model('Palm', 1.6, 0.6, [
    trunk(5, 0.25, 0x8d6e63),
    blob(1.1, 0x43a047, 0, 5.1, 0),
    blob(0.8, 0x2e7d32, 0.7, 5.4, 0),
    blob(0.8, 0x2e7d32, -0.6, 5.3, 0.4),
  ]),
  model('Birch', 1.7, 0.5, [trunk(4, 0.2, 0xe0e0e0), blob(1.6, 0x9ccc65, 0, 4.4, 0)]),
  model('Autumn', 2.4, 1.0, [trunk(2.2, 0.35), blob(2.3, 0xd84315, 0, 4.2, 0)]),
  model('Cherry Blossom', 2.2, 0.6, [
    trunk(2.4, 0.3, 0x5d4037),
    blob(1.8, 0xf8bbd0, 0, 4.0, 0),
    blob(1.2, 0xf48fb1, 1.1, 3.6, 0.4),
    blob(1.1, 0xf8bbd0, -1.0, 3.7, -0.4),
  ]),
  model('Cypress', 1.2, 0.5, [trunk(1.2, 0.25), cone(1.1, 6.5, 0x1b5e20, 4.2)]),
  model('Willow', 2.8, 0.8, [
    trunk(3, 0.4, 0x6d4c41),
    blob(2.6, 0xaed581, 0, 4.4, 0, 0.6),
    blob(0.9, 0x9ccc65, 1.8, 2.8, 0),
    blob(0.9, 0x9ccc65, -1.8, 2.8, 0),
    blob(0.9, 0x9ccc65, 0, 2.8, 1.8),
    blob(0.9, 0x9ccc65, 0, 2.8, -1.8),
  ]),
  model('Topiary', 1.2, 0.4, [trunk(1.6, 0.15, 0x795548), blob(1.0, 0x66bb6a, 0, 2.3, 0)]),
  model('Spruce', 1.9, 0.8, [
    trunk(1.2, 0.25),
    cone(1.9, 2.6, 0x1b5e20, 2.4),
    cone(1.5, 2.4, 0x1b5e20, 4.0),
    cone(1.1, 2.2, 0x1b5e20, 5.5),
  ]),
  model('Poplar', 1.3, 0.5, [trunk(1.0, 0.22), blob(1.2, 0x558b2f, 0, 3.4, 0, 2.2)]),
  model('Maple', 2.2, 0.9, [
    trunk(2.0, 0.32, 0x6d4c41),
    blob(2.0, 0xe65100, 0, 3.6, 0),
    blob(1.3, 0xef6c00, 1.2, 3.0, 0.4),
    blob(1.2, 0xf9a825, -1.0, 3.3, -0.5),
  ]),
  model('Olive', 2.0, 0.8, [
    trunk(1.4, 0.3, 0x8d6e63),
    blob(1.8, 0x7b8f4e, 0, 2.6, 0, 0.6),
    blob(1.4, 0x8fa35f, 1.6, 2.4, 0.6, 0.6),
    blob(1.3, 0x7b8f4e, -1.4, 2.5, -0.5, 0.6),
  ]),
  model('Acacia', 2.0, 0.5, [trunk(3.2, 0.22, 0x795548), blob(1.9, 0x7cb342, 0, 3.6, 0, 0.35), blob(1.2, 0x8bc34a, 1.6, 3.3, 0.3, 0.35)]),
  model('Dead Tree', 0.8, 0.5, [
    trunk(3.6, 0.25, 0x5d4037),
    branch(2.2, 0.9, 0.8, 0.1),
    branch(2.8, -0.7, 0.6, 0.09),
    branch(3.2, 0.5, 0.5, 0.08),
  ]),
  model('Fallen Log', 1.2, 0.5, fallenLog(4, 0.45)),
];

// Trees only on grass, with the crown kept clear of roads, sidewalks, parking, and buildings
export function addTrees(scene, lots) {
  const blockers = [...ZONES, ...lots];
  for (let i = 0; i < TREE_COUNT; i++) {
    const x = range(-WORLD_LIMIT, WORLD_LIMIT);
    const z = range(-WORLD_LIMIT, WORLD_LIMIT);
    const model = TREE_MODELS[Math.floor(rand() * TREE_MODELS.length)];
    const scale = range(MIN_SCALE, MAX_SCALE);
    if (blockers.some((r) => inRect(x, z, grow(r, model.crown * scale)))) continue;
    addTree(scene, model, x, z, scale, range(0, Math.PI * 2));
  }
}

/// <summary>Places a <paramref name="model"/> tree at (<paramref name="x"/>, <paramref name="z"/>), scaled and turned, with its trunk collision.</summary>
export function addTree(scene, model, x, z, scale = 1, rotY = 0) {
  const mesh = new THREE.Mesh(model.geometry, treeMaterial);
  mesh.position.set(x, groundHeight(x, z), z);
  mesh.rotation.y = rotY;
  mesh.scale.setScalar(scale);
  mesh.castShadow = true;
  scene.add(mesh);
  obstacles.push({ x, z, r: model.trunkRadius * scale });
}
