import { describe, expect, it } from "vitest";
import { clearHallEntries, getHallEntries, submitHallRun, validateHallRun } from "./hallOfFame.js";

describe("B7 Hall of Fame", () => {
  it("rejects invalid and implausible runs", () => {
    expect(validateHallRun({ runId: "run_abcdefgh", name: "A", wins: 5, lives: 3, rounds: 5 }).ok).toBe(false);
    expect(validateHallRun({ runId: "run_abcdefgh", name: "Ada", wins: 5, lives: 3, rounds: 2 }).ok).toBe(false);
    expect(validateHallRun({ runId: "run_abcdefgh", name: "Ada", wins: 5, lives: 0, rounds: 8 }).ok).toBe(false);
  });

  it("accepts a victory and makes repeated submit calls idempotent", () => {
    clearHallEntries();
    const payload = { runId: "run_abcdefgh", name: "Ada", wins: 5, lives: 1, rounds: 7 };
    const first = submitHallRun(payload, 100);
    const second = submitHallRun(payload, 200);

    expect(first.ok).toBe(true);
    expect(first.duplicate).toBe(false);
    expect(second.ok).toBe(true);
    expect(second.duplicate).toBe(true);
    expect(getHallEntries()).toHaveLength(1);
  });

  it("orders victories first, then wins, then fewer rounds", () => {
    clearHallEntries();
    submitHallRun({ runId: "run_defeat01", name: "Def", wins: 4, lives: 0, rounds: 7 }, 1);
    submitHallRun({ runId: "run_victory1", name: "Vic", wins: 5, lives: 2, rounds: 6 }, 2);
    submitHallRun({ runId: "run_victory2", name: "Win", wins: 5, lives: 1, rounds: 7 }, 3);

    const entries = getHallEntries();
    expect(entries[0].runId).toBe("run_victory1");
    expect(entries[1].runId).toBe("run_victory2");
    expect(entries[2].runId).toBe("run_defeat01");
  });
});
