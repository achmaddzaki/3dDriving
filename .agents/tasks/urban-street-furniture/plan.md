# Implementation Plan: Urban Street Furniture and Downward Traffic Lights

## Decisions

- **Collision switch**: `STREET_FURNITURE_COLLISION` in `src/core/world.js`, default `false`. `true` pushes each furniture footprint into `obstacles`. Non-blocking by default, as the user asked.
- **Street edge** means the sidewalk strip beside the curb. Objects keep 0.3 m from the curb face and 0.3 m from the sidewalk outer edge, where barrier posts stand. No object goes on the curb face or the road.
- **Own random generator**: furniture uses a seeded generator in its own module and never calls `rand()`. The shared `rand()` drives the town, trees and bushes. Any extra call would move them.
- **Pure layout module**: placement rules live in `src/world/furniture-layout.js` with no `three` import, so a Node check can run them against the real town layout.
- **Traffic lights**: only the signal heads change orientation. The head center, pole, arm, lens count (3 per light) and lens colors stay the same. Each head box turns so its front faces down. Its lenses move to the underside. One hanger per light joins the head to the arm, because the turned head is 0.3 m tall and no longer reaches the arm. The hanger is the only added part, and the report lists it.
- **Sidewalk height constant** moves from `environment.js` to `world.js` so the furniture module can read it. The value stays 0.15.

## Placement rules

Each footprint is axis-aligned. Objects are oriented with their long side along the street (rotY 0 or π on X roads, ±π/2 on Z roads), so the footprint math stays simple. `v` is the offset from the curb edge to the object center. `jitter` is ±0.15 m on `v`, chosen per instance.

| Type | Footprint along × across (m) | v (m) | Height (m) | Min spacing, same side and street (m) | Target |
| --- | --- | --- | --- | --- | --- |
| Street lamp | 0.3 × 0.3 | 0.6 | 4.2 | 40 | 120 |
| Bench | 1.8 × 0.6 | 1.2 | 0.9 | 30 | 60 |
| Trash bin | 0.6 × 0.6 | 0.9 | 1.05 | 15 | 90 |
| Bus shelter | 2.4 × 1.2 | 0.9 | 2.4 | 200 | 12 |
| Mailbox | 0.45 × 0.4 | 0.6 | 1.0 | 40 | 60 |
| Newspaper stand | 0.6 × 0.5 | 0.8 | 1.1 | 60 | 40 |
| Vending machine | 0.8 × 0.7 | 1.0 | 1.8 | 80 | 30 |
| Electrical box | 0.6 × 0.35 | 0.7 | 1.3 | 60 | 50 |
| Fire hydrant | 0.3 × 0.3 | 0.6 | 0.75 | 80 | 40 |
| Advertising board | 0.7 × 0.5 | 0.9 | 1.05 | 60 | 40 |

Targets total 542. The generator stops at each target. Real counts can fall short for a type when no valid spot is left, and the report gives the achieved count.

Exclusions, checked for every candidate footprint:
- **Road surface**: no overlap with any street rect from `streetRect(s)` in `world.js`, which uses `halfWidth` without sidewalk. This also covers the main road parking bays, which sit inside the road.
- **Sidewalk band**: the footprint must lie inside `[halfWidth + 0.3, halfWidth + SIDEWALK_WIDTH - 0.3]` on its side.
- **Pedestrian crossings**: along the street, the footprint stays 4.5 m (`SIDEWALK_WIDTH + 2`) beyond each crossing street's edge. The sidewalk gap at a crossing is 2.5 m, so this leaves 2 m extra.
- **Buildings, parks, distributor lot, and building doors**: the footprint stays 3 m along the street from every lot in `lots`. Doors sit on each lot's street wall (`addFacades`, `facesRoad` in `facade.js`), 6 to 12 m inside the lot, so this margin keeps the door approach clear.
- **Fixed street fixtures**: each street lamp pole and traffic light pole is pushed to `sidewalkFixtures` in `world.js`. Footprints keep 1.5 m from these points.
- **Other furniture**: footprints stay 0.3 m apart, and same-type objects on the same side and street keep the minimum spacing above.

