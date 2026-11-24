import * as THREE from 'three';
import { box, addInstanced } from '../../core/primitives.js';
import { obstacles } from '../../core/world.js';

const WHITE = new THREE.MeshLambertMaterial({ color: 0xffffff }); // instance colors tint this
const UNIT_BOX = new THREE.BoxGeometry(1, 1, 1);
const UNIT_CYL = new THREE.CylinderGeometry(1, 1, 1, 14);
const materials = new Map();
let wireTexture = null;

const FENCE_H = 2.4;
const FENCE_POST_GAP = 3;
const WIRE_TILE = 0.6; // meters per chain-link diamond tile
const WIRE_COLOR = '#90a4ae';
const FENCE_COLOR = 0x607d8b;
const DARK_COLOR = 0x37474f;
const HALL_WALL_COLOR = 0xb0bec5;
const HALL_RIB_COLOR = 0x90a4ae;
const PLINTH_COLOR = 0x546e7a;
const EAVE_COLOR = 0x1565c0;
const ROOF_COLOR = 0x455a64;
const GLASS_COLOR = 0x9fd8f5;
const RIB_GAP = 6;
const RIB_SIZE = 0.5;
const MULLION_GAP = 4;
const BACK_WINDOW_GAP = 8;
const PIPE_COLOR = 0x90a4ae;
const DOCK_DOOR_COLOR = 0x546e7a;
const CANOPY_COLOR = 0x37474f;
const KEEP_CLEAR_COLOR = 0xfdd835;
const SILO_COLOR = 0xcfd8dc;
const SILO_RING_COLOR = 0x78909c;
const DOME_H = 2.2;
const CHIMNEY_COLOR = 0xbdbdbd;
const BRICK_RED = 0xc62828;
const SMOKE_COLOR = 0xffffff;
const FORKLIFT_COLOR = 0xf9a825;
const TIRE_COLOR = 0x212121;
const PALLET_COLOR = 0x8d6e63;
const CARDBOARD = [0xc49a6c, 0xb08a57, 0xd7b98e];
const DRUM_COLOR = 0x1e88e5;
const POLE_COLOR = 0x455a64;
const LAMP_GLASS_COLOR = 0xfff9c4;

/// <summary>Shared Lambert material for <paramref name="color"/>.</summary>
export function lam(color) {
  if (!materials.has(color)) materials.set(color, new THREE.MeshLambertMaterial({ color }));
  return materials.get(color);
}

const hex = (c) => `#${c.toString(16).padStart(6, '0')}`;

// Matrix for a center position, a size, and Euler rotation in radians
function transform(pos, size, rot = [0, 0, 0]) {
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rot[0], rot[1], rot[2]));
  return new THREE.Matrix4().compose(new THREE.Vector3(...pos), q, new THREE.Vector3(...size));
}

// Mesh with shadows on, for a single solid
function solid(scene, geo, color, x, y, z) {
  const m = new THREE.Mesh(geo, lam(color));
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  scene.add(m);
}

/// <summary>Collects unit boxes and cylinders, then draws each shape as one instanced mesh.</summary>
export function createBatch() {
  const groups = new Map();
  const add = (geo, matrix, color) => {
    if (!groups.has(geo)) groups.set(geo, { matrices: [], colors: [] });
    const g = groups.get(geo);
    g.matrices.push(matrix);
    g.colors.push(new THREE.Color(color));
  };
  return {
    /// <summary>Queues a box of <paramref name="size"/> centered at <paramref name="pos"/>.</summary>
    box(size, pos, color, rot) {
      add(UNIT_BOX, transform(pos, size, rot), color);
    },
    /// <summary>Queues a cylinder of radius <paramref name="r"/> and height <paramref name="h"/>.</summary>
    cylinder(r, h, pos, color, rot) {
      add(UNIT_CYL, transform(pos, [r, h, r], rot), color);
    },
    /// <summary>Adds every queued part to <paramref name="scene"/> and clears the batch.</summary>
    flush(scene) {
      for (const [geo, g] of groups) addInstanced(scene, geo, WHITE, g.matrices, g.colors);
      groups.clear();
    },
  };
}

/// <summary>Flat sign with text, centered at <paramref name="pos"/> and turned by <paramref name="rotY"/>.</summary>
export function addSign(scene, { text, bg, fg = 0xffffff, size, pos, rotY = 0, px = 1024 }) {
  const [w, h] = size;
  const canvas = document.createElement('canvas');
  canvas.width = px;
  canvas.height = Math.round((px * h) / w);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = hex(bg);
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = hex(fg);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  let fontPx = Math.floor(canvas.height * 0.6);
  ctx.font = `bold ${fontPx}px sans-serif`;
  while (fontPx > 8 && ctx.measureText(text).width > canvas.width - 40) {
    fontPx -= 2;
    ctx.font = `bold ${fontPx}px sans-serif`;
  }
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);
  const mat = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(canvas) });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  mesh.position.set(...pos);
  mesh.rotation.y = rotY;
  scene.add(mesh);
}

