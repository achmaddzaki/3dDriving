import * as THREE from 'three';
import { box, sphere } from '../../core/primitives.js';
import { WORLD_LIMIT, ZONES, inRect, grow, range, rand } from '../../core/world.js';

const BUSH_COUNT = 250;

// Materials are shared by color so every bush reuses them
const materials = new Map();
function lambert(color) {
  if (!materials.has(color)) {
    materials.set(color, new THREE.MeshLambertMaterial({ color }));
  }
  return materials.get(color);
}

function leaf(r, color, x, y, z) {
  return sphere(r, lambert(color), x, y, z);
}

// Each model: `clearance` is the gap kept from roads, sidewalks, parking, and buildings.
// Bushes are decoration only, so they have no collision.
const BUSH_MODELS = [
  {
    name: 'Round',
    clearance: 1.2,
    build(g) {
      g.add(leaf(0.9, 0x3f8f3a, 0, 0.7, 0));
      g.add(leaf(0.6, 0x4a9d44, 0.6, 0.5, 0.2));
      g.add(leaf(0.6, 0x4a9d44, -0.5, 0.5, -0.3));
    },
  },
  {
    name: 'Flowering',
    clearance: 1.2,
    build(g) {
      g.add(leaf(0.9, 0x3f8f3a, 0, 0.7, 0));
      g.add(leaf(0.18, 0xec407a, 0.5, 1.2, 0.3));
      g.add(leaf(0.18, 0xffffff, -0.4, 1.0, 0.5));
      g.add(leaf(0.18, 0xec407a, 0.1, 1.3, -0.5));
    },
  },
  {
    name: 'Hedge',
    clearance: 1.5,
    build(g) {
      g.add(box(2.2, 0.9, 0.9, lambert(0x2e7d32), 0, 0.45, 0));
    },
  },
  {
    name: 'Lime Shrub',
    clearance: 1.2,
    build(g) {
      g.add(leaf(0.7, 0x7cb342, 0, 0.5, 0));
      g.add(leaf(0.5, 0x8bc34a, 0.6, 0.35, 0.3));
    },
  },
  {
    name: 'Berry',
    clearance: 1.2,
    build(g) {
      g.add(leaf(0.8, 0x2e6b2e, 0, 0.65, 0));
      g.add(leaf(0.12, 0xd32f2f, 0.4, 1.1, 0.3));
      g.add(leaf(0.12, 0xd32f2f, -0.3, 0.95, 0.5));
      g.add(leaf(0.12, 0xd32f2f, 0.2, 0.9, -0.6));
    },
  },
];

// Bushes only on grass, kept clear of roads, sidewalks, parking, and buildings
export function addBushes(scene, lots) {
  const blockers = [...ZONES, ...lots];
  for (let i = 0; i < BUSH_COUNT; i++) {
    const x = range(-WORLD_LIMIT, WORLD_LIMIT);
    const z = range(-WORLD_LIMIT, WORLD_LIMIT);
    const model = BUSH_MODELS[Math.floor(rand() * BUSH_MODELS.length)];
    if (blockers.some((r) => inRect(x, z, grow(r, model.clearance)))) continue;
    addBush(scene, model, x, z);
  }
}

function addBush(scene, model, x, z) {
  const g = new THREE.Group();
  model.build(g);
  g.position.set(x, 0, z);
  g.rotation.y = rand() * Math.PI * 2;
  scene.add(g);
}
