import type { ItemDef, ItemEffects } from "./types";

/** Poison stacks every poisoned weapon adds to the enemy when it fires. */
export const POISONED_STACKS = 2;
/** A poisoned weapon costs this much more than its normal version. */
export const POISONED_EXTRA_PRICE = 2;

/** Items the shop rolls directly. */
const BASE_ITEMS: ItemDef[] = [
  { id: "chipped-dagger", name: "Chipped Dagger", icon: "🗡️", price: 2, cooldown: 4, effects: { damage: 3 } },
  { id: "hunting-bow", name: "Hunting Bow", icon: "🏹", price: 4, cooldown: 4, effects: { damage: 5 } },
  { id: "iron-cleaver", name: "Iron Cleaver", icon: "🪓", price: 5, cooldown: 8, effects: { damage: 12 } },
  { id: "oak-buckler", name: "Oak Buckler", icon: "🛡️", price: 3, cooldown: 5, effects: { block: 4 } },
  { id: "pot-lid", name: "Pot Lid", icon: "🍳", price: 2, cooldown: 3, effects: { block: 2 } },
  { id: "spiked-shield", name: "Spiked Shield", icon: "⚔️", price: 4, cooldown: 6, effects: { damage: 3, block: 3 } },
  { id: "healing-herb", name: "Healing Herb", icon: "🌿", price: 2, cooldown: 4, effects: { heal: 2 } },
  { id: "love-charm", name: "Love Charm", icon: "💕", price: 3, cooldown: 5, effects: { heal: 3 } },
  { id: "health-potion", name: "Health Potion", icon: "🧪", price: 5, cooldown: 8, effects: { heal: 7 } },
];

/** Rare poisoned version of a weapon: same stats plus poison, a bit more expensive. */
function poisoned(id: string, name: string, baseId: string): ItemDef {
  const base = BASE_ITEMS.find((item) => item.id === baseId);
  if (!base) throw new Error(`Unknown base item: ${baseId}`);
  return {
    ...base,
    id,
    name,
    price: base.price + POISONED_EXTRA_PRICE,
    effects: { ...base.effects, poison: POISONED_STACKS },
    variantOf: base.id,
  };
}

/** Variants the shop can roll instead of their base item (see `rollShop`). */
const VARIANTS: ItemDef[] = [
  poisoned("poisoned-dagger", "Poisoned Dagger", "chipped-dagger"),
  poisoned("poisoned-bow", "Poisoned Bow", "hunting-bow"),
  poisoned("poisoned-cleaver", "Poisoned Cleaver", "iron-cleaver"),
  poisoned("poisoned-spiked-shield", "Poisoned Spiked Shield", "spiked-shield"),
];

/** Every item in the game, including rare variants. */
export const CATALOG: ItemDef[] = [...BASE_ITEMS, ...VARIANTS];

/** Items the shop picks from before variants are applied. */
export const SHOP_POOL: ItemDef[] = BASE_ITEMS;

const byId = new Map(CATALOG.map((item) => [item.id, item]));

export function getItem(id: string): ItemDef {
  const item = byId.get(id);
  if (!item) throw new Error(`Unknown item: ${id}`);
  return item;
}

/** The rare variant of a base item, if it has one. */
export function variantOf(baseId: string): ItemDef | undefined {
  return VARIANTS.find((item) => item.variantOf === baseId);
}

const EFFECT_LABELS: [keyof ItemEffects, (n: number) => string][] = [
  ["damage", (n) => `⚔️ ${n} dmg`],
  ["poison", (n) => `☠️ ${n} poison`],
  ["block", (n) => `🛡️ +${n} block`],
  ["heal", (n) => `💕 +${n} heal`],
];

/** Short labels for an item's effects, e.g. `[{ effect: "damage", label: "⚔️ 2 dmg" }, …]`. */
export function describeEffects(effects: ItemEffects): { effect: keyof ItemEffects; label: string }[] {
  return EFFECT_LABELS.flatMap(([effect, label]) => (effects[effect] ? [{ effect, label: label(effects[effect]) }] : []));
}
