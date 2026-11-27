import * as THREE from 'three';
import { STREETS, grow, rectsOverlap } from '../core/world.js';
import { box } from '../core/primitives.js';
import { groundHeight } from '../core/terrain.js';
import { laneCenter } from '../world/roads/environment.js';
import { hornVolume, playHorn, scheduleHornLoad, unlockHorn } from './npc-horn.js';

// NPC cars that drive on the right-hand lane, turn left or right at junctions, and stop for anything ahead
const NPC_COUNT = 20;
const CRUISE_MIN = 7; // m/s
const CRUISE_MAX = 10; // m/s
const ACCEL = 4; // m/s^2
const BRAKE = 12; // m/s^2
const TURN_RATE = 2.5; // rad/s, how fast the body turns into a new direction
const STOP_DISTANCE = 10; // m of road watched ahead of the car
const ZONE_MARGIN = 0.5; // m added to the car's half width for the watched strip's sideways reach
const SPAWN_EDGE = 6; // m kept clear of a street end at spawn
const JUNCTION_CLEAR = 8; // m kept clear of a junction at spawn
const PLAYER_CLEAR = 20; // m kept clear of the player at spawn
const SPAWN_TRIES = 30;
const FRONT_TALK_SECONDS = 2; // seconds the player stays in front before the NPC speaks, repeating while they stay
// The car's collision push leaves the player exactly at contact distance, so contact counts within this margin
const TOUCH_MARGIN = 0.3;
const BUBBLE_SECONDS = 2.5;
const BUBBLE_READ_SECONDS = 2; // extra seconds each bubble stays up so the player can read it
const HIT_STOP_SECONDS = 3; // seconds a car stays stopped after the player hits it
const TALK_COOLDOWN = 5; // seconds between two speeches of the same NPC
const BLOCKED_TALK_SECONDS = 4; // seconds a car stays blocked by another car before it starts speaking, repeating while blocked
const HORN_INTERVAL_SECONDS = 5; // seconds blocked before each honk, repeating while blocked
const HORN_LONG_COUNT = 5; // honks with the long horn, then every later honk uses the short horn
const BUBBLE_HEIGHT = 2.6; // m above the ground
const EPS = 1e-6;
const OFFSET_DECAY = 5; // 1/s, how fast a car slides from its old lane position to the new one after a turn
// Lines by tone. Each car speaks friendly lines first, then neutral, then offensive.
const LINES = {
  friendly: [
    "Excuse me! Could you make a little room?",
    "Hello there! Mind letting me through?",
    "Lovely day for a drive, isn't it? Just need to get past you!",
    "Coming through! Thank you!",
    "I promise I'm a friendly driver. Please move!",
    "Could you park somewhere else, please?",
    "Excuse me, you're blocking my grand adventure!",
    "A little space would be wonderful!",
    "Hey neighbor! Mind clearing the road?",
    "I'm not in a hurry, but my wheels are getting impatient!",
    "After you... actually, could you go first and move?",
    "This road is looking a little crowded!",
    "Pardon me! My destination awaits!",
    "Would you mind moving just a tiny bit?",
    "Nice car! Now could you move it?",
    "I believe this road is big enough for both of us!",
    "Hello! I'm starting to become part of the scenery here!",
    "No rush, but I'm collecting dust behind you!",
    "Could we turn this into a two-way friendship?",
    "Thanks in advance! You're making my day!"
  ],
  neutral: [
    "Are we having a parking competition?",
    "Interesting place to stop. Very scenic.",
    "The road is all yours. Apparently.",
    "Take your time. I wasn't going anywhere anyway.",
    "Did your car run out of imagination?",
    "I admire your commitment to standing still.",
    "Is this a road or your personal parking lot?",
    "Just checking, are we moving today?",
    "Beautiful weather for blocking traffic!",
    "I see we've chosen the scenic route. Behind you.",
    "No worries, I'll just grow old here.",
    "Are you waiting for the road to move?",
    "That's one way to make new friends.",
    "You must really love this particular spot.",
    "I would honk, but I respect your dedication to doing nothing.",
    "Fantastic. A traffic jam with just two people.",
    "Is there a secret mission happening here?",
    "I hope you're enjoying the view. I'm enjoying your bumper.",
    "Don't mind me, just becoming part of the road.",
    "Congratulations! You've unlocked the stationary vehicle achievement!"
  ],
  offensive: [
    "Did you get your driving license from a cereal box?",
    "Move it, you magnificent road obstacle!",
    "Your parking skills are truly a public safety concern.",
    "I've seen loading screens move faster than you.",
    "Are you driving or just decorating the road?",
    "Congratulations, you've become a traffic problem.",
    "Your brain isn't the only thing in neutral, apparently.",
    "Move your car before it becomes part of the pavement!",
    "Were you planning to move this century?",
    "I didn't know the road came with permanent furniture.",
    "Even a snail would be disappointed in you.",
    "Your car has four wheels. Try using them!",
    "Is your steering wheel just for decoration?",
    "I'd call you a roadblock, but that would be disrespectful to roadblocks.",
    "The parking lot is that way, genius!",
    "Are you waiting for a personal invitation to move?",
    "I've had more productive conversations with a brick wall.",
    "Please stop treating the road like your living room!",
    "You're making a traffic cone look intelligent.",
    "Move it, you overpriced traffic decoration!"
  ],
};
// Speech count at which each tone starts: the first 2 lines are friendly, the next 2 neutral, then offensive
// Lines for a car that was just hit by the player. They do not move the tone count.
const HIT_LINES = [
  "Well done. Did you aim for me, or was that just natural talent?",
  "Your brakes called. They said they miss you.",
  "I see mirrors are optional in your driving lessons.",
  "That's a bold way to say hello.",
  "Were you trying to park, or just attack my car?",
  "Congratulations! You've made your insurance company nervous.",
  "My car didn't deserve that kind of introduction.",
  "Do you drive with your eyes closed, or is this your best effort?",
  "I hope your driving skills are better than your apology.",
  "That's going to be an interesting conversation with your mechanic.",
  "You know roads are for driving, not demolition, right?",
  "I've seen shopping carts maneuver better than you.",
  "Was that a brake pedal, or just a decorative feature?",
  "Careful! You're making a strong case for public transport.",
  "I parked my car, not a target.",
  "Impressive. You managed to hit the one thing you needed to avoid.",
  "Should I call the police, or your driving instructor?",
  "I hope you brought your insurance. You're clearly short on driving skills.",
  "That's one expensive way to get my attention.",
  "Next time, try using the road instead of my bumper!"
];
const FRIENDLY_LINES = 4;
const NEUTRAL_LINES = 8;

