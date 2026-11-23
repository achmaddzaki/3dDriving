import { PRODUCTS } from '../data/products.js';

// Fisher-Yates shuffle of a copy of the list
export function shuffled(list) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// Whole number from 0 to count - 1
export function randomInt(count) {
  return Math.floor(Math.random() * count);
}

export function pick(list) {
  return list[randomInt(list.length)];
}

// Distinct random products with a random quantity. Price and unit come from the catalog.
export function randomStock(count, minQty, maxQty) {
  return shuffled(PRODUCTS).slice(0, count).map((p) => ({
    name: p.name,
    unit: p.unit,
    price: p.price,
    qty: minQty + randomInt(maxQty - minQty + 1),
  }));
}

// Stock a user carries. Quantities fall as items are sold or delivered.
export function createInventory(items) {
  const lines = items.map((item) => ({ ...item }));
  const startQty = items.map((item) => item.qty);
  return {
    // Restores every line to its starting quantity
    refill() {
      lines.forEach((line, i) => {
        line.qty = startQty[i];
      });
    },
    // Lines that still have stock. The objects are live, so `qty` reads the current amount.
    items() {
      return lines.filter((line) => line.qty > 0);
    },
    count() {
      return lines.reduce((sum, line) => sum + line.qty, 0);
    },
    take(name, qty) {
      const line = lines.find((l) => l.name === name);
      if (line) line.qty = Math.max(0, line.qty - qty);
    },
  };
}

// One delivery per store, each with a product still in stock. Stops when the stock runs out.
export function planDeliveries(inventory, stores, maxQty) {
  const plan = inventory.items().map((line) => ({ name: line.name, unit: line.unit, left: line.qty }));
  const deliveries = [];
  for (const store of stores) {
    const open = plan.filter((p) => p.left > 0);
    if (open.length === 0) break;
    const item = pick(open);
    const qty = 1 + randomInt(Math.min(item.left, maxQty));
    item.left -= qty;
    deliveries.push({ store, name: item.name, unit: item.unit, qty });
  }
  return deliveries;
}
