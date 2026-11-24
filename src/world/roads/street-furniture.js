import * as THREE from 'three';
import { addInstanced, matrixAt } from '../../core/primitives.js';
import { SIDEWALK_HEIGHT, STREET_FURNITURE_COLLISION, obstacles } from '../../core/world.js';
import { FURNITURE_TYPES, layoutFurniture } from './furniture-layout.js';

const UNIT_BOX = new THREE.BoxGeometry(1, 1, 1);
const UNIT_CYL = new THREE.CylinderGeometry(0.5, 0.5, 1, 12);
// Tinted parts use white here, so the per-instance color sets the final color
const tintMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
// Materials are shared by color so every object of a kind reuses them
const materials = new Map();

// Parts in the object frame: offset [lx, ly, lz] with lx along the street and lz away from the road.
// A part is either one fixed color (color) or the object's palette color (tint).
const PARTS = {
  streetLamp: [
    { geo: 'box', offset: [0, 2.0, 0], size: [0.12, 4.0, 0.12], color: 0x3e4448 },
    { geo: 'box', offset: [0, 4.08, 0], size: [0.3, 0.16, 0.36], color: 0xfff3c4 },
  ],
  bench: [
    { geo: 'box', offset: [0, 0.45, 0], size: [1.8, 0.08, 0.5], color: 0x8d6e63 },
    { geo: 'box', offset: [0, 0.715, 0.22], size: [1.8, 0.45, 0.06], color: 0x8d6e63 },
    { geo: 'box', offset: [-0.75, 0.225, 0], size: [0.08, 0.45, 0.5], color: 0x3e4448 },
    { geo: 'box', offset: [0.75, 0.225, 0], size: [0.08, 0.45, 0.5], color: 0x3e4448 },
  ],
  trashBin: [
    { geo: 'cyl', offset: [0, 0.5, 0], size: [0.6, 1.0, 0.6], tint: true },
    { geo: 'cyl', offset: [0, 1.04, 0], size: [0.62, 0.08, 0.62], color: 0x212121 },
  ],
  busShelter: [
    { geo: 'box', offset: [0, 2.3, 0], size: [2.4, 0.1, 1.2], color: 0x455a64 },
    { geo: 'box', offset: [0, 1.125, 0.575], size: [2.4, 2.25, 0.05], color: 0xb3e5fc },
    { geo: 'box', offset: [-1.175, 1.125, 0], size: [0.05, 2.25, 1.2], color: 0xb3e5fc },
    { geo: 'box', offset: [1.175, 1.125, 0], size: [0.05, 2.25, 1.2], color: 0xb3e5fc },
  ],
  mailbox: [
    { geo: 'box', offset: [0, 0.45, 0], size: [0.08, 0.9, 0.08], color: 0x3e4448 },
    { geo: 'box', offset: [0, 1.07, 0], size: [0.45, 0.35, 0.35], tint: true },
  ],
  newspaperStand: [
    { geo: 'box', offset: [0, 0.55, 0], size: [0.6, 1.1, 0.5], tint: true },
    { geo: 'box', offset: [0, 0.85, -0.26], size: [0.5, 0.3, 0.02], color: 0x263238 },
  ],
  vendingMachine: [
    { geo: 'box', offset: [0, 0.9, 0], size: [0.8, 1.8, 0.7], tint: true },
    { geo: 'box', offset: [0, 1.1, -0.345], size: [0.6, 0.9, 0.02], color: 0xeceff1 },
  ],
  electricalBox: [
    { geo: 'box', offset: [0, 0.65, 0], size: [0.6, 1.3, 0.35], tint: true },
  ],
  fireHydrant: [
    { geo: 'cyl', offset: [0, 0.325, 0], size: [0.24, 0.65, 0.24], color: 0xd32f2f },
    { geo: 'cyl', offset: [0, 0.7, 0], size: [0.2, 0.1, 0.2], color: 0xb71c1c },
  ],
  adBoard: [
    { geo: 'box', offset: [0, 0.025, 0], size: [0.7, 0.05, 0.5], color: 0x3e4448 },
    { geo: 'box', offset: [0, 0.55, 0], size: [0.6, 1.0, 0.05], tint: true },
  ],
};

// Returns the shared material for a hex color
function materialFor(hex) {
  if (!materials.has(hex)) materials.set(hex, new THREE.MeshLambertMaterial({ color: hex }));
  return materials.get(hex);
}

// Matrix for one part of a placed object, turned with the object's rotation
function partMatrix(p, part) {
  const [lx, ly, lz] = part.offset;
  const [sx, sy, sz] = part.size;
  const c = Math.cos(p.rotY);
  const s = Math.sin(p.rotY);
  return matrixAt(p.x + lx * c + lz * s, SIDEWALK_HEIGHT + ly, p.z - lx * s + lz * c, sx, sy, sz, p.rotY);
}

// One instanced mesh for one part across every placed object of its kind
function addPart(scene, type, part, list) {
  const matrices = list.map((p) => partMatrix(p, part));
  const geometry = part.geo === 'cyl' ? UNIT_CYL : UNIT_BOX;
  if (!part.tint) {
    addInstanced(scene, geometry, materialFor(part.color), matrices);
    return;
  }
  const colors = list.map((p) => new THREE.Color(type.colors[p.color]));
  addInstanced(scene, geometry, tintMat, matrices, colors);
}

/// <summary>
/// Adds all street furniture for the town <paramref name="lots"/> to <paramref name="scene"/>.
/// <paramref name="fixtures"/> are the pole positions to keep clear of.
/// Each footprint is also pushed to the obstacles when STREET_FURNITURE_COLLISION is on.
/// Returns the number of placed objects per kind.
/// </summary>
export function addStreetFurniture(scene, lots, fixtures) {
  const placements = layoutFurniture(lots, fixtures);
  const counts = {};
  for (const type of FURNITURE_TYPES) {
    const list = placements.filter((p) => p.type === type.id);
    counts[type.id] = list.length;
    for (const part of PARTS[type.id]) addPart(scene, type, part, list);
  }
  if (STREET_FURNITURE_COLLISION) {
    for (const p of placements) obstacles.push({ box: p.rect });
  }
  return counts;
}
