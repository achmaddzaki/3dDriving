import { inRect } from '../core/world.js';

const VISIT_COUNT = 15;

// Fisher-Yates shuffle of a copy of the list
function shuffled(list) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// Visit mission: check in and check out at 15 random stores, then drive into the distributor lot to finish.
// `ctx.stores` is a list of { name, rect }. `ctx.distributorLot` is a rect.
function createVisitMission({ stores, distributorLot }) {
  const targets = shuffled(stores).slice(0, VISIT_COUNT);
  const visited = new Set();
  let phase = 'visit';
  let atStore = null;    // target store the car is inside, visited or not
  let checkedIn = null;  // store the player checked in at, cleared when the car leaves it

  // Entering the distributor lot completes the mission at once
  function updateReturn(car) {
    if (inRect(car.x, car.z, distributorLot)) phase = 'done';
  }

  // Check-in only works at an unvisited store the car is inside
  function checkIn() {
    if (phase !== 'visit' || !atStore || visited.has(atStore)) return;
    checkedIn = atStore;
  }

  // Check-out completes the visit and moves the mission on
  function checkOut() {
    if (!checkedIn) return;
    visited.add(checkedIn);
    checkedIn = null;
    if (visited.size === targets.length) phase = 'return';
  }

  // Phone state for the store the car is in: 'arrived', 'checkedIn' or 'done'. Null outside target stores.
  function visitState() {
    if (!atStore) return null;
    const { name } = atStore;
    if (visited.has(atStore)) return { name, state: 'done' };
    return { name, state: checkedIn === atStore ? 'checkedIn' : 'arrived' };
  }

  // Rect the car should head to next: the closest unvisited store, or the distributor lot on the return
  function nextRect(car) {
    if (phase === 'return') return distributorLot;
    if (phase !== 'visit') return null;
    let best = null;
    let bestDist2 = Infinity;
    for (const s of targets) {
      if (visited.has(s)) continue;
      const dx = (s.rect.minX + s.rect.maxX) / 2 - car.x;
      const dz = (s.rect.minZ + s.rect.maxZ) / 2 - car.z;
      const dist2 = dx * dx + dz * dz;
      if (dist2 < bestDist2) {
        best = s;
        bestDist2 = dist2;
      }
    }
    return best ? best.rect : null;
  }

  return {
    update(car, dt) {
      atStore = targets.find((s) => inRect(car.x, car.z, s.rect)) || null;
      if (checkedIn && checkedIn !== atStore) checkedIn = null;
      if (phase === 'return') updateReturn(car);
    },
    target: nextRect,
    checkIn,
    checkOut,
    visitState,
    // Lines for the HUD. Visited stores get a check mark.
    status() {
      if (phase === 'return') return ['Return to the distributor lot'];
      if (phase === 'done') return ['Mission complete'];
      const header = `Stores visited: ${visited.size}/${targets.length}`;
      return [header, ...targets.map((s) => `${visited.has(s) ? '✓' : '•'} ${s.name}`)];
    },
  };
}

// Each user type has its own mission. All types use the visit mission for now.
export const USER_TYPES = [
  { id: 'salesman', name: 'Salesman', description: 'Check in and out at 15 stores, then return to the distributor', createMission: createVisitMission },
  { id: 'canvasser', name: 'Canvasser', description: 'Check in and out at 15 stores, then return to the distributor', createMission: createVisitMission },
  { id: 'driver', name: 'Driver', description: 'Check in and out at 15 stores, then return to the distributor', createMission: createVisitMission },
  { id: 'collector', name: 'Collector', description: 'Check in and out at 15 stores, then return to the distributor', createMission: createVisitMission },
  { id: 'surveyor', name: 'Surveyor', description: 'Check in and out at 15 stores, then return to the distributor', createMission: createVisitMission },
];
