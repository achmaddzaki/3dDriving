# Implementation Plan: Road and Sidewalk Improvements

## Findings that shape the plan

- Streets are built in `src/world/environment.js` (`buildEnvironment`, called from `src/main.js` line 55 before `buildTown`). Street layout and zones are in `src/core/world.js`.
- There is no package.json, no build step, no test framework, and no lint config. Three.js loads from a CDN import map in `index.html`. The only available check is a syntax parse. A baseline parse of the four touched files passes today (`node --check` on a `.mjs` copy, exit 0).
- `rand()` in `src/core/world.js` is a shared seeded generator. `buildEnvironment` runs before `buildTown`, so any `rand()` call in the road code would reshuffle the town, trees, and bushes. Road details use fixed arithmetic only.
- Instanced meshes are used by `addBoxes` in `src/world/building/facade.js` (private) and by nothing in the road code. Road code currently makes one mesh per dash. This plan adds a shared `addInstanced` helper to `src/core/primitives.js` so `facade.js` stays untouched.
- Obstacles are pushed to `obstacles` in `src/core/world.js` as `{ box: { minX, maxX, minZ, maxZ } }`. `main.js` `resolveCollisions` reads that array each frame.
- Parking lots start at the sidewalk outer edge (`lotRect` in `town.js`, distance `halfWidth + SIDEWALK_WIDTH`). Cars enter lots only across the sidewalk, so any sidewalk collision must leave lot frontages open.
- Street coordinates: a street is `{ alongX, offset, halfWidth }`. For `alongX` true, the street runs along X at z = offset, and "t" is x. For `alongX` false, it runs along Z at x = offset, and "t" is z. "Across" is the perpendicular coordinate. Street 0 is the main road (halfWidth 6). Streets 1 to 8 are side roads (halfWidth 4). Intersections: 4 X-roads by 5 Z-roads = 20.

## Decisions made in this plan

- **Collision switch**: `ROAD_EDGE_COLLISION` in `src/core/world.js`, default `false`. When `true`, curb faces and roadside barriers add `obstacles` boxes, except in front of parking lots.
- **Sidewalk height**: raise `SIDEWALK_HEIGHT` from 0.04 to 0.15 m. That is the raised curb. A 0.2 m dark curb face on the road edge marks the edge. Corner blocks inherit the height automatically.
- **Parking bays on the main road only**: the main road is 12 m wide. Two 2.2 m bays leave 3.8 m travel lanes. Side roads are 8 m wide, so a bay would leave 1.8 m lanes. Side roads get no bays. This is a choice; report it.
- **Lane direction convention**: traffic on the lane at positive across moves toward decreasing t. Traffic on the negative-across lane moves toward increasing t. Arrows and stop lines follow this rule.
- **Street names**: the code has no real street names. Labels are placeholders: `Main Road` and `Street N` (N = index in `STREETS`). The user supplies real names. Report this.
- **Crossings**: zebra bands sit on each road just outside the crossing road's edge, 3 m long, with 0.6 m stripes on a 1.2 m pitch. Center dashes must keep clear of them, so the dash exclusion changes from `CROSSING_GAP` (8) to `o.halfWidth + ZEBRA_LENGTH + DASH_HALF` (per crossing road `o`). This is needed so dashes do not overlap the new stripes.
- **Corner blocks**: they stay non-obstacles even with the switch on. Cars can cross a corner block at a junction. This is an existing-layout gap, and it is reported.

## Shared constants and helpers (used by the items below)

- `onStreet(s, t, across, lenT, widthA, yCenter, h)` in `environment.js`. Returns a `Matrix4` for a box along street `s`. `lenT` is the length along t, `widthA` is the width across, and `h` is the height. If `s.alongX`, then x = t, z = across, sx = lenT, sz = widthA. Otherwise x = across, z = t, sx = widthA, sz = lenT. Built with `matrixAt`.
- `freeRanges(blocked)` already exists in `environment.js` (line 144). Reuse it for road segments.
- `sidewalkRanges(s)`: the free ranges for one street's sidewalks. Extracted from `addSidewalks` (line 132) so the curb and barrier code can reuse it.

---

