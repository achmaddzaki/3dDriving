import * as THREE from 'three';
import { WORLD_LIMIT, ZONES, inRect, obstacles, sidewalkFixtures } from './core/world.js';
import { buildGround, groundHeight } from './core/terrain.js';
import { buildEnvironment, addRoadEdges } from './world/roads/environment.js';
import { addStreetFurniture } from './world/roads/street-furniture.js';
import { buildTown } from './world/buildings/town.js';
import { addTrees } from './world/nature/tree.js';
import { addRocks } from './world/nature/rocks.js';
import { addBushes, inBush } from './world/nature/bush.js';
import { addGrass } from './world/nature/grass.js';
import { addLandscaping } from './world/nature/landscaping.js';
import { createDistanceCuller } from './core/distance-cull.js';
import { CARGO, VEHICLES, buildVehicle } from './vehicles/vehicle.js';
import { USER_TYPES } from './game/mission.js';
import { createDirectionArrow, createMarker } from './game/marker.js';
import { createMobileApp } from './game/mobile-app.js';
import { createOrderBook } from './game/orders.js';
import { createNpcTraffic } from './game/npc-traffic.js';
import { createIntroCamera } from './game/intro-camera.js';

const keys = new Set();
let menuOpen = false;
// 'title' while the main menu is up, 'panning' while the camera moves to the car, then 'playing'
let phase = 'title';
let overlayEl = null; // the How to play or Credit card while it is open

window.addEventListener('keydown', (e) => {
  if (overlayEl) {
    if (e.code === 'Enter' || e.code === 'Escape') {
      e.preventDefault();
      closeOverlay();
    }
    return;
  }
  if (phase !== 'playing') {
    if (phase === 'title' && e.code === 'Enter') {
      e.preventDefault();
      startGame();
    }
    return;
  }
  if (e.code === 'Escape') {
    setMenu(!menuOpen);
    return;
  }
  if (menuOpen) {
    handleMenuKey(e);
    return;
  }
  keys.add(e.code);
  if (e.code === 'KeyR' && !menuOpen) resetCar();
  if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
});
window.addEventListener('keyup', (e) => keys.delete(e.code));
window.addEventListener('blur', () => keys.clear());

const pressed = (...codes) => codes.some((c) => keys.has(c));
const approach = (value, target, step) => {
  if (value < target) return Math.min(value + step, target);
  return Math.max(value - step, target);
};

// Shows a plain message in the page when the browser cannot give the game a WebGL context
function showGraphicsMessage(text) {
  const el = document.createElement('div');
  el.textContent = text;
  Object.assign(el.style, {
    position: 'fixed', inset: '0', display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '24px', textAlign: 'center', background: '#1b1f24', color: '#fff', font: '18px sans-serif', zIndex: '1000',
  });
  document.body.appendChild(el);
}

// Creates the WebGL renderer, or shows a message and stops when the browser refuses the context
function createRenderer() {
  try {
    return new THREE.WebGLRenderer({ antialias: true });
  } catch (error) {
    console.error('main createRenderer', error.message);
    showGraphicsMessage('Graphics could not start. Close other tabs or apps that use the GPU, then reload the page.');
    throw error;
  }
}

// Lets the browser restore a lost WebGL context; three.js rebuilds its GPU resources on restore
function watchContext(canvas) {
  canvas.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    console.warn('main watchContext WebGL context lost, waiting for restore');
  });
  canvas.addEventListener('webglcontextrestored', () => {
    console.info('main watchContext WebGL context restored');
  });
}

// Renderer, scene, camera
const renderer = createRenderer();
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);
watchContext(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
scene.fog = new THREE.Fog(0x87ceeb, 90, 280);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);

const sun = new THREE.DirectionalLight(0xffffff, 1.1);
sun.position.set(-60, 100, -40);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -80, right: 80, top: 80, bottom: -80, far: 300 });
sun.shadow.camera.updateProjectionMatrix();
scene.add(sun, sun.target, new THREE.HemisphereLight(0xffffff, 0x445522, 0.6));