// Diamond wire pattern on transparent ground, tiled over each fence run
function wirePattern() {
  if (wireTexture) return wireTexture;
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.strokeStyle = WIRE_COLOR;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(64, 64);
  ctx.moveTo(64, 0);
  ctx.lineTo(0, 64);
  ctx.stroke();
  wireTexture = new THREE.CanvasTexture(canvas);
  return wireTexture;
}

// Wire mesh plane for a fence run centered at (cx, cz)
function addWireMesh(scene, len, alongX, cx, cz) {
  const tex = wirePattern().clone();
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(len / WIRE_TILE, FENCE_H / WIRE_TILE);
  tex.needsUpdate = true;
  const mat = new THREE.MeshBasicMaterial({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide });
  const wire = new THREE.Mesh(new THREE.PlaneGeometry(len, FENCE_H), mat);
  wire.position.set(cx, FENCE_H / 2, cz);
  wire.rotation.y = alongX ? 0 : Math.PI / 2;
  scene.add(wire);
}

/// <summary>Chain-link fence between two points on one X or Z line, with posts, a top rail, and collision.</summary>
export function addFenceRun(scene, batch, x0, z0, x1, z1) {
  const alongX = Math.abs(x1 - x0) >= Math.abs(z1 - z0);
  const len = alongX ? Math.abs(x1 - x0) : Math.abs(z1 - z0);
  const cx = (x0 + x1) / 2;
  const cz = (z0 + z1) / 2;
  const count = Math.ceil(len / FENCE_POST_GAP);
  for (let i = 0; i <= count; i++) {
    const s = i / count - 0.5;
    const pos = alongX ? [cx + s * len, FENCE_H / 2, cz] : [cx, FENCE_H / 2, cz + s * len];
    batch.box([0.12, FENCE_H, 0.12], pos, FENCE_COLOR);
  }
  batch.box(alongX ? [len, 0.08, 0.08] : [0.08, 0.08, len], [cx, FENCE_H, cz], FENCE_COLOR);
  addWireMesh(scene, len, alongX, cx, cz);
  const hx = alongX ? len / 2 : 0.1;
  const hz = alongX ? 0.1 : len / 2;
  obstacles.push({ box: { minX: cx - hx, maxX: cx + hx, minZ: cz - hz, maxZ: cz + hz } });
}

// Vertical glazing bars and a transom on one glazed face at x, facing +X
function addGlazingBars(batch, rect, x, wallH, rise) {
  const d = rect.maxZ - rect.minZ;
  const cz = (rect.minZ + rect.maxZ) / 2;
  const n = Math.floor(d / MULLION_GAP);
  for (let j = 0; j <= n; j++) {
    batch.box([0.25, rise, 0.12], [x, wallH + rise / 2, rect.minZ + (j * d) / n], DARK_COLOR);
  }
  batch.box([0.25, 0.1, d], [x, wallH + rise / 2, cz], DARK_COLOR);
}

// Sloped roof panels with a glazed vertical face on the high side of each tooth
function addSawtoothRoof(batch, rect, wallH, teeth, rise) {
  const w = rect.maxX - rect.minX;
  const d = rect.maxZ - rect.minZ;
  const cz = (rect.minZ + rect.maxZ) / 2;
  const run = w / teeth;
  const angle = Math.atan2(rise, run);
  for (let k = 0; k < teeth; k++) {
    const x0 = rect.minX + k * run;
    const x1 = x0 + run;
    batch.box([Math.hypot(run, rise), 0.3, d], [x0 + run / 2, wallH + rise / 2, cz], ROOF_COLOR, [0, 0, angle]);
    batch.box([0.2, rise, d], [x1, wallH + rise / 2, cz], GLASS_COLOR);
    addGlazingBars(batch, rect, x1, wallH, rise);
  }
}

// Vertical ribs on the back wall and on both end walls
function addHallRibs(batch, rect, wallH, teeth) {
  const w = rect.maxX - rect.minX;
  const d = rect.maxZ - rect.minZ;
  const n = Math.floor(d / RIB_GAP);
  for (let j = 0; j <= n; j++) {
    batch.box([RIB_SIZE, wallH, RIB_SIZE], [rect.minX, wallH / 2, rect.minZ + (j * d) / n], HALL_RIB_COLOR);
  }
  for (const z of [rect.minZ, rect.maxZ]) {
    for (let i = 0; i <= teeth; i++) {
      batch.box([RIB_SIZE, wallH, RIB_SIZE], [rect.minX + (i * w) / teeth, wallH / 2, z], HALL_RIB_COLOR);
    }
  }
}

