import * as THREE from 'three';
import { box, sphere } from '../../core/primitives.js';
import { WORLD_LIMIT, ZONES, inRect, grow, range, rand } from '../../core/world.js';
import { groundHeight } from '../../core/terrain.js';

const BUSH_COUNT = 2500;

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

function cone(r, h, color, x, y, z) {
  const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, 8), lambert(color));
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

// Circles of every placed bush, { x, z, r }, used to slow the vehicle while it is inside one
const bushAreas = [];

/// <summary>True when (<paramref name="x"/>, <paramref name="z"/>) is inside a bush.</summary>
export function inBush(x, z) {
  return bushAreas.some((b) => (b.x - x) ** 2 + (b.z - z) ** 2 < b.r * b.r);
}

// Each model: `clearance` is the gap kept from roads, sidewalks, parking, and buildings.
// `radius` is the footprint used for the slow-down area. Bushes are decoration only, so they have no collision.
const BUSH_MODELS = [
  {
    name: 'Round',
    clearance: 1.2,
    radius: 1.0,
    build(g) {
      g.add(leaf(0.9, 0x3f8f3a, 0, 0.7, 0));
      g.add(leaf(0.6, 0x4a9d44, 0.6, 0.5, 0.2));
      g.add(leaf(0.6, 0x4a9d44, -0.5, 0.5, -0.3));
    },
  },
  {
    name: 'Flowering',
    clearance: 1.2,
    radius: 1.0,
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
    radius: 1.2,
    build(g) {
      g.add(box(2.2, 0.9, 0.9, lambert(0x2e7d32), 0, 0.45, 0));
    },
  },
  {
    name: 'Lime Shrub',
    clearance: 1.2,
    radius: 0.9,
    build(g) {
      g.add(leaf(0.7, 0x7cb342, 0, 0.5, 0));
      g.add(leaf(0.5, 0x8bc34a, 0.6, 0.35, 0.3));
    },
  },
  {
    name: 'Berry',
    clearance: 1.2,
    radius: 0.9,
    build(g) {
      g.add(leaf(0.8, 0x2e6b2e, 0, 0.65, 0));
      g.add(leaf(0.12, 0xd32f2f, 0.4, 1.1, 0.3));
      g.add(leaf(0.12, 0xd32f2f, -0.3, 0.95, 0.5));
      g.add(leaf(0.12, 0xd32f2f, 0.2, 0.9, -0.6));
    },
  },
  {
    name: 'Conifer',
    clearance: 1.2,
    radius: 0.7,
    build(g) {
      g.add(cone(0.6, 1.4, 0x1b5e20, 0, 0.7, 0));
      g.add(cone(0.42, 1.0, 0x2e7d32, 0, 1.2, 0));
    },
  },
  {
    name: 'Rose',
    clearance: 1.2,
    radius: 0.9,
    build(g) {
      g.add(leaf(0.8, 0x558b2f, 0, 0.7, 0));
      g.add(leaf(0.14, 0xe53935, 0.5, 1.25, 0.2));
      g.add(leaf(0.14, 0xe53935, -0.4, 1.15, 0.35));
      g.add(leaf(0.14, 0xe53935, 0.1, 1.3, -0.45));
    },
  },
  {
    name: 'Hydrangea',
    clearance: 1.2,
    radius: 1.0,
    build(g) {
      g.add(leaf(0.85, 0x4caf50, 0, 0.75, 0));
      g.add(leaf(0.2, 0x5c6bc0, 0.5, 1.2, 0.3));
      g.add(leaf(0.2, 0x7e57c2, -0.45, 1.1, 0.4));
      g.add(leaf(0.2, 0x5c6bc0, 0.1, 1.25, -0.5));
    },
  },
  {
    name: 'Boxwood',
    clearance: 1.2,
    radius: 0.9,
    build(g) {
      g.add(box(1.2, 0.9, 1.2, lambert(0x33691e), 0, 0.45, 0));
    },
  },
  {
    name: 'Autumn',
    clearance: 1.2,
    radius: 1.0,
    build(g) {
      g.add(leaf(0.9, 0xef6c00, 0, 0.7, 0));
      g.add(leaf(0.6, 0xf9a825, 0.5, 0.5, 0.3));
      g.add(leaf(0.5, 0xd84315, -0.5, 0.45, -0.2));
    },
  },
  {
    name: 'Fern',
    clearance: 1.0,
    radius: 0.8,
    build(g) {
      g.add(cone(0.45, 0.5, 0x43a047, 0, 0.25, 0));
      g.add(cone(0.4, 0.45, 0x388e3c, 0.45, 0.22, 0.2));
      g.add(cone(0.4, 0.45, 0x388e3c, -0.4, 0.22, -0.2));
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
  g.position.set(x, groundHeight(x, z), z);
  g.rotation.y = rand() * Math.PI * 2;
  scene.add(g);
  bushAreas.push({ x, z, r: model.radius });
}