// Picks a random line for the car's current speech count
function pickLine(n) {
  let tone = LINES.offensive;
  if (n.speechCount < FRIENDLY_LINES) tone = LINES.friendly;
  else if (n.speechCount < NEUTRAL_LINES) tone = LINES.neutral;
  return tone[Math.floor(Math.random() * tone.length)];
}
const PAINTS = [0xf5f5f5, 0x2e7d32, 0xfdd835, 0x6d4c41, 0x7e57c2, 0x455a64]
  .map((color) => new THREE.MeshLambertMaterial({ color }));
const glassMat = new THREE.MeshLambertMaterial({ color: 0x263238 });
const chassisMat = new THREE.MeshLambertMaterial({ color: 0x37474f });
const tireMat = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
const tireGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.25, 12);
tireGeo.rotateZ(Math.PI / 2);

const headPos = new THREE.Vector3();
const camDir = new THREE.Vector3();
const toHead = new THREE.Vector3();

function randomBetween(a, b) {
  return a + (b - a) * Math.random();
}

// Moves value toward target by at most step
function approach(value, target, step) {
  if (value < target) return Math.min(value + step, target);
  return Math.max(value - step, target);
}

// Wheels at every x and z pair, under a model facing +Z
function addWheels(g, xs, zs) {
  for (const x of xs) {
    for (const z of zs) {
      const wheel = new THREE.Mesh(tireGeo, tireMat);
      wheel.position.set(x, 0.35, z);
      g.add(wheel);
    }
  }
}

