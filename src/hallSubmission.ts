/**
 * Remembers in the browser which run was sent to the hall of fame, so the result page still
 * knows it after a refresh, and the hall of fame page can highlight the player's own run.
 */
const KEY = "backpack-brawl.hall-submission";

export interface HallSubmission {
  runId: string;
  /** Name stored by the server (a repeated submission keeps the first name). */
  name: string;
  /** Rank when the run was submitted. */
  rank: number;
}

export function loadHallSubmission(): HallSubmission | null {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) ?? "null") as Partial<HallSubmission> | null;
    if (value && typeof value.runId === "string" && typeof value.name === "string" && typeof value.rank === "number") {
      return { runId: value.runId, name: value.name, rank: value.rank };
    }
  } catch {
    // Storage blocked or the value is broken: behave as if nothing was submitted.
  }
  return null;
}

export function saveHallSubmission(submission: HallSubmission): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(submission));
  } catch {
    // Storage blocked: the server still stores the run only once.
  }
}
