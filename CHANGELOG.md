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

## B5 — Resilient matchmaking

- Every opponent search gets a unique id, stored with its round in the new `GameState.search` (`src/game.ts`). `startBattle` and `searchFailed` only act on the search that is still running; slow, duplicate or late answers, and answers to older searches, change nothing. A battle can therefore never be restarted, started outside a search, or have its result applied twice.
- An answer for another round ends the search with an error instead of starting a battle.
- `fightBlocker` now blocks a second search while one is running (and any search outside the shop), and `startSearch` uses the same rule, so double clicks start only one search.
- A failed search now returns to a usable shop (`phase: "shop"`) with the message, and the player can try again. Before, the game stayed in `searching` with a disabled shop.
- `fetchOpponent` (`src/api.ts`) gives up after 8 s, turns network errors, proxy errors and timeouts into understandable messages, keeps the server's own error text, and validates the answer (shape, numbers, known item ids, at most 6 items) so an invalid opponent can't crash the battle.
- The page URL can pass `fail` and `latency` to the API (e.g. `http://localhost:5174/?fail=true`) to show failures and delays without restarting the server. Documented in `docs/API.md`.
- Added Vitest tests for the search rules (`src/game.test.ts`) and the API client (`src/api.test.ts`), including timeout, unreachable server, server error text and invalid answers.

## B6 — Save and resume

- The game state is saved in `localStorage` (`src/save.ts`, key `backpack-brawl.run`) after every change, inside an envelope with a `version` field. On start the app restores it and the URL follows the restored phase, so the player continues on the matching screen.
- Before saving and after loading, the state is checked: shape, numbers in range, known item ids, unique item ids, a round that matches wins and lives, and for a battle the stored result must equal a fresh simulation. Malformed, incompatible (other version) or impossible saves are discarded, and a new playable run starts.
- Refresh policy: a refresh during a **search** cancels it at no cost (gold, shop and backpack stay; the opponent per round is fixed anyway). A refresh during a **battle replay** skips to the end and applies the result once, because the result was decided when the battle started. A refresh can therefore not give a free reroll, a different opponent, a second result or avoid a loss.
- Added Vitest tests in `src/save.test.ts`.

## B7 — Hall of fame

- New endpoints `GET` and `POST /api/hall-of-fame` (`server/hallOfFame.js`), stored in memory and documented in `docs/API.md`.
- The server validates every run (field types and ranges, `rounds = wins + (3 − lives)`, finished runs only) and answers invalid data with 400 and a clear `error`.
- Every run gets a `runId` when it starts. A second submission of the same `runId` returns the stored entry instead of adding a new one, so a run is never stored twice.
- Ranking: victories first, then more wins, then fewer rounds, then earlier submission. Shown on the hall of fame page.
- The result page has a name field, a submit button and a retry button that keeps the name. The hall of fame page (`/hall-of-fame`, linked in the header) shows loading, empty and error states with a retry.
- Added Vitest tests in `server/hallOfFame.test.js`.

## Final review fixes

- **Save in rounds 6 and 7:** the save check allowed at most round 5, but a run can last 7 rounds. From round 6 on nothing was saved, so a refresh went back to round 5 and could undo a loss. The limit is now `MAX_ROUNDS = WINS_TO_VICTORY + START_LIVES − 1` (7). Added tests for round 6/7 and for a loss in round 6 followed by a refresh.
- **Refresh policy is shown to the player:** after a refresh that changed something (search cancelled, battle skipped to its end, save discarded) a dismissible message appears at the top of every page. The rules panel explains the policy. Before, the battle case was silent and the search message said "Try again." twice.
- **Hall of fame API:** a body that is not valid JSON now gets a JSON 400 error instead of Express's HTML page (which also showed server file paths). Names may use letters of any language (e.g. "Jürgen", "Sarıoğlu"). `POST` returns the entry with its rank.
- **Hall of fame client:** requests give up after 8 s and show understandable messages. The result page remembers a submitted run after a refresh and shows its name and rank; the hall of fame page highlights the player's own run.
- `docs/API.md` documents the hall of fame endpoints. `GameContext` no longer pretends the game can be `null`.