// Car body facing +Z, with four wheels
function buildSedan(paint) {
  const g = new THREE.Group();
  g.add(box(1.8, 0.7, 4, paint, 0, 0.55, 0));
  g.add(box(1.6, 0.6, 2, glassMat, 0, 1.15, -0.2));
  addWheels(g, [-0.9, 0.9], [-1.3, 1.3]);
  return g;
}

// Box truck: chassis, tall cargo box, and a cab in front
function buildBoxCar(paint) {
  const g = new THREE.Group();
  g.add(box(2.0, 0.4, 6.0, chassisMat, 0, 0.45, 0));
  g.add(box(2.2, 2.2, 4.0, paint, 0, 1.75, -0.8));
  g.add(box(2.0, 1.4, 1.6, paint, 0, 1.2, 2.2));
  g.add(box(1.6, 0.5, 0.05, glassMat, 0, 1.35, 3.01));
  addWheels(g, [-1.0, 1.0], [-2.0, 2.2]);
  return g;
}

// Pickup truck: cab over the front, open bed behind it
function buildPickup(paint) {
  const g = new THREE.Group();
  g.add(box(1.9, 0.6, 4.5, paint, 0, 0.65, 0));
  g.add(box(1.8, 0.7, 1.7, paint, 0, 1.3, 0.1));
  g.add(box(1.7, 0.45, 0.05, glassMat, 0, 1.35, 0.96));
  g.add(box(0.1, 0.5, 1.4, paint, -0.9, 1.1, -1.55));
  g.add(box(0.1, 0.5, 1.4, paint, 0.9, 1.1, -1.55));
  addWheels(g, [-0.95, 0.95], [-1.5, 1.5]);
  return g;
}

// Low sport car with a glass cabin and a small rear spoiler
function buildSport(paint) {
  const g = new THREE.Group();
  g.add(box(1.9, 0.5, 4.0, paint, 0, 0.5, 0));
  g.add(box(1.5, 0.45, 1.6, glassMat, 0, 0.98, -0.2));
  g.add(box(1.7, 0.05, 0.25, paint, 0, 0.85, -1.85));
  addWheels(g, [-0.95, 0.95], [-1.3, 1.3]);
  return g;
}

// Body variants. halfLen and halfWid are the footprint used for collisions and the watched strip.
const VARIANTS = [
  { halfLen: 2, halfWid: 0.9, build: buildSedan },
  { halfLen: 3, halfWid: 1.1, build: buildBoxCar },
  { halfLen: 2.3, halfWid: 0.95, build: buildPickup },
  { halfLen: 2, halfWid: 0.95, build: buildSport },
];

// Speech bubble element, hidden until the car speaks
function createBubble() {
  const el = document.createElement('div');
  el.className = 'npc-bubble';
  el.hidden = true;
  document.body.appendChild(el);
  return el;
}

function createNpc() {
  const paint = PAINTS[Math.floor(Math.random() * PAINTS.length)];
  const variant = VARIANTS[Math.floor(Math.random() * VARIANTS.length)];
  return {
    mesh: variant.build(paint),
    halfLen: variant.halfLen,
    halfWid: variant.halfWid,
    bubble: createBubble(),
    street: null,
    sign: 1, // travel direction along the street axis, +1 or -1
    a: 0, // position along the travel axis
    cruise: 0,
    speed: 0,
    heading: 0, // visual yaw, eased toward the travel direction
    offset: { x: 0, z: 0 }, // visual gap left by the last turn, eased to zero
    frontTimer: 0,
    touching: false,
    hitTimer: 0, // seconds left in the stop after a hit
    blockedTimer: 0, // seconds blocked by another car
    hornTimer: 0, // seconds blocked since the last honk
    hornCount: 0, // honks in the current block
    speechCount: 0, // lines spoken since the last reset, which sets the tone
    talkCooldown: 0,
    bubbleTimer: 0,
  };
}

// Right-hand lane center across the street for travel direction `sign`
function laneAcross(street, sign) {
  const lc = laneCenter(street);
  return street.alongX ? street.offset + sign * lc : street.offset - sign * lc;
}

