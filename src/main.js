import * as THREE from 'three';
import { WORLD_LIMIT, ZONES, inRect, obstacles } from './core/world.js';
import { buildEnvironment } from './world/environment.js';
import { buildTown } from './world/building.js';
import { addTrees } from './world/tree.js';
import { addBushes } from './world/bush.js';
import { VEHICLES, buildVehicle, disposeObject } from './vehicles/vehicle.js';

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
const lots = buildTown(scene);
addTrees(scene, lots);
addBushes(scene, lots);

let vehicle = VEHICLES[0];
let carMesh = buildVehicle(vehicle);
scene.add(carMesh);

const car = { x: 0, z: 0, heading: 0, speed: 0, steer: 0, wheelAngle: 0 };

function resetCar() {
  Object.assign(car, { x: 0, z: 0, heading: 0, speed: 0, steer: 0 });
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

function resolveCollisions() {
  for (const c of vehicle.colliders) {
    for (const o of obstacles) {
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
  carMesh.position.set(car.x, 0, car.z);
  carMesh.rotation.y = car.heading;

  car.wheelAngle += (car.speed * dt) / vehicle.wheelRadius;
  for (const { spin, pivot } of carMesh.userData.wheels) {
    spin.rotation.x = car.wheelAngle;
    if (pivot) pivot.rotation.y = car.steer;
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

function updateHud() {
  speedEl.textContent = `${Math.round(Math.abs(car.speed) * 3.6)} km/h`;
  gearEl.textContent = car.speed < -0.1 ? 'Gear: R' : 'Gear: D';
}

// Menu
const menuEl = document.getElementById('menu');
const menuButtons = document.querySelectorAll('[data-vehicle]');

function setMenu(open) {
  menuOpen = open;
  menuEl.classList.toggle('hidden', !open);
  if (open) keys.clear();
}

function selectVehicle(id) {
  const next = VEHICLES.find((v) => v.id === id);
  if (!next || next === vehicle) return;

  vehicle = next;
  scene.remove(carMesh);
  disposeObject(carMesh);
  carMesh = buildVehicle(vehicle);
  scene.add(carMesh);

  resetCar();
  syncCarMesh(0);
  updateCamera(0, true);
  vehicleEl.textContent = `Vehicle: ${vehicle.name}`;
  menuButtons.forEach((b) => b.classList.toggle('active', b.dataset.vehicle === id));
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

menuButtons.forEach((b) => b.classList.toggle('active', b.dataset.vehicle === vehicle.id));
vehicleEl.textContent = `Vehicle: ${vehicle.name}`;

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

let last = performance.now();
function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;

  if (!menuOpen) {
    updateCar(dt);
    syncCarMesh(dt);
  }
  updateCamera(dt);
  updateHud();
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

syncCarMesh(0);
updateCamera(0, true);
requestAnimationFrame(frame);