- [ ] 1. Add a shared instancing helper to `src/core/primitives.js`.
      Add `export function addInstanced(scene, geometry, mat, matrices)` that builds one `THREE.InstancedMesh` (castShadow off, receiveShadow on), sets each matrix, and adds it to the scene. Skip when `matrices` is empty. Add `export function matrixAt(x, y, z, sx, sy, sz, rotY = 0)` that composes position, scale, and a Y-axis rotation into a `THREE.Matrix4`. Use `new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotY)`. Keep the `box` and `sphere` functions unchanged. Do not touch `facade.js`.
      Files: `src/core/primitives.js`
      Verify: `node --check` on a `.mjs` copy of the file exits 0 (see Digest for the exact command). No behavior is observable yet.

- [ ] 2. Add the collision switch in `src/core/world.js`.
      Add after `SIDEWALK_WIDTH` (line 8): `export const ROAD_EDGE_COLLISION = false;` with a one-line comment: `// true makes curbs and roadside barriers solid for driving, except in front of parking lots`. Do not change anything else in this file in this item.
      Files: `src/core/world.js`
      Verify: parse check on a `.mjs` copy exits 0.

- [ ] 3. Raise the sidewalks into curbs and add the dark curb face in `src/world/environment.js`.
      Change `SIDEWALK_HEIGHT` (line 11) from 0.04 to 0.15. Add constants `CURB_FACE_W = 0.2` and `curbMat` (`0xc8c8c8`). In `addSidewalks` (line 132), keep the existing per-piece calls. Add a separate loop over the same `sidewalkRanges(s)` that collects curb-face matrices: for each `side` in [-1, 1], across = `s.offset + side * (s.halfWidth + CURB_FACE_W / 2)`, length = to - from, using `onStreet(s, mid, across, length, CURB_FACE_W, (SIDEWALK_HEIGHT + 0.01) / 2, SIDEWALK_HEIGHT + 0.01)`. The face top sits 0.01 above the sidewalk top to avoid z-fighting. After the street loop in `buildEnvironment` (line 19), call `addInstanced` once with `curbMat` and all curb-face matrices. Extract `sidewalkRanges(s)` from `addSidewalks` first, so that `addSidewalks` also calls it. Behavior of the sidewalks stays the same apart from the new height.
      Files: `src/world/environment.js`
      Verify: parse check on a `.mjs` copy exits 0. Visual check by a person: sidewalks stand clearly above the road, and the corner blocks (`addCornerPiece`, line 52) match the straight sidewalks.

- [ ] 4. Add pedestrian crossings and stop lines (intersection markings) in `src/world/environment.js`.
      Add constants `ZEBRA_LENGTH = 3`, `ZEBRA_STRIPE_W = 0.6`, `ZEBRA_PITCH = 1.2`, `DASH_HALF = 2.5`, `MARK_Y = 0.03`, `MARK_H = 0.02`, and `STOP_LINE_T = 0.5`. Replace `CROSSING_GAP` (line 10) with these. Change the dash exclusion in `addStreetDashes` (line 118) to skip a dash when `Math.abs(t - o.offset) < o.halfWidth + ZEBRA_LENGTH + DASH_HALF` for any crossing street `o`. This needs `crossingStreets(s)`, which returns the full street objects. Keep `crossingOffsets` (line 102) if other code uses it, or replace it. Add `addCrossings(scene)`: for each X-road `A` and Z-road `B`, and each `sd` in [-1, 1]:
      - Zebra on `B` (the crossing road, at t = `A.offset + sd*(A.halfWidth + ZEBRA_LENGTH / 2)`, length `ZEBRA_LENGTH`): stripes at across positions `-B.halfWidth + (k + 0.5) * pitch`, with `n = floor(2 * B.halfWidth / ZEBRA_PITCH)` and `pitch = 2 * B.halfWidth / n`. Width `ZEBRA_STRIPE_W`.
      - Zebra on `A`: same rule with the roles swapped.
      - Stop line on each approach: on street `s` for crossing `o`, at t = `o.offset + sd*(o.halfWidth + ZEBRA_LENGTH + STOP_LINE_T)`, across = `sd * laneCenter(s)`, width = `laneWidth(s) - 0.4`, length 0.3. Define `parkingWidth(s)` (returns `PARKING_WIDTH` when `s === STREETS[0]`, else 0) and `laneWidth(s) = s.halfWidth - parkingWidth(s)`, and `laneCenter(s) = laneWidth(s) / 2`. `PARKING_WIDTH = 2.2` is defined here, used in item 5.
      Collect all stripe and stop-line matrices, then call `addInstanced` once with `lineMat`. Add the calls in `buildEnvironment` after the existing street loop.
      Files: `src/world/environment.js`
      Verify: parse check on a `.mjs` copy exits 0. Visual check by a person: each intersection shows four zebra bands and four stop lines, and no center dash overlaps a stripe.

