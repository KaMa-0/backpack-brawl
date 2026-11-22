import { describe, expect, it } from "vitest";
import { newGame, updateRun } from "./game";
import { getItem } from "./items";
import { buyItem, buyBlocker, newRun, rerollBlocker, rerollShop, sellItem } from "./run";

describe("B1 shop economy", () => {
  it("buys one item once and leaves no duplicate or lost gold", () => {
    const initial = newRun(123);
    const itemId = initial.shop[0]!;
    const bought = buyItem(initial, 0);

    expect(bought).not.toBe(initial);
    expect(bought.shop[0]).toBeNull();
    expect(bought.backpack.filter((slot) => slot?.itemId === itemId)).toHaveLength(1);
    expect(bought.gold).toBe(initial.gold - getItem(itemId).price);
    expect(buyItem(bought, 0)).toBe(bought);
  });

  it("never buys an item without enough gold or a free slot", () => {
    const initial = newRun(456);
    initial.gold = 0;
    initial.backpack = initial.backpack.map(() => ({ uid: "occupied", itemId: "pot-lid" }));

    expect(buyBlocker(initial, 0)).not.toBeNull();
    expect(buyItem(initial, 0)).toBe(initial);
  });

  it("sells for half price rounded down and removes exactly one owned item", () => {
    const initial = newRun(789);
    const bought = buyItem(initial, 0);
    const ownedSlot = bought.backpack.findIndex((slot) => slot !== null);
    const itemId = bought.backpack[ownedSlot]!.itemId;
    const goldBefore = bought.gold;
    const sold = sellItem(bought, ownedSlot);

    expect(sold.gold).toBe(goldBefore + Math.floor(getItem(itemId).price / 2));
    expect(sold.backpack[ownedSlot]).toBeNull();
    expect(sold.backpack.filter((slot) => slot?.itemId === itemId)).toHaveLength(0);
  });

  it("does not change state for an empty sell slot", () => {
    const initial = newRun(42);
    expect(sellItem(initial, 2)).toBe(initial);
  });

  it("rerolls for exactly 1 gold and cannot reroll with no gold", () => {
    const initial = newRun(999);
    initial.gold = 1;
    const rerolled = rerollShop(initial);

    expect(rerolled.gold).toBe(0);
    expect(rerolled.seed).not.toBe(initial.seed);
    expect(rerolled.shop).not.toEqual(initial.shop);

    expect(rerollBlocker(rerolled)).toBe("Need 1 🪙");
    expect(rerolled === rerollShop(rerolled)).toBe(true);
  });

  it("blocks buy, sell, and reroll actions outside the shopping phase", () => {
    const initial = newGame(111);
    const bought = buyItem(initial.run, 0);

    expect(updateRun(initial, () => bought)).not.toBe(initial);

    const searching = { ...initial, phase: "searching" as const };
    expect(updateRun(searching, () => sellItem(searching.run, 0))).toBe(searching);
    expect(updateRun(searching, () => rerollShop(searching.run))).toBe(searching);
  });
});
