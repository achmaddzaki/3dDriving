// Engine loops for the player car. Idle and acceleration loops crossfade by speed share. Bikes and cars have their own clips.
const ENGINE_DIR = '../sounds/soundeffect/';
const CLIPS = {
  bike: { idle: 'Car_driving_engine_s_idle_bike_2.mp3', accelerate: 'Car_driving_engine_s_accelerate_bike_2.mp3' },
  car: { idle: 'Car_driving_engine_i_idle_car_2.mp3', accelerate: 'Car_driving_engine_s_accelerate_car.mp3' },
};
const ENGINE_VOLUME = 0.6; // gain at top speed, from 0 to 1
const TURN_VOLUME_FACTOR = 0.85; // volume share kept while steering left or right
const GAIN_SMOOTHING = 0.05; // seconds, time constant for gain changes so switching clips does not click

let context = null;
let enabled = false; // sound effects setting, off by default
let fetching = null; // raw mp3 bytes per clip, fetched once
let started = false;
const gains = {}; // gain node per clip, keyed like 'bike.idle'

// Each clip as [key, file], with key like 'bike.idle'
function clipEntries() {
  return Object.entries(CLIPS).flatMap(([kind, files]) =>
    Object.entries(files).map(([layer, file]) => [`${kind}.${layer}`, file]));
}

// Downloads every engine clip once, without decoding them
function fetchEngine() {
  if (!fetching) {
    fetching = Promise.all(clipEntries().map(async ([key, file]) => {
      const url = new URL(ENGINE_DIR + encodeURIComponent(file), import.meta.url);
      const response = await fetch(url);
      return [key, await response.arrayBuffer()];
    })).then(Object.fromEntries);
  }
  return fetching;
}

// Starts the download after the page has loaded, in idle time, so the base game loads first
export function scheduleEngineLoad() {
  const start = () => {
    const whenIdle = window.requestIdleCallback || ((cb) => setTimeout(cb, 1));
    whenIdle(() => {
      fetchEngine().catch((err) => console.warn(`engine scheduleEngineLoad: ${err.message}`));
    });
  };
  if (document.readyState === 'complete') start();
  else window.addEventListener('load', start, { once: true });
}

// Adds one clip as a looping source through its own gain node, starting at the given time
function playLoop(key, buffer, when) {
  const gain = context.createGain();
  gain.gain.value = 0;
  gain.connect(context.destination);
  const source = context.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  source.connect(gain);
  source.start(when);
  gains[key] = gain;
}

// Creates the audio context, decodes every clip, and loops them all. Call from a user click.
export function startEngine() {
  if (started) return;
  started = true;
  if (!context) context = new AudioContext();
  context.resume();
  fetchEngine()
    .then(async (raw) => {
      const decoded = {};
      for (const [key, bytes] of Object.entries(raw)) {
        decoded[key] = await context.decodeAudioData(bytes);
      }
      const when = context.currentTime + 0.1;
      for (const [key, buffer] of Object.entries(decoded)) playLoop(key, buffer, when);
    })
    .catch((err) => console.warn(`engine startEngine: ${err.message}`));
}

// Sets the gain of one clip, smoothed so changes do not click
function setGain(key, value) {
  const gain = gains[key];
  if (gain) gain.gain.setTargetAtTime(value, context.currentTime, GAIN_SMOOTHING);
}

// Turns the engine sounds on or off with the sound effects setting. Turning off silences the clips at once.
export function setEngineEnabled(on) {
  enabled = on;
  if (!on) for (const key of Object.keys(gains)) setGain(key, 0);
}

// Crossfades the idle and acceleration clips of the current vehicle kind by speedRatio (speed over top speed, 0 to 1).
// Clips of the other kind are silenced. Steering lowers the volume.
export function updateEngine(speedRatio, turning, kind) {
  const share = Math.min(1, Math.max(0, speedRatio));
  const level = enabled ? ENGINE_VOLUME * (turning ? TURN_VOLUME_FACTOR : 1) : 0;
  for (const k of Object.keys(CLIPS)) {
    const active = k === kind;
    setGain(`${k}.idle`, active ? (1 - share) * level : 0);
    setGain(`${k}.accelerate`, active ? share * level : 0);
  }
}
