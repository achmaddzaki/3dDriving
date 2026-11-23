import * as THREE from 'three';
import { addInstanced, matrixAt } from '../core/primitives.js';
import { WORLD_LIMIT, ZONES, inRect, grow, range, rand } from '../core/world.js';

const GRASS_COUNT = 14000;
const GRASS_CLEARANCE = 0.5; // gap kept from roads, sidewalks, lots, and landscaped areas
const TUFT_GEO = new THREE.ConeGeometry(0.07, 0.4, 4);
const TUFT_MAT = new THREE.MeshLambertMaterial({ color: 0xffffff });
const TUFT_COLORS = [0x558b2f, 0x689f38, 0x7cb342, 0x33691e].map((c) => new THREE.Color(c));

// Scatters grass tufts over open ground. `taken` lists the lots and landscaped rects to keep clear of.
export function addGrass(scene, taken) {
  const blockers = [...ZONES, ...taken];
  const matrices = [];
  const colors = [];
  for (let attempt = 0; attempt < GRASS_COUNT * 6 && matrices.length < GRASS_COUNT; attempt++) {
    const x = range(-WORLD_LIMIT, WORLD_LIMIT);
    const z = range(-WORLD_LIMIT, WORLD_LIMIT);
    if (blockers.some((r) => inRect(x, z, grow(r, GRASS_CLEARANCE)))) continue;
    const s = 0.7 + rand() * 0.8;
    matrices.push(matrixAt(x, 0.2 * s, z, s, s, s, rand() * Math.PI * 2));
    colors.push(TUFT_COLORS[Math.floor(rand() * TUFT_COLORS.length)]);
  }
  addInstanced(scene, TUFT_GEO, TUFT_MAT, matrices, colors);
}
