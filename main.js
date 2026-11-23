import * as THREE from 'three';

const WORLD_SIZE = 800;
const WORLD_LIMIT = WORLD_SIZE / 2 - 10;
const ROAD_HALF_WIDTH = 6;

// Helpers for building primitives
function box(w, h, d, mat, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function sphere(r, mat, x, y, z) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

// Physics defaults shared by every vehicle
const COMMON = {
  coastDecel: 2,
  handbrakeDecel: 25,
  steerRate: 3,
};

// Vehicle definitions.
// Models face +Z. Collision circles (`colliders`) are placed at z offsets along the vehicle.
// `wheels` lists wheel positions; `front` wheels steer.
const VEHICLES = [
  {
    ...COMMON,
    id: 'motorbike',
    name: 'Motorbike',
    description: 'Fast and nimble, very tight turns',
    color: 0x1e88e5,
    accent: 0x222222,
    wheelBase: 1.9,
    wheelRadius: 0.35,
    wheelWidth: 0.2,
    maxSpeed: 50,
    maxReverse: 10,
    accel: 18,
    brake: 30,
    maxSteer: 0.7,
    cameraDistance: 6,
    cameraHeight: 3,
    colliders: [{ z: 0.9, r: 0.5 }, { z: -0.9, r: 0.5 }],
    wheels: [{ x: 0, z: 0.95, front: true }, { x: 0, z: -0.95 }],
    build(g, m) {
      g.add(box(0.3, 0.35, 1.3, m.paint, 0, 0.55, 0.3));
      g.add(box(0.3, 0.12, 0.9, m.dark, 0, 0.8, -0.35));
      g.add(box(0.7, 0.06, 0.06, m.metal, 0, 1.15, 0.85));
      g.add(box(0.1, 0.9, 0.1, m.metal, 0, 0.75, 0.9));
      g.add(box(0.45, 0.7, 0.3, m.paint, 0, 1.25, -0.25));
      g.add(sphere(0.2, m.helmet, 0, 1.75, -0.2));
    },
  },
  {
    ...COMMON,
    id: 'pickup',
    name: 'Pickup Car',
    description: 'Balanced all-rounder with an open bed',
    color: 0xd62828,
    accent: 0x333333,
    wheelBase: 2.6,
    wheelRadius: 0.4,
    wheelWidth: 0.35,
    maxSpeed: 40,
    maxReverse: 10,
    accel: 14,
    brake: 30,
    maxSteer: 0.55,
    cameraDistance: 9,
    cameraHeight: 4.5,
    colliders: [{ z: 1.4, r: 1.1 }, { z: -0.5, r: 1.1 }, { z: -1.9, r: 1.0 }],
    wheels: [
      { x: -1.0, z: 1.4, front: true },
      { x: 1.0, z: 1.4, front: true },
      { x: -1.0, z: -1.4 },
      { x: 1.0, z: -1.4 },
    ],
    build(g, m) {
      g.add(box(1.9, 0.5, 2.0, m.paint, 0, 0.75, 1.0));
      g.add(box(1.8, 0.75, 1.9, m.paint, 0, 1.3, -0.5));
      g.add(box(1.7, 0.6, 0.05, m.glass, 0, 1.35, 0.46));
      g.add(box(1.9, 0.1, 1.8, m.dark, 0, 0.98, -1.5));
      g.add(box(0.08, 0.45, 1.8, m.paint, -0.92, 1.25, -1.5));
      g.add(box(0.08, 0.45, 1.8, m.paint, 0.92, 1.25, -1.5));
      g.add(box(1.9, 0.45, 0.08, m.paint, 0, 1.25, -2.4));
      g.add(box(0.4, 0.15, 0.1, m.light, -0.6, 0.7, 2.02));
      g.add(box(0.4, 0.15, 0.1, m.light, 0.6, 0.7, 2.02));
    },
  },
  {
    ...COMMON,
    id: 'boxcar',
    name: 'Box Car',
    description: 'Tall box truck, slow to speed up and turn',
    color: 0xf2a900,
    accent: 0xeeeeee,
    wheelBase: 4.0,
    wheelRadius: 0.45,
    wheelWidth: 0.4,
    maxSpeed: 30,
    maxReverse: 6,
    accel: 9,
    brake: 25,
    maxSteer: 0.45,
    cameraDistance: 11,
    cameraHeight: 5.5,
    colliders: [{ z: 2.4, r: 1.2 }, { z: 0, r: 1.4 }, { z: -2.2, r: 1.4 }],
    wheels: [
      { x: -1.1, z: 2.0, front: true },
      { x: 1.1, z: 2.0, front: true },
      { x: -1.1, z: -2.0 },
      { x: 1.1, z: -2.0 },
    ],
    build(g, m) {
      g.add(box(2.2, 0.5, 5.5, m.dark, 0, 0.6, 0));
      g.add(box(2.2, 1.6, 1.8, m.paint, 0, 1.6, 2.2));
      g.add(box(1.9, 0.7, 0.05, m.glass, 0, 1.9, 3.13));
      g.add(box(2.4, 2.8, 4.5, m.accent, 0, 2.4, -1.0));
      g.add(box(0.4, 0.15, 0.1, m.light, -0.7, 0.9, 3.13));
      g.add(box(0.4, 0.15, 0.1, m.light, 0.7, 0.9, 3.13));
    },
  },
  {
    ...COMMON,
    id: 'container',
    name: 'Container Car',
    description: 'Long truck pulling a big container',
    color: 0xd62828,
    accent: 0x2e7d32,
    wheelBase: 6.5,
    wheelRadius: 0.5,
    wheelWidth: 0.45,
    maxSpeed: 25,
    maxReverse: 6,
    accel: 6,
    brake: 18,
    maxSteer: 0.38,
    cameraDistance: 14,
    cameraHeight: 6,
    colliders: [{ z: 5.5, r: 1.3 }, { z: 1.0, r: 1.5 }, { z: -3.0, r: 1.5 }, { z: -5.5, r: 1.4 }],
    wheels: [
      { x: -1.1, z: 5.8, front: true },
      { x: 1.1, z: 5.8, front: true },
      { x: -1.1, z: 3.6 },
      { x: 1.1, z: 3.6 },
      { x: -1.1, z: -4.6 },
      { x: 1.1, z: -4.6 },
    ],
    build(g, m) {
      g.add(box(2.4, 0.5, 3.5, m.dark, 0, 0.7, 4.8));
      g.add(box(2.4, 1.8, 2.4, m.paint, 0, 1.7, 5.8));
      g.add(box(2.1, 0.9, 0.05, m.glass, 0, 1.9, 7.02));
      g.add(box(2.2, 0.4, 11, m.dark, 0, 0.6, -0.5));
      g.add(box(2.6, 2.8, 9.5, m.accent, 0, 2.4, -1.5));
    },
  },
];

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

// Ground and road
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE),
  new THREE.MeshLambertMaterial({ color: 0x4a8f3a })
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const road = new THREE.Mesh(
  new THREE.PlaneGeometry(ROAD_HALF_WIDTH * 2, WORLD_SIZE),
  new THREE.MeshLambertMaterial({ color: 0x333338 })
);
road.rotation.x = -Math.PI / 2;
road.position.y = 0.01;
road.receiveShadow = true;
scene.add(road);

const lineMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
for (let z = -WORLD_LIMIT; z <= WORLD_LIMIT; z += 10) {
  const dash = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.02, 5), lineMat);
  dash.position.set(0, 0.03, z);
  scene.add(dash);
}

// Deterministic random so the world layout is the same on every load
let seed = 12345;
const rand = () => {
  seed = (seed * 16807) % 2147483647;
  return seed / 2147483647;
};
const range = (a, b) => a + (b - a) * rand();

// Obstacles are circles used for collision: { x, z, r }
const obstacles = [];

function addTree(x, z) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.3, 0.4, 2, 8),
    new THREE.MeshLambertMaterial({ color: 0x6b4423 })
  );
  trunk.position.y = 1;
  const crown = new THREE.Mesh(
    new THREE.ConeGeometry(2.2, 5, 10),
    new THREE.MeshLambertMaterial({ color: 0x2e7d32 })
  );
  crown.position.y = 4.5;
  trunk.castShadow = crown.castShadow = true;
  g.add(trunk, crown);
  g.position.set(x, 0, z);
  scene.add(g);
  obstacles.push({ x, z, r: 1.2 });
}

function addBuilding(x, z) {
  const w = range(6, 12);
  const h = range(8, 30);
  const d = range(6, 12);
  const colors = [0xb0bec5, 0xd7ccc8, 0x90a4ae, 0xe0e0e0];
  const mat = new THREE.MeshLambertMaterial({ color: colors[Math.floor(rand() * colors.length)] });
  scene.add(box(w, h, d, mat, x, h / 2, z));
  obstacles.push({ x, z, r: Math.hypot(w, d) / 2 });
}

