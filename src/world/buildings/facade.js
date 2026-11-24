import * as THREE from 'three';

const FLOOR_HEIGHT = 3.5;
const WINDOW_SPACING = 3;
const WINDOW_W = 1.6;
const WINDOW_H = 1.8;
const DOOR_W = 1.4;
const DOOR_H = 2.4;
const SIGN_Y = 3.3;
const SIGN_H = 0.8;
const SIGN_FACE_OFFSET = 0.21; // just outside the sign's front face
const LABEL_W = 512;
const LABEL_H = 64;
const LABEL_FONT_MAX = 44;
const LABEL_FONT_MIN = 16;
const PANE_DEPTH = 0.1;
const WALL_OUTSET = 0.02;
const GLASS_MAT = new THREE.MeshLambertMaterial({ color: 0x9fd8f5 });
const DOOR_MAT = new THREE.MeshLambertMaterial({ color: 0x5d4037 });
const TRIM_MAT = new THREE.MeshLambertMaterial({ color: 0x455a64 });
const TRIM_HEIGHT = 0.5;
const ROOF_MAT = new THREE.MeshLambertMaterial({ color: 0x8d3b2e });
const ROOF_OVERHANG = 0.6;
const ROOF_RISE = 0.5; // roof height as a share of its span
const UNIT_BOX = new THREE.BoxGeometry(1, 1, 1);
const WALLS = [
  { nx: 1, nz: 0 },
  { nx: -1, nz: 0 },
  { nx: 0, nz: 1 },
  { nx: 0, nz: -1 },
];

const FRAME_MAT = new THREE.MeshLambertMaterial({ color: 0xeceff1 }); // off-white window and door frames
const FRAME_W = 0.1;
const FRAME_D = 0.16; // frame bars stand out past the glass
const STONE_MAT = new THREE.MeshLambertMaterial({ color: 0xbdb5a8 }); // floor bands
const BAND_H = 0.15;
const BAND_D = 0.08;
const CONCRETE_MAT = new THREE.MeshLambertMaterial({ color: 0x9e9e9e }); // balconies
const METAL_MAT = new THREE.MeshLambertMaterial({ color: 0x37474f }); // railings
const BALCONY_EXTRA = 0.5; // balcony width beyond the window, in total
const BALCONY_D = 0.8;
const BALCONY_T = 0.12;
const RAIL_H = 0.9;
const RAIL_T = 0.08;
const PLANTER_MAT = new THREE.MeshLambertMaterial({ color: 0x8d6e63 }); // wall planter box
const PLANT_MAT = new THREE.MeshLambertMaterial({ color: 0x43a047 }); // planter greenery
const PLANTER_W = 1.2;
const PLANTER_H = 0.5;
const PLANTER_D = 0.4;
const PLANTER_Y = 1; // bottom of the planter above the ground
const PLANT_H = 0.3;
const PLANTER_MARGIN = 0.3; // gap between the planter and the end of the wall
const MIN_PLANTER_WALL = 4;
const SIGN_MAT = new THREE.MeshLambertMaterial({ color: 0xffb300 }); // roof sign board
const ROOF_SIGN_H = 0.8;
const ROOF_SIGN_D = 0.15;
const ROOF_SIGN_SHARE = 0.6; // roof sign length as a share of the wall
const TANK_MAT = new THREE.MeshLambertMaterial({ color: 0x6d4c41 }); // wooden water tank
const TANK_R = 0.9;
const TANK_H = 1.8;
const TANK_CAP_H = 0.6;
const TANK_GEO = new THREE.CylinderGeometry(TANK_R, TANK_R, TANK_H, 12);
const TANK_CAP_GEO = new THREE.ConeGeometry(TANK_R * 1.1, TANK_CAP_H, 12);
const AC_MAT = new THREE.MeshLambertMaterial({ color: 0xcfd8dc }); // air conditioning units
const AC_W = 1.2;
const AC_H = 0.7;
const AC_D = 0.9;
const MIN_ROOF_SIDE = 5; // smaller roofs get no rooftop equipment
const PART_MATS = {
  glass: GLASS_MAT,
  frame: FRAME_MAT,
  stone: STONE_MAT,
  concrete: CONCRETE_MAT,
  metal: METAL_MAT,
  sign: SIGN_MAT,
  planter: PLANTER_MAT,
  plant: PLANT_MAT,
};