- [ ] 5. Add lane markings, directional arrows, and main-road parking bays in `src/world/environment.js`.
      Add `EDGE_INSET = 0.3`, `LINE_W = 0.12`, `PARK_BAY_LENGTH = 2.5`, `CROSSING_CLEAR = ZEBRA_LENGTH + 1`, `ARROW_STEP = 20`. Define `markFreeRanges(s)` = `freeRanges` of the crossing clearances, where each crossing street `o` blocks `[o.offset - (o.halfWidth + CROSSING_CLEAR), o.offset + (o.halfWidth + CROSSING_CLEAR)]`. Add `addLaneMarkings(scene)`, which for each street `s` and each segment `[from, to]` of `markFreeRanges(s)`:
      - Solid edge line on each `sd`: across = `sd * (s.halfWidth - EDGE_INSET)`, length `to - from`, width `LINE_W`.
      - If `parkingWidth(s) > 0`, also a solid divider line on each `sd` at across = `sd * laneWidth(s)`, and parking bay dividers (length `LINE_W` along t, width `PARKING_WIDTH` across, centered at across `sd * (s.halfWidth - PARKING_WIDTH / 2)`) at t = `from + k * PARK_BAY_LENGTH` for every k while t is at most `to`, on each `sd`.
      Add directional arrows: candidate t values are the multiples of `ARROW_STEP` (20) inside `[-WORLD_LIMIT, WORLD_LIMIT]` that are at least `o.halfWidth + CROSSING_CLEAR` from every crossing street `o`. For each valid t with `index % 2 === 0`, place one arrow on each travel lane: across = `sd * laneCenter(s)`, traffic direction `dir = -sd` along t. Arrow geometry is one `ShapeGeometry` shared by all arrows: shape points (in order) `(0,-1)`, `(0.5,0)`, `(0.2,0)`, `(0.2,0.9)`, `(-0.2,0.9)`, `(-0.2,0)`, `(-0.5,0)`, then `geometry.rotateX(-Math.PI / 2)` so the tip points to local +Z. The matrix uses `matrixAt(p.x, MARK_Y, p.z, 1, 1, 1, rotY)` with `rotY = Math.atan2(dx, dz)` where `(dx, dz)` is the travel direction. Get `(p.x, p.z)` from the street coordinates (x = t, z = across for `alongX`, and the reverse otherwise). Add the arrow matrices to `addInstanced` with `lineMat`, and call `addInstanced` once for the arrow geometry.
      Note: the arrow geometry is a flat shape, so it uses `addInstanced` with a custom geometry and not `UNIT_BOX`.
      Files: `src/world/environment.js`
      Verify: parse check on a `.mjs` copy exits 0. Visual check by a person: edge lines run the full length between crossings, and the main road shows parking bays on both sides with arrows in each travel lane pointing the lane direction.

- [ ] 6. Add manhole covers and storm drains in `src/world/environment.js`.
      Add `MANHOLE_R = 0.45`, `DRAIN_W = 0.6`, `DRAIN_D = 0.4`, `DRAIN_CLEAR = ZEBRA_LENGTH + 1.2`, `ironMat` (`0x3a3a3a`), and `drainMat` (`0x2a2a2a`). Manholes: for each street `s`, each candidate t from the same multiples-of-20 grid as item 5 with `index % 2 === 1` and valid (not within a crossing clearance), place one `CylinderGeometry(MANHOLE_R, MANHOLE_R, MARK_H, 14)` at `matrixAt(p.x, MARK_Y, p.z, 1, 1, 1)`, centered on the travel lane (across = `laneCenter(s)` for `sd = +1`). Storm drains: for each street `s`, each crossing street `o`, and each `sd` in [-1, 1], place a grate at t = `o.offset + sd * (o.halfWidth + DRAIN_CLEAR)` and across = `side * (s.halfWidth - 0.6)` for each `side` in [-1, 1]. Grates use `onStreet(s, t, across, DRAIN_W, DRAIN_D, MARK_Y, MARK_H)`. Batch each kind into one `addInstanced` call with its material.
      Files: `src/world/environment.js`
      Verify: parse check on a `.mjs` copy exits 0. Visual check by a person: manholes sit in travel lanes mid-block, and grates sit at the curb edge beyond each crossing.

