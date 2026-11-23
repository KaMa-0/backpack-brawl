export const HALL_NAME_MIN = 2;
export const HALL_NAME_MAX = 24;

const entries = new Map();

function isWholeInRange(value, min, max) {
  return Number.isInteger(value) && value >= min && value <= max;
}

export function validateHallRun(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { ok: false, error: "Run data must be a JSON object." };
  }

  if (typeof payload.runId !== "string" || !/^[A-Za-z0-9_-]{8,100}$/.test(payload.runId)) {
    return { ok: false, error: "runId must be 8–100 letters, numbers, hyphens or underscores." };
  }

  if (typeof payload.name !== "string") {
    return { ok: false, error: "Name is required." };
  }
  const name = payload.name.trim();
  if (name.length < HALL_NAME_MIN || name.length > HALL_NAME_MAX) {
    return { ok: false, error: `Name must be ${HALL_NAME_MIN}–${HALL_NAME_MAX} characters.` };
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9 _'-]*$/.test(name)) {
    return { ok: false, error: "Name may contain letters, numbers, spaces, hyphens, underscores and apostrophes." };
  }

  if (!isWholeInRange(payload.wins, 0, 5)) {
    return { ok: false, error: "Wins must be a whole number from 0 to 5." };
  }
  if (!isWholeInRange(payload.lives, 0, 3)) {
    return { ok: false, error: "Lives must be a whole number from 0 to 3." };
  }
  if (!isWholeInRange(payload.rounds, 1, 7)) {
    return { ok: false, error: "Rounds must be a whole number from 1 to 7." };
  }

  const victory = payload.wins === 5;
  const expectedRounds = payload.wins + (3 - payload.lives);
  if (payload.rounds !== expectedRounds) {
    return { ok: false, error: "Round count is inconsistent with wins and remaining lives." };
  }
  if (victory && payload.lives === 0) {
    return { ok: false, error: "A victorious run cannot have zero lives." };
  }
  if (!victory && payload.lives !== 0) {
    return { ok: false, error: "A defeat must have zero lives, or a victory must have 5 wins." };
  }

  return { ok: true, value: { runId: payload.runId, name, wins: payload.wins, lives: payload.lives, rounds: payload.rounds, victory } };
}

export function submitHallRun(payload, now = Date.now()) {
  const checked = validateHallRun(payload);
  if (!checked.ok) return { ok: false, error: checked.error };

  const existing = entries.get(checked.value.runId);
  if (existing) return { ok: true, duplicate: true, entry: existing };

  const entry = { ...checked.value, submittedAt: now };
  entries.set(entry.runId, entry);
  return { ok: true, duplicate: false, entry };
}

export function getHallEntries() {
  return [...entries.values()].sort((a, b) => {
    if (a.victory !== b.victory) return a.victory ? -1 : 1;
    if (a.wins !== b.wins) return b.wins - a.wins;
    if (a.rounds !== b.rounds) return a.rounds - b.rounds;
    if (a.submittedAt !== b.submittedAt) return a.submittedAt - b.submittedAt;
    return a.runId.localeCompare(b.runId);
  }).map((entry, index) => ({ rank: index + 1, ...entry }));
}

export function clearHallEntries() {
  entries.clear();
}
