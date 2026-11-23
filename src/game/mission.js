import { inRect } from '../core/world.js';

const VISIT_COUNT = 15;
const STAY_SECONDS = 3;

// Fisher-Yates shuffle of a copy of the list
function shuffled(list) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// Visit mission: stay 3 seconds in each of 15 random stores, then stay 3 seconds in the distributor lot.
// `ctx.stores` is a list of { name, rect }. `ctx.distributorLot` is a rect.
function createVisitMission({ stores, distributorLot }) {
  const targets = shuffled(stores).slice(0, VISIT_COUNT);
  const visited = new Set();
  let phase = 'visit';
  let stay = 0;

  function updateVisit(car, dt) {
    const here = targets.find((s) => !visited.has(s) && inRect(car.x, car.z, s.rect));
    if (!here) {
      stay = 0;
      return;
    }
    stay += dt;
    if (stay < STAY_SECONDS) return;
    visited.add(here);
    stay = 0;
    if (visited.size === targets.length) phase = 'return';
  }

  function updateReturn(car, dt) {
    stay = inRect(car.x, car.z, distributorLot) ? stay + dt : 0;
    if (stay >= STAY_SECONDS) phase = 'done';
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
      if (phase === 'visit') updateVisit(car, dt);
      else if (phase === 'return') updateReturn(car, dt);
    },
    target: nextRect,
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
  { id: 'salesman', name: 'Salesman', description: 'Visit 15 stores, then return to the distributor', createMission: createVisitMission },
  { id: 'canvasser', name: 'Canvasser', description: 'Visit 15 stores, then return to the distributor', createMission: createVisitMission },
  { id: 'driver', name: 'Driver', description: 'Visit 15 stores, then return to the distributor', createMission: createVisitMission },
  { id: 'collector', name: 'Collector', description: 'Visit 15 stores, then return to the distributor', createMission: createVisitMission },
  { id: 'surveyor', name: 'Surveyor', description: 'Visit 15 stores, then return to the distributor', createMission: createVisitMission },
];
