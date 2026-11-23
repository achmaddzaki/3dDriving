import * as THREE from 'three';
import { box } from '../core/primitives.js';
import {
  WORLD_LIMIT,
  SIDEWALK_WIDTH,
  STREETS,
  ZONES,
  rectsOverlap,
  range,
  rand,
  obstacles,
} from '../core/world.js';

const LOT_CHANCE = 0.15;
const SLOT_STEP = 10;
const LOT_GAP = 3;
const COLORS = [0xb0bec5, 0xd7ccc8, 0x90a4ae, 0xe0e0e0];

const lotMat = new THREE.MeshLambertMaterial({ color: 0x5a5a5e });

// Parking lots with buildings, tried along both sides of every street
export function buildTown(scene) {
  const lots = [];
  for (const s of STREETS) {
    for (const side of [-1, 1]) {
      let t = -WORLD_LIMIT;
      while (t < WORLD_LIMIT) {
        const spec = makeSpec();
        const placed = rand() <= LOT_CHANCE && tryAddLot(scene, lots, s, side, t, spec);
        t += placed ? spec.lotAlong + LOT_GAP : SLOT_STEP;
      }
    }
  }
  return lots;
}

// Random building and lot size. The lot is larger than the building, with random parking room.
function makeSpec() {
  const along = range(12, 20);
  const perp = range(10, 16);
  const strip = range(6, 12);      // parking between the sidewalk and the building
  const sideSpace = range(4, 10);  // parking on each side of the building along the street
  const behind = range(3, 6);      // lot space behind the building
  return {
    along,
    perp,
    strip,
    height: range(12, 40),
    color: COLORS[Math.floor(rand() * COLORS.length)],
    lotAlong: along + sideSpace * 2,
    lotDepth: strip + perp + behind,
  };
}

// Lot footprint: starts at the sidewalk edge and extends away from the street
function lotRect(s, side, t, spec) {
  const near = s.halfWidth + SIDEWALK_WIDTH;
  const edgeA = s.offset + side * near;
  const edgeB = edgeA + side * spec.lotDepth;
  const perpMin = Math.min(edgeA, edgeB);
  const perpMax = Math.max(edgeA, edgeB);
  return s.alongX
    ? { minX: t, maxX: t + spec.lotAlong, minZ: perpMin, maxZ: perpMax }
    : { minX: perpMin, maxX: perpMax, minZ: t, maxZ: t + spec.lotAlong };
}

// Adds a lot and its building when the spot is free. Lots may not touch roads, sidewalks, or other lots.
function tryAddLot(scene, lots, s, side, t, spec) {
  const lot = lotRect(s, side, t, spec);
  const insideWorld = lot.minX >= -WORLD_LIMIT && lot.maxX <= WORLD_LIMIT
    && lot.minZ >= -WORLD_LIMIT && lot.maxZ <= WORLD_LIMIT;
  if (!insideWorld) return false;
  if (ZONES.some((r) => rectsOverlap(r, lot)) || lots.some((l) => rectsOverlap(l, lot))) return false;

  lots.push(lot);
  addLotSurface(scene, lot);
  addBuildingInLot(scene, s, side, t, spec);
  return true;
}

function addLotSurface(scene, lot) {
  const slab = new THREE.Mesh(
    new THREE.BoxGeometry(lot.maxX - lot.minX, 0.02, lot.maxZ - lot.minZ),
    lotMat
  );
  slab.position.set((lot.minX + lot.maxX) / 2, 0.015, (lot.minZ + lot.maxZ) / 2);
  slab.receiveShadow = true;
  scene.add(slab);
}

