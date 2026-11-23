import * as THREE from 'three';
import { box } from '../../core/primitives.js';
import {
  WORLD_LIMIT,
  SIDEWALK_WIDTH,
  STREETS,
  ZONES,
  rectsOverlap,
  range,
  rand,
  obstacles,
} from '../../core/world.js';
import { pickModel, randomShopName } from './models.js';
import { addFacades, addGableRoof, addRoadSign, addRoofTrim, addShopLabel } from './facade.js';
import { addParkContents } from './park.js';
import { buildDistributor } from './distributor.js';

const LOT_CHANCE = 0.15;
const SLOT_STEP = 10;
const LOT_GAP = 3;

const lotMat = new THREE.MeshLambertMaterial({ color: 0x5a5a5e });
const lawnMat = new THREE.MeshLambertMaterial({ color: 0x66bb6a });

// Fixed distributor lot on the west side of the main road, reserved before random lots
const DISTRIBUTOR = { t: -30, lotAlong: 60, lotDepth: 45 };

// Parking lots with buildings or parks, tried along both sides of every street.
// Returns all lots, the store lots, the distributor lot, and its parking spots.
export function buildTown(scene, spotCount) {
  const lots = [];
  const stores = [];
  const distributor = addDistributor(scene, lots, spotCount);
  for (const s of STREETS) {
    for (const side of [-1, 1]) {
      let t = -WORLD_LIMIT;
      while (t < WORLD_LIMIT) {
        const spec = makeSpec(pickModel());
        const placed = rand() <= LOT_CHANCE && tryAddLot(scene, lots, stores, s, side, t, spec);
        t += placed ? spec.lotAlong + LOT_GAP : SLOT_STEP;
      }
    }
  }
  return { lots, stores, spots: distributor.spots, distributorLot: distributor.lot };
}

function addDistributor(scene, lots, spotCount) {
  const lot = lotRect(STREETS[0], -1, DISTRIBUTOR.t, DISTRIBUTOR);
  lots.push(lot);
  addLotSurface(scene, lot, lotMat);
  return { lot, spots: buildDistributor(scene, lot, spotCount) };
}

// Random size for the chosen model. The lot is larger than the building, with random parking room.
function makeSpec(model) {
  const along = range(model.along[0], model.along[1]);
  const perp = range(model.perp[0], model.perp[1]);
  const strip = range(6, 12);      // parking between the sidewalk and the building
  const sideSpace = range(4, 10);  // parking on each side of the building along the street
  const behind = range(3, 6);      // lot space behind the building
  return {
    model,
    along,
    perp,
    strip,
    height: range(model.height[0], model.height[1]),
    color: model.colors[Math.floor(rand() * model.colors.length)],
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

// Adds a lot and its contents when the spot is free. Lots may not touch roads, sidewalks, or other lots.
function tryAddLot(scene, lots, stores, s, side, t, spec) {
  const lot = lotRect(s, side, t, spec);
  const insideWorld = lot.minX >= -WORLD_LIMIT && lot.maxX <= WORLD_LIMIT
    && lot.minZ >= -WORLD_LIMIT && lot.maxZ <= WORLD_LIMIT;
  if (!insideWorld) return false;
  if (ZONES.some((r) => rectsOverlap(r, lot)) || lots.some((l) => rectsOverlap(l, lot))) return false;

  const isPark = spec.model.kind === 'park';
  const name = spec.model.sign ? randomShopName(spec.model.name) : null;
  lots.push(lot);
  if (name) stores.push({ name, rect: lot });
  addLotSurface(scene, lot, isPark ? lawnMat : lotMat);
  if (isPark) {
    addParkContents(scene, lot);
  } else {
    addBuildingInLot(scene, s, side, t, spec, name);
  }
  return true;
}

function addLotSurface(scene, lot, mat) {
  const slab = new THREE.Mesh(
    new THREE.BoxGeometry(lot.maxX - lot.minX, 0.02, lot.maxZ - lot.minZ),
    mat
  );
  slab.position.set((lot.minX + lot.maxX) / 2, 0.015, (lot.minZ + lot.maxZ) / 2);
  slab.receiveShadow = true;
  scene.add(slab);
}

// Building is centered along the lot and sits in its far half
function addBuildingInLot(scene, s, side, t, spec, name) {
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
  addRoofTrim(scene, x, z, w, spec.height, d, spec.model.roof);
  if (spec.model.roof === 'gable') addGableRoof(scene, x, z, w, spec.height, d);
  addFacades(scene, x, z, w, spec.height, d, road);
  if (spec.model.sign) {
    addRoadSign(scene, x, z, w, d, road, spec.model.sign);
    addShopLabel(scene, x, z, w, d, road, name, spec.model.sign);
  }
}
