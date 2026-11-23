import { inRect } from '../core/world.js';
import { createInventory, pick, planDeliveries, randomInt, randomStock, shuffled } from './inventory.js';
import { formatRp } from './orders.js';

const VISIT_COUNT = 15;
const CANVASS_PRODUCT_COUNT = 6;
const CANVASS_QTY = [10, 40];
const DRIVER_PRODUCT_COUNT = 6;
const DRIVER_QTY = [5, 30];
const DELIVERY_COUNT = 5;
const DELIVERY_MAX_QTY = 10;
const COLLECTOR_COUNT = 6;
const DEBT_STEP = 5000;
const PAYMENT_STEP = 1000;

const noNote = () => null;

function distanceTo(rect, car) {
  return Math.hypot((rect.minX + rect.maxX) / 2 - car.x, (rect.minZ + rect.maxZ) / 2 - car.z);
}

// Store visits shared by every user type. Check in at the store the car is inside, check out to finish.
// A permanent visit removes the store from the mission. Otherwise the store only counts as done for that stay.
function createVisitFlow(targets, permanent) {
  const visited = new Set();
  let completed = null; // store finished during the current stay
  let here = null;      // target store the car is inside, visited or not
  let checkedIn = null;

  function isDone(store) {
    return visited.has(store) || completed === store;
  }

  // Up to `count` unvisited stores, closest first. The store the car is in always comes first.
  function nearby(car, describe, count = 5) {
    const list = targets
      .filter((s) => !visited.has(s))
      .map((store) => ({ store, dist: distanceTo(store.rect, car), note: describe(store) }))
      .sort((a, b) => a.dist - b.dist);
    if (here && !visited.has(here)) {
      const first = list.find((n) => n.store === here);
      return [first, ...list.filter((n) => n !== first)].slice(0, count);
    }
    return list.slice(0, count);
  }

  return {
    targets,
    visited,
    update(car) {
      here = targets.find((s) => inRect(car.x, car.z, s.rect)) || null;
      if (checkedIn && checkedIn !== here) checkedIn = null;
      if (completed && completed !== here) completed = null;
    },
    here: () => here,
    checkedInAt: () => checkedIn,
    allVisited: () => visited.size === targets.length,
    // 'arrived', 'checkedIn' or 'done' for the store the car is in. Null outside target stores.
    stateOf() {
      if (!here) return null;
      if (isDone(here)) return 'done';
      return checkedIn === here ? 'checkedIn' : 'arrived';
    },
    checkIn() {
      if (here && !isDone(here)) checkedIn = here;
    },
    // Returns the store the visit ended at, or null when no visit was open
    checkOut() {
      const store = checkedIn;
      if (!store) return null;
      if (permanent) visited.add(store);
      else completed = store;
      checkedIn = null;
      return store;
    },
    nearby,
  };
}

// Rect of the closest store the phone lists, or null
function nearestRect(flow, car) {
  const [first] = flow.nearby(car, noNote, 1);
  return first ? first.store.rect : null;
}

// Phone view shared by every user type. `depot` is true when the phone should show the distributor screen.
function phoneOf(flow, car, describe, showNearby, { task = null, usesOrders = false, inventory = null, depot = false }) {
  return {
    store: flow.here(),
    state: flow.stateOf(),
    nearby: showNearby ? flow.nearby(car, describe) : [],
    task,
    usesOrders,
    inventory,
    depot,
  };
}

