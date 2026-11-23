import type { HallEntry, HallRunPayload, Opponent } from "./types";

/** Asks the API for this round's opponent; throws with the server's error text on failure. */
export async function fetchOpponent(round: number): Promise<Opponent> {
  const response = await fetch(`/api/opponents?round=${encodeURIComponent(round)}`);
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `Opponent search failed (${response.status})`);
  }
  return response.json() as Promise<Opponent>;
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
