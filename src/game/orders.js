import { PRODUCTS } from '../data/products.js';
import { pick, randomInt } from './inventory.js';

const MAX_QTY = 12;

const rupiah = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });

// Formats an amount in Rupiah, for example "Rp 3.000"
export function formatRp(amount) {
  return rupiah.format(amount);
}

// Order totals per store. Saved orders stay on the store and keep adding up on later visits.
// A line with an inventory `source` sells from that stock. Saving takes the quantity out of it.
export function createOrderBook() {
  const accounts = new Map(); // store object -> { total, draft }

  function account(store) {
    if (!accounts.has(store)) accounts.set(store, { total: 0, draft: [] });
    return accounts.get(store);
  }

  // Quantity of a product already in unsaved invoices from this inventory, across all stores
  function reserved(inventory, name) {
    let sum = 0;
    for (const acc of accounts.values()) {
      for (const line of acc.draft) {
        if (line.source === inventory && line.name === name) sum += line.qty;
      }
    }
    return sum;
  }

  // Random sellable product from the inventory. Returns false when nothing is left to sell.
  function addFromInventory(store, inventory) {
    const open = inventory
      .items()
      .map((item) => ({ item, free: item.qty - reserved(inventory, item.name) }))
      .filter((o) => o.free > 0);
    if (open.length === 0) return false;
    const { item, free } = pick(open);
    const qty = 1 + randomInt(Math.min(free, MAX_QTY));
    account(store).draft.push({ name: item.name, unit: item.unit, qty, amount: item.price * qty, source: inventory });
    return true;
  }

  return {
    total(store) {
      return account(store).total;
    },
    draft(store) {
      return account(store).draft;
    },
    // Sum of saved totals across every store
    grandTotal() {
      let sum = 0;
      for (const acc of accounts.values()) sum += acc.total;
      return sum;
    },
    // Adds a random product with a random unit and quantity. Uses the inventory when one is given.
    addRandomProduct(store, inventory = null) {
      if (inventory) return addFromInventory(store, inventory);
      const product = pick(PRODUCTS);
      const qty = 1 + randomInt(MAX_QTY);
      account(store).draft.push({ name: product.name, unit: product.unit, qty, amount: product.price * qty, source: null });
      return true;
    },
    // Sends the unsaved order (simulated, no server yet), takes stock out, and adds the amount to the store total
    save(store) {
      const acc = account(store);
      for (const line of acc.draft) {
        if (line.source) line.source.take(line.name, line.qty);
        acc.total += line.amount;
      }
      acc.draft = [];
    },
  };
}
