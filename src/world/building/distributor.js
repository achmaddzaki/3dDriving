import * as THREE from 'three';
import { box } from '../../core/primitives.js';
import { obstacles } from '../../core/world.js';
import { addFacades, addRoadSign, addRoofTrim, addShopLabel } from './facade.js';

const TOWER_HEIGHT = 38;
const WAREHOUSE_HEIGHT = 9;
const TOWER_COLOR = 0xcfd8dc;
const WAREHOUSE_COLOR = 0xc5a880;
const SIGN_COLOR = 0x1565c0;
const SPOT_SPACING = 6;
const STREET_SIDE = { nx: 1, nz: 0 }; // the main road is on the +X side of the lot

const DOOR_WIDTH = 4;
const DOOR_HEIGHT = 4.5;
const DOOR_THICKNESS = 0.12;
const DOOR_SLATS = 3;
const DOOR_COLOR = 0x546e7a;
const SLAT_COLOR = 0x37474f;
const SIGN_Y_ABOVE_DOORS = 6.3;

const BOX_SIZE = 1.1;
const BOX_MAT = new THREE.MeshLambertMaterial({ color: 0xb08a57 });

// Distributor lot: a tall office tower, a wide warehouse with loading doors, boxes, and one parking spot per vehicle.
// Returns the parking spots as { x, z, heading } in the same order as the vehicles.
export function buildDistributor(scene, lot, spotCount) {
  const tower = addBlock(scene, {
    minX: lot.minX + 3, maxX: lot.minX + 15, minZ: lot.minZ + 44, maxZ: lot.minZ + 56,
  }, TOWER_HEIGHT, TOWER_COLOR);
  addFacades(scene, tower.cx, tower.cz, tower.w, TOWER_HEIGHT, tower.d, STREET_SIDE);
  addRoofTrim(scene, tower.cx, tower.cz, tower.w, TOWER_HEIGHT, tower.d);

  const warehouseRect = {
    minX: lot.minX + 3, maxX: lot.minX + 17, minZ: lot.minZ + 4, maxZ: lot.minZ + 40,
  };
  const warehouse = addBlock(scene, warehouseRect, WAREHOUSE_HEIGHT, WAREHOUSE_COLOR);
  addRoofTrim(scene, warehouse.cx, warehouse.cz, warehouse.w, WAREHOUSE_HEIGHT, warehouse.d);
  addRoadSign(scene, warehouse.cx, warehouse.cz, warehouse.w, warehouse.d, STREET_SIDE, SIGN_COLOR, SIGN_Y_ABOVE_DOORS);
  addShopLabel(scene, warehouse.cx, warehouse.cz, warehouse.w, warehouse.d, STREET_SIDE, 'Distributor', SIGN_COLOR, SIGN_Y_ABOVE_DOORS);
  addLoadingDoors(scene, warehouseRect, [lot.minZ + 10, lot.minZ + 23, lot.minZ + 36]);

  addBoxStack(scene, lot.minX + 19.5, lot.minZ + 50, 2, 2, 3);
  addBoxStack(scene, lot.minX + 32, lot.minZ + 52, 3, 2, 2);
  addBoxStack(scene, lot.minX + 41, lot.minZ + 53, 2, 2, 1);

  const spots = [];
  for (let i = 0; i < spotCount; i++) {
    spots.push({ x: lot.maxX - 16, z: lot.minZ + 12 + i * SPOT_SPACING, heading: Math.PI / 2 });
  }
  return spots;
}

// Solid block that cars cannot drive through
function addBlock(scene, rect, height, color) {
  const w = rect.maxX - rect.minX;
  const d = rect.maxZ - rect.minZ;
  const cx = (rect.minX + rect.maxX) / 2;
  const cz = (rect.minZ + rect.maxZ) / 2;
  scene.add(box(w, height, d, new THREE.MeshLambertMaterial({ color }), cx, height / 2, cz));
  obstacles.push({ box: rect });
  return { cx, cz, w, d };
}

// Roll-up doors on the street-facing wall, one per z position
function addLoadingDoors(scene, rect, centersZ) {
  const doorMat = new THREE.MeshLambertMaterial({ color: DOOR_COLOR });
  const slatMat = new THREE.MeshLambertMaterial({ color: SLAT_COLOR });
  const x = rect.maxX + DOOR_THICKNESS / 2;
  for (const z of centersZ) {
    scene.add(box(DOOR_THICKNESS, DOOR_HEIGHT, DOOR_WIDTH, doorMat, x, DOOR_HEIGHT / 2, z));
    for (let k = 1; k <= DOOR_SLATS; k++) {
      const y = (DOOR_HEIGHT * k) / (DOOR_SLATS + 1);
      scene.add(box(DOOR_THICKNESS + 0.04, 0.08, DOOR_WIDTH, slatMat, x, y, z));
    }
  }
}

// Stack of cardboard boxes, solid for driving. cols and rows are the footprint, levels is the height.
function addBoxStack(scene, x, z, cols, rows, levels) {
  for (let l = 0; l < levels; l++) {
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        const bx = x + (i - (cols - 1) / 2) * BOX_SIZE;
        const bz = z + (j - (rows - 1) / 2) * BOX_SIZE;
        scene.add(box(BOX_SIZE * 0.95, BOX_SIZE * 0.95, BOX_SIZE * 0.95, BOX_MAT, bx, BOX_SIZE * (l + 0.5), bz));
      }
    }
  }
  obstacles.push({
    box: {
      minX: x - (cols * BOX_SIZE) / 2,
      maxX: x + (cols * BOX_SIZE) / 2,
      minZ: z - (rows * BOX_SIZE) / 2,
      maxZ: z + (rows * BOX_SIZE) / 2,
    },
  });
}