// Salesman: check in and out at 15 random stores with orders, then drive into the distributor lot.
// `ctx.stores` is a list of { name, rect }. `ctx.distributorLot` is a rect.
function createVisitMission({ stores, distributorLot }) {
  const flow = createVisitFlow(shuffled(stores).slice(0, VISIT_COUNT), true);
  const order = { kind: 'order', label: 'Create order', done: false };
  let phase = 'visit';

  return {
    update(car) {
      flow.update(car);
      if (phase === 'visit' && flow.allVisited()) phase = 'return';
      else if (phase === 'return' && inRect(car.x, car.z, distributorLot)) phase = 'done';
    },
    target(car) {
      if (phase === 'return') return distributorLot;
      return phase === 'visit' ? nearestRect(flow, car) : null;
    },
    checkIn() {
      if (phase === 'visit') flow.checkIn();
    },
    checkOut() {
      flow.checkOut();
      return null;
    },
    task: () => null,
    depotAction: () => null,
    phone(car) {
      return phoneOf(flow, car, noNote, phase === 'visit', { task: flow.here() ? order : null, usesOrders: true });
    },
    status() {
      if (phase === 'return') return ['Return to the distributor lot'];
      if (phase === 'done') return ['Mission complete'];
      const header = `Stores visited: ${flow.visited.size}/${flow.targets.length}`;
      return [header, ...flow.targets.map((s) => `${flow.visited.has(s) ? '✓' : '•'} ${s.name}`)];
    },
  };
}

// Canvasser: carries random stock and invoices any store. Ends the mission at the distributor, when asked.
function createCanvassMission({ stores, distributorLot }) {
  const inventory = createInventory(randomStock(CANVASS_PRODUCT_COUNT, CANVASS_QTY[0], CANVASS_QTY[1]));
  const flow = createVisitFlow(stores, false);
  const invoice = { kind: 'invoice', label: 'Create invoice', done: false };
  let phase = 'visit';
  let atDepot = false;

  return {
    update(car) {
      flow.update(car);
      atDepot = inRect(car.x, car.z, distributorLot);
    },
    // The canvasser has no single direction to show, so only the store marker is drawn.
    hidesDirection: true,
    target: (car) => (phase === 'visit' ? nearestRect(flow, car) : null),
    checkIn() {
      if (phase === 'visit') flow.checkIn();
    },
    checkOut() {
      flow.checkOut();
      return null;
    },
    task: () => null,
    // 'refill' restores the starting stock. 'end' finishes the mission. Only works at the distributor.
    depotAction(action) {
      if (phase !== 'visit' || !atDepot) return null;
      if (action === 'refill') {
        inventory.refill();
        return 'Stock refilled';
      }
      if (action === 'end') {
        phase = 'done';
        return 'Mission ended';
      }
      return null;
    },
    phone(car) {
      return phoneOf(flow, car, noNote, phase === 'visit', {
        task: flow.here() ? invoice : null,
        usesOrders: true,
        inventory,
        depot: phase === 'visit' && atDepot,
      });
    },
    status() {
      if (phase === 'done') return ['Mission complete'];
      return [
        `Inventory: ${inventory.count()} items`,
        ...inventory.items().map((l) => `${l.name}: ${l.qty} ${l.unit}`),
        'Back at the distributor: refill or end',
      ];
    },
  };
}

// Driver: drops one ordered product per listed customer. Each drop takes its quantity out of the stock.
function createDeliveryMission({ stores, cargo = { scale: 1, products: DRIVER_PRODUCT_COUNT } }) {
  const scaled = (qty) => Math.max(1, Math.round(qty * cargo.scale));
  const inventory = createInventory(randomStock(cargo.products, scaled(DRIVER_QTY[0]), scaled(DRIVER_QTY[1])));
  const deliveries = planDeliveries(inventory, shuffled(stores).slice(0, DELIVERY_COUNT), DELIVERY_MAX_QTY);
  const byStore = new Map(deliveries.map((d) => [d.store, d]));
  const flow = createVisitFlow(deliveries.map((d) => d.store), true);
  const dropped = new Set();
  let phase = 'visit';

  const describe = (store) => {
    const d = byStore.get(store);
    return `${d.name} x${d.qty} ${d.unit}`;
  };

  function taskOf(store) {
    if (!store) return null;
    return { kind: 'drop', label: 'Drop ordered products', done: dropped.has(store), info: `Deliver ${describe(store)}` };
  }

  return {
    update(car) {
      flow.update(car);
      if (phase === 'visit' && flow.allVisited()) phase = 'done';
    },
    target: (car) => (phase === 'visit' ? nearestRect(flow, car) : null),
    checkIn() {
      if (phase === 'visit') flow.checkIn();
    },
    checkOut() {
      const store = flow.checkedInAt();
      if (!store) return null;
      if (!dropped.has(store)) return 'Drop the ordered products before check out';
      flow.checkOut();
      return null;
    },
    depotAction: () => null,
    // Performs the drop at the store the car is checked in at. Returns a message for the phone.
    task() {
      const store = flow.checkedInAt();
      if (!store || dropped.has(store)) return null;
      const d = byStore.get(store);
      inventory.take(d.name, d.qty);
      dropped.add(store);
      return `Dropped ${describe(store)}`;
    },
    phone(car) {
      return phoneOf(flow, car, describe, phase === 'visit', { task: taskOf(flow.here()), inventory });
    },
    status() {
      if (phase === 'done') return ['Mission complete'];
      const lines = flow.targets.map((s) => `${flow.visited.has(s) ? '✓' : '•'} ${s.name}: ${describe(s)}`);
      return [`Drops: ${flow.visited.size}/${flow.targets.length}`, ...lines, `Inventory: ${inventory.count()} items`];
    },
  };
}