- [ ] 7. Add street name signs at the intersections in `src/world/environment.js`.
      Add constants `SIGN_POLE_H = 2.6`, `SIGN_W = 1.6`, `SIGN_H = 0.4`, `SIGN_Y = 2.6`, `poleMat` (`0x607d8b`), and a `nameTextures` Map cache. Add `streetName(s)`: `'Main Road'` when `s === STREETS[0]`, otherwise `` `Street ${STREETS.indexOf(s)}` ``. Add `nameTexture(name)`: canvas 512x128 with a green fill (`#2e7d32`), white bold text (`bold 56px sans-serif`, centered), cached by name in `nameTextures`. Add `addStreetSigns(scene)`: for each X-road `A` and Z-road `B`, the pole is at `(x, z) = (B.offset + B.halfWidth + SIDEWALK_WIDTH / 2, A.offset + A.halfWidth + SIDEWALK_WIDTH / 2)`, which is the middle of the corner block. Add one pole box (`0.08 x SIGN_POLE_H x 0.08`, centered at y = `SIGN_POLE_H / 2`) through `addInstanced` with `poleMat`. Add two plates from `new THREE.Mesh(new THREE.PlaneGeometry(SIGN_W, SIGN_H), new THREE.MeshBasicMaterial({ map: nameTexture(...), side: THREE.DoubleSide }))`: plate `A` with rotation.y = `Math.PI / 2` (readable by traffic on `A`, which runs along X), and plate `B` with rotation.y = 0 (readable by traffic on `B`). Both at y = `SIGN_Y`, at the pole position. Call from `buildEnvironment`.
      Files: `src/world/environment.js`
      Verify: parse check on a `.mjs` copy exits 0. Visual check by a person: 20 poles appear at the 20 intersections, and each plate reads from its road.

- [ ] 8. Add roadside barriers and the optional collision in `src/world/environment.js`, and call it from `src/main.js`.
      Add `addRoadEdges(scene, lots)`, exported. For each street `s`, each `sd` in [-1, 1], and each segment `[from, to]` of `sidewalkRanges(s)`:
      - Cut out parking-lot frontage. A lot is a frontage for `(s, sd)` when `rectsOverlap(lot, band)` is true, where `band` is the sidewalk band grown 0.5 m outward on that side: across range `[s.halfWidth, s.halfWidth + SIDEWALK_WIDTH + 0.5]` times `sd`, along the full world. Remove each frontage's along-range (`[lot.minX, lot.maxX]` for `alongX`, else `[lot.minZ, lot.maxZ]`) from the segment. Use a helper `subtractRanges(segments, cuts)`.
      - For each remaining sub-segment `[a, b]` with `b - a >= 0.5`: posts at `a + i * (len / n)` for `i` in `0..n` where `n = ceil(len / 3)`, each `onStreet(s, t, sd * (s.halfWidth + SIDEWALK_WIDTH - 0.1), 0.1, 0.1, SIDEWALK_HEIGHT + 0.375, 0.75)`. Two rails: `onStreet(s, mid, across, len, 0.06, SIDEWALK_HEIGHT + 0.45, 0.06)` and at `+0.7`. Collect all into `barrierMat` (`0x9aa5ab`) and post matrices, and call `addInstanced` once per material.
      - If `ROAD_EDGE_COLLISION` is true, push obstacles for each sub-segment: the curb (`across` range `[s.halfWidth, s.halfWidth + CURB_FACE_W]` times `sd`) and the barrier (`across` range `[s.halfWidth + SIDEWALK_WIDTH - 0.2, s.halfWidth + SIDEWALK_WIDTH]` times `sd`). Build each box as `{ box: { minX, maxX, minZ, maxZ } }` with the correct axis mapping: along t and across ordered with `Math.min`/`Math.max`. Push into `obstacles` from `src/core/world.js`.
      - When `ROAD_EDGE_COLLISION` is false, push nothing.
      In `src/main.js`, add `addRoadEdges` to the import from `./world/environment.js` (line 3), and call `addRoadEdges(scene, lots);` directly after `buildTown` (line 56).
      Files: `src/world/environment.js`, `src/main.js`
      Verify: parse check on both `.mjs` copies exits 0. Also check: with `ROAD_EDGE_COLLISION = false`, the `obstacles` array length is unchanged by this item (confirmed by reading that no push happens). A person checks visually that barriers appear only beside grass.