// World x and z of a car at position p
function worldPos(p) {
  const across = laneAcross(p.street, p.sign);
  return p.street.alongX ? { x: p.a, z: across } : { x: across, z: p.a };
}

// Axis-aligned footprint of a car at position p
function bodyBox(p) {
  const { x, z } = worldPos(p);
  const hx = p.street.alongX ? p.halfLen : p.halfWid;
  const hz = p.street.alongX ? p.halfWid : p.halfLen;
  return { minX: x - hx, maxX: x + hx, minZ: z - hz, maxZ: z + hz };
}

// Strip of road ahead of the car that must be clear before it moves
function watchZone(p) {
  const { x, z } = worldPos(p);
  const near = p.a + p.sign * p.halfLen;
  const far = near + p.sign * STOP_DISTANCE;
  const lo = Math.min(near, far);
  const hi = Math.max(near, far);
  const reach = p.halfWid + ZONE_MARGIN;
  if (p.street.alongX) return { minX: lo, maxX: hi, minZ: z - reach, maxZ: z + reach };
  return { minX: x - reach, maxX: x + reach, minZ: lo, maxZ: hi };
}

// Nearest crossing street ahead on the current street, as { street, dist }, or null
function nextJunction(p) {
  let best = null;
  for (const s of STREETS) {
    if (s.alongX === p.street.alongX) continue;
    const dist = (s.offset - p.a) * p.sign;
    if (dist > EPS && (!best || dist < best.dist)) best = { street: s, dist };
  }
  return best;
}

// New travel signs for a right and a left turn onto the crossing street, keeping only the ones that stay on the road
function turnOptions(p, crossing) {
  const rightSign = p.street.alongX ? p.sign : -p.sign;
  const along = p.street.offset;
  return [rightSign, -rightSign].filter((s) => (s > 0 ? along < crossing.span : along > -crossing.span));
}

// Turns onto the crossing street, picking left or right at random
function takeJunction(p, crossing) {
  const options = turnOptions(p, crossing);
  if (options.length === 0) {
    p.sign = -p.sign;
    return;
  }
  const along = p.street.offset;
  p.street = crossing;
  p.a = along;
  p.sign = options[Math.floor(Math.random() * options.length)];
}

// Moves a car forward along its street, turning at the next junction when it reaches it.
// The visual gap left by a turn is stored in `offset` and eased out in updateNpc.
function advance(p, distance) {
  const junction = nextJunction(p);
  if (!junction) return;
  if (distance < junction.dist) {
    p.a += p.sign * distance;
    return;
  }
  p.a = junction.street.offset;
  const before = worldPos(p);
  takeJunction(p, junction.street);
  const after = worldPos(p);
  p.offset.x += before.x - after.x;
  p.offset.z += before.z - after.z;
}

// Yaw that points the model along its travel direction (the model faces +Z at yaw 0)
function travelYaw(p) {
  if (p.street.alongX) return p.sign > 0 ? Math.PI / 2 : -Math.PI / 2;
  return p.sign > 0 ? 0 : Math.PI;
}

// Turns the visual yaw toward the travel direction at TURN_RATE
function easeYaw(n, dt) {
  const target = travelYaw(n);
  const diff = Math.atan2(Math.sin(target - n.heading), Math.cos(target - n.heading));
  const step = TURN_RATE * dt;
  n.heading += Math.max(-step, Math.min(step, diff));
}

// Player collision circles in world space, from the car pose and its collider list
function playerCircles(car, colliders) {
  const s = Math.sin(car.heading);
  const c = Math.cos(car.heading);
  return colliders.map(({ z, r }) => ({ x: car.x + s * z, z: car.z + c * z, r }));
}

// True when a circle overlaps an axis-aligned rectangle
function circleHitsRect(circle, rect, margin = 0) {
  const nx = Math.min(Math.max(circle.x, rect.minX), rect.maxX);
  const nz = Math.min(Math.max(circle.z, rect.minZ), rect.maxZ);
  const dx = circle.x - nx;
  const dz = circle.z - nz;
  const reach = circle.r + margin;
  return dx * dx + dz * dz < reach * reach;
}

