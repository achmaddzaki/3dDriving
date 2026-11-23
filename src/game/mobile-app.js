const TEXT = {
  arrived: 'You have arrived. Check in to start this visit.',
  checkedIn: 'Checked in. Finish your visit, then check out.',
  done: 'Visit complete.',
};
const TOAST_MS = 1200;

// Mobile app preview on the right edge. It slides out when the car enters a store lot and back in when it leaves.
export function createMobileApp({ onCheckIn, onCheckOut }) {
  const root = document.getElementById('mobile');
  const handle = document.getElementById('mobile-handle');
  const storeEl = document.getElementById('mobile-store');
  const textEl = document.getElementById('mobile-text');
  const toastEl = document.getElementById('mobile-toast');
  let open = false;
  let inLot = false;
  let shownKey = '';
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
    toastEl.textContent = `✓ ${message}`;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), TOAST_MS);
  }

  function render(visit) {
    root.dataset.state = visit.state;
    storeEl.textContent = visit.name;
    textEl.textContent = TEXT[visit.state];
  }

  handle.addEventListener('click', () => setOpen(!open));
  bindButton('mobile-checkin', onCheckIn);
  bindButton('mobile-checkout', onCheckOut);
  bindButton('mobile-order', () => flash('Order created'));
  bindButton('mobile-photo', () => flash('Picture taken'));

  return {
    // Shows the screen for `visit` ({ name, state }, or null outside a store lot)
    update(visit) {
      const key = visit ? `${visit.name}|${visit.state}` : '';
      if (key === shownKey) return;
      shownKey = key;
      if (!!visit !== inLot) setOpen(!!visit);
      inLot = !!visit;
      if (visit) render(visit);
    },
  };
}