// World: roads and sidewalks, then parking lots with buildings, then gardens, then trees
buildEnvironment(scene);
const { lots, spots, stores, distributorLot } = buildTown(scene, VEHICLES.length);
buildGround(scene);
addRoadEdges(scene, lots);
addStreetFurniture(scene, lots, sidewalkFixtures);
const gardens = addLandscaping(scene, lots);
addTrees(scene, [...lots, ...gardens]);
addRocks(scene, [...lots, ...gardens]);
addBushes(scene, [...lots, ...gardens]);
addGrass(scene, [...lots, ...gardens]);

// Static world objects beyond RENDER_DISTANCE are hidden, so the GPU only draws what is nearby
const RENDER_DISTANCE = 200; // meters from the camera; raise for a longer view, lower for speed
const distanceCuller = createDistanceCuller(scene, RENDER_DISTANCE);

// NPC cars drive on the right-hand lane. They stay hidden until switched on from the menu.
const traffic = createNpcTraffic(scene);
let trafficOn = false;

// Every vehicle is parked at its own distributor spot. `active` is the one being driven.
const RETURN_DELAY = 3; // seconds before a vehicle you stopped driving goes back to its spot
const VEHICLE_ARROW_GAP = 1.5; // height of the direction arrow above the vehicle's top

// Local footprint bounds of a model, measured before it is placed in the world
function localExtent(mesh) {
  const b = new THREE.Box3().setFromObject(mesh);
  return { minX: b.min.x, maxX: b.max.x, minZ: b.min.z, maxZ: b.max.z, top: b.max.y };
}

// Puts a vehicle mesh at its current pose, with the front wheels straight
function placeVehicle(entry) {
  entry.mesh.position.set(entry.pose.x, 0, entry.pose.z);
  entry.mesh.rotation.y = entry.pose.heading;
  for (const { pivot } of entry.mesh.userData.wheels) {
    if (pivot) pivot.rotation.y = 0;
  }
}

const fleet = VEHICLES.map((def, i) => {
  const mesh = buildVehicle(def);
  const home = spots[i];
  const entry = {
    def,
    mesh,
    home,
    pose: { ...home },
    extent: localExtent(mesh),
    returnTimer: null, // seconds left before a stopped vehicle returns home
  };
  scene.add(mesh);
  placeVehicle(entry);
  return entry;
});

let active = fleet[0];
let vehicle = active.def;
const car = { x: 0, z: 0, heading: 0, speed: 0, steer: 0, wheelAngle: 0, reach: vehicle.checkReach ?? 0 };
Object.assign(car, active.pose);

function resetCar() {
  Object.assign(car, { x: active.home.x, z: active.home.z, heading: active.home.heading, speed: 0, steer: 0 });
  traffic.resetSpeech();
}

const GRASS_SPEED_FACTOR = 0.5;   // top speed multiplier on grass
const BUSH_SPEED_FACTOR = 0.5;    // top speed multiplier inside a bush
const SPEED_LIMIT_DECEL = 15;     // m/s^2 used to slow down to a new top speed

// Grass is any ground outside roads, sidewalks, and parking lots
function isOnGrass() {
  return ![...ZONES, ...lots].some((r) => inRect(car.x, car.z, r));
}

// Top speed multiplier: bushes slow the car to half, and grass does too. Bushes do not stack with grass.
function gripFactor() {
  if (inBush(car.x, car.z)) return BUSH_SPEED_FACTOR;
  return isOnGrass() ? GRASS_SPEED_FACTOR : 1;
}
// Caps speed at the top speed, lower on grass and in bushes. Slows down smoothly when the cap drops.
function limitSpeed(dt) {
  const grip = gripFactor();
  const topForward = vehicle.maxSpeed * grip;
  const topReverse = vehicle.maxReverse * grip;
  if (car.speed > topForward) {
    car.speed = approach(car.speed, topForward, SPEED_LIMIT_DECEL * dt);
  } else if (car.speed < -topReverse) {
    car.speed = approach(car.speed, -topReverse, SPEED_LIMIT_DECEL * dt);
  }
}

