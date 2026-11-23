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
| R | Reset car to start |
| Esc or Menu button | Open or close the vehicle menu (driving pauses while open) |

## Vehicles

Pick one from the menu. Each has its own model, speed, acceleration, steering, and turning behavior:

- **Motorbike**: fastest and most nimble
- **Pickup Car**: balanced, the default-style car
- **Box Car**: tall box truck, slow to accelerate and turn
- **Container Car**: long truck with a container trailer, slowest to turn

## Files

- `index.html` - page layout, HUD, import map for Three.js
- `main.js` - scene, car model, driving physics, collisions, chase camera
