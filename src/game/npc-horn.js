// Plays the NPC car horn clips. Volume falls off with the distance between the car and the player.
const CLIP_DIR = '../sounds/soundeffect/';
const CLIP_FILES = {
  long: 'Simple_Car_Horn_#3-1795748285664.mp3',
  short: 'Simple_Car_Horn_#4-1795748285665.mp3',
};
const FULL_VOLUME_DISTANCE = 6; // m, at or closer than this the horn plays at full volume
const SILENT_DISTANCE = 60; // m, at or farther than this the horn is silent

let context = null;
let enabled = false; // sound effects setting, off by default
let fetching = null; // raw mp3 bytes per clip, fetched once
let decoding = null; // decoded buffers, decoded once on unlock
const buffers = {};

// Downloads the clip files once, without decoding them
function fetchClips() {
  if (!fetching) {
    fetching = Promise.all(Object.entries(CLIP_FILES).map(async ([name, file]) => {
      const url = new URL(CLIP_DIR + encodeURIComponent(file), import.meta.url);
      const response = await fetch(url);
      return [name, await response.arrayBuffer()];
    })).then(Object.fromEntries);
  }
  return fetching;
}

// Starts the download after the page has loaded, in idle time, so the base game loads first
export function scheduleHornLoad() {
  const start = () => {
    const whenIdle = window.requestIdleCallback || ((cb) => setTimeout(cb, 1));
    whenIdle(() => {
      fetchClips().catch((err) => console.warn(`npcHorn scheduleHornLoad: ${err.message}`));
    });
  };
  if (document.readyState === 'complete') start();
  else window.addEventListener('load', start, { once: true });
}

// Creates the audio context and decodes the clips. Call from a user click so the browser allows sound.
export function unlockHorn() {
  if (!context) context = new AudioContext();
  context.resume();
  if (decoding) return;
  decoding = fetchClips()
    .then(async (raw) => {
      for (const [name, bytes] of Object.entries(raw)) {
        buffers[name] = await context.decodeAudioData(bytes);
      }
    })
    .catch((err) => console.warn(`npcHorn unlockHorn: ${err.message}`));
}

// Turns the horn sounds on or off with the sound effects setting
export function setHornEnabled(on) {
  enabled = on;
}

// Volume from 1 at FULL_VOLUME_DISTANCE down to 0 at SILENT_DISTANCE, linear in between
export function hornVolume(distance) {
  const span = SILENT_DISTANCE - FULL_VOLUME_DISTANCE;
  return Math.min(1, Math.max(0, (SILENT_DISTANCE - distance) / span));
}

// Plays one clip by name ('long' or 'short') at a volume from 0 to 1
export function playHorn(name, volume) {
  const buffer = buffers[name];
  if (!enabled || !context || !buffer || volume <= 0) return;
  const source = context.createBufferSource();
  const gain = context.createGain();
  gain.gain.value = volume;
  source.buffer = buffer;
  source.connect(gain).connect(context.destination);
  source.start();
}
