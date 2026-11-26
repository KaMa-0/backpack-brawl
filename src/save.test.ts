import { describe, expect, it } from "vitest";
import { leaveBattle, newGame, skipReplay, startBattle, startSearch, updateRun } from "./game";
import { buyItem } from "./run";
import { RESTORE_NOTICES, restoreGame, SAVE_KEY, SAVE_VERSION, saveGame } from "./save";
import type { GameState, Opponent } from "./types";

class MemoryStorage {
  data = new Map<string, string>();
  getItem(key: string) { return this.data.get(key) ?? null; }
  setItem(key: string, value: string) { this.data.set(key, value); }
  removeItem(key: string) { this.data.delete(key); }
}

const opponent: Opponent = { id: "dummy", name: "Dummy", icon: "🎯", hp: 1, round: 1, items: ["pot-lid"] };
const ready = () => updateRun(newGame(1), (run) => buyItem(run, 0));

describe("B6 save and resume", () => {
  it("restores a valid shop save with the same offers, seed and run", () => {
    const storage = new MemoryStorage();
    const game = ready();
    saveGame(game, storage);

    expect(restoreGame(999, storage)).toMatchObject({ game, notice: null });
  });

  it("cancels a refresh during search without rerolling or spending gold", () => {
    const storage = new MemoryStorage();
    const searching = startSearch(ready(), "search-1");
    saveGame(searching, storage);

    const restored = restoreGame(999, storage);
    expect(restored.game).toMatchObject({ phase: "shop", search: null, battle: null, error: null });
    expect(restored.game.run).toEqual(searching.run);
    expect(restored.notice).toBe(RESTORE_NOTICES.search);
  });

  it("applies a battle result once after refresh and skips to the end of the replay", () => {
    const storage = new MemoryStorage();
    const battle = startBattle(startSearch(ready(), "search-1"), "search-1", opponent);
    const done = skipReplay(battle);
    saveGame(done, storage);

    const atEnd = restoreGame(999, storage);
    expect(atEnd.game.phase).toBe("battle");
    expect(atEnd.game.run.wins + (3 - atEnd.game.run.lives)).toBe(1);
    const restoredBattle = atEnd.game.battle;
    expect(restoredBattle).not.toBeNull();
    if (restoredBattle) {
      expect(restoredBattle.frame).toBe(restoredBattle.result.frames.length - 1);
    }
  });

  it("discards malformed, incompatible and impossible saves", () => {
    const storage = new MemoryStorage();
    storage.setItem(SAVE_KEY, "not-json");
    expect(restoreGame(123, storage)).toMatchObject({ game: { phase: "shop" }, notice: RESTORE_NOTICES.discarded });

    storage.setItem(SAVE_KEY, JSON.stringify({ version: SAVE_VERSION + 1, game: ready() }));
    expect(restoreGame(123, storage).notice).toBe(RESTORE_NOTICES.discarded);

    storage.setItem(SAVE_KEY, JSON.stringify({ version: SAVE_VERSION, game: { ...ready(), run: { ...ready().run, gold: -50 } } }));
    expect(restoreGame(123, storage).notice).toBe(RESTORE_NOTICES.discarded);
  });

  it("does not save an impossible run", () => {
    const storage = new MemoryStorage();
    saveGame({ ...ready(), run: { ...ready().run, gold: -1 } }, storage);
    expect(storage.getItem(SAVE_KEY)).toBeNull();
  });

  it("saves and restores runs in rounds 6 and 7 (the longest possible run)", () => {
    const storage = new MemoryStorage();
    // 4 wins and 2 losses: the run is now in round 7.
    let game = fighterGame();
    for (const result of ["win", "loss", "win", "loss", "win", "win"] as const) game = playRound(game, result);
    expect(game.run).toMatchObject({ round: 7, wins: 4, lives: 1 });

    saveGame(game, storage);
    expect(restoreGame(999, storage).game).toEqual(game);

    // The 7th battle ends the run; the finished run is saved too.
    const finished = playRound(game, "win");
    saveGame(finished, storage);
    expect(restoreGame(999, storage).game).toMatchObject({ phase: "finished", run: { round: 7, wins: 5, lives: 1 } });
  });

  it("keeps a loss in round 6 after a refresh", () => {
    const storage = new MemoryStorage();
    let game = fighterGame();
    for (const result of ["win", "loss", "win", "win", "win"] as const) game = playRound(game, result, storage);
    expect(game.run).toMatchObject({ round: 6, lives: 2 });

    const afterLoss = playRound(game, "loss", storage);
    expect(afterLoss.run).toMatchObject({ round: 7, wins: 4, lives: 1 });
    expect(restoreGame(999, storage).game.run).toEqual(afterLoss.run);
  });
});

/** A new game with an Iron Cleaver in the backpack, so it can win against a weak opponent. */
function fighterGame(): GameState {
  const game = newGame(1);
  const backpack = [{ uid: "item-1", itemId: "iron-cleaver" }, null, null, null, null, null];
  return { ...game, run: { ...game.run, backpack, nextUid: 2 } };
}

/** Plays one round against an opponent that always loses or always wins, saving every step like the app does. */
function playRound(game: GameState, result: "win" | "loss", storage?: MemoryStorage): GameState {
  const round = game.run.round;
  const enemy: Opponent = result === "win"
    ? { id: "weak", name: "Weak", icon: "🎯", hp: 1, round, items: ["pot-lid"] }
    : { id: "strong", name: "Strong", icon: "👹", hp: 999, round, items: ["iron-cleaver", "iron-cleaver"] };
  const steps = [startSearch(game, `search-${round}`)];
  steps.push(startBattle(steps[0], `search-${round}`, enemy));
  steps.push(skipReplay(steps[1]));
  steps.push(leaveBattle(steps[2]));
  if (storage) for (const step of steps) saveGame(step, storage);
  return steps[steps.length - 1];
}