function updateCar(dt) {
  const throttle = pressed('KeyW', 'ArrowUp');
  const reverse = pressed('KeyS', 'ArrowDown');
  const handbrake = pressed('Space');
  const left = pressed('KeyA', 'ArrowLeft');
  const right = pressed('KeyD', 'ArrowRight');

  if (handbrake) {
    car.speed = approach(car.speed, 0, vehicle.handbrakeDecel * dt);
  } else if (throttle && !reverse) {
    car.speed += vehicle.accel * dt;
  } else if (reverse) {
    car.speed = car.speed > 0.5
      ? car.speed - vehicle.brake * dt
      : car.speed - vehicle.accel * dt;
  } else {
    car.speed = approach(car.speed, 0, vehicle.coastDecel * dt);
  }
  limitSpeed(dt);

  const steerInput = (left ? 1 : 0) - (right ? 1 : 0);
  car.steer = approach(car.steer, steerInput * vehicle.maxSteer, vehicle.steerRate * dt);

  // Bicycle model: turn rate depends on speed and steering angle
  car.heading += (car.speed * Math.tan(car.steer) / vehicle.wheelBase) * vehicle.turnRateScale * dt;
  // Small sub-steps keep a fast car from skipping over a thin barrier in one frame
  const steps = Math.max(1, Math.ceil(Math.abs(car.speed * dt) / MAX_MOVE_STEP));
  const subDt = dt / steps;
  for (let i = 0; i < steps; i++) {
    car.x += Math.sin(car.heading) * car.speed * subDt;
    car.z += Math.cos(car.heading) * car.speed * subDt;
    resolveCollisions(subDt);
  }
  car.x = Math.min(Math.max(car.x, -WORLD_LIMIT), WORLD_LIMIT);
  car.z = Math.min(Math.max(car.z, -WORLD_LIMIT), WORLD_LIMIT);
}

// Axis-aligned box around a parked or stopped vehicle at its current pose
function footprint(entry) {
  const { x, z, heading } = entry.pose;
  const s = Math.sin(heading);
  const c = Math.cos(heading);
  const { minX, maxX, minZ, maxZ } = entry.extent;
  const corners = [[minX, minZ], [minX, maxZ], [maxX, minZ], [maxX, maxZ]].map(([lx, lz]) => ({
    x: x + lx * c + lz * s,
    z: z - lx * s + lz * c,
  }));
  return {
    minX: Math.min(...corners.map((p) => p.x)),
    maxX: Math.max(...corners.map((p) => p.x)),
    minZ: Math.min(...corners.map((p) => p.z)),
    maxZ: Math.max(...corners.map((p) => p.z)),
  };
}

// Every vehicle that is not being driven blocks the car like a building
function vehicleObstacles() {
  return fleet.filter((e) => e !== active).map((e) => ({ box: footprint(e) }));
}

// Per-second share of speed kept while touching an obstacle; lower values stop the car faster
const CONTACT_SPEED_RETAIN = 0.2;
// Share of speed kept on the first contact with an NPC car: 10% remains, so 90% is lost at once
const NPC_HIT_SPEED_RETAIN = 0.1;
// Radians per second the heading turns away from a surface the car is driving into
const CONTACT_TURN_RATE = 2.5;
// Longest movement allowed in one sub-step, in metres
const MAX_MOVE_STEP = 0.15;

// NPC cars seen in contact during the previous sub-step, so one impact only costs speed once
let npcContacts = new Set();

