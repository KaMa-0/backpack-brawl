## B1 — Shop economy

- Added guarded selling and reroll rules in the run module. Backpack items sell for half their catalog price, rounded down, and rerolls cost exactly 1 Gold.
- Buying now also checks for a free backpack slot, so no action can remove gold or alter the offer/backpack without completing fully.
- Added sell controls to backpack slots and a reroll control to the shop. Disabled controls show why an action is unavailable, and shop actions remain protected by the existing shopping-phase guard.
- Added sell/reroll values to the in-game rules panel.
- Added six Vitest tests covering buys, duplicate prevention, full backpacks, insufficient gold, selling, rerolling, and the shopping-phase rule.
- Design decision: kept all economy mutations in pure run-rule functions, with the UI only invoking them through `updateRun`, to keep validation identical across interface and action paths.