// Building is centered along the lot and sits in its far half
function addBuildingInLot(scene, s, side, t, spec) {
  const alongC = t + spec.lotAlong / 2;
  const perpC = s.offset + side * (s.halfWidth + SIDEWALK_WIDTH + spec.strip + spec.perp / 2);
  const x = s.alongX ? alongC : perpC;
  const z = s.alongX ? perpC : alongC;
  const w = s.alongX ? spec.along : spec.perp;
  const d = s.alongX ? spec.perp : spec.along;
  const mat = new THREE.MeshLambertMaterial({ color: spec.color });

  scene.add(box(w, spec.height, d, mat, x, spec.height / 2, z));
  obstacles.push({ box: { minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 } });

  // Direction from the building toward the street
  const road = s.alongX ? { nx: 0, nz: -side } : { nx: -side, nz: 0 };
  addFacades(scene, x, z, w, spec.height, d, road);
}

const FLOOR_HEIGHT = 3.5;
const WINDOW_SPACING = 3;
const WINDOW_W = 1.6;
const WINDOW_H = 1.8;
const DOOR_W = 1.4;
const DOOR_H = 2.4;
const PANE_DEPTH = 0.1;
const WALL_OUTSET = 0.02;
const GLASS_MAT = new THREE.MeshLambertMaterial({ color: 0x9fd8f5 });
const DOOR_MAT = new THREE.MeshLambertMaterial({ color: 0x5d4037 });
const UNIT_BOX = new THREE.BoxGeometry(1, 1, 1);
const WALLS = [
  { nx: 1, nz: 0 },
  { nx: -1, nz: 0 },
  { nx: 0, nz: 1 },
  { nx: 0, nz: -1 },
];

// Windows on every wall, and a door on the wall facing the street
function addFacades(scene, cx, cz, w, h, d, road) {
  const windows = [];
  const floors = Math.max(1, Math.floor(h / FLOOR_HEIGHT));
  for (const wall of WALLS) {
    const facesRoad = wall.nx === road.nx && wall.nz === road.nz;
    const alongZ = wall.nx !== 0;
    const len = alongZ ? d : w;
    const half = alongZ ? w / 2 : d / 2;
    const count = Math.max(1, Math.floor((len - 2) / WINDOW_SPACING));
    for (let f = 0; f < floors; f++) {
      const y = f * FLOOR_HEIGHT + FLOOR_HEIGHT / 2;
      for (let i = 0; i < count; i++) {
        const t = -len / 2 + (i + 0.5) * (len / count);
        if (facesRoad && f === 0 && Math.abs(t) < (DOOR_W + WINDOW_W) / 2) continue;
        windows.push(paneMatrix(cx, cz, wall, half, t, y, WINDOW_W, WINDOW_H));
      }
    }
    if (facesRoad) addDoor(scene, paneMatrix(cx, cz, wall, half, 0, DOOR_H / 2, DOOR_W, DOOR_H));
  }
  addWindows(scene, windows);
}

// Transform for a flat pane on a wall. `t` is the position along the wall, `half` is the distance to the wall.
function paneMatrix(cx, cz, wall, half, t, y, pw, ph) {
  const alongZ = wall.nx !== 0;
  const off = half + WALL_OUTSET;
  const pos = alongZ
    ? new THREE.Vector3(cx + wall.nx * off, y, cz + t)
    : new THREE.Vector3(cx + t, y, cz + wall.nz * off);
  const scale = alongZ
    ? new THREE.Vector3(PANE_DEPTH, ph, pw)
    : new THREE.Vector3(pw, ph, PANE_DEPTH);
  return new THREE.Matrix4().compose(pos, new THREE.Quaternion(), scale);
}

// All windows of one building in a single instanced mesh
function addWindows(scene, matrices) {
  if (matrices.length === 0) return;
  const glass = new THREE.InstancedMesh(UNIT_BOX, GLASS_MAT, matrices.length);
  matrices.forEach((m, i) => glass.setMatrixAt(i, m));
  scene.add(glass);
}

function addDoor(scene, matrix) {
  const door = new THREE.Mesh(UNIT_BOX, DOOR_MAT);
  door.applyMatrix4(matrix);
  scene.add(door);
}