function resolveCollisions(dt) {
  const solids = [...obstacles, ...vehicleObstacles(), ...traffic.solids()];
  const contactKeep = Math.pow(CONTACT_SPEED_RETAIN, dt);
  const touchingNpcs = new Set();
  for (const c of vehicle.colliders) {
    for (const o of solids) {
      const fx = Math.sin(car.heading);
      const fz = Math.cos(car.heading);
      const px = car.x + fx * c.z;
      const pz = car.z + fz * c.z;
      const push = o.box ? boxPush(px, pz, c.r, o.box) : circlePush(px, pz, c.r, o);
      if (!push) continue;
      car.x += push.x;
      car.z += push.z;
      if (o.npc) {
        // Hitting an NPC car drops speed at once and does not turn the car
        touchingNpcs.add(o.npc);
        if (!npcContacts.has(o.npc)) car.speed *= NPC_HIT_SPEED_RETAIN;
        continue;
      }
      car.speed *= contactKeep;
      deflectHeading(push, dt);
    }
  }
  npcContacts = touchingNpcs;
}

// Turns the heading so the car slides along a surface instead of pushing into it
function deflectHeading(push, dt) {
  const len = Math.hypot(push.x, push.z);
  if (len < 1e-6) return;
  const nx = push.x / len;
  const nz = push.z / len;
  const fx = Math.sin(car.heading);
  const fz = Math.cos(car.heading);
  const moveDir = Math.sign(car.speed);
  // Moving into the surface means the motion points against the push direction
  if (moveDir === 0 || (fx * nx + fz * nz) * moveDir >= 0) return;
  // Derivative of the forward vector with respect to heading
  const tx = Math.cos(car.heading);
  const tz = -Math.sin(car.heading);
  const side = tx * nx + tz * nz;
  const turn = Math.sign(side) * moveDir * CONTACT_TURN_RATE * dt;
  car.heading += turn;
}

// Push vector that moves a circle at (px, pz) out of a circle obstacle, or null when they do not touch
function circlePush(px, pz, r, o) {
  const dx = px - o.x;
  const dz = pz - o.z;
  const minDist = o.r + r;
  const dist2 = dx * dx + dz * dz;
  if (dist2 >= minDist * minDist || dist2 < 1e-6) return null;
  const dist = Math.sqrt(dist2);
  const push = minDist - dist;
  return { x: (dx / dist) * push, z: (dz / dist) * push };
}

// Push vector that moves a circle at (px, pz) out of a box obstacle, or null when they do not touch
function boxPush(px, pz, r, b) {
  const nx = Math.min(Math.max(px, b.minX), b.maxX);
  const nz = Math.min(Math.max(pz, b.minZ), b.maxZ);
  const dx = px - nx;
  const dz = pz - nz;
  const dist2 = dx * dx + dz * dz;
  if (dist2 >= r * r) return null;
  if (dist2 > 1e-6) {
    const dist = Math.sqrt(dist2);
    const push = r - dist;
    return { x: (dx / dist) * push, z: (dz / dist) * push };
  }
  // Center is inside the box: leave through the nearest side
  const exits = [
    { depth: px - b.minX, x: -1, z: 0 },
    { depth: b.maxX - px, x: 1, z: 0 },
    { depth: pz - b.minZ, x: 0, z: -1 },
    { depth: b.maxZ - pz, x: 0, z: 1 },
  ];
  const best = exits.reduce((a, e) => (e.depth < a.depth ? e : a));
  const move = best.depth + r;
  return { x: best.x * move, z: best.z * move };
}

function syncCarMesh(dt) {
  active.mesh.position.set(car.x, groundHeight(car.x, car.z), car.z);
  active.mesh.rotation.y = car.heading;

  car.wheelAngle += (car.speed * dt) / vehicle.wheelRadius;
  for (const { spin, pivot } of active.mesh.userData.wheels) {
    spin.rotation.x = car.wheelAngle;
    if (pivot) pivot.rotation.y = car.steer;
  }
}

// Counts down the return timers and sends stopped vehicles back to their spots
function updateReturns(dt) {
  for (const entry of fleet) {
    if (entry.returnTimer === null) continue;
    entry.returnTimer -= dt;
    if (entry.returnTimer > 0) continue;
    entry.returnTimer = null;
    entry.pose = { ...entry.home };
    placeVehicle(entry);
  }
}

