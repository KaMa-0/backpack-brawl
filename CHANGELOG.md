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

## B3 — Status effects

- Added **poison** and **heal** effects to items and to the battle simulation (`src/battle.ts`).
  - Poison adds stacks to the enemy. Every 2 ticks (1 s) a poisoned fighter loses 1 HP per stack. Poison ignores block, and stacks add up and never decay during a battle.
  - Heal restores the owner's HP, never above max HP. A knocked-out fighter can't be healed.
  - Order within a tick: items fire (player first, then opponent; per item damage → poison → block → heal), then poison deals damage, then knockouts are checked. Everything is deterministic.
- Added rare **poisoned weapons**: Poisoned Dagger, Poisoned Bow, Poisoned Cleaver and Poisoned Spiked Shield. Same stats as the normal weapon plus ☠️ 2 poison, 2 🪙 more expensive. In the shop, each weapon offer turns into its poisoned version with a 25% chance, using the seeded RNG.
- Added three **heal items**: 🌿 Healing Herb (2 🪙, every 2 s, +2), 💕 Love Charm (3 🪙, every 2.5 s, +3) and 🧪 Health Potion (5 🪙, every 4 s, +7).
- Later opponents now use heal and poisoned items (Rusted Knight, Pit Gladiator, Ash Golem, Hollow King).
- Battle view shows a poison counter per fighter, and the combat log shows poison applied, poison damage and heals in their own colours. The rules panel and tooltips explain both effects; all texts are built from the same constants as the simulation.
- Rare poisoned items have a green border and a "Rare poisoned version" badge in the shop and the backpack.
- Added Vitest tests for poison timing, block bypass, no decay, heal cap, no revive, determinism, catalog requirements and shop variant rolls.

## B4 — Item sets

- Added a data-driven set system in `src/sets.ts`. A set's bonus is active while a fighter has **2 or more different** items of that set. Two copies of the same item count once, and a poisoned weapon counts as its normal version.
- **🔥 Fire set:** 🔥 Torch (3 🪙, every 2 s, 2 dmg), 🧨 Firecracker (4 🪙, every 3 s, 4 dmg) and 🌋 Magma Hammer (6 🪙, every 4 s, 10 dmg). Bonus: every Fire item also adds 3 Burn to the enemy.
- **🛡️ Guardian set:** Oak Buckler, Pot Lid and Spiked Shield. Bonus: every Guardian item grants +2 extra block.
- Added the **Burn** status. Every tick (0.5 s) a burning fighter takes 1 damage per stack. Block absorbs burn damage first, and afterwards the burn loses 1 stack until it wears off. Compared with poison, burn stacks faster (3 vs 2 stacks per hit) and deals more damage per stack (every 0.5 s instead of every 1 s), but block stops it and it decays.
- Order within a tick: items fire (damage → poison → burn → block → heal), then poison, then burn, then knockouts are checked.
- Set bonuses are applied in `buildFighter`, so they work the same way for the player and for opponents. Tollgate Ogre (Guardian), Pit Gladiator (Fire), Ash Golem (Fire + Guardian) and Hollow King (Guardian) now use sets.
- Set badges are shown on items in the shop, the backpack and the battle view. The backpack shows the progress of every set (e.g. "🔥 Fire 1/3"), and the battle view shows each fighter's active bonuses, a burn counter and burn events in the combat log.
- The rules panel has a new "Item sets" section, and burn is explained in the battle rules and tooltips. All texts are built from the same constants as the simulation.
- Added Vitest tests for set definitions, distinct counting, bonuses for player and opponents, and burn timing, decay, block absorption and the comparison with poison.
