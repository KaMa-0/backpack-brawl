## B1 — Shop economy

- Added guarded selling and reroll rules in the run module. Backpack items sell for half their catalog price, rounded down, and rerolls cost exactly 1 Gold.
- Buying now also checks for a free backpack slot, so no action can remove gold or alter the offer/backpack without completing fully.
- Added sell controls to backpack slots and a reroll control to the shop. Disabled controls show why an action is unavailable, and shop actions remain protected by the existing shopping-phase guard.
- Added sell/reroll values to the in-game rules panel.
- Added six Vitest tests covering buys, duplicate prevention, full backpacks, insufficient gold, selling, rerolling, and the shopping-phase rule.
- Design decision: kept all economy mutations in pure run-rule functions, with the UI only invoking them through `updateRun`, to keep validation identical across interface and action paths.

## B2 — Backpack arrangement

- Added pure `moveBlocker` and `moveItem` run rules. Moves are guarded against invalid indexes, empty source slots, and moving a slot onto itself.
- Moving to an empty slot preserves the item instance; moving onto an occupied slot swaps both item instances without duplication or loss.
- Updated the backpack UI with visible selection, highlighted valid destinations, Cancel control, empty-slot targets, and occupied-slot swaps.
- Movement uses the existing shopping-phase guard, so it cannot occur during search or battle.
- Added and documented the arrangement rules in the shop's rules panel.
- Added three Vitest tests covering empty-slot moves, occupied-slot swaps, and invalid move attempts.
