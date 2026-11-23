import * as THREE from 'three';
import { WORLD_LIMIT, ZONES, inRect, grow, range, rand, obstacles } from '../core/world.js';

const TREE_COUNT = 600;
const TRUNK_COLOR = 0x6b4423;

// Materials are shared by color so every tree reuses them
const materials = new Map();
function lam(color) {
  if (!materials.has(color)) {
    materials.set(color, new THREE.MeshLambertMaterial({ color }));
  }
  return materials.get(color);
}

function trunk(h, r, color = TRUNK_COLOR) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.7, r, h, 8), lam(color));
  m.position.y = h / 2;
  m.castShadow = true;
  return m;
}

function blob(r, color, x, y, z) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 10), lam(color));
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

function cone(r, h, color, y) {
  const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, 10), lam(color));
  m.position.y = y;
  m.castShadow = true;
  return m;
}

// Each model: `crown` is the clearance kept from roads and lots, `trunkRadius` is the collision circle.
const TREE_MODELS = [
  {
    name: 'Fir',
    crown: 2.2,
    trunkRadius: 1.2,
    build(g) {
      g.add(trunk(2, 0.35));
      g.add(cone(2.2, 5, 0x2e7d32, 4.5));
    },
  },
  {
    name: 'Oak',
    crown: 2.6,
    trunkRadius: 1.0,
    build(g) {
      g.add(trunk(2.5, 0.4));
      g.add(blob(2.4, 0x3f8f3a, 0, 4.3, 0));
    },
  },
  {
    name: 'Pine',
    crown: 1.8,
    trunkRadius: 1.0,
    build(g) {
      g.add(trunk(1.5, 0.3));
      g.add(cone(1.8, 3, 0x1b5e20, 3));
      g.add(cone(1.4, 2.5, 0x1b5e20, 5));
    },
  },
  {
    name: 'Palm',
    crown: 1.6,
    trunkRadius: 0.6,
    build(g) {
      g.add(trunk(5, 0.25, 0x8d6e63));
      g.add(blob(1.1, 0x43a047, 0, 5.1, 0));
      g.add(blob(0.8, 0x2e7d32, 0.7, 5.4, 0));
      g.add(blob(0.8, 0x2e7d32, -0.6, 5.3, 0.4));
    },
  },
  {
    name: 'Birch',
    crown: 1.7,
    trunkRadius: 0.5,
    build(g) {
      g.add(trunk(4, 0.2, 0xe0e0e0));
      g.add(blob(1.6, 0x9ccc65, 0, 4.4, 0));
    },
  },
  {
    name: 'Autumn',
    crown: 2.4,
    trunkRadius: 1.0,
    build(g) {
      g.add(trunk(2.2, 0.35));
      g.add(blob(2.3, 0xd84315, 0, 4.2, 0));
    },
  },
];

// Trees only on grass, with the crown kept clear of roads, sidewalks, parking, and buildings
export function addTrees(scene, lots) {
  const blockers = [...ZONES, ...lots];
  for (let i = 0; i < TREE_COUNT; i++) {
    const x = range(-WORLD_LIMIT, WORLD_LIMIT);
    const z = range(-WORLD_LIMIT, WORLD_LIMIT);
    const model = TREE_MODELS[Math.floor(rand() * TREE_MODELS.length)];
    if (blockers.some((r) => inRect(x, z, grow(r, model.crown)))) continue;
    addTree(scene, model, x, z);
  }
}

function addTree(scene, model, x, z) {
  const g = new THREE.Group();
  model.build(g);
  g.position.set(x, 0, z);
  scene.add(g);
  obstacles.push({ x, z, r: model.trunkRadius });
}