// Glazed strips and two horizontal pipes on the back wall
function addBackWall(batch, rect) {
  const d = rect.maxZ - rect.minZ;
  const cz = (rect.minZ + rect.maxZ) / 2;
  const n = Math.floor(d / BACK_WINDOW_GAP);
  for (let j = 0; j < n; j++) {
    batch.box([0.1, 1.5, 2.2], [rect.minX - 0.02, 6.3, rect.minZ + ((j + 0.5) * d) / n], GLASS_COLOR);
  }
  for (const y of [3.2, 5.6]) {
    batch.cylinder(0.18, d, [rect.minX - 0.45, y, cz], PIPE_COLOR, [Math.PI / 2, 0, 0]);
  }
}

/// <summary>Production hall with walls, a sawtooth roof, and a plinth. The glazed faces look toward +X.</summary>
export function addSawtoothHall(scene, batch, rect, wallH, teeth, rise) {
  const w = rect.maxX - rect.minX;
  const d = rect.maxZ - rect.minZ;
  const cx = (rect.minX + rect.maxX) / 2;
  const cz = (rect.minZ + rect.maxZ) / 2;
  scene.add(box(w, wallH, d, lam(HALL_WALL_COLOR), cx, wallH / 2, cz));
  batch.box([w + 0.3, 1.0, d + 0.3], [cx, 0.5, cz], PLINTH_COLOR);
  batch.box([w + 0.4, 0.5, d + 0.4], [cx, wallH - 0.25, cz], EAVE_COLOR);
  addSawtoothRoof(batch, rect, wallH, teeth, rise);
  addHallRibs(batch, rect, wallH, teeth);
  addBackWall(batch, rect);
  obstacles.push({ box: rect });
}

/// <summary>Roll-up dock door on a wall facing +X, with a canopy, a bay number, and a yellow keep-clear strip.</summary>
export function addLoadingDock(scene, batch, { x, z, bay }) {
  batch.box([0.16, 4.5, 5.0], [x + 0.08, 2.25, z], DOCK_DOOR_COLOR);
  for (let k = 1; k <= 3; k++) batch.box([0.2, 0.08, 5.0], [x + 0.1, (4.5 * k) / 4, z], DARK_COLOR);
  batch.box([0.2, 0.3, 5.4], [x + 0.1, 4.65, z], DARK_COLOR);
  batch.box([2.0, 0.3, 6.0], [x + 1.0, 5.2, z], CANOPY_COLOR);
  for (const dz of [-2.7, 2.7]) batch.cylinder(0.12, 5.05, [x + 1.9, 2.525, z + dz], DARK_COLOR);
  batch.box([0.3, 0.02, 6.0], [x + 2.6, 0.06, z], KEEP_CLEAR_COLOR);
  addSign(scene, {
    text: String(bay), bg: 0xffffff, fg: DARK_COLOR, size: [0.9, 0.6], pos: [x + 0.02, 5.9, z], rotY: Math.PI / 2, px: 128,
  });
}

/// <summary>Galvanized silo with a dome, two rings, a side ladder, and a round collision.</summary>
export function addSilo(scene, batch, x, z, r, h) {
  solid(scene, new THREE.CylinderGeometry(r, r, h, 24), SILO_COLOR, x, h / 2, z);
  solid(scene, new THREE.ConeGeometry(r * 1.02, DOME_H, 24), 0x90a4ae, x, h + DOME_H / 2, z);
  for (const f of [0.3, 0.7]) batch.cylinder(r * 1.02, 0.3, [x, h * f, z], SILO_RING_COLOR);
  batch.box([0.12, h, 0.45], [x, h / 2, z - r - 0.05], DARK_COLOR);
  obstacles.push({ x, z, r });
}

// Three translucent puffs drifting above a chimney top
function addSmoke(scene, x, y, z) {
  const puffs = [[1.0, 1.5, 0.0, 1.1], [2.6, 3.4, 0.6, 1.5], [4.2, 5.6, 1.2, 1.9]];
  for (const [dx, dy, dz, r] of puffs) {
    const mat = new THREE.MeshLambertMaterial({ color: SMOKE_COLOR, transparent: true, opacity: 0.55, depthWrite: false });
    const puff = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), mat);
    puff.position.set(x + dx, y + dy, z + dz);
    scene.add(puff);
  }
}

