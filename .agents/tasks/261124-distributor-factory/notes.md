# Distributor lot: larger factory compound

Status: implemented and checked. Working tree was clean on `master` at start (HEAD bb7d061). Nothing committed, no branch changes.

## Goal

Make the distributor lot larger and turn its buildings into a detailed factory compound: production hall with sawtooth roof, office block, silos, chimneys, loading docks, containers, fence and gate, yard markings, floodlights.

## Files

- `src/world/building/town.js`: change `DISTRIBUTOR` to `{ t: -50, lotAlong: 100, lotDepth: 60 }`.
- `src/world/building/distributor.js`: rewrite layout. Keep export `buildDistributor(scene, lot, spotCount)` and its return value `spots` (`{ x, z, heading: Math.PI / 2 }`, one per vehicle).
- `src/world/building/factory-parts.js` (new): reusable builders (batch helper, sign label, chain-link fence run, sawtooth hall, silo, chimney, container, forklift, pallet stack, floodlight).
- `README.md`: update the `distributor.js` entry and add `factory-parts.js`.
- Do not edit `facade.js` (shared by all town buildings). Reuse `addFacades` and `addRoofTrim` for the office.

## Constraints

- No `rand()` in distributor code. It shares the seeded sequence used by the rest of the town. Use fixed numbers.
- Every solid part pushes to `obstacles` (box or circle). Spot positions and the paths from gate to spots must stay free.
- Batch repeated small parts with `addInstanced` (per-instance colors). Big solids use `box()` so they cast shadows.
- Personal rules: short `<summary>` docs, one-line inline comments, early returns, no tests unless a major change needs one.

## Coordinates

Lot with the new size: x from -68.5 to -8.5, z from -50 to 50. Road-side edge is `lot.maxX` (x = -8.5), main road at x = 0.
Local frame: `u` = depth from road edge, `x = lot.maxX - u`. `v` = along the lot, `z = lot.minZ + v`.
Zones checked: side street at x = -80 (zone x -86.5..-73.5) and cross streets at z = ±80 (zone z 73.5..86.5). The new lot does not overlap them.

## Layout (u, v)

- Concrete yard over the whole lot (y about 0.035). Asphalt slab in town.js stays underneath.
- Fence inset 0.4 m. Road side has a 16 m gate gap at v 42..58, with two gate pillars and an arch sign with the existing label "PT. Simple Mandiri".
- Spots: 6 spots at u = 16, z = -15..15 step 6 (centered on lot). White bay lines at v = 32, 38, ..., 68.
- Office: u 3..15, v 4..26, 4 floors (14 m), via `addFacades` and `addRoofTrim`, entrance canopy on road wall.
- Production hall: u 30..54, v 12..88. Walls 9 m. Sawtooth roof: 4 teeth, run 6 m, rise 4 m (peak 13 m), glass on road-facing side. Dock doors on road wall at v = 26, 36, 46, 54, 64, 74 with canopies, bay numbers, yellow keep-clear strips. Company label above the docks.
- Silos: centers u = 35, 44.5, 54 at v = 6, radius 3.1, height 13, dome cone, pipes to hall wall.
- Chimneys: (u 36, v 94) height 26 with smoke, (u 48, v 94) height 18. Red bands.
- Containers: u 55.2..57.6, v from 14 in 4 units (6.06 m long), 2 stacked.
- Drums: 4 at u 56.4..57.6, v 90.5..91.7.
- Forklift near (u 22, v 20). Pallet stacks near u 22..26, v 80..87.
- Floodlight poles: (u 20, v 3), (u 20, v 97), (u 58.3, v 50), (u 58.3, v 76).
- Trees via `addTree` with `TREE_MODELS` (no rand): Fir at (u 26, v 2.5), Oak at (u 26, v 97.5).

## Verification plan

1. Syntax check of the changed modules (no tests).
2. One headless screenshot of the scene at start, since the start position is the distributor. Only if a local browser is available.

## Progress log

- [x] town.js DISTRIBUTOR constant (`{ t: -50, lotAlong: 100, lotDepth: 60 }`)
- [x] factory-parts.js written
- [x] distributor.js rewritten (same export, same return shape)
- [x] README.md entries
- [x] node --check on all three changed modules, and named imports checked against exports
- [x] runtime check: two headless Edge renders (overview and gate close-up), built with the same order as `main.js`. No page errors. Screenshots: `%TEMP%\driving-overview.png`, `%TEMP%\driving-gate.png`. The temp harness was removed.
- [x] spot check: console output gave x -24.5, z -15..15 step 6, heading PI/2. The bay area and gate path have no obstacles by construction.
- [ ] in-game driving through the gate and into the spots is not tested.

## Side effects

- The larger lot rejects random lots that overlap it. The town uses one seeded random sequence, so random lots and trees placed after that point land in different places. The layout is still fixed on every load.
- The 38 m office tower is gone. The new office is four floors (14 m). The tallest parts are the 26 m chimney and the sawtooth hall.
- Chimney smoke is three static puffs. Up close they read as spheres.

## Status

Done in the working tree on `master`. Nothing committed.