## Items

- [ ] 1. (FEAT-001) Build the check harness and record the baseline before any edit.
      Create `$env:TEMP\furn-check\` with `package.json` (`{"type":"module"}`), a `node_modules\three\index.js` stub, and `check.mjs`. The stub exports every `THREE.<Name>` name used in `src` (found by scanning `src` for `THREE\.(\w+)`). Each name is a recursive Proxy that returns itself for any property, call, or construct. `check.mjs` copies `src` into the harness folder, imports `buildEnvironment`, `buildTown`, and `addRoadEdges`, runs them with a stub scene `{ add() {} }`, and writes `baseline.json` with `JSON.stringify(lots)` and `obstacles.length`. The script skips furniture checks while `src/world/furniture-layout.js` does not exist, so the same script runs before and after the feature.
      Files: none in the repo. Harness files live under `$env:TEMP\furn-check\`.
      Verify: `node $env:TEMP\furn-check\check.mjs` exits 0 and prints the lot count and obstacle count. Keep `baseline.json` for item 8.

- [ ] 2. (FEAT-001) Turn the traffic light signal heads to face down.
      In `addTrafficLights`, replace the head matrix with a `headMatrix` helper that composes position, a quaternion from `new THREE.Euler(Math.PI / 2, rotY, 0, 'YXZ')`, and scale `(0.4, LIGHT_HEAD_H, LIGHT_HEAD_T)`. This turns the 1.1 m long side horizontal along the approach, and turns the front face down. Keep `headY` unchanged. Replace `LENS_FRONT` with `LIGHT_HEAD_T = 0.3` and `LENS_T = 0.04`. Place three lenses per light under the head at head-local offsets `-0.3` (red), `0` (yellow), `0.3` (green), at world `(headX + sin(rotY) * d, headY - LIGHT_HEAD_T / 2 - LENS_T / 2, headZ + cos(rotY) * d)`, each `matrixAt(..., 0.26, LENS_T, 0.26, rotY)`. Add one hanger per light, centered at `(headX, (top + bottom) / 2, headZ)` with `top = armY - LIGHT_ARM_T / 2` and `bottom = headY + LIGHT_HEAD_T / 2`, size `0.08 × (top - bottom) × 0.08`, batched into the existing pole and arm `addInstanced` call with `lightPoleMat`. Do not change the poles, arms, junction positions, or colors.
      Files: `src/world/environment.js` (`addTrafficLights`, constants block near lines 37-44)
      Verify: `node --check` on the copy in the harness folder exits 0, then `node $env:TEMP\furn-check\check.mjs` exits 0 with the same lot count and obstacle count as `baseline.json`. A person opens the page and checks that the heads and lenses face the road from above.

- [ ] 3. (FEAT-002) Move the sidewalk height to `world.js` and record fixture positions.
      In `world.js`, add `export const SIDEWALK_HEIGHT = 0.15;` after line 8, `export const sidewalkFixtures = [];`, and `export const STREET_FURNITURE_COLLISION = false;` with a one-line comment (`// true makes street furniture solid for driving`) after line 12. In `environment.js`, remove `const SIDEWALK_HEIGHT = 0.15;` at line 14, add `SIDEWALK_HEIGHT` and `sidewalkFixtures` to the import from `../core/world.js`, and push `{ x, z }` for each street lamp pole in `addStreetLamps` and for each `poleX, poleZ` in the `addTrafficLights` loop.
      Files: `src/core/world.js`, `src/world/environment.js`
      Verify: `node $env:TEMP\furn-check\check.mjs` exits 0 and the lot JSON and obstacle count still match `baseline.json`.