// Dark roof band slightly wider than the building. `roof` is the model roof type.
export function addRoofTrim(scene, cx, cz, w, h, d, roof) {
  const trim = new THREE.Mesh(new THREE.BoxGeometry(w + ROOF_OVERHANG, TRIM_HEIGHT, d + ROOF_OVERHANG), TRIM_MAT);
  trim.position.set(cx, h + TRIM_HEIGHT / 2, cz);
  trim.castShadow = true;
  scene.add(trim);
  addRooftopEquipment(scene, cx, cz, w, h, d, roof);
}

// Triangular roof with its ridge along the longer side of the building
export function addGableRoof(scene, cx, cz, w, h, d) {
  const alongX = w >= d;
  const span = (alongX ? d : w) + ROOF_OVERHANG;
  const length = (alongX ? w : d) + ROOF_OVERHANG;
  const rise = span * ROOF_RISE;
  const shape = new THREE.Shape();
  shape.moveTo(-span / 2, 0);
  shape.lineTo(span / 2, 0);
  shape.lineTo(0, rise);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: length, bevelEnabled: false });
  geo.translate(0, 0, -length / 2);
  if (alongX) geo.rotateY(Math.PI / 2);
  const roof = new THREE.Mesh(geo, ROOF_MAT);
  roof.position.set(cx, h + TRIM_HEIGHT, cz);
  roof.castShadow = true;
  scene.add(roof);
}

// Colored fascia band above the ground floor on the wall facing the street
export function addRoadSign(scene, cx, cz, w, d, road, color, y = SIGN_Y) {
  const mat = new THREE.MeshLambertMaterial({ color });
  const alongZ = road.nx !== 0;
  const sign = new THREE.Mesh(
    alongZ
      ? new THREE.BoxGeometry(0.2, SIGN_H, d * 0.9)
      : new THREE.BoxGeometry(w * 0.9, SIGN_H, 0.2),
    mat
  );
  const off = (alongZ ? w / 2 : d / 2) + 0.1;
  sign.position.set(
    alongZ ? cx + road.nx * off : cx,
    y,
    alongZ ? cz : cz + road.nz * off
  );
  scene.add(sign);
}

// Shop name written on the fascia, shrunk to fit the sign width
export function addShopLabel(scene, cx, cz, w, d, road, text, color, y = SIGN_Y) {
  const canvas = document.createElement('canvas');
  canvas.width = LABEL_W;
  canvas.height = LABEL_H;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = `#${color.toString(16).padStart(6, '0')}`;
  ctx.fillRect(0, 0, LABEL_W, LABEL_H);
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  let size = LABEL_FONT_MAX;
  ctx.font = `bold ${size}px sans-serif`;
  while (size > LABEL_FONT_MIN && ctx.measureText(text).width > LABEL_W - 24) {
    size -= 2;
    ctx.font = `bold ${size}px sans-serif`;
  }
  ctx.fillText(text, LABEL_W / 2, LABEL_H / 2);

  const alongZ = road.nx !== 0;
  const len = (alongZ ? d : w) * 0.9;
  const label = new THREE.Mesh(
    new THREE.PlaneGeometry(len, SIGN_H),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(canvas) })
  );
  const off = (alongZ ? w / 2 : d / 2) + SIGN_FACE_OFFSET;
  label.position.set(
    alongZ ? cx + road.nx * off : cx,
    y,
    alongZ ? cz : cz + road.nz * off
  );
  label.rotation.y = Math.atan2(road.nx, road.nz);
  scene.add(label);
}

