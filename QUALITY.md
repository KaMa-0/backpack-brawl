# Quality Goals and Team Decisions

> **Status: final (all requirements B1–B7 implemented).** This document records the qualitative (non-functional) goals of our Backpack Brawl solution, why we chose them, the engineering decisions and trade-offs that support them, and how we check that we meet them. Section 6 records the results of our checks.

## 1. Context: how we expect the application to be used

- **One player, one browser tab, short sessions.** A run takes a few minutes. Players reload, close the tab, and come back later (B6).
- **Everything runs locally.** The game logic runs in the browser. A small Express API provides opponents and the hall of fame and keeps its data in memory.
- **The network is unreliable by design.** The opponent API is deliberately slow, can fail on demand (`?fail=true`, `API_FAIL=true`), and can be delayed up to 5 s (`?latency=`).
- **Users will poke at edge cases.** Players (and examiners) will double-click, refresh mid-battle, edit `localStorage`, send odd API requests, and try to get an advantage through a refresh.
- **The feature set keeps growing.** B3 and B4 add new effects, sets and a new status (Burn) on top of the existing catalog and battle simulation.

These points drive the goals below.

## 2. Quality goals at a glance

| Priority | Goal | Short description | Main requirements it supports |
|---:|---|---|---|
| 1 | **Q1 Game-state integrity** | The run is always in a valid state. Gold, items and results are never lost, duplicated or applied twice. | B1, B2, B5, B6, B7 |
| 2 | **Q2 Determinism & fairness** | The same inputs always give the same outcome, and a refresh or a crafted request can't be used to gain an advantage. | B3, B4, B5, B6, B7 |
| 3 | **Q3 Resilience** | Slow or failing APIs and broken saved data never break the game. The player always lands in a usable screen with a clear message. | B5, B6, B7 |
| 4 | **Q4 Maintainability & extensibility** | New items, effects, statuses and sets can be added in a few predictable places, and the rules explained in the UI never drift from the code. | B3, B4 |

When goals conflict, a higher-priority goal wins. Example: if a saved run can't be validated, we discard it (Q1) rather than try to repair it (Q3). See section 4.

## 3. Goals in detail

Each goal lists *why it matters*, the *decisions* we made, the *trade-offs* we accepted, and concrete *quality scenarios* (stimulus → expected response → how we check it).

### Q1 — Game-state integrity

**Why it matters.** Most functional requirements are really integrity rules: gold never becomes negative, no item is lost or duplicated, an action either completes fully or changes nothing (B1), a battle result is applied exactly once (B5), and an impossible saved run must not be loaded (B6). A single bug here breaks a run in a way the player notices immediately.

**Decisions**

- **Pure rule functions.** All game rules live in React-free TypeScript modules (`run.ts`, `game.ts`, `battle.ts`, `shop.ts`). Each takes the current state and returns a new one, and returns the *same* object when an action is not allowed. "Nothing changed" is therefore easy to detect and to test.
- **One guard, two users.** Every action has a `*Blocker` function (`buyBlocker`, `sellBlocker`, `rerollBlocker`, `moveBlocker`, `fightBlocker`) that returns a reason string or `null`. The UI uses it to disable controls and show *why*, and the action function calls the same guard before changing anything. The rule can't differ between "what the UI shows" and "what the action allows".
- **Explicit phase state machine.** `shop → searching → battle → shop … → finished`. Shop and backpack actions go through `updateRun`, which rejects them outside the `shop` phase. `RequireRoute` makes the URL follow the phase, so no page can act in the wrong phase.
- **Item instances with unique ids.** Each bought item gets a `uid` from `nextUid`. Moves and swaps (B2) move the instances themselves, so duplicates and losses can be detected.
- **Result applied once.** `showFrame` applies the battle result only on the transition to the last frame. A search id (B5) and the saved battle (B6) make sure a late response or a reload can't apply it a second time (see Q2/Q3).
- **Functional state updates.** Every update is `update(current => transition(current))`, so async callbacks always work on the latest state and never on a stale copy captured earlier.

**Trade-offs**

