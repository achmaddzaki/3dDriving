import * as THREE from 'three';
import {
  WORLD_SIZE,
  WORLD_LIMIT,
  HALF_WORLD,
  SIDEWALK_WIDTH,
  STREETS,
  ROAD_EDGE_COLLISION,
  ROADSIDE_BARRIER_COLLISION,
  STREET_FURNITURE_COLLISION,
  SIDEWALK_HEIGHT,
  sidewalkFixtures,
  obstacles,
  rectsOverlap,
} from '../core/world.js';
import { addInstanced, matrixAt } from '../core/primitives.js';
const ROAD_PATCH_HEIGHT = 0.02;
const CURB_FACE_W = 0.2;
const MARK_Y = 0.03;
const MARK_H = 0.02;
const ZEBRA_LENGTH = 3;
const ZEBRA_STRIPE_W = 0.6;
const ZEBRA_PITCH = 1.2;
const STOP_LINE_T = 0.5;
const DASH_HALF = 2.5;
// Pickup Car in vehicle.js is 2.35 m wide with wheels; spaces add 0.55 m margin
const PARKING_WIDTH = 2.9;
const EDGE_INSET = 0.3;
const LINE_W = 0.12;
// Pickup Car in vehicle.js is 4.51 m long; spaces add 0.3 m margin
const PARK_BAY_LENGTH = 4.81;
const CROSSING_CLEAR = ZEBRA_LENGTH + 1;
const ARROW_STEP = 20;
const POLE_COLLISION_R = 0.2; // collision circle radius of lamp and traffic light poles
const GRID_STEPS = Math.floor(WORLD_LIMIT / ARROW_STEP);
const MANHOLE_R = 0.45;
const DRAIN_W = 0.6;
const DRAIN_D = 0.4;
const DRAIN_CLEAR = ZEBRA_LENGTH + 1.2;
const LIGHT_POLE_H = 5.2; // pole height above the sidewalk, so the arm clears the tallest vehicle (3.8 m)
const LIGHT_ARM_T = 0.12;
const LIGHT_HEAD_H = 1.1;
const LIGHT_INSET = 0.6; // distance from the sidewalk outer edge to the light pole
const LIGHT_HEAD_T = 0.3; // head depth along its facing direction
const LENS_T = 0.04; // lens thickness, which sticks out in front of the head
const LAMP_POLE_H = 3.6;
const LAMP_HEAD_W = 0.32;
const LAMP_HEAD_H = 0.18;
const BARRIER_POST_GAP = 3;
const lineMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
const roadMat = new THREE.MeshLambertMaterial({ color: 0x333338 });
const sidewalkMat = new THREE.MeshLambertMaterial({ color: 0x9e9e9e });
const curbMat = new THREE.MeshLambertMaterial({ color: 0xc8c8c8 });
const ironMat = new THREE.MeshLambertMaterial({ color: 0x8a8a8a });
const drainMat = new THREE.MeshLambertMaterial({ color: 0x2a2a2a });
const barrierMat = new THREE.MeshLambertMaterial({ color: 0x9aa5ab });
const lightPoleMat = new THREE.MeshLambertMaterial({ color: 0x3e4448 });
const lightHeadMat = new THREE.MeshLambertMaterial({ color: 0x212121 });
const lampHeadMat = new THREE.MeshLambertMaterial({ color: 0xfff3c4 });
const lensMats = {
  red: new THREE.MeshLambertMaterial({ color: 0xe53935 }),
  yellow: new THREE.MeshLambertMaterial({ color: 0xfdd835 }),
  green: new THREE.MeshLambertMaterial({ color: 0x43a047 }),
};
const UNIT_BOX = new THREE.BoxGeometry(1, 1, 1);
// Ground, road strips, dashes, sidewalks, and all road markings
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
  addCurbFaces(scene);
  addCrossings(scene);
  addLaneMarkings(scene);
  addManholes(scene);
  addStormDrains(scene);
  addTrafficLights(scene);
  addStreetLamps(scene);
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
// Streets that cross the given street
function crossingStreets(s) {
  return STREETS.filter((o) => o.alongX !== s.alongX);
}
// Blocked along-ranges for a street, each crossing street grown by `clear` on both sides
function crossingBlocks(s, clear) {
  return crossingStreets(s)
    .map((o) => [o.offset - o.halfWidth - clear, o.offset + o.halfWidth + clear])
    .sort((a, b) => a[0] - b[0]);
}
// True when t is at least CROSSING_CLEAR past every crossing street
function clearOfCrossings(s, t) {
  return crossingStreets(s).every((o) => Math.abs(t - o.offset) >= o.halfWidth + CROSSING_CLEAR);
}
function parkingWidth(s) {
  return s === STREETS[0] ? PARKING_WIDTH : 0;
}
// Travel lane width from the center line to the lane edge, after any parking lane
function laneWidth(s) {
  return s.halfWidth - parkingWidth(s);
}
function laneCenter(s) {
  return laneWidth(s) / 2;
}
// World x and z for along-street position t and absolute across position
function pointAt(s, t, across) {
  return s.alongX ? { x: t, z: across } : { x: across, z: t };
}
// Matrix for a box on street s. lenT runs along the street, widthA across it, h up.
function onStreet(s, t, across, lenT, widthA, yCenter, h) {
  const p = pointAt(s, t, across);
  const [sx, sz] = s.alongX ? [lenT, widthA] : [widthA, lenT];
  return matrixAt(p.x, yCenter, p.z, sx, h, sz);
}
// Box rectangle for along range [t1, t2] and absolute across range [c1, c2] on street s
function rectOf(s, t1, t2, c1, c2) {
  const tr = [Math.min(t1, t2), Math.max(t1, t2)];
  const cr = [Math.min(c1, c2), Math.max(c1, c2)];
  return s.alongX
    ? { minX: tr[0], maxX: tr[1], minZ: cr[0], maxZ: cr[1] }
    : { minX: cr[0], maxX: cr[1], minZ: tr[0], maxZ: tr[1] };
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
  const crossings = crossingStreets(s);
  for (let t = -WORLD_LIMIT; t <= WORLD_LIMIT; t += 10) {
    if (crossings.some((o) => Math.abs(t - o.offset) < o.halfWidth + ZEBRA_LENGTH + DASH_HALF)) continue;
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
  for (const [from, to] of sidewalkRanges(s)) {
    for (const side of [-1, 1]) {
      const across = s.offset + side * (s.halfWidth + SIDEWALK_WIDTH / 2);
      addSidewalkPiece(scene, s.alongX, across, from, to);
    }
  }
}
// Along-ranges where sidewalks run on street s
function sidewalkRanges(s) {
  return freeRanges(crossingBlocks(s, SIDEWALK_WIDTH));
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
// Removes each cut range from every segment
function subtractRanges(segments, cuts) {
  let out = segments;
  for (const [ca, cb] of cuts) {
    out = out.flatMap(([a, b]) => {
      if (cb <= a || ca >= b) return [[a, b]];
      const parts = [];
      if (ca > a) parts.push([a, ca]);
      if (cb < b) parts.push([cb, b]);
      return parts;
    });
  }
  return out;
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
// Dark curb face on the road edge of every sidewalk
function addCurbFaces(scene) {
  const matrices = [];
  for (const s of STREETS) {
    for (const [from, to] of sidewalkRanges(s)) {
      if (to - from < 0.1) continue;
      for (const side of [-1, 1]) {
        // Sinks 0.02 into the road so its face does not z-fight the sidewalk edge
        const across = s.offset + side * (s.halfWidth + CURB_FACE_W / 2 - 0.02);
        matrices.push(onStreet(s, (from + to) / 2, across, to - from, CURB_FACE_W, (SIDEWALK_HEIGHT + 0.01) / 2, SIDEWALK_HEIGHT + 0.01));
      }
    }
  }
  addInstanced(scene, UNIT_BOX, curbMat, matrices);
}
// Zebra bands on both roads of each junction, and a stop line on each approach
function addCrossings(scene) {
  const matrices = [];
  for (const A of STREETS.filter((s) => s.alongX)) {
    for (const B of STREETS.filter((s) => !s.alongX)) {
      for (const sd of [-1, 1]) {
        matrices.push(...zebraMatrices(B, A.offset + sd * (A.halfWidth + ZEBRA_LENGTH / 2)));
        matrices.push(...zebraMatrices(A, B.offset + sd * (B.halfWidth + ZEBRA_LENGTH / 2)));
      }
    }
  }
  for (const s of STREETS) {
    for (const o of crossingStreets(s)) {
      matrices.push(...stopLineMatrices(s, o));
    }
  }
  addInstanced(scene, UNIT_BOX, lineMat, matrices);
}
// Stripes across road s, centered at along position t
function zebraMatrices(s, t) {
  const n = Math.floor((2 * s.halfWidth) / ZEBRA_PITCH);
  const pitch = (2 * s.halfWidth) / n;
  const out = [];
  for (let k = 0; k < n; k++) {
    const across = s.offset - s.halfWidth + (k + 0.5) * pitch;
    out.push(onStreet(s, t, across, ZEBRA_LENGTH, ZEBRA_STRIPE_W, MARK_Y, MARK_H));
  }
  return out;
}
// One stop line per travel lane on the approach to crossing street o
function stopLineMatrices(s, o) {
  const out = [];
  for (const sd of [-1, 1]) {
    const t = o.offset + sd * (o.halfWidth + ZEBRA_LENGTH + STOP_LINE_T);
    const across = s.offset + sd * laneCenter(s);
    out.push(onStreet(s, t, across, 0.3, laneWidth(s) - 0.4, MARK_Y, MARK_H));
  }
  return out;
}
// Edge lines, parking lane lines, and parking bay dividers, plus travel lane arrows
function addLaneMarkings(scene) {
  const lines = [];
  const arrows = [];
  for (const s of STREETS) {
    for (const [from, to] of freeRanges(crossingBlocks(s, CROSSING_CLEAR))) {
      lines.push(...edgeLineMatrices(s, from, to));
    }
    arrowMatrices(s, arrows);
  }
  addInstanced(scene, UNIT_BOX, lineMat, lines);
  addInstanced(scene, arrowGeometry(), lineMat, arrows);
}
function edgeLineMatrices(s, from, to) {
  const mid = (from + to) / 2;
  const len = to - from;
  const out = [];
  for (const sd of [-1, 1]) {
    out.push(onStreet(s, mid, s.offset + sd * (s.halfWidth - EDGE_INSET), len, LINE_W, MARK_Y, MARK_H));
    if (parkingWidth(s) === 0) continue;
    out.push(onStreet(s, mid, s.offset + sd * laneWidth(s), len, LINE_W, MARK_Y, MARK_H));
    for (let t = from; t <= to; t += PARK_BAY_LENGTH) {
      out.push(onStreet(s, t, s.offset + sd * (s.halfWidth - PARKING_WIDTH / 2), LINE_W, PARKING_WIDTH, MARK_Y, MARK_H));
    }
  }
  return out;
}
// Flat arrow pointing to local +Z, with its tip at the front
function arrowGeometry() {
  const shape = new THREE.Shape();
  shape.moveTo(0, -1);
  shape.lineTo(0.5, 0);
  shape.lineTo(0.2, 0);
  shape.lineTo(0.2, 0.9);
  shape.lineTo(-0.2, 0.9);
  shape.lineTo(-0.2, 0);
  shape.lineTo(-0.5, 0);
  shape.closePath();
  const geo = new THREE.ShapeGeometry(shape);
  geo.rotateX(-Math.PI / 2);
  return geo;
}
// One arrow per travel lane on every other grid point, pointing the lane's traffic direction
function arrowMatrices(s, out) {
  for (let k = -GRID_STEPS; k <= GRID_STEPS; k++) {
    const t = k * ARROW_STEP;
    if (k % 2 !== 0 || !clearOfCrossings(s, t)) continue;
    for (const sd of [-1, 1]) {
      const dir = -sd;
      const [dx, dz] = s.alongX ? [dir, 0] : [0, dir];
      const p = pointAt(s, t, s.offset + sd * laneCenter(s));
      out.push(matrixAt(p.x, MARK_Y, p.z, 1, 1, 1, Math.atan2(dx, dz)));
    }
  }
}
// Manhole covers in the travel lane between crossings, on half the old grid points (about 80 m apart)
function addManholes(scene) {
  const matrices = [];
  for (const s of STREETS) {
    for (let k = -GRID_STEPS; k <= GRID_STEPS; k++) {
      const t = k * ARROW_STEP;
      if (k % 2 === 0 || Math.abs(k) % 4 !== 1 || !clearOfCrossings(s, t)) continue;
      const p = pointAt(s, t, s.offset + laneCenter(s));
      matrices.push(matrixAt(p.x, MARK_Y, p.z, 1, 1, 1));
    }
  }
  addInstanced(scene, new THREE.CylinderGeometry(MANHOLE_R, MANHOLE_R, MARK_H, 14), ironMat, matrices);
}
// Storm drain grates at both curb edges, just beyond each crossing
function addStormDrains(scene) {
  const matrices = [];
  for (const s of STREETS) {
    for (const o of crossingStreets(s)) {
      matrices.push(...drainMatrices(s, o));
    }
  }
  addInstanced(scene, UNIT_BOX, drainMat, matrices);
}
function drainMatrices(s, o) {
  const out = [];
  for (const sd of [-1, 1]) {
    const t = o.offset + sd * (o.halfWidth + DRAIN_CLEAR);
    for (const side of [-1, 1]) {
      out.push(onStreet(s, t, s.offset + side * (s.halfWidth - 0.6), DRAIN_W, DRAIN_D, MARK_Y, MARK_H));
    }
  }
  return out;
}
/// <summary>
/// Signal lights at the junction with the road at z = 80, one per approach, each over that approach's right-hand lane.
/// </summary>
function addTrafficLights(scene) {
  const main = STREETS[0];
  const cross = STREETS.find((s) => s.alongX && s.offset === 80);
  const armY = SIDEWALK_HEIGHT + LIGHT_POLE_H;
  // The upright head hangs directly under the end of the arm
  const headY = armY - LIGHT_ARM_T / 2 - LIGHT_HEAD_H / 2;
  const poles = [];
  const arms = [];
  const heads = [];
  const lenses = { red: [], yellow: [], green: [] };
  for (const l of junctionLights(main, cross)) {
    poles.push(matrixAt(l.poleX, SIDEWALK_HEIGHT + LIGHT_POLE_H / 2, l.poleZ, 0.15, LIGHT_POLE_H, 0.15));
    sidewalkFixtures.push({ x: l.poleX, z: l.poleZ });
    if (STREET_FURNITURE_COLLISION) obstacles.push({ x: l.poleX, z: l.poleZ, r: POLE_COLLISION_R });
    // The arm runs from the pole to the head, along whichever axis separates them
    const dx = Math.abs(l.poleX - l.headX);
    const dz = Math.abs(l.poleZ - l.headZ);
    arms.push(matrixAt((l.poleX + l.headX) / 2, armY, (l.poleZ + l.headZ) / 2, dx + LIGHT_ARM_T, LIGHT_ARM_T, dz + LIGHT_ARM_T));
    heads.push(matrixAt(l.headX, headY, l.headZ, 0.4, LIGHT_HEAD_H, LIGHT_HEAD_T, l.rotY));
    // Red on top, green at the bottom. Each lens sits on the front face, toward the approaching traffic.
    const front = LIGHT_HEAD_T / 2 + LENS_T / 2;
    for (const [color, dy] of [['red', 0.3], ['yellow', 0], ['green', -0.3]]) {
      const x = l.headX + Math.sin(l.rotY) * front;
      const z = l.headZ + Math.cos(l.rotY) * front;
      lenses[color].push(matrixAt(x, headY + dy, z, 0.26, 0.26, LENS_T, l.rotY));
    }
  }
  addInstanced(scene, UNIT_BOX, lightPoleMat, [...poles, ...arms]);
  addInstanced(scene, UNIT_BOX, lightHeadMat, heads);
  for (const color of Object.keys(lenses)) {
    addInstanced(scene, UNIT_BOX, lensMats[color], lenses[color]);
  }
}
/// <summary>
/// Pole and head positions for the four approaches to the junction of <paramref name="main"/> and <paramref name="cross"/>.
/// Each pole sits on the right-hand corner of its approach, and each head sits over that approach's right-hand lane.
/// </summary>
function junctionLights(main, cross) {
  const px = main.halfWidth + SIDEWALK_WIDTH - LIGHT_INSET;
  const pz = cross.halfWidth + SIDEWALK_WIDTH - LIGHT_INSET;
  const lights = [];
  for (const sz of [-1, 1]) {
    // Main road traffic from the sz side keeps to the sz side of x, and its head faces that way
    const z = cross.offset + sz * pz;
    lights.push({ poleX: sz * px, poleZ: z, headX: sz * laneCenter(main), headZ: z, rotY: sz > 0 ? 0 : Math.PI });
  }
  for (const sx of [-1, 1]) {
    // Cross road traffic from the sx side keeps to the -sx side of z, and its head faces sx
    const z = cross.offset - sx * pz;
    lights.push({ poleX: sx * px, poleZ: z, headX: sx * px, headZ: cross.offset - sx * laneCenter(cross), rotY: (sx * Math.PI) / 2 });
  }
  return lights;
}
// Four lamps on the main road sidewalks, alternating sides and spaced 80 m apart, mid-block between junctions
function addStreetLamps(scene) {
  const main = STREETS[0];
  const x = main.halfWidth + SIDEWALK_WIDTH / 2;
  const poles = [];
  const heads = [];
  for (const [sx, z] of [[-1, -120], [1, -40], [-1, 40], [1, 120]]) {
    poles.push(matrixAt(sx * x, SIDEWALK_HEIGHT + LAMP_POLE_H / 2, z, 0.12, LAMP_POLE_H, 0.12));
    sidewalkFixtures.push({ x: sx * x, z });
    if (STREET_FURNITURE_COLLISION) obstacles.push({ x: sx * x, z, r: POLE_COLLISION_R });
    heads.push(matrixAt(sx * x, SIDEWALK_HEIGHT + LAMP_POLE_H + LAMP_HEAD_H / 2, z, LAMP_HEAD_W, LAMP_HEAD_H, LAMP_HEAD_W));
  }
  addInstanced(scene, UNIT_BOX, lightPoleMat, poles);
  addInstanced(scene, UNIT_BOX, lampHeadMat, heads);
}
// Parts of each sidewalk edge that are not in front of a parking lot
function barrierRanges(s, sd, lots) {
  const band = rectOf(s, -HALF_WORLD, HALF_WORLD, s.offset + sd * s.halfWidth, s.offset + sd * (s.halfWidth + SIDEWALK_WIDTH + 0.5));
  const cuts = lots
    .filter((lot) => rectsOverlap(lot, band))
    .map((lot) => (s.alongX ? [lot.minX, lot.maxX] : [lot.minZ, lot.maxZ]));
  return subtractRanges(sidewalkRanges(s), cuts);
}
// Posts and rails on the outer sidewalk edge beside grass, and optional driving collision
export function addRoadEdges(scene, lots) {
  const matrices = [];
  for (const s of STREETS) {
    for (const sd of [-1, 1]) {
      for (const [from, to] of barrierRanges(s, sd, lots)) {
        if (to - from < 0.5) continue;
        matrices.push(...barrierMatrices(s, sd, from, to));
        if (ROAD_EDGE_COLLISION) pushCurbObstacle(s, sd, from, to);
        if (ROADSIDE_BARRIER_COLLISION) pushBarrierObstacle(s, sd, from, to);
      }
    }
  }
  addInstanced(scene, UNIT_BOX, barrierMat, matrices);
}
function barrierMatrices(s, sd, from, to) {
  const len = to - from;
  const mid = (from + to) / 2;
  const across = s.offset + sd * (s.halfWidth + SIDEWALK_WIDTH - 0.1);
  const n = Math.ceil(len / BARRIER_POST_GAP);
  const out = [];
  for (let i = 0; i <= n; i++) {
    out.push(onStreet(s, from + i * (len / n), across, 0.1, 0.1, SIDEWALK_HEIGHT + 0.375, 0.75));
  }
  out.push(onStreet(s, mid, across, len, 0.06, SIDEWALK_HEIGHT + 0.45, 0.06));
  out.push(onStreet(s, mid, across, len, 0.06, SIDEWALK_HEIGHT + 0.7, 0.06));
  return out;
}
// Solid strip over the curb face on the road edge
function pushCurbObstacle(s, sd, from, to) {
  obstacles.push({ box: rectOf(s, from, to, s.offset + sd * s.halfWidth, s.offset + sd * (s.halfWidth + CURB_FACE_W)) });
}
// Solid strip over the barrier posts on the outer sidewalk edge
function pushBarrierObstacle(s, sd, from, to) {
  obstacles.push({
    box: rectOf(s, from, to, s.offset + sd * (s.halfWidth + SIDEWALK_WIDTH - 0.2), s.offset + sd * (s.halfWidth + SIDEWALK_WIDTH)),
  });
}
