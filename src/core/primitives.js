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

const TILE_SIZE = 50; // meters per batch, so each batch can be culled on its own
// One instanced mesh per 50 m tile, with a copy of the geometry per matrix. Nothing is added when the list is empty.
// Optional per-instance colors are applied in the same order as the matrices.
export function addInstanced(scene, geometry, mat, matrices, colors = null) {
  const tiles = new Map();
  matrices.forEach((m, i) => {
    const key = `${Math.floor(m.elements[12] / TILE_SIZE)},${Math.floor(m.elements[14] / TILE_SIZE)}`;
    if (!tiles.has(key)) tiles.set(key, []);
    tiles.get(key).push(i);
  });
  for (const indices of tiles.values()) {
    const mesh = new THREE.InstancedMesh(geometry, mat, indices.length);
    indices.forEach((src, j) => {
      mesh.setMatrixAt(j, matrices[src]);
      if (colors) mesh.setColorAt(j, colors[src]);
    });
    mesh.receiveShadow = true;
    scene.add(mesh);
  }
}
// Matrix for a position, a scale, and a rotation around the Y axis
export function matrixAt(x, y, z, sx, sy, sz, rotY = 0) {
  const quat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotY);
  return new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), quat, new THREE.Vector3(sx, sy, sz));
}