// Collector: collects part of the debt of each listed customer, then moves to the next one.
function createCollectionMission({ stores }) {
  const customers = shuffled(stores).slice(0, COLLECTOR_COUNT);
  const flow = createVisitFlow(customers, true);
  const debts = new Map(customers.map((s) => [s, DEBT_STEP * (10 + randomInt(91))]));
  const collectedAt = new Set();
  let collected = 0;
  let phase = 'visit';

  const describe = (store) => `Debt ${formatRp(debts.get(store))}`;

  // Random part of the debt, in whole thousands and never more than the debt itself
  function randomPayment(debt) {
    const share = 0.3 + Math.random() * 0.7;
    const amount = Math.round((debt * share) / PAYMENT_STEP) * PAYMENT_STEP;
    return Math.min(debt, Math.max(PAYMENT_STEP, amount));
  }

  function taskOf(store) {
    if (!store) return null;
    return { kind: 'collect', label: 'Collect payment', done: collectedAt.has(store), info: describe(store) };
  }

  return {
    update(car) {
      flow.update(car);
      if (phase === 'visit' && flow.allVisited()) phase = 'done';
    },
    target: (car) => (phase === 'visit' ? nearestRect(flow, car) : null),
    checkIn() {
      if (phase === 'visit') flow.checkIn();
    },
    checkOut() {
      const store = flow.checkedInAt();
      if (!store) return null;
      if (!collectedAt.has(store)) return 'Collect the payment before check out';
      flow.checkOut();
      return null;
    },
    depotAction: () => null,
    // Collects at the store the car is checked in at. Returns a message for the phone.
    task() {
      const store = flow.checkedInAt();
      if (!store || collectedAt.has(store)) return null;
      const debt = debts.get(store);
      const amount = randomPayment(debt);
      debts.set(store, debt - amount);
      collected += amount;
      collectedAt.add(store);
      return `Collected ${formatRp(amount)}`;
    },
    phone(car) {
      return phoneOf(flow, car, describe, phase === 'visit', { task: taskOf(flow.here()) });
    },
    status() {
      const total = `Collected: ${formatRp(collected)}`;
      if (phase === 'done') return ['Mission complete', total];
      const lines = customers.map((s) => `${flow.visited.has(s) ? '✓' : '•'} ${s.name}: ${describe(s)}`);
      return [total, `Customers: ${flow.visited.size}/${customers.length}`, ...lines];
    },
  };
}

// Each user type has its own mission. Every mission starts with check-in at a store.
export const USER_TYPES = [
  { id: 'salesman', name: 'Salesman', description: 'Check in and out at 15 stores, then return to the distributor', createMission: createVisitMission },
  { id: 'canvasser', name: 'Canvasser', description: 'Invoice any store from your stock. Refill or end at the distributor', createMission: createCanvassMission },
  { id: 'driver', name: 'Driver', description: 'Drop the ordered products at each listed customer', usesVehicle: true, createMission: createDeliveryMission },
  { id: 'collector', name: 'Collector', description: 'Collect the debt from each listed customer', createMission: createCollectionMission },
];