// Shows a random line in the car's bubble, unless it spoke recently
function say(n, text, seconds) {
  if (n.talkCooldown > 0) return;
  n.bubble.textContent = text;
  n.bubble.hidden = false;
  n.bubbleTimer = seconds + BUBBLE_READ_SECONDS;
  n.talkCooldown = TALK_COOLDOWN;
}

// Speaks a tone line, which moves the car's speech count forward
function speak(n) {
  if (n.talkCooldown > 0) return;
  n.speechCount += 1;
  say(n, pickLine(n), BUBBLE_SECONDS);
}

// Stops the car and speaks when the player bumps it. Speaks after the player waits in front for FRONT_TALK_SECONDS.
function reactToPlayer(n, dt, inFront, touching, carAhead) {
  if (touching && !n.touching) {
    n.hitTimer = HIT_STOP_SECONDS;
    n.talkCooldown = 0;
    say(n, HIT_LINES[Math.floor(Math.random() * HIT_LINES.length)], HIT_STOP_SECONDS);
  }
  n.touching = touching;
  // A car stopped behind another car is not talking to the player, so it stays quiet
  if (!inFront || carAhead) {
    n.frontTimer = 0;
    return;
  }
  n.frontTimer += dt;
  if (n.frontTimer >= FRONT_TALK_SECONDS && n.talkCooldown <= 0) {
    n.frontTimer = 0;
    speak(n);
  }
}

// Starts a reaction loop while another car keeps this one blocked for BLOCKED_TALK_SECONDS
function reactToBlock(n, dt, blockedByCar) {
  n.blockedTimer = blockedByCar ? n.blockedTimer + dt : 0;
  if (n.blockedTimer >= BLOCKED_TALK_SECONDS && n.talkCooldown <= 0) {
    n.blockedTimer = 0;
    speak(n);
  }
}

// Honks every HORN_INTERVAL_SECONDS while the car is blocked by the player or another car, with volume set by distance to the player
function honkWhileBlocked(n, dt, blockedByCar, car) {
  if (!blockedByCar) {
    n.hornTimer = 0;
    n.hornCount = 0;
    return;
  }
  n.hornTimer += dt;
  if (n.hornTimer < HORN_INTERVAL_SECONDS) return;
  n.hornTimer = 0;
  n.hornCount += 1;
  const pos = worldPos(n);
  const volume = hornVolume(Math.hypot(pos.x - car.x, pos.z - car.z));
  playHorn(n.hornCount > HORN_LONG_COUNT ? 'short' : 'long', volume);
}

// One simulation step for a car: stop or go, move, turn at junctions, and react to the player
function updateNpc(n, dt, circles, others, car) {
  n.talkCooldown = Math.max(0, n.talkCooldown - dt);
  n.hitTimer = Math.max(0, n.hitTimer - dt);
  if (n.bubbleTimer > 0) {
    n.bubbleTimer -= dt;
    if (n.bubbleTimer <= 0) n.bubble.hidden = true;
  }
  const zone = watchZone(n);
  const inFront = circles.some((c) => circleHitsRect(c, zone));
  const touching = circles.some((c) => circleHitsRect(c, bodyBox(n), TOUCH_MARGIN));
  const blockedByCar = others.some((m) => m !== n && rectsOverlap(zone, bodyBox(m)));
  reactToPlayer(n, dt, inFront, touching, blockedByCar);
  reactToBlock(n, dt, blockedByCar);
  honkWhileBlocked(n, dt, inFront || blockedByCar, car);
  const blocked = inFront || touching || blockedByCar || n.hitTimer > 0;
  n.speed = approach(n.speed, blocked ? 0 : n.cruise, (blocked ? BRAKE : ACCEL) * dt);
  advance(n, n.speed * dt);
  easeYaw(n, dt);
  const decay = Math.exp(-OFFSET_DECAY * dt);
  n.offset.x *= decay;
  n.offset.z *= decay;
}

