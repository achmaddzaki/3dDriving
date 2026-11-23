import * as THREE from 'three';
import {
  WORLD_SIZE,
  WORLD_LIMIT,
  HALF_WORLD,
  SIDEWALK_WIDTH,
  STREETS,
} from '../core/world.js';

const CROSSING_GAP = 8;
const SIDEWALK_HEIGHT = 0.04;
const ROAD_PATCH_HEIGHT = 0.02;

const lineMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
const roadMat = new THREE.MeshLambertMaterial({ color: 0x333338 });
const sidewalkMat = new THREE.MeshLambertMaterial({ color: 0x9e9e9e });

// Ground, road strips, dashes, and sidewalks
export function buildEnvironment(scene) {
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE),
    new THREE.MeshLambertMaterial({ color: 0x4a8f3a })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  for (const s of STREETS) {
    addStreetSurface(scene, s);
    addStreetDashes(scene, s);
    addSidewalks(scene, s);
  }
  addSidewalkCorners(scene);
}

// Round corner pieces where the sidewalks of two crossing streets meet
function addSidewalkCorners(scene) {
  const alongX = STREETS.filter((s) => s.alongX);
  const alongZ = STREETS.filter((s) => !s.alongX);
  for (const a of alongX) {
    for (const b of alongZ) {
      for (const [sx, sz] of [[1, 1], [-1, 1], [-1, -1], [1, -1]]) {
        // Corner block between the two sidewalks at this crossing
        addCornerPiece(scene, b.offset + sx * b.halfWidth, a.offset + sz * a.halfWidth, sx, sz);
      }
    }
  }
}

// Corner block at the inner corner (cx, cz), extending into the quadrant (sx, sz).
// The corner nearest the junction is rounded.
function addCornerPiece(scene, cx, cz, sx, sz) {
  const piece = new THREE.Mesh(cornerGeometry(sx, sz), sidewalkMat);
  piece.position.set(cx, 0, cz);
  piece.receiveShadow = true;
  scene.add(piece);

  // Road color fills the gap left by the rounded curb, so no grass shows at the junction
  const notch = new THREE.Mesh(notchGeometry(sx, sz), roadMat);
  notch.position.set(cx, 0, cz);
  notch.receiveShadow = true;
  scene.add(notch);
}

// Builds the corner block in local coordinates where (0, 0) is the inner corner
function cornerGeometry(sx, sz) {
  const w = SIDEWALK_WIDTH;
  const r = w * 0.8;
  // Shape y is flipped so that after rotateX the piece lands on world +z when sz is 1
  const pt = (x, y) => [sx * x, -sz * y];
  const shape = new THREE.Shape();
  shape.moveTo(...pt(r, 0));
  shape.lineTo(...pt(w, 0));
  shape.lineTo(...pt(w, w));
  shape.lineTo(...pt(0, w));
  shape.lineTo(...pt(0, r));
  shape.quadraticCurveTo(...pt(0, 0), ...pt(r, 0));
  shape.closePath();
  return extrudeFlat(shape, SIDEWALK_HEIGHT);
}

// The area between the rounded curb and the junction corner, filled with road color
function notchGeometry(sx, sz) {
  const r = SIDEWALK_WIDTH * 0.8;
  const pt = (x, y) => [sx * x, -sz * y];
  const shape = new THREE.Shape();
  shape.moveTo(...pt(0, 0));
  shape.lineTo(...pt(r, 0));
  shape.quadraticCurveTo(...pt(0, 0), ...pt(0, r));
  shape.closePath();
  return extrudeFlat(shape, ROAD_PATCH_HEIGHT);
}

// Extrudes a shape in the XZ plane, from y = 0 up to the given height
function extrudeFlat(shape, height) {
  const geo = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false });
  geo.rotateX(-Math.PI / 2);
  return geo;
}

// Offsets of the streets that cross the given street
function crossingOffsets(s) {
  return STREETS.filter((o) => o.alongX !== s.alongX).map((o) => o.offset);
}

function addStreetSurface(scene, s) {
  const geo = s.alongX
    ? new THREE.PlaneGeometry(WORLD_SIZE, s.halfWidth * 2)
    : new THREE.PlaneGeometry(s.halfWidth * 2, WORLD_SIZE);
  const strip = new THREE.Mesh(geo, roadMat);
  strip.rotation.x = -Math.PI / 2;
  strip.position.set(s.alongX ? 0 : s.offset, 0.01, s.alongX ? s.offset : 0);
  strip.receiveShadow = true;
  scene.add(strip);
}

// Center dashes that stop short of crossings
function addStreetDashes(scene, s) {
  const crossings = crossingOffsets(s);
  for (let t = -WORLD_LIMIT; t <= WORLD_LIMIT; t += 10) {
    if (crossings.some((c) => Math.abs(t - c) < CROSSING_GAP)) continue;
    const dashGeo = s.alongX
      ? new THREE.BoxGeometry(5, 0.02, 0.3)
      : new THREE.BoxGeometry(0.3, 0.02, 5);
    const dash = new THREE.Mesh(dashGeo, lineMat);
    dash.position.set(s.alongX ? t : s.offset, 0.03, s.alongX ? s.offset : t);
    scene.add(dash);
  }
}

// Sidewalks run along both edges and stop at each crossing street
function addSidewalks(scene, s) {
  const blocked = STREETS.filter((o) => o.alongX !== s.alongX)
    .map((o) => [o.offset - o.halfWidth - SIDEWALK_WIDTH, o.offset + o.halfWidth + SIDEWALK_WIDTH])
    .sort((a, b) => a[0] - b[0]);
  for (const [from, to] of freeRanges(blocked)) {
    for (const side of [-1, 1]) {
      const across = s.offset + side * (s.halfWidth + SIDEWALK_WIDTH / 2);
      addSidewalkPiece(scene, s.alongX, across, from, to);
    }
  }
}

function freeRanges(blocked) {
  const free = [];
  let start = -HALF_WORLD;
  for (const [a, b] of blocked) {
    if (a > start) free.push([start, a]);
    start = Math.max(start, b);
  }
  if (start < HALF_WORLD) free.push([start, HALF_WORLD]);
  return free;
}

function addSidewalkPiece(scene, alongX, across, from, to) {
  const length = to - from;
  if (length < 0.1) return;
  const size = alongX
    ? [length, SIDEWALK_HEIGHT, SIDEWALK_WIDTH]
    : [SIDEWALK_WIDTH, SIDEWALK_HEIGHT, length];
  const piece = new THREE.Mesh(new THREE.BoxGeometry(...size), sidewalkMat);
  const mid = (from + to) / 2;
  piece.position.set(alongX ? mid : across, SIDEWALK_HEIGHT / 2, alongX ? across : mid);
  piece.receiveShadow = true;
  scene.add(piece);
}
