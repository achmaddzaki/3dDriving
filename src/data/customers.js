// Dummy customer details for the customer detail page.
const OWNERS = ['Pak Budi', 'Bu Sari', 'Pak Andi', 'Bu Rina', 'Pak Dedi', 'Bu Wati', 'Pak Joko', 'Bu Lina'];
const STREETS = ['Jl. Merdeka', 'Jl. Sudirman', 'Jl. Diponegoro', 'Jl. Ahmad Yani', 'Jl. Gatot Subroto'];

const details = new WeakMap(); // store object -> customer

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function randomDigits(count) {
  return Array.from({ length: count }, () => Math.floor(Math.random() * 10)).join('');
}

function makeCustomer() {
  const number = 1 + Math.floor(Math.random() * 200);
  return {
    owner: pick(OWNERS),
    address: `${pick(STREETS)} No. ${number}`,
    phone: `08${randomDigits(10)}`,
  };
}

// Dummy owner, address and phone for a store. Made once per store and kept for the session.
export function customerOf(store) {
  if (!details.has(store)) details.set(store, makeCustomer());
  return details.get(store);
}