const cameraTarget = new THREE.Vector3();
const lookTarget = new THREE.Vector3();

// Sets the chase camera position and look point for the current car pose
function chasePose() {
  const fx = Math.sin(car.heading);
  const fz = Math.cos(car.heading);
  const d = vehicle.cameraDistance;
  cameraTarget.set(car.x - fx * d, vehicle.cameraHeight, car.z - fz * d);
  lookTarget.set(car.x + fx * 2, 1.2, car.z + fz * 2);
}

function updateCamera(dt, snap = false) {
  chasePose();
  if (snap) {
    camera.position.copy(cameraTarget);
  } else {
    camera.position.lerp(cameraTarget, 1 - Math.exp(-6 * dt));
  }
  camera.lookAt(lookTarget);
}

// Title screen camera, and the pan from it to the chase camera when the game starts
const PAN_SECONDS = 2.5;
const introCenter = {
  x: (distributorLot.minX + distributorLot.maxX) / 2,
  z: (distributorLot.minZ + distributorLot.maxZ) / 2,
};
const intro = createIntroCamera(introCenter);
const panFrom = new THREE.Vector3();
const panLookFrom = new THREE.Vector3();
const panLook = new THREE.Vector3();
let panTime = 0;

// Leaves the title screen and starts the pan to the car
function startGame() {
  if (phase !== 'title') return;
  phase = 'panning';
  panFrom.copy(camera.position);
  panLookFrom.copy(intro.look);
  panTime = 0;
  document.getElementById('title-menu').classList.add('hidden');
}

// Eases the camera from the title view to the chase view, then hands control to the player
function updatePan(dt) {
  panTime += dt;
  const k = Math.min(panTime / PAN_SECONDS, 1);
  const eased = k * k * (3 - 2 * k);
  chasePose();
  camera.position.lerpVectors(panFrom, cameraTarget, eased);
  panLook.lerpVectors(panLookFrom, lookTarget, eased);
  camera.lookAt(panLook);
  if (k < 1) return;
  phase = 'playing';
  document.body.classList.remove('intro');
  updateCamera(0, true);
}

const speedEl = document.getElementById('speed');
const vehicleEl = document.getElementById('vehicle');

const userTypeEl = document.getElementById('user-type');
const missionEl = document.getElementById('mission');
let shownMissionText = '';

// The shadow box is fixed at ±80 m, so it follows the car to shade the buildings around it
function updateSun() {
  sun.target.position.set(car.x, 0, car.z);
  sun.position.set(car.x - 60, 100, car.z - 40);
}

function updateHud() {
  speedEl.textContent = `${Math.round(Math.abs(car.speed) * 3.6)} km/h`;
  const text = mission.status().join('\n');
  if (text === shownMissionText) return;
  shownMissionText = text;
  missionEl.textContent = text;
}

// Menu
const menuEl = document.getElementById('menu');
const menuButtons = document.querySelectorAll('[data-vehicle]');
const typeButtons = document.querySelectorAll('[data-type]');
const trafficButtons = document.querySelectorAll('[data-traffic]');

// Mission for the chosen user type, created over the current store and distributor lots
// Builds the mission for a user type with the current vehicle's cargo size
function createMissionFor(type) {
  return type.createMission({ stores, distributorLot, cargo: CARGO[vehicle.id] });
}
let userType = USER_TYPES[0];
let mission = createMissionFor(userType);
const marker = createMarker(scene);
const vehicleArrow = createDirectionArrow(scene);
const orderBook = createOrderBook();
const mobileApp = createMobileApp({
  orders: orderBook,
  onCheckIn: () => mission.checkIn(),
  onCheckOut: () => mission.checkOut(),
  onTask: () => mission.task(),
  onDepot: (action) => mission.depotAction(action),
});

function setMenu(open) {
  menuOpen = open;
  menuEl.classList.toggle('hidden', !open);
  if (open) {
    keys.clear();
    focusActiveOption();
  }
}