- [ ] 9. Update the README file list in `README.md`.
      Change the `src/world/environment.js` line (under `## Files`) to: "ground, roads, sidewalks with raised curbs, crossings, lane and parking markings, arrows, manhole covers, storm drains, street name signs, and roadside barriers". Add a note to the `src/core/world.js` line: "and the `ROAD_EDGE_COLLISION` switch for curb and barrier collisions (default off)".
      Files: `README.md`
      Verify: `Select-String -Path README.md -Pattern ROAD_EDGE_COLLISION` returns one line.

- [ ] 10. Final parse check of every changed file.
      Copy each changed `.js` file to a `.mjs` copy in `$env:TEMP` and run `node --check`. The change is visual and no test suite exists, so the run is a parse check, not tests. Then list every changed file and its change in the final report, and state the collision switch location (`src/core/world.js`, `ROAD_EDGE_COLLISION`).
      Files: `src/world/environment.js`, `src/core/primitives.js`, `src/core/world.js`, `src/main.js`, `README.md`
      Verify: all four `.js` files pass `node --check` with exit 0.

---

## Digest

Build: none (no build step; Three.js loads from a CDN import map in `index.html`). Tests: none (no test files or framework). Parse check used for every item:

```
Copy-Item <file> "$env:TEMP\parsecheck\<name>.mjs" -Force; node --check "$env:TEMP\parsecheck\<name>.mjs"
```

Baseline (today): all four files pass `node --check`, exit 0.

- `src/core/primitives.js`
  - Blocks: `box(w, h, d, mat, x, y, z)` lines 4-9; `sphere(...)` lines 13-18. Add `addInstanced` and `matrixAt` after line 18.
  - Covered by: no test. Used by `town.js`, `distributor.js`, `main.js` `box`.
  - Verified: read whole file; parse check passes today.
- `src/core/world.js`
  - Blocks: constants line 3-8 (`SIDEWALK_WIDTH` line 8). Add `ROAD_EDGE_COLLISION` after line 8. `ZONES` line 27, `rectsOverlap` line 30, `obstacles` line 45, `rand`/`range` lines 36-41 (do not call from road code).
  - Covered by: no test.
  - Verified: read whole file; parse check passes today.
- `src/world/environment.js` (166 lines)
  - Blocks: constants lines 10-12 (`CROSSING_GAP` line 10, `SIDEWALK_HEIGHT` line 11, `ROAD_PATCH_HEIGHT` line 12); materials lines 14-16; `buildEnvironment(scene)` lines 19-34; `addSidewalkCorners` 37-49; `addCornerPiece` 52-64; `cornerGeometry` 66-81; `notchGeometry` 83-93; `extrudeFlat` 95-100; `crossingOffsets` 102-104; `addStreetSurface` 106-116; `addStreetDashes` 118-130 (uses `CROSSING_GAP`); `addSidewalks` 132-142; `freeRanges` 144-153; `addSidewalkPiece` 155-166.
  - Covered by: no test. Visual checks listed per item.
  - Verified: read whole file; imports `WORLD_SIZE, WORLD_LIMIT, HALF_WORLD, SIDEWALK_WIDTH, STREETS` from `core/world.js`. Parse check passes today.
- `src/main.js`
  - Blocks: import line 3 (`buildEnvironment` from `./world/environment.js`); world build lines 54-58 (`buildEnvironment` line 55, `buildTown` line 56, `addTrees` 57, `addBushes` 58). Add `addRoadEdges(scene, lots)` after line 56.
  - Covered by: no test.
  - Verified: read whole file; parse check passes today.
- `README.md`
  - Blocks: `## Files` list; the `environment.js` line and the `world.js` line.
  - Verified: read whole file.
