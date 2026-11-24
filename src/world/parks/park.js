import * as THREE from 'three';
import { box } from '../../core/primitives.js';
import { createContext, flushContext, frame, mulberry32, addFlowerBed, addHedgeRun, addPlanter } from '../nature/landscape-parts.js';

const ENTRY_HALF = 2; // half width of the gate gap in the middle of each side

const STONE_MAT = new THREE.MeshLambertMaterial({ color: 0xbdbdbd });
const WATER_MAT = new THREE.MeshLambertMaterial({ color: 0x4fc3f7 });
const WOOD_MAT = new THREE.MeshLambertMaterial({ color: 0x8d6e63 });

// Fountain in the middle of the lot, two benches with planters, and a flower bed in each corner
export function addParkContents(scene, lot) {
  const cx = (lot.minX + lot.maxX) / 2;
  const cz = (lot.minZ + lot.maxZ) / 2;
  const basin = new THREE.Mesh(new THREE.CylinderGeometry(2, 2.2, 0.6, 16), STONE_MAT);
  basin.position.set(cx, 0.3, cz);
  basin.castShadow = true;
  scene.add(basin);
  const water = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 0.05, 16), WATER_MAT);
  water.position.set(cx, 0.62, cz);
  scene.add(water);
  for (const dx of [-4, 4]) {
    scene.add(box(1.6, 0.2, 0.5, WOOD_MAT, cx + dx, 0.5, cz));
  }
  addParkGardens(scene, lot, cx, cz);
}

function addParkGardens(scene, lot, cx, cz) {
  const ctx = createContext(scene, mulberry32(Math.floor(cx * 31 + cz * 17)));
  const reachX = (lot.maxX - lot.minX) / 2 - 2.2;
  const reachZ = (lot.maxZ - lot.minZ) / 2 - 2.2;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) addFlowerBed(ctx, frame(cx + sx * reachX, cz + sz * reachZ, 0), 0, 0, 2.6, 2.6);
    addPlanter(ctx, frame(cx + sx * 5.4, cz, 0), 0, 0);
  }
  addHedgeBorder(lot, cx, cz, ctx);
  flushContext(ctx);
}

// Hedge around all four sides, with a gate gap in the middle of each side
function addHedgeBorder(lot, cx, cz, ctx) {
  const x0 = lot.minX + 0.5;
  const x1 = lot.maxX - 0.5;
  const z0 = lot.minZ + 0.5;
  const z1 = lot.maxZ - 0.5;
  for (const z of [z0, z1]) {
    addHedgeRun(ctx, x0, z, cx - ENTRY_HALF, z);
    addHedgeRun(ctx, cx + ENTRY_HALF, z, x1, z);
  }
  for (const x of [x0, x1]) {
    addHedgeRun(ctx, x, z0, x, cz - ENTRY_HALF);
    addHedgeRun(ctx, x, cz + ENTRY_HALF, x, z1);
  }
}
