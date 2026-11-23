import * as THREE from 'three';

// Box mesh with shadows on, centered at (x, y, z)
export function box(w, h, d, mat, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

// Sphere mesh with shadows on, centered at (x, y, z)
export function sphere(r, mat, x, y, z) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

// One instanced mesh with a copy of the geometry per matrix. Nothing is added when the list is empty.
// Optional per-instance colors are applied in the same order as the matrices.
export function addInstanced(scene, geometry, mat, matrices, colors = null) {
  if (matrices.length === 0) return;
  const mesh = new THREE.InstancedMesh(geometry, mat, matrices.length);
  matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
  if (colors) colors.forEach((c, i) => mesh.setColorAt(i, c));
  mesh.receiveShadow = true;
  scene.add(mesh);
}
// Matrix for a position, a scale, and a rotation around the Y axis
export function matrixAt(x, y, z, sx, sy, sz, rotY = 0) {
  const quat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotY);
  return new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), quat, new THREE.Vector3(sx, sy, sz));
}