- [ ] 4. (FEAT-002) Let `addInstanced` take optional per-instance colors.
      Change the signature in `src/core/primitives.js` to `addInstanced(scene, geometry, mat, matrices, colors = null)`. When `colors` is set, call `mesh.setColorAt(i, colors[i])` for each instance. Leave the existing body otherwise unchanged. Existing callers pass four arguments and behave the same.
      Files: `src/core/primitives.js`
      Verify: `node --check` on the harness copy exits 0 and `check.mjs` still matches the baseline.

- [ ] 5. (FEAT-002) Add the pure placement module `src/world/furniture-layout.js`.
      Export `FURNITURE_TYPES` (the table above, with `id`, `fl`, `fw`, `v`, `gap`, `target`, and `colors` as hex arrays or null) and `layoutFurniture(lots)`. Import `STREETS`, `HALF_WORLD`, `WORLD_LIMIT`, `SIDEWALK_WIDTH`, `sidewalkFixtures`, `rectsOverlap`, `streetRect` from `../core/world.js`. Use a mulberry32 generator seeded with `20240601`, defined in this file. Constants: `SIDE_CLEAR = 0.3`, `CROSS_CLEAR = SIDEWALK_WIDTH + 2`, `LOT_CLEAR = 3`, `FIXTURE_CLEAR = 1.5`, `GAP_CLEAR = 0.3`, `JITTER = 0.15`, `ATTEMPTS_PER_TARGET = 400`.
      Per type, in table order, repeat up to `target * ATTEMPTS_PER_TARGET` times: pick a street index, a side `sd` (±1), an along position `t` in `[-WORLD_LIMIT, WORLD_LIMIT]`, and a jittered `v`. Compute `across = s.offset + sd * (s.halfWidth + v)`. Build the world rect: for `alongX` streets, `minX/maxX` from `t ± fl/2` and `minZ/maxZ` from `across ± fw/2`. For `alongZ` streets, swap the axes. Reject when any of these holds: the across range leaves the sidewalk band (`v - fw/2 < SIDE_CLEAR` or `v + fw/2 > SIDEWALK_WIDTH - SIDE_CLEAR`); the along range reaches a crossing street's `[offset - halfWidth - CROSS_CLEAR, offset + halfWidth + CROSS_CLEAR]`; the rect grown along the street by `LOT_CLEAR` overlaps a lot; the rect grown by `FIXTURE_CLEAR` contains a fixture point; the same type on the same street and side has `|t - t_other| < gap`; or the rect grown by `GAP_CLEAR` overlaps an already placed rect. Accept by pushing `{ type, x, z, rotY, color, rect, si, sd, t }`, where `(x, z)` is `(t, across)` on `alongX` streets and `(across, t)` otherwise, `rotY` is `sd > 0 ? 0 : π` on `alongX` and `sd > 0 ? π/2 : -π/2` otherwise, and `color` is a random palette index or -1. Stop each type at its target. Do not call `rand()`.
      Files: `src/world/furniture-layout.js` (new)
      Verify: `node $env:TEMP\furn-check\check.mjs` runs the layout checks in item 8 and exits 0.

