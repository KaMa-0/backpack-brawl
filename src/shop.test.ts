import { describe, expect, it } from "vitest";
import { getItem, SHOP_POOL, variantOf } from "./items";
import { POISON_VARIANT_CHANCE, rollShop } from "./shop";

const SEEDS = Array.from({ length: 2000 }, (_, i) => i * 7919 + 1);

describe("rollShop", () => {
  it("gives the same offers and next seed for the same seed", () => {
    expect(rollShop(12345)).toEqual(rollShop(12345));
  });

  it("only rolls poisoned versions in place of weapons, and only sometimes", () => {
    let weaponOffers = 0;
    let poisonedOffers = 0;
    for (const seed of SEEDS) {
      for (const id of rollShop(seed).offers) {
        const item = getItem(id);
        const baseId = item.variantOf ?? item.id;
        if (!variantOf(baseId)) {
          expect(item.variantOf).toBeUndefined();
          continue;
        }
        weaponOffers += 1;
        if (item.variantOf) poisonedOffers += 1;
      }
    }
    const share = poisonedOffers / weaponOffers;
    expect(share).toBeGreaterThan(POISON_VARIANT_CHANCE - 0.05);
    expect(share).toBeLessThan(POISON_VARIANT_CHANCE + 0.05);
  });

  it("offers every heal item", () => {
    const offered = new Set(SEEDS.flatMap((seed) => rollShop(seed).offers));
    for (const item of SHOP_POOL.filter((candidate) => candidate.effects.heal)) expect(offered).toContain(item.id);
  });
});
