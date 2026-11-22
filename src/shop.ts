import { SHOP_POOL, variantOf } from "./items";
import type { Backpack } from "./types";

export const SHOP_SIZE = 4;
export const BACKPACK_COLS = 2;
export const BACKPACK_ROWS = 3;
export const BACKPACK_SIZE = BACKPACK_COLS * BACKPACK_ROWS;

/** Small seeded PRNG: same seed → same sequence of numbers in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Chance that a weapon offer is replaced by its rare poisoned version. */
export const POISON_VARIANT_CHANCE = 0.25;

/**
 * Rolls `SHOP_SIZE` offers (duplicates allowed) and returns the seed for the next roll.
 * Each offer picks an item from the shop pool; if that item has a rare variant
 * (a poisoned weapon), a second roll turns it into the variant with `POISON_VARIANT_CHANCE`.
 */
export function rollShop(seed: number): { offers: string[]; seed: number } {
  const rng = mulberry32(seed);
  const offers = Array.from({ length: SHOP_SIZE }, () => {
    const base = SHOP_POOL[Math.floor(rng() * SHOP_POOL.length)];
    const variant = variantOf(base.id);
    return variant && rng() < POISON_VARIANT_CHANCE ? variant.id : base.id;
  });
  return { offers, seed: Math.floor(rng() * 4294967296) };
}

/** Item ids of all occupied backpack slots, in grid order. */
export function itemIdsOf(backpack: Backpack): string[] {
  return backpack.flatMap((slot) => (slot ? [slot.itemId] : []));
}