- [ ] 6. (FEAT-002) Build the furniture meshes and wire them into the world.
      Create `src/world/street-furniture.js`. Import `* as THREE`, `addInstanced` and `matrixAt` from `../core/primitives.js`, `SIDEWALK_HEIGHT`, `STREET_FURNITURE_COLLISION`, and `obstacles` from `../core/world.js`, and `FURNITURE_TYPES` and `layoutFurniture` from `./furniture-layout.js`. Define a `PARTS` map from type id to parts. Each part has `geo` (`'box'` or `'cyl'`), `offset` `[lx, ly, lz]` in the object frame (`lx` along the street, `lz` away from the road), `size` `[sx, sy, sz]`, and either `color` (hex) or `tint: true` for the per-instance palette color. The parts are:
      - streetLamp: pole box `(0.12, 4.0, 0.12)` at `(0, 2.0, 0)`, color `0x3e4448`; head box `(0.3, 0.16, 0.36)` at `(0, 4.08, 0)`, color `0xfff3c4`.
      - bench: seat `(1.8, 0.08, 0.5)` at `(0, 0.45, 0)` and back `(1.8, 0.45, 0.06)` at `(0, 0.75, 0.22)`, color `0x8d6e63`; two legs `(0.08, 0.45, 0.5)` at `(±0.75, 0.225, 0)`, color `0x3e4448`.
      - trashBin: body cylinder `(0.6, 1.0, 0.6)` at `(0, 0.5, 0)`, tint; lid cylinder `(0.62, 0.08, 0.62)` at `(0, 1.04, 0)`, color `0x212121`.
      - busShelter: roof `(2.4, 0.1, 1.2)` at `(0, 2.3, 0)`, color `0x455a64`; back panel `(2.4, 1.8, 0.05)` at `(0, 1.2, 0.575)` and two side panels `(0.05, 1.8, 1.2)` at `(±1.175, 1.2, 0)`, color `0xb3e5fc`.
      - mailbox: post `(0.08, 0.9, 0.08)` at `(0, 0.45, 0)`, color `0x3e4448`; body `(0.45, 0.35, 0.35)` at `(0, 1.07, 0)`, tint.
      - newspaperStand: body `(0.6, 1.1, 0.5)` at `(0, 0.55, 0)`, tint; window `(0.5, 0.3, 0.02)` at `(0, 0.85, -0.26)`, color `0x263238`.
      - vendingMachine: body `(0.8, 1.8, 0.7)` at `(0, 0.9, 0)`, tint; front panel `(0.6, 0.9, 0.02)` at `(0, 1.1, -0.345)`, color `0xeceff1`.
      - electricalBox: cabinet `(0.6, 1.3, 0.35)` at `(0, 0.65, 0)`, tint.
      - fireHydrant: body cylinder `(0.24, 0.65, 0.24)` at `(0, 0.325, 0)`, color `0xd32f2f`; cap cylinder `(0.2, 0.1, 0.2)` at `(0, 0.7, 0)`, color `0xb71c1c`.
      - adBoard: base `(0.7, 0.05, 0.5)` at `(0, 0.025, 0)`, color `0x3e4448`; panel `(0.6, 1.0, 0.05)` at `(0, 0.6, 0)`, tint.
      Export `addStreetFurniture(scene, lots)`. It calls `layoutFurniture(lots)` once. For each type and each part, it builds one matrix per placed object. The world part center is `px = p.x + lx * cos(rotY) + lz * sin(rotY)`, `pz = p.z - lx * sin(rotY) + lz * cos(rotY)`, `y = SIDEWALK_HEIGHT + ly`, and the matrix is `matrixAt(px, y, pz, sx, sy, sz, rotY)`. The `cyl` geometry is `CylinderGeometry(0.5, 0.5, 1, 12)`, scaled by the size, so a diameter of `sx` is passed as `sx`. The `box` geometry is `BoxGeometry(1, 1, 1)`. Tinted parts use a white material with `colors` set to `new THREE.Color(palette[p.color])`. Other parts use a material cached by hex color, as in `tree.js`. Call `addInstanced` once per part. If `STREET_FURNITURE_COLLISION` is true, push `{ box: p.rect }` into `obstacles` for every placement. Return the per-type counts object.
      In `src/main.js`, add `addStreetFurniture` to the import from `./world/street-furniture.js`, and call `addStreetFurniture(scene, lots);` after line 57 (`addRoadEdges(scene, lots);`) and before `addTrees`.
      Files: `src/world/street-furniture.js` (new), `src/main.js`
      Verify: `node $env:TEMP\furn-check\check.mjs` exits 0. The check prints per-type counts from `addStreetFurniture`, and the lot JSON and obstacle count still match `baseline.json` (the switch is off, so no obstacle is added).

