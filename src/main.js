import * as THREE from 'three';
import { WORLD_LIMIT, ZONES, inRect, obstacles, sidewalkFixtures } from './core/world.js';
import { buildEnvironment, addRoadEdges } from './world/environment.js';
import { addStreetFurniture } from './world/street-furniture.js';
import { buildTown } from './world/building/town.js';
import { addTrees } from './world/tree.js';
import { addBushes } from './world/bush.js';
import { VEHICLES, buildVehicle } from './vehicles/vehicle.js';
import { USER_TYPES } from './game/mission.js';
import { createDirectionArrow, createMarker } from './game/marker.js';

const keys = new Set();
let menuOpen = false;

window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape') {
    setMenu(!menuOpen);
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

// Renderer, scene, camera
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
scene.fog = new THREE.Fog(0x87ceeb, 90, 280);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);

const sun = new THREE.DirectionalLight(0xffffff, 1.1);
sun.position.set(60, 100, 40);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -80, right: 80, top: 80, bottom: -80, far: 300 });
sun.shadow.camera.updateProjectionMatrix();
scene.add(sun, new THREE.HemisphereLight(0xffffff, 0x445522, 0.6));

// World: roads and sidewalks, then parking lots with buildings, then trees
buildEnvironment(scene);
const { lots, spots, stores, distributorLot } = buildTown(scene, VEHICLES.length);
addRoadEdges(scene, lots);
addStreetFurniture(scene, lots, sidewalkFixtures);
addTrees(scene, lots);
addBushes(scene, lots);

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
const car = { x: 0, z: 0, heading: 0, speed: 0, steer: 0, wheelAngle: 0 };
Object.assign(car, active.pose);

function resetCar() {
  Object.assign(car, { x: active.home.x, z: active.home.z, heading: active.home.heading, speed: 0, steer: 0 });
}

const GRASS_SPEED_FACTOR = 0.5;   // top speed multiplier on grass
const SPEED_LIMIT_DECEL = 15;     // m/s^2 used to slow down to a new top speed

// Grass is any ground outside roads, sidewalks, and parking lots
function isOnGrass() {
  return ![...ZONES, ...lots].some((r) => inRect(car.x, car.z, r));
}

// Caps speed at the top speed, lower on grass. Slows down smoothly when the cap drops.
function limitSpeed(dt) {
  const grip = isOnGrass() ? GRASS_SPEED_FACTOR : 1;
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
  car.x += Math.sin(car.heading) * car.speed * dt;
  car.z += Math.cos(car.heading) * car.speed * dt;

  resolveCollisions();
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

function resolveCollisions() {
  const solids = [...obstacles, ...vehicleObstacles()];
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
      car.speed *= 0.2;
    }
  }
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
  active.mesh.position.set(car.x, 0, car.z);
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

function updateCamera(dt, snap = false) {
  const fx = Math.sin(car.heading);
  const fz = Math.cos(car.heading);
  const d = vehicle.cameraDistance;
  cameraTarget.set(car.x - fx * d, vehicle.cameraHeight, car.z - fz * d);
  if (snap) {
    camera.position.copy(cameraTarget);
  } else {
    camera.position.lerp(cameraTarget, 1 - Math.exp(-6 * dt));
  }
  lookTarget.set(car.x + fx * 2, 1.2, car.z + fz * 2);
  camera.lookAt(lookTarget);
}

const speedEl = document.getElementById('speed');
const gearEl = document.getElementById('gear');
const vehicleEl = document.getElementById('vehicle');

const userTypeEl = document.getElementById('user-type');
const missionEl = document.getElementById('mission');
let shownMissionText = '';

function updateHud() {
  speedEl.textContent = `${Math.round(Math.abs(car.speed) * 3.6)} km/h`;
  gearEl.textContent = car.speed < -0.1 ? 'Gear: R' : 'Gear: D';
  const text = mission.status().join('\n');
  if (text === shownMissionText) return;
  shownMissionText = text;
  missionEl.textContent = text;
}

// Menu
const menuEl = document.getElementById('menu');
const menuButtons = document.querySelectorAll('[data-vehicle]');
const typeButtons = document.querySelectorAll('[data-type]');

// Mission for the chosen user type, created over the current store and distributor lots
const missionContext = { stores, distributorLot };
let userType = USER_TYPES[0];
let mission = userType.createMission(missionContext);
const marker = createMarker(scene);
const vehicleArrow = createDirectionArrow(scene);

function setMenu(open) {
  menuOpen = open;
  menuEl.classList.toggle('hidden', !open);
  if (open) keys.clear();
}

// Drives the picked vehicle from its current spot and starts the return timer for the previous one.
// The camera eases over to the new vehicle through its follow lerp.
function selectVehicle(id) {
  const next = fleet.find((e) => e.def.id === id);
  if (!next || next === active) return;

  active.pose = { x: car.x, z: car.z, heading: car.heading };
  active.returnTimer = RETURN_DELAY;

  // A vehicle still on the road is picked up where it stopped and keeps its place
  next.returnTimer = null;
  active = next;
  vehicle = next.def;
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
  mission = userType.createMission(missionContext);
  userTypeEl.textContent = `User: ${userType.name}`;
  typeButtons.forEach((b) => b.classList.toggle('active', b.dataset.type === id));
}

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

menuButtons.forEach((b) => b.classList.toggle('active', b.dataset.vehicle === vehicle.id));
vehicleEl.textContent = `Vehicle: ${vehicle.name}`;
typeButtons.forEach((b) => b.classList.toggle('active', b.dataset.type === userType.id));
userTypeEl.textContent = `User: ${userType.name}`;

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Shows the lot marker on the target, and the arrow above the car turned toward it
function updateTargetMarkers(target, time) {
  if (!target) {
    marker.hide();
    vehicleArrow.hide();
    return;
  }
  marker.show(target, time);
  const tx = (target.minX + target.maxX) / 2;
  const tz = (target.minZ + target.maxZ) / 2;
  const yaw = Math.atan2(tx - car.x, tz - car.z);
  vehicleArrow.show(car.x, active.extent.top + VEHICLE_ARROW_GAP, car.z, yaw, time);
}

let last = performance.now();
function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;

  if (!menuOpen) {
    updateCar(dt);
    syncCarMesh(dt);
    updateReturns(dt);
    mission.update(car, dt);
  }
  updateTargetMarkers(mission.target(car), now / 1000);
  updateCamera(dt);
  updateHud();
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

syncCarMesh(0);
updateCamera(0, true);
requestAnimationFrame(frame);