// Menu keyboard navigation: arrows or WASD move the focus, Enter picks the focused option
const menuGrids = [...document.querySelectorAll('#menu .option-grid')].map((g) => [...g.querySelectorAll('button')]);
let menuGrid = 0;
let menuCell = 0;

function focusMenuCell(grid, cell) {
  menuGrid = grid;
  menuCell = cell;
  menuGrids[grid][cell].focus();
}

// Starts on the vehicle that is driven now
function focusActiveOption() {
  const idx = menuGrids[0].findIndex((b) => b.classList.contains('active'));
  focusMenuCell(0, Math.max(0, idx));
}

// Keeps the cursor in step with a focus change made by the mouse
function syncMenuCursor() {
  menuGrids.forEach((buttons, grid) => {
    const cell = buttons.indexOf(document.activeElement);
    if (cell >= 0) {
      menuGrid = grid;
      menuCell = cell;
    }
  });
}

// Moves within a two-column grid. Past its top or bottom row, the focus goes to the neighboring grid.
function moveMenuFocus(dx, dy) {
  const buttons = menuGrids[menuGrid];
  if (dx !== 0) {
    const cell = menuCell + dx;
    const sameRow = Math.floor(cell / 2) === Math.floor(menuCell / 2);
    if (sameRow && cell >= 0 && cell < buttons.length) focusMenuCell(menuGrid, cell);
    return;
  }
  const cell = menuCell + dy * 2;
  if (cell >= 0 && cell < buttons.length) return focusMenuCell(menuGrid, cell);
  const next = menuGrid + dy;
  if (next < 0 || next >= menuGrids.length) return;
  const len = menuGrids[next].length;
  const col = menuCell % 2;
  const target = dy > 0 ? col : Math.floor((len - 1) / 2) * 2 + col;
  focusMenuCell(next, Math.min(target, len - 1));
}

const MENU_MOVES = {
  ArrowUp: [0, -1], KeyW: [0, -1],
  ArrowDown: [0, 1], KeyS: [0, 1],
  ArrowLeft: [-1, 0], KeyA: [-1, 0],
  ArrowRight: [1, 0], KeyD: [1, 0],
};

function handleMenuKey(e) {
  syncMenuCursor();
  const move = MENU_MOVES[e.code];
  if (move) {
    e.preventDefault();
    moveMenuFocus(...move);
  } else if (e.code === 'Enter' || e.code === 'NumpadEnter') {
    e.preventDefault();
    menuGrids[menuGrid][menuCell].click();
  }
}

// Drives the picked vehicle from its current spot and starts the return timer for the previous one.
// The camera eases over to the new vehicle through its follow lerp.
function selectVehicle(id) {
  const next = fleet.find((e) => e.def.id === id);
  if (!next || next === active) return;
  traffic.resetSpeech();

  active.pose = { x: car.x, z: car.z, heading: car.heading };
  active.returnTimer = RETURN_DELAY;

  // A vehicle still on the road is picked up where it stopped and keeps its place
  next.returnTimer = null;
  active = next;
  vehicle = next.def;
  car.reach = vehicle.checkReach ?? 0;
  // Missions that depend on the vehicle start over with the new cargo size
  if (userType.usesVehicle) mission = createMissionFor(userType);
  Object.assign(car, { x: next.pose.x, z: next.pose.z, heading: next.pose.heading, speed: 0, steer: 0 });
  syncCarMesh(0);

  vehicleEl.textContent = `Vehicle: ${vehicle.name}`;
  menuButtons.forEach((b) => b.classList.toggle('active', b.dataset.vehicle === id));
}

// Switching to another user type starts that type's mission from the beginning
function selectUserType(id) {
  const next = USER_TYPES.find((t) => t.id === id);
  if (!next || next === userType) return;
  userType = next;
  mission = createMissionFor(userType);
  resetCar();
  syncCarMesh(0);
  userTypeEl.textContent = `User: ${userType.name}`;
  typeButtons.forEach((b) => b.classList.toggle('active', b.dataset.type === id));
}

