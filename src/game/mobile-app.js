import { formatRp } from './orders.js';
import { customerOf } from '../data/customers.js';

const TEXT = {
  search: 'Find your customer. The closest stores are listed below.',
  arrived: 'You have arrived. Check in to start this visit.',
  done: 'Visit complete.',
};
const FLY_MS = 650;
const STAGGER_MS = 80;
const TOAST_MS = 1200;

// Mobile app preview on the right edge. It slides out when the car enters a store lot and back in when it leaves.
// `onCheckOut` and `onTask` return a message for the phone to show, or null.
export function createMobileApp({ orders, onCheckIn, onCheckOut, onTask, onDepot }) {
  const root = document.getElementById('mobile');
  const handle = document.getElementById('mobile-handle');
  const screens = {
    main: document.getElementById('main-screen'),
    detail: document.getElementById('detail-screen'),
    order: document.getElementById('order-screen'),
    depot: document.getElementById('depot-screen'),
  };
  const depotStockEl = document.getElementById('depot-stock');
  const storeEl = document.getElementById('mobile-store');
  const textEl = document.getElementById('mobile-text');
  const allTotalEl = document.getElementById('main-total');
  const listEl = document.getElementById('mobile-list');
  const detailStoreEl = document.getElementById('detail-store');
  const detailOwnerEl = document.getElementById('detail-owner');
  const detailAddressEl = document.getElementById('detail-address');
  const detailPhoneEl = document.getElementById('detail-phone');
  const detailInfoEl = document.getElementById('detail-info');
  const detailTotalEl = document.getElementById('detail-total');
  const detailTaskEl = document.getElementById('detail-task');
  const orderTitleEl = document.getElementById('order-title');
  const orderStoreEl = document.getElementById('order-store');
  const totalEl = document.getElementById('order-total');
  const linesEl = document.getElementById('order-lines');
  const addBtn = document.getElementById('order-add');
  const saveBtn = document.getElementById('order-save');
  const toastEl = document.getElementById('mobile-toast');
  let open = false;
  let inLot = false;
  let screen = 'main';
  let store = null;      // store the phone is currently at
  let task = null;       // task of the current visit from the mission, or null
  let inventory = null;  // stock the order screen sells from, or null for free-form orders
  let mainKey = '';
  let busy = false;      // true while the save animation plays
  let toastTimer = null;

  function setOpen(value) {
    open = value;
    root.classList.toggle('open', value);
  }

  // Clears focus after a click so a later Space press still means handbrake
  function bindButton(id, action) {
    const btn = document.getElementById(id);
    btn.addEventListener('click', () => {
      action();
      btn.blur();
    });
  }

  function flash(message) {
    toastEl.textContent = message;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), TOAST_MS);
  }

  function renderList(nearby, current) {
    listEl.replaceChildren(...nearby.map(({ store: s, dist, note }) => {
      const isHere = s === current;
      const li = document.createElement('li');
      const label = document.createElement('div');
      const name = document.createElement('span');
      const meta = document.createElement('span');
      name.textContent = s.name;
      meta.textContent = isHere ? 'Here' : `${Math.round(dist)} m`;
      label.append(name);
      if (note) {
        const sub = document.createElement('small');
        sub.textContent = note;
        label.append(sub);
      }
      li.classList.toggle('current', isHere);
      li.append(label, meta);
      return li;
    }));
  }

  // Redraws the main screen only when the state, store, nearby list, or all-store total changes
  function renderMain(view) {
    const allTotal = orders.grandTotal();
    const key = [
      view.state,
      view.store?.name,
      view.usesOrders,
      allTotal,
      ...view.nearby.map((n) => `${n.store.name}:${Math.round(n.dist)}:${n.note ?? ''}`),
    ].join('|');
    if (key === mainKey) return;
    mainKey = key;
    const state = view.state || 'search';
    root.dataset.state = state;
    storeEl.textContent = view.store ? view.store.name : 'Nearby customers';
    textEl.textContent = TEXT[state];
    allTotalEl.hidden = !view.usesOrders;
    allTotalEl.textContent = `All orders: ${formatRp(allTotal)}`;
    renderList(view.nearby, view.store);
  }

  // Customer details, the mission info for this visit, and the task button
  function renderDetail() {
    const customer = customerOf(store);
    detailStoreEl.textContent = store.name;
    detailOwnerEl.textContent = customer.owner;
    detailAddressEl.textContent = customer.address;
    detailPhoneEl.textContent = customer.phone;
    detailInfoEl.hidden = !task?.info;
    detailInfoEl.textContent = task?.info ?? '';
    const sells = task?.kind === 'order' || task?.kind === 'invoice';
    detailTotalEl.hidden = !sells;
    detailTotalEl.textContent = `Total ${task?.kind === 'invoice' ? 'invoice' : 'order'}: ${formatRp(orders.total(store))}`;
    detailTaskEl.hidden = !task;
    if (!task) return;
    detailTaskEl.textContent = task.done ? `${task.label} ✓` : task.label;
    detailTaskEl.disabled = task.done;
  }

  function lineElement(line) {
    const li = document.createElement('li');
    const name = document.createElement('span');
    const amount = document.createElement('span');
    li.className = 'app-line';
    name.textContent = `${line.name} x${line.qty} ${line.unit}`;
    amount.textContent = formatRp(line.amount);
    li.append(name, amount);
    return li;
  }

  function renderOrder() {
    const draft = orders.draft(store);
    const isInvoice = task?.kind === 'invoice';
    orderTitleEl.textContent = isInvoice ? 'Create invoice' : 'Create order';
    saveBtn.textContent = isInvoice ? 'Save invoice' : 'Save order';
    orderStoreEl.textContent = store.name;
    totalEl.textContent = `Total ${task?.kind === 'invoice' ? 'invoice' : 'order'}: ${formatRp(orders.total(store))}`;
    linesEl.replaceChildren(...draft.map(lineElement));
    addBtn.disabled = busy;
    saveBtn.disabled = busy || draft.length === 0;
  }

  // Stock on hand, listed on the distributor screen
  function renderDepot() {
    const stock = inventory ? inventory.items() : [];
    depotStockEl.replaceChildren(...stock.map((line) => {
      const li = document.createElement('li');
      const name = document.createElement('span');
      const qty = document.createElement('span');
      li.className = 'app-line';
      name.textContent = line.name;
      qty.textContent = `${line.qty} ${line.unit}`;
      li.append(name, qty);
      return li;
    }));
    if (stock.length === 0) {
      const li = document.createElement('li');
      li.className = 'app-line';
      li.textContent = 'Stock is empty';
      depotStockEl.replaceChildren(li);
    }
  }

  // Switches to a phone screen and draws it
  function showScreen(name) {
    screen = name;
    for (const [key, el] of Object.entries(screens)) el.hidden = key !== name;
    if (name === 'main') mainKey = '';
    if (name === 'detail') renderDetail();
    if (name === 'order') renderOrder();
    if (name === 'depot') renderDepot();
  }

  // Lines fly out of the phone, then the order is added to the store total
  function save() {
    if (busy || orders.draft(store).length === 0) return;
    busy = true;
    const sent = store;
    const lines = [...linesEl.children];
    lines.forEach((li, i) => {
      li.style.transitionDelay = `${i * STAGGER_MS}ms`;
      li.classList.add('fly');
    });
    setTimeout(() => {
      orders.save(sent);
      busy = false;
      flash('Sent to server');
      showScreen('detail');
    }, FLY_MS + lines.length * STAGGER_MS);
  }

  // Order and invoice open the order screen. Other tasks run now and stay done for this visit.
  function runTask() {
    if (!task || task.done) return;
    if (task.kind === 'order' || task.kind === 'invoice') {
      showScreen('order');
      return;
    }
    const message = onTask();
    if (message) flash(message);
    renderDetail();
  }

  // Check out is blocked while an order has unsaved lines
  function checkOut() {
    if (orders.draft(store).length > 0) {
      flash('Save the order before check out');
      return;
    }
    const message = onCheckOut();
    if (message) flash(message);
  }

  function addProduct() {
    if (!orders.addRandomProduct(store, inventory)) {
      flash('Nothing left in stock');
      return;
    }
    renderOrder();
  }

  handle.addEventListener('click', () => setOpen(!open));
  bindButton('mobile-checkin', onCheckIn);
  bindButton('detail-task', runTask);
  bindButton('detail-photo', () => flash('Picture taken'));
  bindButton('detail-checkout', checkOut);
  bindButton('order-back', () => showScreen('detail'));
  bindButton('order-add', addProduct);
  bindButton('order-save', save);
  bindButton('depot-refill', () => {
    const message = onDepot('refill');
    if (message) flash(message);
    renderDepot();
  });
  bindButton('depot-end', () => {
    const message = onDepot('end');
    if (message) flash(message);
  });

  return {
    // `view` comes from the mission's phone(). The phone opens inside any store lot and at the distributor.
    update(view) {
      store = view.store;
      task = view.task;
      inventory = view.inventory;
      const inLotNow = view.store !== null || view.depot;
      if (inLotNow !== inLot) setOpen(inLotNow);
      inLot = inLotNow;
      if (view.state === 'checkedIn') {
        if (screen === 'main') showScreen('detail');
        return;
      }
      if (view.depot) {
        if (screen !== 'depot') showScreen('depot');
        return;
      }
      if (screen !== 'main') showScreen('main');
      renderMain(view);
    },
  };
}
