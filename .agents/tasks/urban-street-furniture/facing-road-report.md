# Vending machine and newspaper stand placements facing the road

Decision from the user: KEEP THE FRONT FACES. Front panels stay on the road side.

Result from the harness copy of the real town (125 lots, roadside barriers present, `ROADSIDE_BARRIER_COLLISION` on):

- Total vending machines and newspaper stands: 70 (30 vending, 40 newspaper).
- Facing the road: 70 of 70. Every front panel points at the road by construction.
- Next to a road barrier: 70 of 70. Barrier strips cover each footprint's along-street range, plus 0.5 m on each end.

So the rule "faces the road where next to a barrier" covers every placement. No placement faces the road without a barrier beside it.

Columns: index is the position in the layout output, x and z are the object center in meters, street is the index in `STREETS`, side is -1 or +1 (`sd`).

| type | index | x | z | street | side | faces road | barrier beside |
|---|---|---|---|---|---|---|---|
| newspaperStand | 342 | -343.1 | -155.2 | 1 | 1 | yes | yes |
| newspaperStand | 343 | 274.1 | 155.3 | 7 | -1 | yes | yes |
| newspaperStand | 344 | 84.7 | -46.8 | 6 | 1 | yes | yes |
| newspaperStand | 345 | 164.8 | 149.5 | 8 | 1 | yes | yes |
| newspaperStand | 346 | 256.3 | 164.8 | 7 | 1 | yes | yes |
| newspaperStand | 347 | 389.0 | 84.8 | 5 | 1 | yes | yes |
| newspaperStand | 348 | 6.9 | -65.0 | 0 | 1 | yes | yes |
| newspaperStand | 349 | -175.3 | -84.8 | 3 | -1 | yes | yes |
| newspaperStand | 350 | -6.9 | -301.7 | 0 | -1 | yes | yes |
| newspaperStand | 351 | -6.7 | -89.7 | 0 | -1 | yes | yes |
| newspaperStand | 352 | 164.9 | -102.4 | 8 | 1 | yes | yes |
| newspaperStand | 353 | -75.1 | -273.8 | 4 | 1 | yes | yes |
| newspaperStand | 354 | -114.7 | -164.9 | 1 | -1 | yes | yes |
| newspaperStand | 355 | 75.2 | -344.3 | 6 | -1 | yes | yes |
| newspaperStand | 356 | 84.8 | 180.2 | 6 | 1 | yes | yes |
| newspaperStand | 357 | 155.1 | -203.9 | 8 | -1 | yes | yes |
| newspaperStand | 358 | -189.8 | 164.8 | 7 | 1 | yes | yes |
| newspaperStand | 359 | -84.7 | -327.8 | 4 | -1 | yes | yes |
| newspaperStand | 360 | -155.2 | 335.1 | 2 | 1 | yes | yes |
| newspaperStand | 361 | 254.4 | 84.8 | 5 | 1 | yes | yes |
| newspaperStand | 362 | -6.8 | 228.1 | 0 | -1 | yes | yes |
| newspaperStand | 363 | 6.8 | 244.2 | 0 | 1 | yes | yes |
| newspaperStand | 364 | -95.9 | 155.2 | 7 | -1 | yes | yes |
| newspaperStand | 365 | 84.7 | -340.9 | 6 | 1 | yes | yes |
| newspaperStand | 366 | -164.8 | -220.0 | 2 | -1 | yes | yes |
| newspaperStand | 367 | 164.8 | 338.6 | 8 | 1 | yes | yes |
| newspaperStand | 368 | 327.6 | -84.8 | 3 | -1 | yes | yes |
| newspaperStand | 369 | 336.3 | 164.7 | 7 | 1 | yes | yes |
| newspaperStand | 370 | 84.9 | -133.7 | 6 | 1 | yes | yes |
| newspaperStand | 371 | -75.3 | 6.9 | 4 | 1 | yes | yes |
| newspaperStand | 372 | -164.7 | 365.8 | 2 | -1 | yes | yes |
| newspaperStand | 373 | 357.2 | 155.1 | 7 | -1 | yes | yes |
| newspaperStand | 374 | -339.6 | 75.2 | 5 | -1 | yes | yes |
| newspaperStand | 375 | 92.0 | -75.2 | 3 | 1 | yes | yes |
| newspaperStand | 376 | 75.2 | -54.7 | 6 | -1 | yes | yes |
| newspaperStand | 377 | -155.3 | 70.3 | 2 | 1 | yes | yes |
| newspaperStand | 378 | 75.3 | 98.7 | 6 | -1 | yes | yes |
| newspaperStand | 379 | 70.2 | 84.7 | 5 | 1 | yes | yes |
| newspaperStand | 380 | -164.9 | -147.7 | 2 | -1 | yes | yes |
| newspaperStand | 381 | 56.3 | 155.2 | 7 | -1 | yes | yes |
| vendingMachine | 382 | -7.1 | -295.2 | 0 | -1 | yes | yes |
| vendingMachine | 383 | -52.3 | -75.0 | 3 | 1 | yes | yes |
| vendingMachine | 384 | 114.5 | -165.1 | 1 | -1 | yes | yes |
| vendingMachine | 385 | 85.1 | -43.3 | 6 | 1 | yes | yes |
| vendingMachine | 386 | 204.2 | -75.0 | 3 | 1 | yes | yes |
| vendingMachine | 387 | -164.9 | 181.1 | 2 | -1 | yes | yes |
| vendingMachine | 388 | 75.1 | 103.4 | 6 | -1 | yes | yes |
| vendingMachine | 389 | -74.9 | -29.9 | 4 | 1 | yes | yes |
| vendingMachine | 390 | 165.1 | 143.1 | 8 | 1 | yes | yes |
| vendingMachine | 391 | -165.1 | 352.7 | 2 | -1 | yes | yes |
| vendingMachine | 392 | -165.0 | -320.4 | 2 | -1 | yes | yes |
| vendingMachine | 393 | -75.0 | -233.8 | 4 | 1 | yes | yes |
| vendingMachine | 394 | -165.0 | -124.6 | 2 | -1 | yes | yes |
| vendingMachine | 395 | 205.9 | -165.0 | 1 | -1 | yes | yes |
| vendingMachine | 396 | 7.1 | 225.0 | 0 | 1 | yes | yes |
| vendingMachine | 397 | -74.9 | -359.9 | 4 | 1 | yes | yes |
| vendingMachine | 398 | 164.9 | -122.7 | 8 | 1 | yes | yes |
| vendingMachine | 399 | -84.9 | 383.3 | 4 | -1 | yes | yes |
| vendingMachine | 400 | 285.9 | 154.9 | 7 | -1 | yes | yes |
| vendingMachine | 401 | -63.4 | -84.9 | 3 | -1 | yes | yes |
| vendingMachine | 402 | 85.0 | 178.9 | 6 | 1 | yes | yes |
| vendingMachine | 403 | 232.8 | 165.1 | 7 | 1 | yes | yes |
| vendingMachine | 404 | -250.8 | -165.1 | 1 | -1 | yes | yes |
| vendingMachine | 405 | 7.1 | -31.5 | 0 | 1 | yes | yes |
| vendingMachine | 406 | 75.1 | 208.6 | 6 | -1 | yes | yes |
| vendingMachine | 407 | -7.1 | 259.2 | 0 | -1 | yes | yes |
| vendingMachine | 408 | 96.3 | 74.9 | 5 | -1 | yes | yes |
| vendingMachine | 409 | 304.3 | -165.1 | 1 | -1 | yes | yes |
| vendingMachine | 410 | -235.8 | 85.1 | 5 | 1 | yes | yes |
| vendingMachine | 411 | -7.0 | 128.9 | 0 | -1 | yes | yes |
