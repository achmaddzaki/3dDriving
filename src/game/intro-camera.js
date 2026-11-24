import * as THREE from 'three';

const VIEW_SECONDS = 15; // seconds before the camera picks a new random viewpoint
const SLIDE_RATE = 0.6; // 1/s, how fast the camera glides toward the viewpoint
const ORBIT_SPEED = 0.03; // rad/s, slow drift around the lot while the title is up
const DISTANCE_MIN = 45; // m from the lot center to the camera
const DISTANCE_MAX = 70;
// Angle above the ground. Kept low so the view is never top-down.
const ELEVATION_MIN = (22 * Math.PI) / 180;
const ELEVATION_MAX = (38 * Math.PI) / 180;
const LOOK_HEIGHT = 2; // m, the point the camera looks at on the lot

// Slow aerial camera over a lot for the title screen. `look` is the point it aims at.
export function createIntroCamera(center) {
  const look = new THREE.Vector3(center.x, LOOK_HEIGHT, center.z);
  const goal = new THREE.Vector3();
  let angle = 0;
  let radius = 0;
  let height = 0;
  let timer = 0;
  let placed = false;

  // Picks a random compass angle, distance, and elevation, then splits the distance into height and ground radius
  function pickViewpoint() {
    angle = Math.random() * Math.PI * 2;
    const distance = DISTANCE_MIN + (DISTANCE_MAX - DISTANCE_MIN) * Math.random();
    const elevation = ELEVATION_MIN + (ELEVATION_MAX - ELEVATION_MIN) * Math.random();
    radius = distance * Math.cos(elevation);
    height = distance * Math.sin(elevation);
  }
  pickViewpoint();

  // Moves the camera toward the current viewpoint, and picks a new one every VIEW_SECONDS
  function update(dt, camera) {
    timer += dt;
    if (timer >= VIEW_SECONDS) {
      timer -= VIEW_SECONDS;
      pickViewpoint();
    }
    angle += ORBIT_SPEED * dt;
    goal.set(center.x + Math.sin(angle) * radius, height, center.z + Math.cos(angle) * radius);
    if (!placed) {
      camera.position.copy(goal);
      placed = true;
    } else {
      camera.position.lerp(goal, 1 - Math.exp(-SLIDE_RATE * dt));
    }
    camera.lookAt(look);
  }

  return { update, look };
}
