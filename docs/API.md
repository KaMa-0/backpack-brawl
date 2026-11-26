# Backpack Brawl API

The local API is a small Express server in `server/index.js`. It listens on port 4200 (override with the `PORT` environment variable). During Vite development, `/api` is proxied to it, so the frontend uses relative URLs such as `/api/opponents?round=1`. All responses are JSON. The only state on the server is the hall of fame, which is kept in memory: restarting the server empties it and changes nothing else.

## `GET /api/health`

Always answers immediately with status 200:

```json
{ "ok": true, "service": "backpack-brawl" }
```

## `GET /api/opponents`

Returns the opponent for one round of a run. The opponent table lives in `server/opponents.js`.

### Query parameters

| Parameter | Required | Meaning |
|---|---|---|
| `round` | yes | The 1-based round number. Must be a positive whole number written in digits (`1`, `2`, …). |
| `latency` | no | Response delay in milliseconds, clamped to 0–5000. Defaults to 1200. A value that is not a number falls back to the default. |
| `fail` | no | `fail=true` forces a 503 response (see below). |

### Success — 200

```json
{
  "id": "mossback-hermit",
  "name": "Mossback Hermit",
  "icon": "🐢",
  "hp": 25,
  "items": ["chipped-dagger", "pot-lid"],
  "round": 1
}
```

| Field | Type | Meaning |
|---|---|---|
| `id` | string | Stable identifier of the opponent |
| `name` | string | Display name |
| `icon` | string | Emoji shown in the battle view |
| `hp` | number | Maximum (and starting) HP |
| `items` | string[] | Item ids from the catalog in `src/items.ts`; the same id may appear several times |
| `round` | number | The round this opponent was requested for (echoes `round`) |

The response matches the `Opponent` type in `src/types.ts`.

The answer is deterministic: the same `round` always returns the same opponent. There is one hand-built opponent per round for rounds 1–7. Every round past the table returns the last opponent with +6 HP per additional round. The table never needs more than 7 rounds (5 wins + 3 lives − 1), and an opponent never carries more than 6 items, the size of the player's 2×3 backpack.

### Errors

Every error response has the shape:

```json
{ "error": "human-readable explanation" }
```

| Status | When | `error` |
|---|---|---|
| 400 | `round` is missing, not a whole number, or less than 1 | `round must be a positive whole number` |
| 503 | `fail=true`, or the server was started with `API_FAIL=true` | `The arena gates are shut. No challenger answered the call.` |

An invalid `round` is reported as 400 even when failure is forced. All responses from this endpoint, errors included, arrive after the configured delay.

## `GET /api/hall-of-fame`

Returns all finished runs that were submitted, best first. The code lives in `server/hallOfFame.js`.

### Success — 200

```json
{
  "entries": [
    { "rank": 1, "runId": "8f0c…", "name": "Ada", "wins": 5, "lives": 2, "rounds": 6, "victory": true, "submittedAt": 1795530021655 },
    { "rank": 2, "runId": "c41d…", "name": "Jürgen", "wins": 4, "lives": 0, "rounds": 7, "victory": false, "submittedAt": 1795530098000 }
  ]
}
```

`entries` is empty (`[]`) when nothing was submitted yet.

| Field | Type | Meaning |
|---|---|---|
| `rank` | number | Position in the list, starting at 1 |
| `runId` | string | Id of the run, created by the client when the run starts |
| `name` | string | Name the player entered (trimmed) |
| `wins` | number | Battles won (0–5) |
| `lives` | number | Lives left (0–3) |
| `rounds` | number | Battles played (1–7) |
| `victory` | boolean | `true` if the run reached 5 wins |
| `submittedAt` | number | Server time of the first submission, in milliseconds |

### Ranking

1. Victories before defeats.
2. More wins first.
3. Fewer rounds first (a faster run is better).
4. Earlier submission first.

## `POST /api/hall-of-fame`

Submits a finished run. Body (JSON, matches `HallRunPayload` in `src/types.ts`):

```json
{ "runId": "8f0c…", "name": "Ada", "wins": 5, "lives": 2, "rounds": 6 }
```

### Validation

The server does not trust the client. A run is rejected with 400 unless:

| Field | Rule |
|---|---|
| `runId` | 8–100 letters, digits, `-` or `_` |
| `name` | 2–24 characters after trimming; letters of any language, digits, spaces, `-`, `_` and `'`; starts with a letter or digit |
| `wins` | whole number 0–5 |
| `lives` | whole number 0–3 |
| `rounds` | whole number 1–7, and exactly `wins + (3 − lives)`, because every round is one battle that is either won or costs a life |
| result | a finished run: either 5 wins (a victory, at least 1 life left) or 0 lives (a defeat) |

### Success — 201 / 200

```json
{ "entry": { "rank": 1, "runId": "8f0c…", "name": "Ada", "wins": 5, "lives": 2, "rounds": 6, "victory": true, "submittedAt": 1795530021655 }, "duplicate": false }
```

- **201** with `"duplicate": false`: the run was stored.
- **200** with `"duplicate": true`: a run with this `runId` was already stored. Nothing changes; the stored entry (with its first name) is returned. A run is therefore never stored twice, even if the client retries.

`entry.rank` is the run's current position, so the client can show it right away.

### Errors — 400

Same shape as the other endpoints, for example:

| When | `error` |
|---|---|
| Name too short | `Name must be 2–24 characters.` |
| Rounds don't match wins and lives | `Round count is inconsistent with wins and remaining lives.` |
| Not a finished run | `A defeat must have zero lives, or a victory must have 5 wins.` |
| Body is not valid JSON | `The request body must be valid JSON.` |

### Client

`fetchHallOfFame()` and `submitHallRun(payload)` in `src/api.ts` send these requests. Like the opponent search, they give up after 8 s and reject with a message the player can understand: the server's `error` text, or a generic text for a timeout or an unreachable server. The result page remembers a submitted run in `localStorage` (`src/hallSubmission.ts`), so after a refresh it shows the stored entry instead of the form, and the hall of fame page highlights the player's own run.

## Environment variables

| Variable | Effect |
|---|---|
| `PORT` | Port to listen on (default 4200). The Vite proxy expects 4200. |
| `API_LATENCY` | Default delay in milliseconds when a request has no `latency` parameter. |
| `API_FAIL` | `true` makes every opponent request fail with 503. |

Example: `API_FAIL=true pnpm server`.

## Client

`fetchOpponent(round)` in `src/api.ts` performs the request.

- It resolves with the `Opponent` only if the answer has the documented shape: a positive whole `hp` and `round`, at most 6 `items`, and only item ids that exist in the catalog. Anything else is rejected instead of crashing the battle later.
- It gives up after `SEARCH_TIMEOUT_MS` (8 s, above the API's maximum delay of 5 s).
- It rejects with a player-facing message: the server's own `error` text when there is one, otherwise a generic text for an unreachable server (including the Vite proxy's error when the API is not running), a timeout or invalid data.

### Test switches in the page URL

`fail` and `latency` in the page URL are passed on to the API, so failures and delays can be shown without restarting the server. They are read once when the app loads, for example:

- `http://localhost:5174/?fail=true`: every search fails with 503.
- `http://localhost:5174/?latency=5000`: every answer takes 5 seconds.

### Late and duplicate answers

The client does not decide whether an answer is still wanted. Every search gets a unique id (`startSearch` in `src/game.ts`), and `startBattle` / `searchFailed` only act if that id is still the running search and the opponent is for the searched round. Slow, duplicate or late answers therefore change nothing.
