import { hasItem } from "./items";
import { BACKPACK_SIZE } from "./shop";
import type { HallEntry, HallRunPayload, Opponent } from "./types";

/** A search that takes longer than this is given up. The API answers within 5 s at most. */
export const SEARCH_TIMEOUT_MS = 8000;

/** Player-facing messages; the shop adds "Try again." behind them. */
export const SEARCH_ERRORS = {
  timeout: "The arena took too long to answer.",
  unreachable: "The arena server can't be reached right now.",
  invalid: "The arena sent a challenger the game doesn't understand.",
} as const;

/**
 * Test switches that are copied from the page URL to the API, so failures and delays can be shown
 * without restarting the server: open e.g. `http://localhost:5174/?fail=true` or `/?latency=5000`.
 */
const TEST_SWITCHES = ["fail", "latency"] as const;

/** The page's query string when the app was loaded (in-app navigation drops it later). */
const PAGE_QUERY = typeof window === "undefined" ? "" : window.location.search;

interface FetchOpponentOptions {
  timeoutMs?: number;
  /** Query string to take the test switches from; defaults to the page URL. */
  testQuery?: string;
}

/**
 * Asks the API for this round's opponent.
 * Resolves with a validated `Opponent`; rejects with a player-facing message when the server
 * can't be reached, answers with an error, takes longer than `timeoutMs`, or sends invalid data.
 */
export async function fetchOpponent(round: number, { timeoutMs = SEARCH_TIMEOUT_MS, testQuery = PAGE_QUERY }: FetchOpponentOptions = {}): Promise<Opponent> {
  const params = new URLSearchParams({ round: String(round) });
  const page = new URLSearchParams(testQuery);
  for (const key of TEST_SWITCHES) {
    const value = page.get(key);
    if (value !== null) params.set(key, value);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const failed = () => new Error(controller.signal.aborted ? SEARCH_ERRORS.timeout : SEARCH_ERRORS.unreachable);

  try {
    let response: Response;
    try {
      response = await fetch(`/api/opponents?${params}`, { signal: controller.signal });
    } catch {
      throw failed();
    }

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      if (controller.signal.aborted) throw failed();
      body = null;
    }

    if (!response.ok) {
      const message = (body as { error?: unknown } | null)?.error;
      // The API explains its errors; anything else (e.g. the dev proxy when the API is down) gets a generic text.
      throw new Error(typeof message === "string" && message !== "" ? message : unreachableWithStatus(response.status));
    }

    const opponent = parseOpponent(body);
    if (!opponent) throw new Error(SEARCH_ERRORS.invalid);
    return opponent;
  } finally {
    clearTimeout(timer);
  }
}

/** "The arena server can't be reached right now (error 502)." */
export const unreachableWithStatus = (status: number) => `${SEARCH_ERRORS.unreachable.replace(/\.$/, "")} (error ${status}).`;

/** The opponent in an API answer, or `null` if the answer doesn't have the documented shape or uses unknown items. */
export function parseOpponent(data: unknown): Opponent | null {
  if (typeof data !== "object" || data === null) return null;
  const { id, name, icon, hp, round, items } = data as Record<string, unknown>;
  const valid =
    typeof id === "string" &&
    typeof name === "string" &&
    typeof icon === "string" &&
    typeof hp === "number" &&
    Number.isInteger(hp) &&
    hp > 0 &&
    typeof round === "number" &&
    Number.isInteger(round) &&
    round > 0 &&
    Array.isArray(items) &&
    items.length <= BACKPACK_SIZE &&
    items.every((item) => typeof item === "string" && hasItem(item));
  return valid ? { id, name, icon, hp, round, items: [...(items as string[])] } : null;
}

/** Hall of fame requests give up after this, like the opponent search. */
export const HALL_TIMEOUT_MS = 8000;

/** Player-facing messages for hall of fame requests. */
export const HALL_ERRORS = {
  timeout: "The hall of fame took too long to answer.",
  unreachable: "The hall of fame can't be reached right now.",
} as const;

/**
 * Sends one request to the hall of fame API and returns the JSON answer.
 * Throws an Error with a message the player can understand: the server's own `error` text,
 * or one of `HALL_ERRORS` for a timeout or an unreachable server.
 */
async function hallRequest(init?: RequestInit): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HALL_TIMEOUT_MS);
  try {
    let response: Response;
    try {
      response = await fetch("/api/hall-of-fame", { ...init, signal: controller.signal });
    } catch {
      throw new Error(controller.signal.aborted ? HALL_ERRORS.timeout : HALL_ERRORS.unreachable);
    }
    const body = (await response.json().catch(() => null)) as { error?: unknown } | null;
    if (!response.ok) {
      throw new Error(typeof body?.error === "string" ? body.error : `${HALL_ERRORS.unreachable} (error ${response.status})`);
    }
    return body;
  } finally {
    clearTimeout(timer);
  }
}

/** All stored runs, best first (the server ranks them). */
export async function fetchHallOfFame(): Promise<HallEntry[]> {
  const body = (await hallRequest()) as { entries?: unknown } | null;
  return Array.isArray(body?.entries) ? (body.entries as HallEntry[]) : [];
}

/** Submits a finished run. Submitting the same run again returns the stored entry (`duplicate: true`). */
export async function submitHallRun(payload: HallRunPayload): Promise<{ entry: HallEntry; duplicate: boolean }> {
  const body = await hallRequest({
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return body as { entry: HallEntry; duplicate: boolean };
}
