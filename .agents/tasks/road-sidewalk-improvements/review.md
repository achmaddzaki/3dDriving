# Review: Road and Sidewalk Improvements

Verdict: APPROVED (no blockers)

## Evidence

Scope read: `plan.md`, `git status` and `git diff` for `src/core/primitives.js`, `src/core/world.js`, `src/world/environment.js`, `src/main.js`, `README.md`, and the coder's record. Recorded parse checks (exit 0 for the four `.js` files) were accepted, not rerun. No test suite exists, and this is not a major update.

Feature check against the nine requested items, all in `src/world/environment.js`:
- Raised sidewalks and curb faces: `SIDEWALK_HEIGHT` 0.15, `addCurbFaces`.
- Pedestrian crossings and stop lines: `addCrossings`, `zebraMatrices`, `stopLineMatrices`. Zebra stripes run along the crossing road and are spaced across it. Stop lines sit on the approach side of each lane.
- Intersection markings: same as above, 20 junctions.
- Lane markings and arrows: `addLaneMarkings`, `arrowMatrices`. Arrows are at least 8 m from crossing centers, so they do not meet stop lines.
- Parking: main road only, `parkingWidth`. Approved trade-off.
- Manhole covers and storm drains: `addManholes`, `addStormDrains`.
- Roadside barriers: `addRoadEdges`, `barrierRanges`. Lot frontages are cut with `rectsOverlap` against a band 0.5 m past the sidewalk. Lots start at `halfWidth + SIDEWALK_WIDTH` (`town.js` `lotRect`), so the band always overlaps the frontage.
- Street name signs: `addStreetSigns`, placeholder names as planned.

Collision switch: `ROAD_EDGE_COLLISION = false` in `src/core/world.js`, read by `environment.js`. With the switch off, `addRoadEdges` pushes no obstacles. `addRoadEdges` calls no `rand()`, so the seeded town layout is unchanged.

Existing behavior: sidewalk ranges, dash gaps and the `main.js` call order keep their previous logic. `crossingOffsets` and `CROSSING_GAP` have no remaining references (grep).

Checked and held: arrow and manhole grid parity for negative `k`, `subtractRanges`, `onStreet` axis mapping, arrow tip direction after `rotateX`, `matrixAt` yaw convention, and absolute coordinates for every mark.

## Non-blocking notes (not findings)
- Corner blocks (`addCornerPiece`) have no dark curb face on their rounded edges. Their top height matches the straight sidewalks.
- With the switch on, corner blocks stay drivable, as the plan decided. The coder's report did not mention this gap. It is reported here.
- The `curbMat` constant is light grey (0xc8c8c8), but the comment above `addCurbFaces` says "Dark curb face". The plan prose also says dark. The user should choose the color.
- Sign plates are 40 separate meshes with per-name textures, not instanced. The plan chose this.
- Blank-line removals in untouched functions of `environment.js` add diff noise. No behavior changes.
- `.kiro/steering/backend-code-review.md` does not exist, so it could not be read. The coding rules were applied from the personal steering.
- Visual checks by a person are still pending. They are a user action.
- Staged files `facade.js`, `town.js`, and `.agents/tasks/facade-details/` belong to another task. They are not part of this change.