// Windows with frames, decorative floor bands, balconies, a back-wall planter, a roof sign, and a door on the street wall
export function addFacades(scene, cx, cz, w, h, d, road) {
  const parts = { glass: [], frame: [], stone: [], concrete: [], metal: [], sign: [], planter: [], plant: [] };
  const floors = Math.max(1, Math.floor(h / FLOOR_HEIGHT));
  for (const wall of WALLS) {
    const facesRoad = wall.nx === road.nx && wall.nz === road.nz;
    const facesBack = wall.nx === -road.nx && wall.nz === -road.nz;
    const alongZ = wall.nx !== 0;
    const len = alongZ ? d : w;
    const half = alongZ ? w / 2 : d / 2;
    const count = Math.max(1, Math.floor((len - 2) / WINDOW_SPACING));
    const hasPlanter = facesBack && len >= MIN_PLANTER_WALL;
    const planterT = len / 2 - PLANTER_W / 2 - PLANTER_MARGIN;
    for (let f = 1; f < floors; f++) {
      parts.stone.push(wallBox(cx, cz, wall, half + BAND_D / 2, 0, f * FLOOR_HEIGHT, len, BAND_H, BAND_D));
    }
    for (let f = 0; f < floors; f++) {
      const y = f * FLOOR_HEIGHT + FLOOR_HEIGHT / 2;
      for (let i = 0; i < count; i++) {
        const t = -len / 2 + (i + 0.5) * (len / count);
        if (facesRoad && f === 0 && Math.abs(t) < (DOOR_W + WINDOW_W) / 2) continue;
        if (hasPlanter && f === 0 && Math.abs(t - planterT) < (WINDOW_W + PLANTER_W) / 2) continue;
        addWindow(parts, cx, cz, wall, half, t, y);
        if (facesRoad && f > 0 && i % 2 === 0) addBalcony(parts, cx, cz, wall, half, t, y);
      }
    }
    if (facesRoad) addDoor(scene, parts, cx, cz, wall, half);
    if (hasPlanter) addPlanter(parts, cx, cz, wall, half, planterT);
  }
  addRoofSign(parts, cx, cz, road, w, h, d);
  for (const key of Object.keys(parts)) addBoxes(scene, PART_MATS[key], parts[key]);
}

// Transform for a box on a wall. `t` runs along the wall, `dist` is the distance from the building center to the box center.
function wallBox(cx, cz, wall, dist, t, y, along, vert, depth) {
  if (wall.nx !== 0) return boxMatrix(cx + wall.nx * dist, y, cz + t, depth, vert, along);
  return boxMatrix(cx + t, y, cz + wall.nz * dist, along, vert, depth);
}

function boxMatrix(x, y, z, sx, sy, sz) {
  return new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion(), new THREE.Vector3(sx, sy, sz));
}

function addWindow(parts, cx, cz, wall, half, t, y) {
  parts.glass.push(wallBox(cx, cz, wall, half + WALL_OUTSET, t, y, WINDOW_W, WINDOW_H, PANE_DEPTH));
  addFrame(parts, cx, cz, wall, half, t, y, WINDOW_W, WINDOW_H, true);
}

// Four bars around an opening centered at (t, y). The bottom bar is skipped for doors.
function addFrame(parts, cx, cz, wall, half, t, y, pw, ph, bottom) {
  const dist = half + WALL_OUTSET;
  const sideT = (pw + FRAME_W) / 2;
  const sideY = (ph + FRAME_W) / 2;
  parts.frame.push(wallBox(cx, cz, wall, dist, t, y + sideY, pw + 2 * FRAME_W, FRAME_W, FRAME_D));
  if (bottom) parts.frame.push(wallBox(cx, cz, wall, dist, t, y - sideY, pw + 2 * FRAME_W, FRAME_W, FRAME_D));
  for (const side of [-1, 1]) {
    parts.frame.push(wallBox(cx, cz, wall, dist, t + side * sideT, y, FRAME_W, ph, FRAME_D));
  }
}

function addDoor(scene, parts, cx, cz, wall, half) {
  addFrame(parts, cx, cz, wall, half, 0, DOOR_H / 2, DOOR_W, DOOR_H, false);
  const door = new THREE.Mesh(UNIT_BOX, DOOR_MAT);
  door.applyMatrix4(wallBox(cx, cz, wall, half + WALL_OUTSET, 0, DOOR_H / 2, DOOR_W, DOOR_H, PANE_DEPTH));
  scene.add(door);
}

// Concrete balcony slab at the sill of an upper-floor window, with a metal railing
function addBalcony(parts, cx, cz, wall, half, t, y) {
  const len = WINDOW_W + BALCONY_EXTRA;
  const floorY = y - WINDOW_H / 2;
  parts.concrete.push(wallBox(cx, cz, wall, half + BALCONY_D / 2, t, floorY - BALCONY_T / 2, len, BALCONY_T, BALCONY_D));
  addRailing(parts, cx, cz, wall, half, t, len, BALCONY_D, floorY);
}

