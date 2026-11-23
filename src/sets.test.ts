import { describe, expect, it } from "vitest";
import { buildFighter, buildOpponentFighter } from "./battle";
import { CATALOG, SHOP_POOL } from "./items";
import { activeSets, FIRE_BURN_STACKS, GUARDIAN_EXTRA_BLOCK, SET_IDS, setCounts, setMembers } from "./sets";

describe("set definitions", () => {
  it("has at least two sets with at least three items each, one of them Fire", () => {
    expect(SET_IDS.length).toBeGreaterThanOrEqual(2);
    expect(SET_IDS).toContain("fire");
    for (const id of SET_IDS) expect(setMembers(id).length).toBeGreaterThanOrEqual(3);
  });

  it("puts every set item in the shop", () => {
    for (const id of SET_IDS) {
      for (const item of setMembers(id)) expect(SHOP_POOL).toContain(item);
    }
  });

  it("lets poisoned variants keep the set of their base item", () => {
    for (const item of CATALOG.filter((candidate) => candidate.variantOf)) {
      expect(item.set).toBe(CATALOG.find((base) => base.id === item.variantOf)!.set);
    }
  });
});

describe("activating sets", () => {
  it("needs two different items of a set", () => {
    expect(activeSets(["torch"])).toEqual([]);
    expect(activeSets(["torch", "firecracker"])).toEqual(["fire"]);
    expect(activeSets(["torch", "firecracker", "oak-buckler", "pot-lid"])).toEqual(["fire", "guardian"]);
  });

  it("counts copies of the same item, and a poisoned variant with its base, only once", () => {
    expect(setCounts(["torch", "torch"]).fire).toBe(1);
    expect(activeSets(["torch", "torch"])).toEqual([]);
    expect(setCounts(["spiked-shield", "poisoned-spiked-shield"]).guardian).toBe(1);
    expect(activeSets(["poisoned-spiked-shield", "oak-buckler"])).toEqual(["guardian"]);
  });
});

describe("set bonuses in battle", () => {
  it("adds burn to Fire items only while the Fire set is active", () => {
    const inactive = buildFighter(["torch", "chipped-dagger"], 40);
    expect(inactive.items[0].effects.burn).toBeUndefined();

    const active = buildFighter(["torch", "firecracker", "chipped-dagger"], 40);
    expect(active.activeSets).toEqual(["fire"]);
    expect(active.items[0].effects).toEqual({ damage: 2, burn: FIRE_BURN_STACKS });
    expect(active.items[2].effects).toEqual({ damage: 3 });
  });

  it("adds extra block to Guardian items while the Guardian set is active", () => {
    const fighter = buildFighter(["oak-buckler", "spiked-shield", "hunting-bow"], 40);
    expect(fighter.items[0].effects.block).toBe(4 + GUARDIAN_EXTRA_BLOCK);
    expect(fighter.items[1].effects).toEqual({ damage: 3, block: 3 + GUARDIAN_EXTRA_BLOCK });
    expect(fighter.items[2].effects).toEqual({ damage: 5 });
  });

  it("applies to opponents the same way", () => {
    const opponent = buildOpponentFighter({ id: "x", name: "Pyro", icon: "🔥", hp: 30, round: 1, items: ["torch", "magma-hammer"] });
    expect(opponent.activeSets).toEqual(["fire"]);
    expect(opponent.items.every((item) => item.effects.burn === FIRE_BURN_STACKS)).toBe(true);
  });
});
