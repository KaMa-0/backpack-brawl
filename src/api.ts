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

export async function fetchHallOfFame(): Promise<HallEntry[]> {
  const response = await fetch("/api/hall-of-fame");
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `Could not load the hall of fame (${response.status})`);
  }
  const body = await response.json() as { entries?: HallEntry[] };
  return Array.isArray(body.entries) ? body.entries : [];
}

export async function submitHallRun(payload: HallRunPayload): Promise<{ entry: HallEntry; duplicate: boolean }> {
  const response = await fetch("/api/hall-of-fame", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `Could not submit this run (${response.status})`);
  }
  return response.json() as Promise<{ entry: HallEntry; duplicate: boolean }>;
}