/// <summary>Tapered chimney with red bands on a concrete base. Tall stacks also get smoke.</summary>
export function addChimney(scene, batch, x, z, h, smoke = false) {
  const top = 0.8;
  const bottom = 1.2;
  batch.box([3.0, 1.0, 3.0], [x, 0.5, z], CHIMNEY_COLOR);
  solid(scene, new THREE.CylinderGeometry(top, bottom, h, 20), CHIMNEY_COLOR, x, 1 + h / 2, z);
  for (let i = 1; i <= 4; i++) {
    const y = 1 + (h * i) / 5;
    const r = bottom - ((bottom - top) * (y - 1)) / h;
    batch.cylinder(r + 0.05, 1.0, [x, y, z], BRICK_RED);
  }
  batch.cylinder(top + 0.15, 0.3, [x, 1 + h + 0.15, z], DARK_COLOR);
  obstacles.push({ x, z, r: 1.3 });
  if (smoke) addSmoke(scene, x, 1 + h, z);
}

/// <summary>Shipping container standing on <paramref name="y"/>, 2.44 m wide and 6.06 m long.</summary>
export function addContainer(scene, x, y, z, color) {
  scene.add(box(2.44, 2.59, 6.06, lam(color), x, y + 1.295, z));
}

/// <summary>Forklift facing +Z with its forks ahead, with a collision box over the body and forks.</summary>
export function addForklift(batch, x, z) {
  batch.box([1.4, 0.5, 2.2], [x, 0.45, z], FORKLIFT_COLOR);
  batch.box([1.4, 0.8, 0.7], [x, 0.8, z - 0.75], FORKLIFT_COLOR);
  batch.box([0.8, 0.6, 0.7], [x, 1.0, z - 0.3], DARK_COLOR);
  for (const dx of [-0.6, 0.6]) {
    for (const dz of [-0.9, 0.3]) batch.cylinder(0.04, 2.0, [x + dx, 1.2, z + dz], DARK_COLOR);
  }
  batch.box([1.4, 0.08, 1.5], [x, 2.2, z - 0.3], DARK_COLOR);
  for (const dx of [-0.45, 0.45]) {
    batch.box([0.1, 2.2, 0.1], [x + dx, 1.5, z + 1.1], DARK_COLOR);
    batch.box([0.12, 0.08, 1.2], [x + dx, 0.25, z + 1.7], DARK_COLOR);
  }
  for (const dx of [-0.7, 0.7]) {
    for (const dz of [-0.7, 0.6]) batch.cylinder(0.35, 0.22, [x + dx, 0.35, z + dz], TIRE_COLOR, [0, 0, Math.PI / 2]);
  }
  obstacles.push({ box: { minX: x - 0.7, maxX: x + 0.7, minZ: z - 1.1, maxZ: z + 2.3 } });
}

/// <summary>Pallet with two layers of four cardboard boxes, and a collision box.</summary>
export function addPalletStack(batch, x, z) {
  batch.box([1.2, 0.15, 1.0], [x, 0.075, z], PALLET_COLOR);
  for (let layer = 0; layer < 2; layer++) {
    for (const dx of [-0.3, 0.3]) {
      for (const dz of [-0.25, 0.25]) {
        const color = CARDBOARD[(layer + (dx > 0 ? 1 : 0) + (dz > 0 ? 2 : 0)) % CARDBOARD.length];
        batch.box([0.55, 0.55, 0.45], [x + dx, 0.15 + 0.275 + layer * 0.55, z + dz], color);
      }
    }
  }
  obstacles.push({ box: { minX: x - 0.6, maxX: x + 0.6, minZ: z - 0.5, maxZ: z + 0.5 } });
}

/// <summary>Oil drum with a lid and a round collision.</summary>
export function addDrum(batch, x, z) {
  batch.cylinder(0.45, 0.9, [x, 0.45, z], DRUM_COLOR);
  batch.cylinder(0.42, 0.04, [x, 0.92, z], DARK_COLOR);
  obstacles.push({ x, z, r: 0.45 });
}

/// <summary>Floodlight pole with a lamp head, and a round collision.</summary>
export function addFloodlight(batch, x, z) {
  batch.cylinder(0.15, 12, [x, 6, z], POLE_COLOR);
  batch.box([1.4, 0.4, 0.6], [x, 12.2, z], DARK_COLOR);
  batch.box([1.2, 0.12, 0.5], [x, 11.95, z], LAMP_GLASS_COLOR);
  obstacles.push({ x, z, r: 0.3 });
}
