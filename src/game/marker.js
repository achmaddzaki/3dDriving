import * as THREE from 'three';

const MARKER_HEIGHT = 12;
const BOB_HEIGHT = 0.6;
const BOB_SPEED = 3; // radians per second

// Cyan arrow above the driven vehicle, turned to point horizontally at the target
export function createDirectionArrow(scene) {
  const cone = new THREE.Mesh(
    new THREE.ConeGeometry(0.5, 1.6, 4),
    new THREE.MeshBasicMaterial({ color: 0x29b6f6 })
  );
  cone.rotation.x = Math.PI / 2;
  const group = new THREE.Group();
  group.add(cone);
  group.visible = false;
  scene.add(group);

  return {
    // Places the arrow at (x, height, z) and turns it to `yaw`, bobbing based on `time` in seconds
    show(x, height, z, yaw, time) {
      group.position.set(x, height + Math.sin(time * BOB_SPEED) * 0.2, z);
      group.rotation.y = yaw;
      group.visible = true;
    },
    hide() {
      group.visible = false;
    },
  };
}

// Yellow arrow that floats above a lot and points down at it
export function createMarker(scene) {
  const mesh = new THREE.Mesh(
    new THREE.ConeGeometry(1.5, 3, 4),
    new THREE.MeshBasicMaterial({ color: 0xffd600 })
  );
  mesh.rotation.x = Math.PI;
  mesh.visible = false;
  scene.add(mesh);

  return {
    // Shows the arrow above the center of `rect`, bobbing based on `time` in seconds
    show(rect, time) {
      mesh.position.set(
        (rect.minX + rect.maxX) / 2,
        MARKER_HEIGHT + Math.sin(time * BOB_SPEED) * BOB_HEIGHT,
        (rect.minZ + rect.maxZ) / 2
      );
      mesh.visible = true;
    },
    hide() {
      mesh.visible = false;
    },
  };
}
