// Background music. Loads after the page, starts after a delay, plays the track in passes with a gap, and ducks to silence during customer visits.
const MUSIC_DIR = '../sounds/backsound/';
const MUSIC_FILE = 'Small Town Sunrise (Energetic Vibe).mp3';
const MUSIC_VOLUME = 0.5; // gain when playing normally, from 0 to 1
const START_VOLUME = 0.05; // gain at the start of each pass, then fades up to MUSIC_VOLUME
const FADE_IN_SECONDS = 4;
const DUCK_SECONDS = 0.6; // time to fade the music to silence or back
const START_DELAY_SECONDS = 30; // wait after Start before the first pass
const LOOP_DELAY_SECONDS = 20; // silence between the end of one pass and the next

let context = null;
let fetching = null; // raw mp3 bytes, fetched once
let decoding = null; // promise for the decoded buffer, started once
let buffer = null;
let gain = null;
let started = false;
let enabled = false; // background music setting, off by default
let ducked = false;

// Downloads the track once, without decoding it
function fetchMusic() {
  if (!fetching) {
    const url = new URL(MUSIC_DIR + encodeURIComponent(MUSIC_FILE), import.meta.url);
    fetching = fetch(url).then((response) => response.arrayBuffer());
  }
  return fetching;
}

// Starts the download after the page has loaded, in idle time, so the base game loads first
export function scheduleMusicLoad() {
  const start = () => {
    const whenIdle = window.requestIdleCallback || ((cb) => setTimeout(cb, 1));
    whenIdle(() => {
      fetchMusic().catch((err) => console.warn(`music scheduleMusicLoad: ${err.message}`));
    });
  };
  if (document.readyState === 'complete') start();
  else window.addEventListener('load', start, { once: true });
}

// Decodes the track once. Needs the audio context to exist.
function loadTrack() {
  if (!decoding) {
    decoding = fetchMusic()
      .then((bytes) => context.decodeAudioData(bytes))
      .then((decoded) => {
        buffer = decoded;
      })
      .catch((err) => console.warn(`music loadTrack: ${err.message}`));
  }
  return decoding;
}

// Moves the gain to `to` over `seconds`, from `from` when given or from its current value
function rampGain(from, to, seconds) {
  const now = context.currentTime;
  gain.gain.cancelScheduledValues(now);
  gain.gain.setValueAtTime(from ?? gain.gain.value, now);
  gain.gain.linearRampToValueAtTime(to, now + seconds);
}

// Plays the track once through, then waits LOOP_DELAY_SECONDS before the next pass
function playPass() {
  if (!buffer) return;
  if (musicAudible()) rampGain(START_VOLUME, MUSIC_VOLUME, FADE_IN_SECONDS);
  const source = context.createBufferSource();
  source.buffer = buffer;
  source.connect(gain);
  source.onended = () => setTimeout(playPass, LOOP_DELAY_SECONDS * 1000);
  source.start();
}

// Creates the audio context and schedules the first pass after START_DELAY_SECONDS. Call from a user click.
export function startMusic() {
  if (started) return;
  started = true;
  if (!context) context = new AudioContext();
  context.resume();
  gain = context.createGain();
  gain.gain.value = 0;
  gain.connect(context.destination);
  const loaded = loadTrack();
  setTimeout(() => loaded.then(playPass), START_DELAY_SECONDS * 1000);
}

// True when the setting is on and the music is not ducked for a store visit
function musicAudible() {
  return enabled && !ducked;
}

// Fades the gain to match musicAudible
function applyMusicVolume() {
  if (gain) rampGain(null, musicAudible() ? MUSIC_VOLUME : 0, DUCK_SECONDS);
}

// Turns the background music on or off with the setting. The first turn-on starts the track.
export function setMusicEnabled(on) {
  enabled = on;
  if (on && !started) {
    startMusic();
    return;
  }
  applyMusicVolume();
}

// Ducks the music to silence, or brings it back. Does nothing when the state is unchanged.
function setDucked(on) {
  if (ducked === on) return;
  ducked = on;
  applyMusicVolume();
}

// Ducks the music while the car is inside a store lot, and restores it once the car is outside every lot
export function updateMusicDuck(storeState) {
  setDucked(storeState !== null);
}
