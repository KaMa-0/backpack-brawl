# Quality Goals and Team Decisions

> **Status: draft.** This document records the qualitative (non-functional) goals of our Backpack Brawl solution, why we chose them, the engineering decisions and trade-offs that support them, and how we check that we meet them.
> Items marked **In place** already exist in the code. Items marked **Planned** describe how we intend to build the remaining requirements (B3–B7). Points marked **Team decision** are still open and must be agreed on before the document is final.

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

- **Pure rule functions (In place).** All game rules live in React-free TypeScript modules (`run.ts`, `game.ts`, `battle.ts`, `shop.ts`). Each takes the current state and returns a new one, and returns the *same* object when an action is not allowed. "Nothing changed" is therefore easy to detect and to test.
- **One guard, two users (In place).** Every action has a `*Blocker` function (`buyBlocker`, `sellBlocker`, `rerollBlocker`, `moveBlocker`, `fightBlocker`) that returns a reason string or `null`. The UI uses it to disable controls and show *why*, and the action function calls the same guard before changing anything. The rule can't differ between "what the UI shows" and "what the action allows".
- **Explicit phase state machine (In place).** `shop → searching → battle → shop … → finished`. Shop and backpack actions go through `updateRun`, which rejects them outside the `shop` phase. `RequireRoute` makes the URL follow the phase, so no page can act in the wrong phase.
- **Item instances with unique ids (In place).** Each bought item gets a `uid` from `nextUid`. Moves and swaps (B2) move the instances themselves, so duplicates and losses can be detected.
- **Result applied once (In place / Planned).** `showFrame` applies the battle result only on the transition to the last frame. For B5 and B6 we will add a search id and persist the battle so a late response or a reload can't apply it a second time (see Q2/Q3).
- **Functional state updates (In place).** Every update is `update(current => transition(current))`, so async callbacks always work on the latest state and never on a stale copy captured earlier.

**Trade-offs**

