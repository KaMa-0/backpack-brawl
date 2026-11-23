import { describe, expect, it } from "vitest";
import { newGame, skipReplay, startBattle, startSearch, updateRun } from "./game";
import { buyItem } from "./run";
import { restoreGame, SAVE_KEY, SAVE_VERSION, saveGame } from "./save";
import type { Opponent } from "./types";

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
    expect(restored.game).toMatchObject({ phase: "shop", search: null, battle: null });
    expect(restored.game.run).toEqual(searching.run);
    expect(restored.game.error).toContain("cancelled after refresh");
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
    expect(restoreGame(123, storage).game.phase).toBe("shop");

    storage.setItem(SAVE_KEY, JSON.stringify({ version: SAVE_VERSION + 1, game: ready() }));
    expect(restoreGame(123, storage).game.error).toContain("fresh playable run");

    storage.setItem(SAVE_KEY, JSON.stringify({ version: SAVE_VERSION, game: { ...ready(), run: { ...ready().run, gold: -50 } } }));
    expect(restoreGame(123, storage).notice).toBe("Saved run discarded");
  });

  it("does not save an impossible run", () => {
    const storage = new MemoryStorage();
    saveGame({ ...ready(), run: { ...ready().run, gold: -1 } }, storage);
    expect(storage.getItem(SAVE_KEY)).toBeNull();
  });
});
