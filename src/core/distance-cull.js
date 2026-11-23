import * as THREE from 'three';

// Bounding sphere of an object in world space, or null when it has no geometry
function worldSphere(obj) {
  const sphere = new THREE.Sphere();
  if (obj.isInstancedMesh) {
    obj.computeBoundingSphere();
    return sphere.copy(obj.boundingSphere).applyMatrix4(obj.matrixWorld);
  }
  const box = new THREE.Box3().setFromObject(obj);
  if (box.isEmpty()) return null;
  return box.getBoundingSphere(sphere);
}

/// <summary>
/// Hides the objects currently in <paramref name="scene"/> that lie farther than <paramref name="range"/> from the camera.
/// Bounds are measured once, so call it after static world objects are added and before moving ones.
/// Lights and objects without geometry are never hidden.
/// </summary>
export function createDistanceCuller(scene, range) {
  scene.updateMatrixWorld(true);
  const entries = [];
  for (const obj of scene.children) {
    if (obj.isLight || obj.isCamera) continue;
    const s = worldSphere(obj);
    if (s) entries.push({ obj, x: s.center.x, y: s.center.y, z: s.center.z, r: s.radius });
  }
  return {
    count: entries.length,
    /// <summary>Shows objects within <paramref name="range"/> of <paramref name="camera"/> and hides the rest.</summary>
    update(camera) {
      const p = camera.position;
      for (const e of entries) {
        const dx = e.x - p.x;
        const dy = e.y - p.y;
        const dz = e.z - p.z;
        const gap = Math.sqrt(dx * dx + dy * dy + dz * dz) - e.r;
        e.obj.visible = gap <= range;
      }
    },
  };
}