// Top rail along the outer edge and a rail at each end, standing on `baseY`
function addRailing(parts, cx, cz, wall, half, t, len, depth, baseY) {
  const outer = half + depth;
  parts.metal.push(wallBox(cx, cz, wall, outer - RAIL_T / 2, t, baseY + RAIL_H - RAIL_T / 2, len, RAIL_T, RAIL_T));
  for (const side of [-1, 1]) {
    const endT = t + side * (len - RAIL_T) / 2;
    parts.metal.push(wallBox(cx, cz, wall, half + depth / 2, endT, baseY + RAIL_H / 2, RAIL_T, RAIL_H, depth));
  }
}

// Wall-mounted planter box with greenery on top, decoration only with no collision
function addPlanter(parts, cx, cz, wall, half, t) {
  const dist = half + PLANTER_D / 2;
  parts.planter.push(wallBox(cx, cz, wall, dist, t, PLANTER_Y + PLANTER_H / 2, PLANTER_W, PLANTER_H, PLANTER_D));
  parts.plant.push(wallBox(cx, cz, wall, dist, t, PLANTER_Y + PLANTER_H + PLANT_H / 2, PLANTER_W, PLANT_H, PLANTER_D));
}

// Colored sign board along the top of the street-facing wall, below the roof trim
function addRoofSign(parts, cx, cz, road, w, h, d) {
  const alongZ = road.nx !== 0;
  const len = alongZ ? d : w;
  const half = alongZ ? w / 2 : d / 2;
  parts.sign.push(wallBox(cx, cz, road, half + ROOF_SIGN_D / 2, 0, h - ROOF_SIGN_H / 2, len * ROOF_SIGN_SHARE, ROOF_SIGN_H, ROOF_SIGN_D));
}

// Water tank with a cone lid and two air conditioning units on the roof
function addRooftopEquipment(scene, cx, cz, w, h, d, roof) {
  if (Math.min(w, d) < MIN_ROOF_SIDE) return;
  const roofY = h + TRIM_HEIGHT;
  const alongX = w >= d; // ridge direction, as in addGableRoof
  const span = (alongX ? d : w) + ROOF_OVERHANG;
  const acrossOf = (x, z) => (alongX ? z - cz : x - cx);
  // Base height for an object `half` wide across the span; gable roofs rest it on the slope under its far edge
  const baseY = (across, half) => (roof === 'gable' ? gableHeight(h, span, Math.abs(across) + half) : roofY);
  const tankX = cx - w * 0.25;
  const tankZ = cz + d * 0.2;
  const tankY = baseY(acrossOf(tankX, tankZ), TANK_R);
  const tank = new THREE.Mesh(TANK_GEO, TANK_MAT);
  tank.position.set(tankX, tankY + TANK_H / 2, tankZ);
  tank.castShadow = true;
  const lid = new THREE.Mesh(TANK_CAP_GEO, TANK_MAT);
  lid.position.set(tankX, tankY + TANK_H + TANK_CAP_H / 2, tankZ);
  lid.castShadow = true;
  scene.add(tank, lid);

  const acX = cx + w * 0.25;
  const acZs = [cz - d * 0.2, cz - d * 0.2 + AC_D + 0.3];
  const acHalf = alongX ? AC_D / 2 : AC_W / 2;
  const acMatrices = acZs.map((z) => boxMatrix(acX, baseY(acrossOf(acX, z), acHalf) + AC_H / 2, z, AC_W, AC_H, AC_D));
  addBoxes(scene, AC_MAT, acMatrices);
}
// Height of the gable roof surface `offset` away from the ridge, across a roof of the given span
function gableHeight(h, span, offset) {
  return h + TRIM_HEIGHT + span * ROOF_RISE * (1 - (2 * offset) / span);
}

// All boxes that share one material in a single instanced mesh
function addBoxes(scene, mat, matrices) {
  if (matrices.length === 0) return;
  const mesh = new THREE.InstancedMesh(UNIT_BOX, mat, matrices.length);
  matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
  scene.add(mesh);
}
