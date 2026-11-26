import { describe, expect, it } from "vitest";
import { leaveBattle, newGame, skipReplay, startBattle, startSearch, updateRun } from "./game";
import { buyItem, moveItem, rerollShop, sellItem } from "./run";
import { restoreGame, saveGame } from "./save";
import type { GameState, Opponent } from "./types";

/**
 * Plays many random runs (buy, sell, reroll, move, fight) and checks after every step that
 * the run is still valid and that it survives a save + restore (B1, B2, B6).
 * The random numbers come from a fixed seed, so a failure can always be reproduced.
 */

class MemoryStorage {
  data = new Map<string, string>();
  getItem(key: string) { return this.data.get(key) ?? null; }
  setItem(key: string, value: string) { this.data.set(key, value); }
  removeItem(key: string) { this.data.delete(key); }
}

/** Simple repeatable random numbers between 0 and 1 (Park–Miller generator). */
function randomFrom(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
}

/** An opponent the player beats about half of the time. */
const opponentFor = (round: number, random: () => number): Opponent =>
  random() < 0.5
    ? { id: "weak", name: "Weak", icon: "🎯", hp: 1, round, items: ["pot-lid"] }
    : { id: "strong", name: "Strong", icon: "👹", hp: 999, round, items: ["iron-cleaver", "iron-cleaver"] };

function checkRun(game: GameState, bought: number, sold: number) {
  const items = game.run.backpack.filter((slot) => slot !== null);
  expect(game.run.gold).toBeGreaterThanOrEqual(0);
  expect(items).toHaveLength(bought - sold);
  expect(new Set(items.map((slot) => slot.uid)).size).toBe(items.length);
}

describe("random runs", () => {
  it("never break the rules and can always be saved and restored", () => {
    for (let seed = 1; seed <= 100; seed++) {
      const random = randomFrom(seed);
      let game = newGame(seed);
      let bought = 0;
      let sold = 0;

      for (let step = 0; step < 200 && game.phase !== "finished"; step++) {
        const choice = random();
        const before = game;
        if (choice < 0.35) game = updateRun(game, (run) => buyItem(run, Math.floor(random() * 4)));
        else if (choice < 0.45) game = updateRun(game, (run) => sellItem(run, Math.floor(random() * 6)));
        else if (choice < 0.55) game = updateRun(game, (run) => rerollShop(run));
        else if (choice < 0.65) game = updateRun(game, (run) => moveItem(run, Math.floor(random() * 6), Math.floor(random() * 6)));
        else {
          const searching = startSearch(game, `search-${step}`);
          if (searching !== game) {
            const battle = startBattle(searching, `search-${step}`, opponentFor(game.run.round, random));
            game = leaveBattle(skipReplay(battle));
          }
        }

        // Count what changed, then check the invariants.
        const itemsBefore = before.run.backpack.filter((slot) => slot !== null).length;
        const itemsAfter = game.run.backpack.filter((slot) => slot !== null).length;
        if (itemsAfter > itemsBefore) bought += 1;
        if (itemsAfter < itemsBefore) sold += 1;
        checkRun(game, bought, sold);

        const storage = new MemoryStorage();
        saveGame(game, storage);
        expect(restoreGame(0, storage).game).toEqual(game);
      }
    }
  });
});
