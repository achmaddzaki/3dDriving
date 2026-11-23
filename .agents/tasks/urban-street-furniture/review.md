# Urban street furniture and downward-facing traffic light heads

This change places 542 static objects of ten kinds on the city sidewalks and turns the four junction signal heads to face down. Placement runs on a private seeded generator in `furniture-layout.js`, and the meshes are built in `street-furniture.js` as instanced parts. The collision switch `STREET_FURNITURE_COLLISION` is `false`. The head turn reverses the red and green lens order on every light, which the task did not ask for.

Watch for: the red and green lenses are swapped on all four heads, so the lens row reads in reverse (likely).

**Verdict**: NEEDS_CHANGES

## High-level view

Placement and meshes live in two new modules. `furniture-layout.js` picks positions against road, crossing, lot, fixture, and spacing rules, and `street-furniture.js` builds each kind as instanced parts.

The signal heads now lie flat with their lenses on the underside. One hanger per light joins each head to its arm. The lens order along each head is the one place where this change goes beyond the requested rotation.

<details>
<summary>Issues (1)</summary>

1. **Signal lens order reversed** — red sits at the minus end of each head and green at the plus end, which mirrors a plain rotation of the original head (red on top). Set red to +0.3 and green to -0.3 in the lens loop of `addTrafficLights` (environment.js line 433).

</details>

## Details

### Signal head turn and lens order

`headMatrix` turns each head 90 degrees about X and then to its approach. That turn maps the old top of the head to the horizontal direction along the approach, so the old top lens (red) should land at +0.3 along that direction. The lens loop at environment.js line 433 places red at -0.3 and green at +0.3, so the row runs in reverse. The plan gives the same -0.3 value without a reason, and neither the plan nor the feature notes explain the change. (likely: worked out by hand from the rotation, not checked by rendering.)

### Test coverage

Not tested: head orientation and furniture placement in a browser. Both feature files list a person's browser check as pending, and the harness stubs three.js, so it cannot show head orientation or part alignment.

## Files

<details>
<summary>File map</summary>

- `src/world/furniture-layout.js` (new): placement rules and seeded layout for the ten kinds.
- `src/world/street-furniture.js` (new): part tables, instanced meshes, and the collision switch hook.
- `src/world/environment.js`: turned signal heads, relocated lenses, one hanger per light, and recorded lamp and signal pole positions.
- `src/core/world.js`: `SIDEWALK_HEIGHT` export, `STREET_FURNITURE_COLLISION = false`, `sidewalkFixtures`.
- `src/core/primitives.js`: optional per-instance colors on `addInstanced`.
- `src/main.js`: call to `addStreetFurniture` after `addRoadEdges`.
- `README.md`: file list and switch note.

The full change is in `git diff` for these files, plus the untracked new modules.

</details>
