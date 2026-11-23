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
- `src/core/world.js` - shared world size, street layout, collision obstacles, random helpers, and the `ROAD_EDGE_COLLISION` switch for curb and barrier collisions (default off) and the `STREET_FURNITURE_COLLISION` switch for furniture collisions (default off)
- `src/core/primitives.js` - box and sphere mesh helpers
- `src/vehicles/vehicle.js` - vehicle definitions and models (motorbikes, pickup, box car, container car)
- `src/game/marker.js` - yellow arrow above the next mission target
- `src/game/mission.js` - user types and their missions (visit 15 stores, then return to the distributor)
- `src/world/environment.js` - ground, roads, sidewalks with raised curbs, crossings, lane and parking markings, arrows, manhole covers, storm drains, street name signs, and roadside barriers
- `src/world/building/town.js` - parking lot layout and placement
- `src/world/building/models.js` - building and park models with category weights
- `src/world/building/facade.js` - windows, doors, roof trim, and store signs
- `src/world/building/park.js` - park contents (fountain and benches)
- `src/world/building/distributor.js` - distributor lot: tower, warehouse, and vehicle parking spots
- `src/world/furniture-layout.js` - placement rules for street furniture (seeded, no `rand()`)
- `src/world/street-furniture.js` - street furniture meshes: lamps, benches, trash bins, bus shelters, mailboxes, newspaper stands, vending machines, electrical boxes, fire hydrants, and advertising boards
- `src/world/tree.js` - six tree models and tree placement
- `src/world/bush.js` - five bush decoration models and placement