- More boilerplate: every action needs a guard, a transition and a test, and every state change creates new objects. For a state this small the cost is negligible, and the code is easier to reason about.
- Logic is split between pure modules and React components. New team members must learn where each rule lives (see the README's *Project orientation*).

**Quality scenarios**

| Stimulus | Expected response | Evaluation |
|---|---|---|
| The player clicks *Buy* with too little gold or a full backpack | Button is disabled with a reason; calling `buyItem` directly returns the unchanged state | Unit tests in `run.test.ts` |
| The player sells, buys and moves items in any order | Gold ≥ 0, number of item instances = bought − sold, all `uid`s unique | Invariant test over 100 random runs (`invariants.test.ts`) |
| A shop action is triggered while searching or in battle | State does not change | Unit test in `run.test.ts` |
| The replay reaches the last frame, then *Skip* is pressed | Result is applied exactly once | Unit test in `game.test.ts` |

### Q2 — Determinism & fairness

**Why it matters.** The game is a strategy game: players must be able to trust that the outcome depends only on their decisions. B3 and B4 explicitly require deterministic values. B6 forbids using a refresh to get a free reroll, a different opponent, a second result or to avoid a loss. B7 requires the server to reject implausible runs.

**Decisions**

- **Seeded randomness.** Shop rolls use a seeded PRNG (`mulberry32`). The seed is part of `RunState`, so the same seed always produces the same offers, and saving the seed saves the "future" of the shop.
- **Simulate first, replay later.** `simulateBattle` computes the whole battle at once from the two fighters. The replay only *shows* precomputed frames, so animation timing, *Skip* or tab throttling can't change the outcome.
- **Fixed opponents per round (server).** The API returns the same opponent for the same round, so searching again never yields an easier opponent.
- **Deterministic status effects (B3/B4).** Poison, heal and Burn are processed at fixed tick intervals in a fixed order inside `simulateBattle` (items → poison → burn → knockout check), with no randomness. The values are constants (`POISON_INTERVAL`, `BURN_DECAY`, …), and the rules panel is generated from the same constants.
- **Refresh policy (B6).** The policy is shown to the player in the rules panel and, after a refresh that changed something, in a message at the top of the page (`RESTORE_NOTICES` in `save.ts`):
  - *Refresh during shopping:* the run continues with the same gold, backpack, offers and seed.
  - *Refresh during a search:* the search is cancelled and the player returns to the shop. Nothing is charged or rerolled, and the next search gets the same fixed opponent, so nothing is gained.
  - *Refresh during a replay:* the battle (opponent + precomputed result) is part of the saved state. After a reload the replay jumps to the end and the result is applied exactly once. A refresh can't avoid a loss or produce a second result.
- **Server-side plausibility checks (B7).** The API does not trust the client. A submitted run is checked against the game rules: wins 0–5, lives 0–3, and for a finished run `rounds = wins + (3 − lives)` (every round is exactly one battle), plus a victory requires 5 wins and a defeat requires 0 lives.

**Trade-offs**

- The game runs entirely in the browser, so a determined user can edit `localStorage` or call the API directly. **We accept that full cheat-proofing is out of scope.** It would require running the game on the server. Instead we make cheating *pointless through normal use* (refresh, double-click) and reject *implausible* data on the server.
- Jumping to the end of the replay after a reload costs the player the animation, but it keeps the result fair and simple.

**Quality scenarios**

| Stimulus | Expected response | Evaluation |
|---|---|---|
| Two runs start with the same seed and the same actions | Identical shops and identical battle results | Unit tests in `shop.test.ts` and `battle.test.ts` |
| The player refreshes during a replay they are losing | After reload the loss is applied once and the next screen matches the result | Unit tests in `save.test.ts` + manual test |
| The player loses in round 6 and refreshes | The loss stays (round 7, one life less) | Unit test in `save.test.ts` + invariant test |
| The player refreshes in the shop hoping for new offers | The same offers are shown | Unit test in `save.test.ts` + manual test |
| A client posts `{ wins: 5, lives: 3, rounds: 2 }` to the hall of fame | `400` with a clear error message, nothing stored | Unit test in `server/hallOfFame.test.js` |

### Q3 — Resilience

**Why it matters.** The opponent API is slow and fails on purpose, and saved data can be old, partial or edited by hand. B5 and B6 require that none of this breaks the game: the player always returns to a usable screen with an understandable message and can try again.

**Decisions**

- **Search id for every request (B5).** `startSearch` stores a new `searchId` (and the round) in the game state. `startBattle` and `searchFailed` take that id and ignore the response if the phase is not `searching` or the id/round does not match. Late, duplicate or out-of-order responses can't start a battle or overwrite a newer search.
- **Failure returns to the shop (B5).** On failure the phase goes back to `shop` with an error message and a *Try again* action. While searching, the *Find opponent* button is disabled, so a second search can't start.
- **Client-side timeout (B5, B7).** Opponent and hall of fame requests use an `AbortController` with an 8 s timeout, above the API's maximum latency of 5 s, so a hanging request ends in a clear error instead of an endless "searching" or "loading" state. Network and proxy errors are turned into messages the player understands.
- **Versioned, validated saves (B6).** The saved state has a `version` field. On load we parse it defensively, check its shape and the game invariants from Q1 (gold ≥ 0, lives and wins in range, a round that matches wins and lives, backpack size 6, known item ids, unique uids, phase-consistent data, and for a battle a result that equals a fresh simulation). Anything that fails is discarded and the player gets a new playable run with a short notice. A bad save can never crash the app.
- **Explicit loading, empty and error states (B7).** The hall of fame page shows all three. A failed submission keeps the entered name and can be retried. A client-generated run id makes the submission idempotent on the server, so a retry never creates a second entry; the result page also remembers a submitted run after a refresh.

**Trade-offs**

- **Discard instead of migrate.** When the save format changes we drop old saves instead of writing migrations. A player may lose an unfinished run after an update, but it is simple and safe (Q1 wins over Q3). For a game with short runs we think that is acceptable.
- The hall of fame lives in server memory, so entries are lost on restart. This is allowed by the requirements and avoids a database dependency.

**Quality scenarios**

| Stimulus | Expected response | Evaluation |
|---|---|---|
| The API returns 503 (`?fail=true`, `API_FAIL=true`) | Back to the shop within the request time, message shown, *Try again* works | Manual test + unit test on `searchFailed` |
| The player clicks *Find opponent* twice quickly | Only one search runs | Unit test on `startSearch` + manual test |
| A response from an old search arrives after a newer search started | It is ignored and no battle starts | Unit tests in `game.test.ts` + manual test |
| `localStorage` contains invalid JSON, an old version or `gold: -50` | Game starts a fresh playable run with a notice, no crash | Unit tests in `save.test.ts` |
| The hall-of-fame submission fails and the player retries | No retyping, and only one entry is stored | Unit tests in `server/hallOfFame.test.js` + manual test |
| The hall-of-fame API gets a body that is not JSON | `400` with a JSON `error`, no HTML page | Manual test with `curl` |

### Q4 — Maintainability & extensibility

**Why it matters.** B3 and B4 add poison, heal, Burn, sets and set bonuses on top of the existing items. If each new effect touches many files, bugs and inconsistencies between the simulation, the UI and the rules panel are likely. Every team member must also be able to explain and change any part of the code during the exam.

**Decisions**

- **Data-driven catalog.** Items are plain data in `items.ts` (price, cooldown, effects, set). Sets and their bonuses are data in `sets.ts` (name, icon, colour, bonus). Adding an item or a set means adding one entry.
- **One place for battle rules.** All effect processing (damage, block, poison, heal, Burn, set bonuses) stays inside `battle.ts`. The player and opponents are built the same way (`buildFighter`), so set bonuses apply to both automatically (B4).
- **Rules text generated from constants.** `rules.ts` builds the rules panel and tooltips from the same constants the simulation uses. If a value changes, the explanation changes with it, so the UI can't drift from the code.
- **Typing and tooling.** TypeScript with unused-code checks and ESLint. Phases, battle event kinds and set ids are union types, and lookup tables such as `EFFECT_HELP: Record<keyof ItemEffects, string>` make TypeScript demand an entry for every new effect.
- **No duplicated rules.** Values that appear in several places come from one function or constant (`sellPrice`, `REROLL_COST`, `withSetBonus`, `MAX_ROUNDS`), so the UI and the game can't disagree.
- **Tests next to the code.** Vitest tests as `*.test.ts` files next to the module they test.

**Trade-offs**

- A generic effect system is more work up front than hard-coding each effect, but B3 and B4 alone add at least three new behaviours, so we expect it to pay off quickly.
- We deliberately do **not** introduce a state-management library (Redux, Zustand) or a database. Plain React state with pure transitions is enough for this size and keeps the code easy to explain.

**Quality scenarios**

| Stimulus | Expected response | Evaluation |
|---|---|---|
| A developer adds a new item to an existing set | One catalog entry; it shows in shop, battle and tooltips without other changes | Code review checklist |
| A developer changes the poison tick interval | Simulation and rules panel both change by editing one constant | Code review + unit test |
| Any change is pushed | `pnpm lint`, `pnpm build` and `pnpm test` pass | Run before every merge (optionally a GitHub Actions workflow) |

## 4. Conflicts between goals

| Conflict | Our choice | Reason |
|---|---|---|
| Q1 integrity vs Q3 resilience: a saved run is slightly inconsistent | Discard it and start fresh | A "repaired" run could be impossible or exploitable |
| Q2 fairness vs player comfort: refresh during a replay | Skip to the end and apply the result | Prevents avoiding a loss. The animation is cosmetic |
| Q2 fairness vs simplicity: cheat protection | Plausibility checks only, no server-side game | A server-authoritative game is out of scope for a local exam project |
| Q4 extensibility vs effort | Generic effects and sets as data | B3/B4 add several effects. Hard-coding would cost more later |

## 5. Considered but not prioritised

- **Performance.** A battle has at most 60 ticks and 6 items per side, so the simulation is trivial. We check that the UI stays responsive, but we don't set a performance goal.
- **Security.** There is no authentication and no personal data apart from a display name. We only validate and length-limit input (B7) and render names as text, never as HTML.
- **Accessibility / usability.** We follow the requirement that every disabled action explains why, and we keep controls as real buttons, so the game can be played with the keyboard. A full accessibility audit is out of scope, so we did not make it a fifth goal.

## 6. How we evaluate the goals

| Goal | Automated checks | Manual checks |
|---|---|---|
| Q1 | Unit tests for every action and its guard, invariant tests over random action sequences | Clicking quickly, buying and selling to edge values |
| Q2 | Same seed → same shop and battle; save/restore tests; API validation tests | Refresh in every phase (shop, searching, replay, result) |
| Q3 | Tests for `searchFailed`, stale `searchId`, save loading with broken data | `?fail=true`, `?latency=5000`, `API_FAIL=true`, editing `localStorage` by hand |
| Q4 | `pnpm lint`, `pnpm build`, `pnpm test` all green | Review: how many files does adding an item / effect touch? |

### Results (final review)

| Check | Result |
|---|---|
| `npm test` | 64 tests in 9 files pass |
| `npm run build` (`tsc` + Vite) and `npm run lint` | No errors |
| Invariant test: 100 random runs, every step checked and saved/restored | Pass. It found one real bug during the final review: saves were refused from round 6 on, so a refresh could undo a loss. Fixed with `MAX_ROUNDS` (see `CHANGELOG.md`). |
| Manual: `?fail=true`, `?latency=5000`, API stopped, double click, new run during a search | Messages shown, shop usable, only one search, late answers ignored |
| Manual: refresh in shop, during a search, during a replay, on the result page | Behaves as the refresh policy in Q2 says, with a message where something changed |
| Manual: hall of fame with invalid JSON, names like "Jürgen", repeated submission | Clear JSON errors, names accepted, one entry per run |

## 7. Team decisions

All decisions that were open while we built the game, and what we chose:

- **Poison, heal and Burn values (B3/B4):** poison every 1 s, 1 HP per stack, ignores block, never decays; heal capped at max HP; Burn every 0.5 s, 1 damage per stack, block absorbs it, then 1 stack decays. All in `battle.ts` and shown in the rules panel.
- **Sets (B4):** Fire (Torch, Firecracker, Magma Hammer; bonus: +3 Burn per hit) and Guardian (Oak Buckler, Pot Lid, Spiked Shield; bonus: +2 block). Active with 2 different items of a set.
- **Refresh policy (B6):** as described in Q2.
- **What is saved (B6):** the whole `GameState` (run, phase, battle replay, search) in `localStorage`, with `version: 1`.
- **Hall of fame (B7):** victories first, then more wins, then fewer rounds, then earlier submission. Names 2–24 characters, letters of any language, digits, spaces, `-`, `_`, `'`.
- **Accessibility:** not a separate goal (see section 5).