// Sets the mesh pose and keeps the speech bubble above the car on screen
function placeNpc(n, camera) {
  const pos = worldPos(n);
  const x = pos.x + n.offset.x;
  const z = pos.z + n.offset.z;
  n.mesh.position.set(x, groundHeight(x, z), z);
  n.mesh.rotation.y = n.heading;
  if (n.bubble.hidden) return;
  camera.getWorldDirection(camDir);
  toHead.set(x, BUBBLE_HEIGHT, z).sub(camera.position);
  headPos.set(x, BUBBLE_HEIGHT, z).project(camera);
  n.bubble.style.display = toHead.dot(camDir) < 0 ? 'none' : '';
  n.bubble.style.left = `${((headPos.x + 1) / 2) * window.innerWidth}px`;
  n.bubble.style.top = `${((1 - headPos.y) / 2) * window.innerHeight}px`;
}

// Random travel spot on a street, or null when no clear one turns up
function findSpot(n, car, chosen) {
  for (let i = 0; i < SPAWN_TRIES; i++) {
    const street = STREETS[Math.floor(Math.random() * STREETS.length)];
    const spot = {
      street,
      sign: Math.random() < 0.5 ? -1 : 1,
      a: randomBetween(-street.span + SPAWN_EDGE, street.span - SPAWN_EDGE),
      halfLen: n.halfLen,
      halfWid: n.halfWid,
    };
    if (isClearSpot(spot, car, chosen)) return spot;
  }
  return null;
}

// A spot is clear when it is away from junctions, the player, and the cars already placed
function isClearSpot(spot, car, chosen) {
  const nearJunction = STREETS.some((s) => s.alongX !== spot.street.alongX && Math.abs(s.offset - spot.a) < JUNCTION_CLEAR);
  if (nearJunction) return false;
  const { x, z } = worldPos(spot);
  if (Math.hypot(x - car.x, z - car.z) < PLAYER_CLEAR) return false;
  const area = grow(bodyBox(spot), 2);
  return chosen.every((m) => !rectsOverlap(area, bodyBox(m)));
}

// Creates the NPC traffic. Nothing is visible until setEnabled(true) is called.
export function createNpcTraffic(scene) {
  let pool = [];
  let active = [];
  scheduleHornLoad();

  // Turns traffic on at new random spots, or off and removes every NPC car
  function setEnabled(on, car) {
    if (!on) {
      for (const n of active) {
        scene.remove(n.mesh);
        n.bubble.hidden = true;
      }
      active = [];
      return;
    }
    unlockHorn();
    if (pool.length === 0) pool = Array.from({ length: NPC_COUNT }, createNpc);
    active = spawn(car);
    for (const n of active) scene.add(n.mesh); // posed by the next update, before the frame renders
  }

  // Fills pooled cars into clear spots and returns the ones that were placed
  function spawn(car) {
    const chosen = [];
    for (const n of pool) {
      const spot = findSpot(n, car, chosen);
      if (!spot) continue;
      Object.assign(n, spot, {
        cruise: randomBetween(CRUISE_MIN, CRUISE_MAX),
        frontTimer: 0,
        touching: false,
        hitTimer: 0,
        blockedTimer: 0,
        hornTimer: 0,
        hornCount: 0,
        speechCount: 0,
        talkCooldown: 0,
        bubbleTimer: 0,
      });
      n.speed = n.cruise;
      n.heading = travelYaw(n);
      n.offset = { x: 0, z: 0 };
      n.bubble.hidden = true;
      chosen.push(n);
    }
    return chosen;
  }

  // Advances every active car and places it for this frame. `dt` is 0 while the game is paused.
  function update(dt, car, vehicle, camera) {
    if (active.length === 0) return;
    const circles = playerCircles(car, vehicle.colliders);
    for (const n of active) updateNpc(n, dt, circles, active, car);
    camera.updateMatrixWorld();
    for (const n of active) placeNpc(n, camera);
  }

  // Boxes the player car collides with
  function solids() {
    return active.map((n) => ({ box: bodyBox(n), npc: n }));
  }

  // Starts every car's speech from the friendly lines again
  function resetSpeech() {
    for (const n of pool) n.speechCount = 0;
  }

  return { setEnabled, update, solids, resetSpeech };
}