- More boilerplate: every action needs a guard, a transition and a test, and every state change creates new objects. For a state this small the cost is negligible, and the code is easier to reason about.
- Logic is split between pure modules and React components. New team members must learn where each rule lives (see the README's *Project orientation*).

**Quality scenarios**

| Stimulus | Expected response | Evaluation |
|---|---|---|
| The player clicks *Buy* with too little gold or a full backpack | Button is disabled with a reason; calling `buyItem` directly returns the unchanged state | Unit tests in `run.test.ts` |
| The player sells, buys and moves items in any order | Gold ≥ 0, number of item instances = bought − sold, all `uid`s unique | Invariant test over random action sequences (Planned) |
| A shop action is triggered while searching or in battle | State does not change | Unit test (In place) |
| The replay reaches the last frame, then *Skip* is pressed | Result is applied exactly once | Unit test on `showFrame`/`skipReplay` (Planned) |

### Q2 — Determinism & fairness

**Why it matters.** The game is a strategy game: players must be able to trust that the outcome depends only on their decisions. B3 and B4 explicitly require deterministic values. B6 forbids using a refresh to get a free reroll, a different opponent, a second result or to avoid a loss. B7 requires the server to reject implausible runs.

**Decisions**

- **Seeded randomness (In place).** Shop rolls use a seeded PRNG (`mulberry32`). The seed is part of `RunState`, so the same seed always produces the same offers, and saving the seed saves the "future" of the shop.
- **Simulate first, replay later (In place).** `simulateBattle` computes the whole battle at once from the two fighters. The replay only *shows* precomputed frames, so animation timing, *Skip* or tab throttling can't change the outcome.
- **Fixed opponents per round (In place, server).** The API returns the same opponent for the same round, so searching again never yields an easier opponent.
- **Deterministic status effects (Planned, B3/B4).** Poison, heal and Burn are processed at fixed tick intervals in a fixed order inside `simulateBattle`, with no randomness. Exact values are a **Team decision** and are shown in the rules panel generated from the same constants.
- **Refresh policy (Planned, B6) — Team decision, proposal:**
  - *Refresh during shopping:* the run continues with the same gold, backpack, offers and seed.
  - *Refresh during a search:* the search is cancelled and the player returns to the shop with a message. Nothing is charged or rerolled, and the next search gets the same fixed opponent, so nothing is gained.
  - *Refresh during a replay:* the battle (opponent + precomputed result) is part of the saved state. After a reload the replay jumps to the end and the result is applied exactly once. A refresh can't avoid a loss or produce a second result.
- **Server-side plausibility checks (Planned, B7).** The API does not trust the client. A submitted run is checked against the game rules: wins 0–5, lives 0–3, and for a finished run `rounds = wins + (3 − lives)` (every round is exactly one battle), plus a victory requires 5 wins and a defeat requires 0 lives.

**Trade-offs**

- The game runs entirely in the browser, so a determined user can edit `localStorage` or call the API directly. **We accept that full cheat-proofing is out of scope.** It would require running the game on the server. Instead we make cheating *pointless through normal use* (refresh, double-click) and reject *implausible* data on the server.
- Jumping to the end of the replay after a reload costs the player the animation, but it keeps the result fair and simple.

**Quality scenarios**

| Stimulus | Expected response | Evaluation |
|---|---|---|
| Two runs start with the same seed and the same actions | Identical shops and identical battle results | Unit test (Planned) |
| The player refreshes during a replay they are losing | After reload the loss is applied once and the next screen matches the result | Unit test on save/restore + manual test |
| The player refreshes in the shop hoping for new offers | The same offers are shown | Manual test + unit test on restore |
| A client posts `{ wins: 5, lives: 3, rounds: 2 }` to the hall of fame | `400` with a clear error message, nothing stored | API test (Planned) |

### Q3 — Resilience

**Why it matters.** The opponent API is slow and fails on purpose, and saved data can be old, partial or edited by hand. B5 and B6 require that none of this breaks the game: the player always returns to a usable screen with an understandable message and can try again.

**Decisions**

- **Search id for every request (Planned, B5).** `startSearch` stores a new `searchId` (and the round) in the game state. `startBattle` and `searchFailed` take that id and ignore the response if the phase is not `searching` or the id/round does not match. Late, duplicate or out-of-order responses can't start a battle or overwrite a newer search.
- **Failure returns to the shop (Planned, B5).** On failure the phase goes back to `shop` with an error message and a *Try again* action. While searching, the *Find opponent* button is disabled, so a second search can't start.
- **Client-side timeout (Planned, B5).** Requests use an `AbortController` with a timeout above the API's maximum latency, so a hanging request ends in a clear error instead of an endless "searching" state.
- **Versioned, validated saves (Planned, B6).** The saved state has a `version` field. On load we parse it defensively, check its shape and the game invariants from Q1 (gold ≥ 0, lives and wins in range, backpack size 6, known item ids, unique uids, phase-consistent data). Anything that fails is discarded and the player gets a new playable run with a short notice. A bad save can never crash the app.
- **Explicit loading, empty and error states (Planned, B7).** The hall of fame page shows all three. A failed submission keeps the entered name and can be retried. A client-generated run id makes the submission idempotent on the server, so a retry never creates a second entry.

**Trade-offs**

- **Discard instead of migrate.** When the save format changes we drop old saves instead of writing migrations. A player may lose an unfinished run after an update, but it is simple and safe (Q1 wins over Q3). For a game with short runs we think that is acceptable.
- The hall of fame lives in server memory, so entries are lost on restart. This is allowed by the requirements and avoids a database dependency.

**Quality scenarios**

| Stimulus | Expected response | Evaluation |
|---|---|---|
| The API returns 503 (`?fail=true`, `API_FAIL=true`) | Back to the shop within the request time, message shown, *Try again* works | Manual test + unit test on `searchFailed` |
| The player clicks *Find opponent* twice quickly | Only one search runs | Unit test on `startSearch` + manual test |
| A response from an old search arrives after a newer search started | It is ignored and no battle starts | Unit test with mismatching `searchId` (Planned) |
| `localStorage` contains invalid JSON, an old version or `gold: -50` | Game starts a fresh playable run with a notice, no crash | Unit tests for the load function (Planned) |
| The hall-of-fame submission fails and the player retries | No retyping, and only one entry is stored | API + manual test (Planned) |

### Q4 — Maintainability & extensibility

**Why it matters.** B3 and B4 add poison, heal, Burn, sets and set bonuses on top of the existing items. If each new effect touches many files, bugs and inconsistencies between the simulation, the UI and the rules panel are likely. Every team member must also be able to explain and change any part of the code during the exam.

**Decisions**

- **Data-driven catalog (In place / Planned).** Items are plain data in `items.ts` (price, cooldown, effects). For B3/B4 we extend `ItemEffects` with the new effects and add a `set` field to items, and define sets and their bonuses as data. Adding an item means adding one entry.
- **One place for battle rules (In place / Planned).** All effect processing (damage, block, poison, heal, Burn, set bonuses) stays inside `battle.ts`. The player and opponents are built the same way (`buildFighter`), so set bonuses apply to both automatically (B4).
- **Rules text generated from constants (In place).** `rules.ts` builds the rules panel and tooltips from the same constants the simulation uses. If a value changes, the explanation changes with it, so the UI can't drift from the code.
- **Typing and tooling (In place / Planned).** TypeScript with unused-code checks and ESLint (in place). Phases and battle event kinds are union types. For B3/B4 we will handle new event kinds (poison, heal, burn) in exhaustive `switch` statements with a `never` check, so a kind that isn't handled is a compile error (Planned).
- **Tests next to the code (In place).** Vitest tests as `*.test.ts` files next to the module they test.

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
- **Accessibility / usability.** We follow the requirement that every disabled action explains why, and we keep controls as real buttons. A full accessibility audit is out of scope. **Team decision:** promote this to a fifth goal if we have time (for example keyboard support for B2 arrangement).

## 6. How we evaluate the goals

| Goal | Automated checks | Manual checks |
|---|---|---|
| Q1 | Unit tests for every action and its guard, invariant tests over random action sequences | Clicking quickly, buying and selling to edge values |
| Q2 | Same seed → same shop and battle; save/restore tests; API validation tests | Refresh in every phase (shop, searching, replay, result) |
| Q3 | Tests for `searchFailed`, stale `searchId`, save loading with broken data | `?fail=true`, `?latency=5000`, `API_FAIL=true`, editing `localStorage` by hand |
| Q4 | `pnpm lint`, `pnpm build`, `pnpm test` all green | Review: how many files does adding an item / effect touch? |

Before submission we go through every quality scenario in section 3 and record the result here.

## 7. Open team decisions

- [ ] Poison, heal and Burn values (tick interval, stacks, damage, decay) — B3/B4
- [ ] The second set besides Fire and the set bonuses — B4
- [ ] Final refresh policy (proposal in Q2) — B6
- [ ] What exactly is saved, and the save `version` — B6
- [ ] Hall-of-fame ordering (proposal: victories first, then more wins, then fewer rounds, then earlier submission) and the name rules (length, allowed characters) — B7
- [ ] Whether accessibility becomes a fifth goal