// Title menu buttons open the How to play or Credit card, or start the game
const cardEls = { how: document.getElementById('briefing'), credit: document.getElementById('credits') };
function openOverlay(el) {
  overlayEl = el;
  keys.clear();
  el.classList.remove('hidden');
}
function closeOverlay() {
  if (!overlayEl) return;
  overlayEl.classList.add('hidden');
  overlayEl = null;
}
document.querySelectorAll('[data-title]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const action = btn.dataset.title;
    if (action === 'start') return startGame();
    openOverlay(action === 'how' ? cardEls.how : cardEls.credit);
  });
});
document.getElementById('briefing-back').addEventListener('click', closeOverlay);
document.getElementById('credits-back').addEventListener('click', closeOverlay);

document.getElementById('menu-btn').addEventListener('click', () => setMenu(!menuOpen));
document.getElementById('menu-close').addEventListener('click', () => setMenu(false));
menuEl.addEventListener('click', (e) => {
  if (e.target === menuEl) setMenu(false);
});
menuButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    selectVehicle(btn.dataset.vehicle);
    setMenu(false);
  });
});

typeButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    selectUserType(btn.dataset.type);
    setMenu(false);
  });
});

// Switches the NPC cars on or off and updates the menu label
function setTraffic(on) {
  trafficOn = on;
  traffic.setEnabled(on, car);
  trafficButtons.forEach((b) => {
    b.classList.toggle('active', on);
    b.querySelector('strong').textContent = `NPC cars: ${on ? 'On' : 'Off'}`;
  });
}

trafficButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    setTraffic(!trafficOn);
    setMenu(false);
  });
});

menuButtons.forEach((b) => b.classList.toggle('active', b.dataset.vehicle === vehicle.id));
vehicleEl.textContent = `Vehicle: ${vehicle.name}`;
typeButtons.forEach((b) => b.classList.toggle('active', b.dataset.type === userType.id));
userTypeEl.textContent = `User: ${userType.name}`;

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Shows the lot marker on the target, and the arrow above the car turned toward it unless the mission hides it
function updateTargetMarkers(target, time, showDirection) {
  if (!target) {
    marker.hide();
    vehicleArrow.hide();
    return;
  }
  marker.show(target, time);
  if (!showDirection) {
    vehicleArrow.hide();
    return;
  }
  const tx = (target.minX + target.maxX) / 2;
  const tz = (target.minZ + target.maxZ) / 2;
  const yaw = Math.atan2(tx - car.x, tz - car.z);
  const top = groundHeight(car.x, car.z) + active.extent.top + VEHICLE_ARROW_GAP;
  vehicleArrow.show(car.x, top, car.z, yaw, time);
}

// The phone slides out once the car has been nearly still for STILL_SECONDS
const STILL_SPEED = 0.05; // m/s
const STILL_SECONDS = 0.5;
let stillTime = 0;
let last = performance.now();
function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;

  const driving = phase === 'playing' && !menuOpen;
  if (driving) {
    updateCar(dt);
    syncCarMesh(dt);
    updateReturns(dt);
    mission.update(car, dt);
  }
  if (phase === 'playing') {
    updateTargetMarkers(mission.target(car), now / 1000, !mission.hidesDirection);
    updateCamera(dt);
  } else {
    marker.hide();
    vehicleArrow.hide();
    if (phase === 'title') intro.update(dt, camera);
    else updatePan(dt);
  }
  traffic.update(driving ? dt : 0, car, vehicle, camera);
  updateSun();
  updateHud();
  stillTime = Math.abs(car.speed) < STILL_SPEED ? stillTime + dt : 0;
  if (phase === 'playing') mobileApp.update(mission.phone(car), stillTime >= STILL_SECONDS);
  distanceCuller.update(camera);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

syncCarMesh(0);
updateCamera(0, true);
requestAnimationFrame(frame);