const START_CLEARANCE = 12;
const farFromStart = (x, z) => Math.hypot(x, z) > START_CLEARANCE;

// Trees and buildings off the road
for (let i = 0; i < 160; i++) {
  const x = range(-WORLD_LIMIT, WORLD_LIMIT);
  const z = range(-WORLD_LIMIT, WORLD_LIMIT);
  if (Math.abs(x) < ROAD_HALF_WIDTH + 3 || !farFromStart(x, z)) continue;
  addTree(x, z);
}
for (let i = 0; i < 40; i++) {
  const x = range(-WORLD_LIMIT, WORLD_LIMIT);
  const z = range(-WORLD_LIMIT, WORLD_LIMIT);
  if (Math.abs(x) < ROAD_HALF_WIDTH + 20 || !farFromStart(x, z)) continue;
  addBuilding(x, z);
}

// Builds a vehicle model group with its wheels. Wheels are stored for animation.
function buildVehicle(v) {
  const lam = (c) => new THREE.MeshLambertMaterial({ color: c });
  const mats = {
    paint: lam(v.color),
    accent: lam(v.accent),
    glass: lam(0x222c3a),
    dark: lam(0x2b2b2b),
    metal: lam(0x9e9e9e),
    light: lam(0xfff59d),
    helmet: lam(0xf1c27d),
  };
  const tireMat = lam(0x111111);

  const group = new THREE.Group();
  v.build(group, mats);

  const wheelGeo = new THREE.CylinderGeometry(v.wheelRadius, v.wheelRadius, v.wheelWidth, 16);
  wheelGeo.rotateZ(Math.PI / 2);
  const wheels = [];

  for (const w of v.wheels) {
    // Steering wheels sit in a pivot that turns with the steering input
    const pivot = new THREE.Group();
    pivot.position.set(w.x, v.wheelRadius, w.z);
    const spin = new THREE.Group();
    const tire = new THREE.Mesh(wheelGeo, tireMat);
    tire.castShadow = true;
    spin.add(tire);
    if (w.front) {
      pivot.add(spin);
      group.add(pivot);
      wheels.push({ spin, pivot });
    } else {
      spin.position.copy(pivot.position);
      group.add(spin);
      wheels.push({ spin });
    }
  }
  group.userData.wheels = wheels;
  return group;
}

function disposeObject(obj) {
  obj.traverse((child) => {
    if (child.geometry) child.geometry.dispose();
    if (child.material) child.material.dispose();
  });
}

let vehicle = VEHICLES[0];
let carMesh = buildVehicle(vehicle);
scene.add(carMesh);

const car = { x: 0, z: 0, heading: 0, speed: 0, steer: 0, wheelAngle: 0 };

function resetCar() {
  Object.assign(car, { x: 0, z: 0, heading: 0, speed: 0, steer: 0 });
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
  car.speed = Math.min(Math.max(car.speed, -vehicle.maxReverse), vehicle.maxSpeed);

  const steerInput = (left ? 1 : 0) - (right ? 1 : 0);
  car.steer = approach(car.steer, steerInput * vehicle.maxSteer, vehicle.steerRate * dt);

  // Bicycle model: turn rate depends on speed and steering angle
  car.heading += (car.speed * Math.tan(car.steer) / vehicle.wheelBase) * dt;
  car.x += Math.sin(car.heading) * car.speed * dt;
  car.z += Math.cos(car.heading) * car.speed * dt;

  resolveCollisions();
  car.x = Math.min(Math.max(car.x, -WORLD_LIMIT), WORLD_LIMIT);
  car.z = Math.min(Math.max(car.z, -WORLD_LIMIT), WORLD_LIMIT);
}

function resolveCollisions() {
  const fx = Math.sin(car.heading);
  const fz = Math.cos(car.heading);
  for (const c of vehicle.colliders) {
    for (const o of obstacles) {
      const px = car.x + fx * c.z;
      const pz = car.z + fz * c.z;
      const dx = px - o.x;
      const dz = pz - o.z;
      const minDist = o.r + c.r;
      const dist2 = dx * dx + dz * dz;
      if (dist2 >= minDist * minDist || dist2 < 1e-6) continue;

      const dist = Math.sqrt(dist2);
      const push = minDist - dist;
      car.x += (dx / dist) * push;
      car.z += (dz / dist) * push;
      car.speed *= 0.2;
    }
  }
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
