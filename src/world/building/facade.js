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

// Dark roof band slightly wider than the building
export function addRoofTrim(scene, cx, cz, w, h, d) {
  const trim = new THREE.Mesh(new THREE.BoxGeometry(w + ROOF_OVERHANG, TRIM_HEIGHT, d + ROOF_OVERHANG), TRIM_MAT);
  trim.position.set(cx, h + TRIM_HEIGHT / 2, cz);
  trim.castShadow = true;
  scene.add(trim);
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

// Windows on every wall, and a door on the wall facing the street
export function addFacades(scene, cx, cz, w, h, d, road) {
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
