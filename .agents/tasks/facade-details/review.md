# Architectural detail for building facades

This change adds six kinds of detail to the building generator in `src/world/building/facade.js`: off-white frames around windows and the street door, concrete balconies with metal railings on every other upper-floor window of the street wall, a wooden water tank and two AC units on flat roofs, a stepped concrete stair on the back wall of buildings with at least two floors, an amber roof sign with stone floor bands, and a separate material for each part type. Exported functions keep their signatures, so `town.js` and `distributor.js` need no edits. Parts are grouped by material and drawn as one instanced mesh per material per building, which follows the existing window instancing.

**Watch for:** the rooftop equipment is placed at flat-roof height, so on the gable-roofed Residence D and E models the AC units end up inside the roof (likely). Fixing that needs a `town.js` change, which the coder marked as an open decision. The back-wall stair also adds a driving collision footprint (confirmed) and its landing meets a blank wall (confirmed).

**Verdict**: APPROVED

## High-level view

Window and door frames stand 0.03 m proud of the glass, and balconies appear only on the street wall. The rooftop tank and AC units fit flat roofs but sink into gable roofs, which is the main open item. The back-wall stair is a stepped concrete block from ground level to a 3.5 m landing. It adds a driving footprint, and its landing meets a blank wall. Every building gets an amber roof sign and stone floor bands. Each part type has its own material constant, but all buildings share the same palette.

<details>
<summary>Issues (6)</summary>

1. **Gable roof clipping**: rooftop equipment is placed at flat-roof height, so on Residence D and E the AC units sit inside the gable roof. **DECISION NEEDED: PASS THE ROOF TYPE FROM town.js INTO addRoofTrim, OR SKIP ROOFTOP EQUIPMENT ON GABLE BUILDINGS.**
2. **Stair lands on a blank wall**: the landing at 3.5 m has no door, and the first-floor windows start at 4.35 m. Add a back-wall door at the landing, or accept the stair as decorative.
3. **Stair collision footprint**: the stair blocks cars, which changes driving. **DECISION NEEDED: KEEP THE obstacles.push IN addExteriorStair, OR MAKE THE STAIR VISUAL ONLY.**
4. **Stair proportions**: six steps over 3.5 m give 0.58 m risers with 0.3 m treads, so the stair reads as a steep block. Accept it as stylized, or revisit the proportions.
5. **Stair naming mismatch**: the `addFacades` comment says "fire stair" while the stair function describes a stepped concrete stair. Use one term.
6. **Frame contrast**: off-white frames on the cream Residence A walls (0xf5e6c8) may have low contrast (possible).

</details>

<details>
<summary>Details</summary>

### Materials and instancing

The previous code collected window transforms into one list and drew them as one instanced mesh. The new code collects every part into a `parts` object keyed by material and calls `addBoxes` once per key. Window transforms keep the old math. Every building uses the same frame color, so off-white frames on the cream Residence A walls (0xf5e6c8) may have low contrast (possible).

### Back-wall stair lands on a blank wall

The stair is six solid columns whose tops step down from a landing, from 3.5 m at the wall to 0.58 m at the outer edge. The landing sits 0.9 m out from the wall at 3.3 to 3.5 m. Upper-floor windows on the back wall start at a 4.35 m sill, and the only door is on the street wall. The stair therefore meets a solid wall with no opening at the landing (confirmed: the stair logic only removes ground-floor windows on that wall, and no door is placed there). The rise is about three times that of a real stair, where risers run 0.17 to 0.19 m (likely, judged from the numbers).

The collision footprint reaches 2.7 m from the wall. `makeSpec` in `town.js` reserves 3 to 6 m of lot behind each building, so the footprint stays inside its own lot (checked against the source).

### Rooftop equipment on gable roofs

`addRoofTrim` always adds the tank and AC units, and `town.js` adds a gable roof on top for Residence D and E. A gable rises by half its span, where the span is the shorter footprint side plus 0.6 m. For Residence D the shorter side is 8 to 10 m, so the roof surface is about 2.3 m above the trim at 2 m from the centerline. The AC units are 0.7 m tall, so they are fully hidden. The tank is 2.4 m tall and sits 1.6 to 2.5 m off the centerline, so most of its body is inside the roof and its top and outer edge break through the slope (likely, computed from the geometry, not rendered). Residence D and E make up about 20% of spawn weight (residential category weight 0.5 times two of five models). The coder marked the fix as an open decision that needs a `town.js` change.

</details>

## File map

<details>
<summary>Files changed</summary>

- `src/world/building/facade.js`: frames, balconies and railings, back-wall stair, roof sign, stone floor bands, rooftop tank and AC units, and per-part materials. Full diff: `git diff HEAD -- src/world/building/facade.js`.

</details>
