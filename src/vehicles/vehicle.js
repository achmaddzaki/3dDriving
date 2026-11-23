import * as THREE from 'three';
import { box, sphere } from '../core/primitives.js';

// Physics defaults shared by every vehicle
const COMMON = {
  coastDecel: 2,
  handbrakeDecel: 25,
  steerRate: 3,
  turnRateScale: 0.6, // fraction of the bicycle-model turn rate
};

// Shared motorbike base. Each bike variant adds its own cargo.
const BIKE_COLLIDERS = [{ z: 0.9, r: 0.5 }, { z: -0.9, r: 0.5 }];
const BIKE = {
  ...COMMON,
  color: 0x1e88e5,
  accent: 0x222222,
  turnRateScale: 0.3,
  wheelBase: 1.9,
  wheelRadius: 0.35,
  wheelWidth: 0.2,
  maxSpeed: 120 / 3.6, // 120 km/h
  maxReverse: 10,
  accel: 18,
  brake: 30,
  maxSteer: 0.7,
  cameraDistance: 6,
  cameraHeight: 4.5,
  wheels: [{ x: 0, z: 0.95, front: true }, { x: 0, z: -0.95 }],
  build(g, m) {
    g.add(box(0.3, 0.35, 1.3, m.paint, 0, 0.55, 0.3));
    g.add(box(0.3, 0.12, 0.9, m.dark, 0, 0.8, -0.35));
    g.add(box(0.7, 0.06, 0.06, m.metal, 0, 1.15, 0.85));
    g.add(box(0.1, 0.9, 0.1, m.metal, 0, 0.75, 0.9));
    g.add(box(0.45, 0.7, 0.3, m.paint, 0, 1.25, -0.25));
    g.add(sphere(0.2, m.helmet, 0, 1.75, -0.2));
  },
};

// Creates a motorbike variant with extra collision circles and cargo geometry
function makeBike(id, name, description, cargoColliders, buildCargo) {
  return {
    ...BIKE,
    id,
    name,
    description,
    colliders: [...BIKE_COLLIDERS, ...cargoColliders],
    build(g, m) {
      BIKE.build(g, m);
      buildCargo(g, m);
    },
  };
}

// Vehicle definitions.
// Models face +Z. Collision circles (`colliders`) are placed at z offsets along the vehicle.
// `wheels` lists wheel positions; `front` wheels steer.
export const VEHICLES = [
  makeBike(
    'bike-small',
    'Motorbike + Small Cargo',
    'Light bike with one small box behind',
    [{ z: -1.2, r: 0.4 }],
    (g, m) => g.add(box(0.5, 0.35, 0.4, m.metal, 0, 0.95, -1.15))
  ),
  makeBike(
    'bike-sides',
    'Motorbike + Side Cargo',
    'Bike with a cargo box on the left and right',
    [{ z: -0.5, r: 0.6 }],
    (g, m) => {
      g.add(box(0.25, 0.45, 0.6, m.metal, -0.45, 0.7, -0.5));
      g.add(box(0.25, 0.45, 0.6, m.metal, 0.45, 0.7, -0.5));
    }
  ),
  makeBike(
    'bike-big',
    'Motorbike + Big Cargo',
    'Bike with a large cargo box behind',
    [{ z: -1.4, r: 0.6 }],
    (g, m) => g.add(box(0.8, 0.6, 0.9, m.metal, 0, 1.15, -1.3))
  ),
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
    maxSpeed: 110 / 3.6, // 110 km/h
    maxReverse: 10,
    accel: 14,
    brake: 30,
    maxSteer: 0.55,
    cameraDistance: 9,
    cameraHeight: 6,
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
    maxSpeed: 90 / 3.6, // 90 km/h
    maxReverse: 6,
    accel: 9,
    brake: 25,
    maxSteer: 0.45,
    cameraDistance: 11,
    cameraHeight: 7,
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
    maxSpeed: 70 / 3.6, // 70 km/h
    maxReverse: 6,
    accel: 6,
    brake: 18,
    maxSteer: 0.38,
    cameraDistance: 14,
    cameraHeight: 7.5,
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

// Builds a vehicle model group with its wheels. Wheels are stored for animation.
export function buildVehicle(v) {
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

export function disposeObject(obj) {
  obj.traverse((child) => {
    if (child.geometry) child.geometry.dispose();
    if (child.material) child.material.dispose();
  });
}
