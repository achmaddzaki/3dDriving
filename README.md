# Simple 3D Driving

A small driving sandbox in the browser. You drive a red car around a straight road with cones, trees and buildings.

## Library

[Three.js](https://threejs.org/) (v0.160.0, loaded from unpkg CDN). It is the most widely used WebGL library, has good docs, and needs no build step.

## Run

Browsers block ES module scripts opened with `file://`, so serve the folder over HTTP. From this folder, use either:

```
npx serve .
```

or

```
python -m http.server 8000
```

Then open the printed URL (for example `http://localhost:8000`).

## Controls

| Key | Action |
| --- | --- |
| W / Up | Accelerate |
| S / Down | Brake, then reverse |
| A / Left, D / Right | Steer |
| Space | Handbrake |
| R | Reset car to its parking spot at the distributor |
| Esc or Menu button | Open or close the vehicle menu (driving pauses while open) |

## Vehicles

Pick one from the menu. Each has its own model, speed, acceleration, steering, and turning behavior:

- **Motorbike + Small Cargo**, **Motorbike + Side Cargo**, **Motorbike + Big Cargo**: fastest and most nimble, one cargo layout each
- **Pickup Car**: balanced, the default-style car
- **Box Car**: tall box truck, slow to accelerate and turn
- **Container Car**: long truck with a container trailer, slowest to turn

## Files

- `index.html` - page layout, HUD, import map for Three.js
- `src/main.js` - renderer, car physics, collisions, chase camera, menu, game loop
- `src/core/world.js` - shared world size, street layout (every road ends on a ring road around the town), collision obstacles, random helpers, and the `ROAD_EDGE_COLLISION` switch for curb and barrier collisions (default off) and the `STREET_FURNITURE_COLLISION` switch for furniture collisions (default off)
- `src/core/primitives.js` - box and sphere mesh helpers
- `src/core/distance-cull.js` - hides static world objects beyond `RENDER_DISTANCE` (set in `main.js`) from the camera
- `src/vehicles/vehicle.js` - vehicle definitions and models (motorbikes, pickup, box car, container car)
- `src/game/marker.js` - yellow arrow above the next mission target
- `src/game/mission.js` - user types and their missions: salesman (15 stores, then the distributor), canvasser (invoice from stock), driver (drop ordered products), collector (collect debts)
- `src/game/inventory.js` - random stock a user carries, deliveries planning, and shared random helpers
- `src/game/npc-traffic.js` - optional NPC cars (off by default, switched on in the menu). They drive on the right lane, turn left or right at junctions, stop for cars ahead or for the player, and speak in a bubble when the player bumps them or waits in front for 2 seconds
- `src/game/mobile-app.js` - mobile app preview on the right edge: nearby customers, check-in and check-out, and the create order screen. Slides out in a store lot, hides again when the car leaves
- `src/data/products.js` - dummy product catalog (name and price in Rp) and the unit names used on order lines
- `src/data/customers.js` - dummy owner, address and phone for each store's customer detail page
- `src/game/orders.js` - per-store order totals, kept for the session, and Rp formatting
- `src/world/environment.js` - ground, roads, sidewalks with raised curbs, crossings, lane and parking markings, arrows, manhole covers, storm drains, street name signs, and roadside barriers
- `src/world/building/town.js` - parking lot layout and placement, including park, seating area, and garden plot lots
- `src/world/building/public-space.js` - contents of public lots: seating areas (at the sidewalk edge), garden plots, and pocket parks (paths, round bed, corner features, fence or hedge border)
- `src/world/building/lot-decor.js` - parking spaces with white lines, 0 to 2 parked cars and 0 to 2 motorbikes in the spaces, and 2 to 5 bins, planters, cones, bollards, crate stacks, or flower beds beside or behind each building, all with collision
- `src/world/building/models.js` - building and park models with category weights
- `src/world/building/facade.js` - windows, doors, roof trim, and store signs
- `src/world/building/park.js` - park contents (fountain, benches, corner flower beds, planters)
- `src/world/building/distributor.js` - distributor factory yard (fenced, 100 x 60 m lot): gate, four-floor office, sawtooth production hall with loading docks, silos, chimneys, containers, floodlights, and vehicle parking spots
- `src/world/building/factory-parts.js` - factory builders for the distributor: batched boxes and cylinders, sign labels, chain-link fence runs, sawtooth hall, silos, chimneys, containers, forklift, pallet stacks, drums, and floodlights
- `src/world/building/logo.js` - red Simplidots logo extruded into 3D from `src/img/logo_simpli_red.svg`, on a concrete plinth with a spotlight in the distributor yard
- `src/world/furniture-layout.js` - placement rules for street furniture (seeded, no `rand()`)
- `src/world/street-furniture.js` - street furniture meshes: lamps, benches, trash bins, bus shelters, mailboxes, newspaper stands, vending machines, electrical boxes, fire hydrants, and advertising boards
- `src/world/tree.js` - ten tree models (adds Cherry Blossom, Cypress, Willow, Topiary) and tree placement
- `src/world/landscaping.js` - ponds scattered by the roadside (own seeded generator)
- `src/world/landscape-parts.js` - builders for flower beds, hedges, fences, planters, and seating areas
- `src/world/bush.js` - five bush decoration models and placement
- `src/world/grass.js` - grass tufts scattered over open ground, away from roads, lots, and landscaped areas
