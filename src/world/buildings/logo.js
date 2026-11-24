import * as THREE from 'three';
import { SVGLoader } from 'https://unpkg.com/three@0.160.0/examples/jsm/loaders/SVGLoader.js';
import { obstacles } from '../../core/world.js';

const LOGO_URL = new URL('../../img/logo_simpli_red.svg', import.meta.url).href;
const LOGO_COLOR = 0xeb3b5a;
const SVG_HEIGHT = 42; // viewBox height of logo_simpli_red.svg
const LOGO_ASPECT = 40 / 42; // viewBox width over height
const DEPTH = 0.6; // extrusion depth in meters
const PLINTH_COLOR = 0x9e9e9e;
const PLINTH_DEPTH = 1.4;
const PLINTH_H = 1.0;
const PLINTH_MARGIN = 0.4; // plinth width beyond the logo width
const LIGHT_OFFSET = 4.5; // light distance on the road side of the logo
const LIGHT_HEIGHT = 9;
const LIGHT_COLOR = 0xfff3e0;

/// <summary>Adds the red logo as an extruded 3D mesh on a plinth, centered at (<paramref name="x"/>, <paramref name="z"/>) and facing +X.</summary>
export function addLogo3D(scene, { x, z, height }) {
  const width = height * LOGO_ASPECT;
  addPlinth(scene, x, z, width + PLINTH_MARGIN);
  addLogoLight(scene, x, z, height);
  new SVGLoader().load(LOGO_URL, (data) => {
    const shapes = data.paths.flatMap((path) => SVGLoader.createShapes(path));
    const mesh = new THREE.Mesh(extrudeLogo(shapes, height), new THREE.MeshLambertMaterial({ color: LOGO_COLOR, side: THREE.DoubleSide }));
    mesh.position.set(x, 0, z);
    scene.add(mesh);
  });
}

// Warm spotlight aimed at the logo face from the road side, with no visible fixture
function addLogoLight(scene, x, z, height) {
  const lx = x + LIGHT_OFFSET;
  const spot = new THREE.SpotLight(LIGHT_COLOR, 80, 40, 0.6, 0.5, 2);
  spot.position.set(lx, LIGHT_HEIGHT, z);
  spot.target.position.set(x, PLINTH_H + height / 2, z);
  scene.add(spot, spot.target);
}

// Solid concrete base under the logo, with collision
function addPlinth(scene, x, z, width) {
  const plinth = new THREE.Mesh(
    new THREE.BoxGeometry(PLINTH_DEPTH, PLINTH_H, width),
    new THREE.MeshLambertMaterial({ color: PLINTH_COLOR })
  );
  plinth.position.set(x, PLINTH_H / 2, z);
  scene.add(plinth);
  obstacles.push({
    box: { minX: x - PLINTH_DEPTH / 2, maxX: x + PLINTH_DEPTH / 2, minZ: z - width / 2, maxZ: z + width / 2 },
  });
}

// Extrudes the SVG shapes to meters, flips them upright, and stands them on the plinth facing +X
function extrudeLogo(shapes, height) {
  const s = height / SVG_HEIGHT;
  const geo = new THREE.ExtrudeGeometry(shapes, { depth: DEPTH / s, bevelEnabled: false, curveSegments: 8 });
  geo.scale(s, -s, s);
  geo.computeBoundingBox();
  const b = geo.boundingBox;
  geo.translate(-(b.min.x + b.max.x) / 2, PLINTH_H - b.min.y, -(b.min.z + b.max.z) / 2);
  geo.rotateY(Math.PI / 2);
  return geo;
}
