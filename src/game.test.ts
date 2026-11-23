import { describe, expect, it } from "vitest";
import { fightBlocker, leaveBattle, newGame, searchFailed, skipReplay, startBattle, startSearch, updateRun } from "./game";
import { buyItem, sellItem } from "./run";
import type { GameState, Opponent } from "./types";

/** A weak opponent for the given round, as the API would send it. */
const opponent = (round = 1): Opponent => ({ id: "dummy", name: "Dummy", icon: "🎯", hp: 1, round, items: ["pot-lid"] });

/** A new game with one item bought, so a search may start. */
function readyGame(): GameState {
  return updateRun(newGame(1), (run) => buyItem(run, 0));
}

describe("B5 resilient matchmaking", () => {
  it("shows a running search and blocks a second one", () => {
    const searching = startSearch(readyGame(), "first");

    expect(searching.phase).toBe("searching");
    expect(searching.search).toEqual({ id: "first", round: 1 });
    expect(fightBlocker(searching)).not.toBeNull();
    expect(startSearch(searching, "second")).toBe(searching);
  });

  it("returns a failed search to a usable shop with the message, and lets the player try again", () => {
    const failed = searchFailed(startSearch(readyGame(), "first"), "first", "The arena gates are shut.");

    expect(failed).toMatchObject({ phase: "shop", search: null, error: "The arena gates are shut." });
    expect(fightBlocker(failed)).toBeNull();
    expect(updateRun(failed, (run) => sellItem(run, 0))).not.toBe(failed);

    const retry = startSearch(failed, "second");
    expect(retry).toMatchObject({ phase: "searching", search: { id: "second" }, error: null });
  });

  it("starts a battle only for the current search", () => {
    const searching = startSearch(readyGame(), "current");

    expect(startBattle(searching, "older", opponent())).toBe(searching);
    expect(startBattle(searching, "current", opponent())).toMatchObject({ phase: "battle", search: null });
  });

  it("never starts a battle outside a search", () => {
    const shop = readyGame();
    const failed = searchFailed(startSearch(shop, "first"), "first", "Timeout");

    expect(startBattle(shop, "first", opponent())).toBe(shop);
    expect(startBattle(failed, "first", opponent())).toBe(failed);
  });

  it("ignores a duplicate answer instead of restarting the battle", () => {
    const battle = startBattle(startSearch(readyGame(), "first"), "first", opponent());
    expect(startBattle(battle, "first", opponent())).toBe(battle);
  });

  it("ignores a late failure of an older search", () => {
    const failed = searchFailed(startSearch(readyGame(), "first"), "first", "Timeout");
    const retry = startSearch(failed, "second");

    expect(searchFailed(retry, "first", "late")).toBe(retry);
  });

  it("ends the search when the answer is for another round", () => {
    const searching = startSearch(readyGame(), "first");
    const wrongRound = startBattle(searching, "first", opponent(2));

    expect(wrongRound).toMatchObject({ phase: "shop", search: null, battle: null });
    expect(wrongRound.error).toContain("round 2");
  });

  it("applies a battle result exactly once, even when answers arrive late", () => {
    const start = readyGame();
    const battle = startBattle(startSearch(start, "first"), "first", opponent());
    const done = skipReplay(battle);
    const roundsPlayed = (game: GameState) => game.run.wins + (start.run.lives - game.run.lives);

    expect(roundsPlayed(done)).toBe(1);
    expect(skipReplay(done)).toBe(done);
    expect(startBattle(done, "first", opponent())).toBe(done);

    const nextShop = leaveBattle(done);
    expect(startBattle(nextShop, "first", opponent())).toBe(nextShop);
    expect(roundsPlayed(nextShop)).toBe(1);
  });
});
