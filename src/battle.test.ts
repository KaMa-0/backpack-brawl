import { describe, expect, it } from "vitest";
import {
  BURN_DAMAGE_PER_STACK,
  BURN_DECAY,
  BURN_INTERVAL,
  buildFighter,
  POISON_DAMAGE_PER_STACK,
  POISON_INTERVAL,
  simulateBattle,
} from "./battle";
import { FIRE_BURN_STACKS } from "./sets";
import { CATALOG, getItem, POISONED_EXTRA_PRICE, POISONED_STACKS } from "./items";
import type { Fighter, ItemEffects } from "./types";

/** A fighter with one test item, so each rule can be checked in isolation. */
function fighter(name: string, maxHp: number, cooldown: number, effects: ItemEffects): Fighter {
  return { name, maxHp, activeSets: [], items: [{ itemId: "chipped-dagger", name: `${name}'s item`, icon: "🧪", cooldown, effects }] };
}

describe("poison", () => {
  it("stacks up and deals damage every interval, ignoring block", () => {
    const player = fighter("Hero", 100, 1, { poison: 1 });
    const enemy = fighter("Wall", 100, 1, { block: 50 });
    const { frames, events } = simulateBattle(player, enemy);

    // Tick 1: one stack, no poison damage yet. Tick 2: two stacks, then poison deals 2.
    expect(frames[1].opponent).toMatchObject({ hp: 100, poison: 1 });
    expect(frames[POISON_INTERVAL].opponent).toMatchObject({ hp: 98, poison: 2 });
    expect(frames[POISON_INTERVAL].opponent.block).toBeGreaterThan(0);

    const ticks = events.filter((event) => event.kind === "poison-tick");
    expect(ticks[0]).toMatchObject({ tick: 2, target: "opponent", source: "player", amount: 2 });
    expect(ticks.every((event) => event.tick % POISON_INTERVAL === 0)).toBe(true);
  });

  it("never decays", () => {
    const player = fighter("Hero", 100, 100, { damage: 1 });
    const poisoner = fighter("Spider", 100, 1, { poison: 1 });
    const { frames } = simulateBattle(player, poisoner);
    const stacks = frames.map((frame) => frame.player.poison);
    expect(stacks).toEqual([...stacks].sort((a, b) => a - b));
  });
});

describe("heal", () => {
  it("never heals above max HP", () => {
    const player = fighter("Hero", 10, 1, { heal: 5 });
    const enemy = fighter("Brute", 1000, 2, { damage: 3 });
    const { frames, events } = simulateBattle(player, enemy);

    expect(frames.every((frame) => frame.player.hp <= frame.player.maxHp)).toBe(true);
    // Tick 1: already at full HP. Tick 2: hit for 3. Tick 3: heals exactly the 3 missing HP.
    const heals = events.filter((event) => event.kind === "heal");
    expect(heals[0]).toMatchObject({ tick: 1, amount: 0 });
    expect(heals[2]).toMatchObject({ tick: 3, amount: 3 });
    expect(frames[3].player.hp).toBe(10);
  });

  it("can't revive a knocked-out fighter", () => {
    const player = fighter("Hero", 100, 1, { damage: 10 });
    const enemy = fighter("Healer", 5, 1, { heal: 20 });
    const result = simulateBattle(player, enemy);

    expect(result.winner).toBe("player");
    expect(result.events.some((event) => event.kind === "heal")).toBe(false);
  });
});

describe("status effects in the catalog", () => {
  it("has at least three poison and three heal items", () => {
    expect(CATALOG.filter((item) => item.effects.poison).length).toBeGreaterThanOrEqual(3);
    expect(CATALOG.filter((item) => item.effects.heal).length).toBeGreaterThanOrEqual(3);
  });

  it("makes poisoned weapons cost 2 more and add poison on top of the base stats", () => {
    for (const item of CATALOG.filter((candidate) => candidate.variantOf)) {
      const base = getItem(item.variantOf!);
      expect(item.price).toBe(base.price + POISONED_EXTRA_PRICE);
      expect(item.effects).toEqual({ ...base.effects, poison: POISONED_STACKS });
      expect(item.cooldown).toBe(base.cooldown);
    }
  });

  it("gives the same result for the same fighters", () => {
    const player = buildFighter(["poisoned-dagger", "love-charm", "oak-buckler"], 40, "Hero");
    const enemy = buildFighter(["poisoned-bow", "health-potion", "spiked-shield"], 50, "Rival");
    expect(simulateBattle(player, enemy)).toEqual(simulateBattle(player, enemy));
  });
});

describe("burn", () => {
  it("deals damage every tick, then decays", () => {
    const result = simulateBattle(fighter("Target", 100, 1000, {}), fighter("Pyro", 100, 1, { burn: 3 }));
    // Tick 1: +3 stacks, burn deals 3, then decays. Tick 2: +3 more, burn deals 5, then decays.
    expect(result.frames[1].player).toMatchObject({ hp: 97, burn: 3 - BURN_DECAY });
    expect(result.frames[2].player).toMatchObject({ hp: 92, burn: 5 - BURN_DECAY });
    expect(result.events.find((event) => event.kind === "burn-tick")).toMatchObject({ tick: 1, target: "player", source: "opponent", amount: 3 });
  });

  it("wears off when no new burn is added", () => {
    // Pyro fires at tick 8 only (and again at 16): the burn fades 3 → 2 → 1 → 0 in between.
    const result = simulateBattle(fighter("Target", 1000, 1000, {}), fighter("Pyro", 1000, 8, { burn: 3 }));
    expect(result.frames.slice(8, 12).map((frame) => frame.player.burn)).toEqual([2, 1, 0, 0]);
    expect(result.frames[11].player.hp).toBe(1000 - 3 - 2 - 1);
  });

  it("is absorbed by block first", () => {
    const result = simulateBattle(fighter("Target", 100, 1, { block: 10 }), fighter("Pyro", 100, 1, { burn: 3 }));
    // Tick 1: the target gains 10 block, then the 3 burn damage only hits the block.
    expect(result.frames[1].player).toMatchObject({ hp: 100, block: 7 });
    expect(result.events.find((event) => event.kind === "burn-tick")?.message).toContain("3 blocked");
  });

  it("stacks faster and deals more damage than poison", () => {
    expect(FIRE_BURN_STACKS).toBeGreaterThan(POISONED_STACKS);
    const burnPerStackPerTick = BURN_DAMAGE_PER_STACK / BURN_INTERVAL;
    const poisonPerStackPerTick = POISON_DAMAGE_PER_STACK / POISON_INTERVAL;
    expect(burnPerStackPerTick).toBeGreaterThan(poisonPerStackPerTick);
  });
});
