import { CATALOG, getItem } from "./items";
import type { ItemDef, ItemEffects, SetId } from "./types";

/** A set's bonus is active while a fighter has at least this many *different* items of it. */
export const SET_THRESHOLD = 2;
/** Fire bonus: burn stacks every Fire item adds to the enemy when it fires. */
export const FIRE_BURN_STACKS = 3;
/** Guardian bonus: extra block every Guardian item grants when it fires. */
export const GUARDIAN_EXTRA_BLOCK = 2;

export interface SetDef {
  id: SetId;
  name: string;
  icon: string;
  /** Effects added to every item of the set while the bonus is active. */
  bonus: ItemEffects;
  /** Player-facing description of the bonus. */
  bonusText: string;
}

export const SETS: Record<SetId, SetDef> = {
  fire: {
    id: "fire",
    name: "Fire",
    icon: "🔥",
    bonus: { burn: FIRE_BURN_STACKS },
    bonusText: `Fire items also add ${FIRE_BURN_STACKS} 🔥 Burn to the enemy.`,
  },
  guardian: {
    id: "guardian",
    name: "Guardian",
    icon: "🛡️",
    bonus: { block: GUARDIAN_EXTRA_BLOCK },
    bonusText: `Guardian items grant +${GUARDIAN_EXTRA_BLOCK} extra block.`,
  },
};

export const SET_IDS = Object.keys(SETS) as SetId[];

/** Base items of a set; rare variants (e.g. poisoned) count as their base item. */
export function setMembers(setId: SetId): ItemDef[] {
  return CATALOG.filter((item) => item.set === setId && !item.variantOf);
}

/** How many *different* items of each set are in the list. A poisoned variant counts as its base item. */
export function setCounts(itemIds: string[]): Record<SetId, number> {
  const distinct = Object.fromEntries(SET_IDS.map((id) => [id, new Set<string>()])) as Record<SetId, Set<string>>;
  for (const id of itemIds) {
    const item = getItem(id);
    if (item.set) distinct[item.set].add(item.variantOf ?? item.id);
  }
  return Object.fromEntries(SET_IDS.map((id) => [id, distinct[id].size])) as Record<SetId, number>;
}

/** Sets whose bonus is active for the given items. */
export function activeSets(itemIds: string[]): SetId[] {
  const counts = setCounts(itemIds);
  return SET_IDS.filter((id) => counts[id] >= SET_THRESHOLD);
}

/** The item's effects with its set bonus added, if that set is active. */
export function withSetBonus(item: ItemDef, active: SetId[]): ItemEffects {
  const effects: ItemEffects = { ...item.effects };
  if (!item.set || !active.includes(item.set)) return effects;
  for (const [key, value] of Object.entries(SETS[item.set].bonus) as [keyof ItemEffects, number][]) {
    effects[key] = (effects[key] ?? 0) + value;
  }
  return effects;
}