- [ ] 7. (FEAT-002) Update the README file list.
      In `README.md`, under `## Files`, add the two new files: `src/world/furniture-layout.js` (placement rules for street furniture) and `src/world/street-furniture.js` (furniture meshes). Add to the `src/core/world.js` line: `and the STREET_FURNITURE_COLLISION switch for furniture collisions (default off)`.
      Files: `README.md`
      Verify: `Select-String -Path README.md -Pattern STREET_FURNITURE_COLLISION` returns one line.

- [ ] 8. (FEAT-002) Final verification with the harness.
      Extend `check.mjs` to run the layout on the real town lots from `buildTown` (after `buildEnvironment` and `addRoadEdges`, as in `main.js`). Then check every placement and print the counts:
      - Road: no rect overlaps any `streetRect` of each street with its `halfWidth` alone (no sidewalk). This also rules out parking bays.
      - Sidewalk: each rect lies inside its sidewalk band.
      - Crossings and lots: the clearances from the rules above hold.
      - Fixtures: no rect comes within 1.5 m of a fixture point.
      - Overlap: no two rects overlap.
      - Counts: each type's count equals its target, or the script prints a shortfall.
      - Baseline: the lot JSON and obstacle count still match `baseline.json`.
      The script exits 1 on any violation. Run `node --check` on every changed `.js` file in the harness copy.
      Files: none in the repo.
      Verify: `node $env:TEMP\furn-check\check.mjs` exits 0 and prints zero violations. A person checks the traffic lights and street furniture in the browser, because the harness cannot render.

## Digest

Build: none (no build step; Three.js loads from a CDN import map in `index.html`). Tests: none in the repo. Verification is `node $env:TEMP\furn-check\check.mjs` (item 1) plus `node --check` on each changed file in the harness copy. Node is v20.18.0. The planning step read the code but ran nothing, so no test results exist yet.

- `src/core/world.js` (read whole file)
  - Blocks: `SIDEWALK_WIDTH` line 8; `ROAD_EDGE_COLLISION` line 10 with comment at line 9; `ROADSIDE_BARRIER_COLLISION` line 12; `streetRect` line 24; `rectsOverlap` line 34; `obstacles` line 49.
  - Adds: `SIDEWALK_HEIGHT`, `sidewalkFixtures`, `STREET_FURNITURE_COLLISION`.
  - Covered by: harness only.
- `src/core/primitives.js` (read whole file)
  - Blocks: `addInstanced(scene, geometry, mat, matrices)` lines 21-27; `matrixAt(x, y, z, sx, sy, sz, rotY = 0)` lines 29-33.
  - Covered by: harness (environment and town call it).
- `src/world/environment.js` (read whole file)
  - Blocks: `const SIDEWALK_HEIGHT` line 14; world import lines 3-12; constants `LIGHT_POLE_H` line 37, `LIGHT_HEAD_H` line 39, `LENS_FRONT` line 41; `addTrafficLights(scene)` lines 403-433 (`headY` line 407, head `matrixAt` line 418, lens loop around line 421-423, lens `addInstanced` line 428); `junctionLights(main, cross)` lines 435-450; `addStreetLamps(scene)` from line 452 (pole and head lines near 457-459).
  - Covered by: harness.
- `src/main.js` (read lines 1-58 and the world build section)
  - Blocks: import line 3 (`buildEnvironment, addRoadEdges`); `addRoadEdges(scene, lots);` line 57; `addTrees(scene, lots);` line 58.
  - Covered by: harness for the world build order; browser check for the rest.
- `README.md` (read whole file)
  - Blocks: the `## Files` list lines for `src/world/environment.js` and `src/core/world.js`.
- `src/world/furniture-layout.js` (new): exports `FURNITURE_TYPES`, `layoutFurniture(lots)`. Covered by: item 8 harness.
- `src/world/street-furniture.js` (new): exports `addStreetFurniture(scene, lots)`. Covered by: item 8 harness (runs it with the stub scene) and the browser check.
- Not touched: `src/world/building/town.js`, `facade.js` (both carry staged changes from other tasks), `tree.js`, `bush.js`, `models.js`, `park.js`, `distributor.js`.
