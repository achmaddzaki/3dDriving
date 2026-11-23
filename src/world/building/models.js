import { rand } from '../../core/world.js';

// Each category's weight is its share of all lots. Models inside a category are picked evenly.
// `along` and `perp` are the building footprint size, `height` is the building height range.
const CATEGORIES = [
  {
    weight: 0.5,
    models: [
      { name: 'Residence A', kind: 'building', along: [10, 14], perp: [8, 11], height: [8, 12], colors: [0xf5e6c8] },
      { name: 'Residence B', kind: 'building', along: [8, 11], perp: [8, 10], height: [10, 14], colors: [0xb5651d] },
      { name: 'Residence C', kind: 'building', along: [12, 18], perp: [10, 14], height: [14, 20], colors: [0xd7ccc8] },
      { name: 'Residence D', kind: 'building', along: [10, 13], perp: [8, 10], height: [7, 9], colors: [0xfff3e0], roof: 'gable' },
      { name: 'Residence E', kind: 'building', along: [12, 16], perp: [9, 12], height: [8, 10], colors: [0xb3d9e8], roof: 'gable' },
    ],
  },
  {
    weight: 0.1,
    models: [
      { name: 'Office Tower', kind: 'building', along: [12, 16], perp: [12, 16], height: [40, 60], colors: [0x90caf9] },
      { name: 'Office Block', kind: 'building', along: [20, 28], perp: [12, 16], height: [18, 28], colors: [0x90a4ae] },
    ],
  },
  {
    weight: 0.3,
    models: [
      { name: 'Shop', kind: 'building', along: [10, 14], perp: [8, 10], height: [5, 7], colors: [0xffe0b2], sign: 0xd84315 },
      { name: 'Supermarket', kind: 'building', along: [22, 28], perp: [14, 18], height: [6, 8], colors: [0xeeeeee], sign: 0x1e88e5 },
      { name: 'Cafe', kind: 'building', along: [8, 10], perp: [7, 9], height: [6, 8], colors: [0xa1887f], sign: 0x2e7d32 },
      { name: 'Bakery', kind: 'building', along: [9, 12], perp: [7, 9], height: [5, 7], colors: [0xfff8e1], sign: 0xef6c00 },
      { name: 'Pharmacy', kind: 'building', along: [8, 11], perp: [7, 9], height: [5, 7], colors: [0xe0f2f1], sign: 0x00897b },
      { name: 'Bookstore', kind: 'building', along: [10, 13], perp: [8, 10], height: [6, 8], colors: [0xd7ccc8], sign: 0x5e35b1 },
    ],
  },
  {
    weight: 0.1,
    models: [
      { name: 'Park', kind: 'park', along: [14, 22], perp: [12, 16], height: [0, 0], colors: [0x66bb6a] },
    ],
  },
];

const OWNER_NAMES = ['Budi', 'Toni', 'Andi', 'Siti', 'Dewi', 'Rina', 'Agus', 'Lina', 'Joko', 'Maya'];

function pickOne(list) {
  return list[Math.floor(rand() * list.length)];
}

// Random shop name, like "Toni's Shop", "Andi Cafe" or "Supermarket Budi"
export function randomShopName(noun) {
  const name = pickOne(OWNER_NAMES);
  return pickOne([`${name}'s ${noun}`, `${name} ${noun}`, `${noun} ${name}`]);
}

// Picks a model by category weight, then evenly within the category
export function pickModel() {
  let r = rand();
  for (const c of CATEGORIES) {
    if (r < c.weight) return pickOne(c.models);
    r -= c.weight;
  }
  return pickOne(CATEGORIES[CATEGORIES.length - 1].models);
}
