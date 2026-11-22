import { HERO_BASE_HP, MAX_TICKS, POISON_DAMAGE_PER_STACK, POISON_INTERVAL, TICK_SECONDS } from "./battle";
import { POISONED_EXTRA_PRICE } from "./items";
import { GOLD_PER_ROUND, START_GOLD, START_LIVES, WINS_TO_VICTORY } from "./run";
import { BACKPACK_COLS, BACKPACK_ROWS, POISON_VARIANT_CHANCE, SHOP_SIZE } from "./shop";
import type { ItemEffects } from "./types";

/**
 * Player-facing explanations of the rules. Built from the game constants so
 * the texts stay correct when numbers are rebalanced.
 */

const BATTLE_SECONDS = MAX_TICKS * TICK_SECONDS;
const POISON_SECONDS = POISON_INTERVAL * TICK_SECONDS;
const POISON_RULE = `Every ${POISON_SECONDS} s a poisoned fighter loses ${POISON_DAMAGE_PER_STACK} HP per stack. Poison ignores block, and stacks add up and never wear off during the battle.`;
const HEAL_RULE = "Heal restores the item owner's HP, but never above max HP. A knocked-out fighter can't be healed.";

/** Tooltip per item effect. */
export const EFFECT_HELP: Record<keyof ItemEffects, string> = {
  damage: "Damage: hits the enemy. Block absorbs it first, the rest is lost from HP.",
  block: "Block: absorbs incoming damage until used up. Unused block stays for the rest of the battle.",
  poison: `Poison: adds this many stacks to the enemy. ${POISON_RULE}`,
  heal: `Heal: ${HEAL_RULE}`,
};

/** Tooltip for the badge on rare poisoned weapons. */
export const RARE_HELP = `Rare: replaces a normal weapon offer with a ${POISON_VARIANT_CHANCE * 100}% chance. Same stats plus poison, ${POISONED_EXTRA_PRICE} 🪙 more expensive.`;

export const COOLDOWN_HELP = `Cooldown: the item fires every time this much battle time has passed (1 tick = ${TICK_SECONDS} s).`;

/** Tooltip per fighter status shown in battle. */
export const STATUS_HELP = {
  hp: "HP: reaching 0 is a knockout.",
  block: EFFECT_HELP.block,
  poison: `Poison stacks on this fighter. ${POISON_RULE}`,
  timer: `After ${BATTLE_SECONDS} s the fighter with the higher share of HP wins; a tie counts as your loss.`,
};

export interface RuleSection {
  title: string;
  rules: string[];
}

export const RULES: RuleSection[] = [
  {
    title: "🏆 The run",
    rules: [
      `Reach ${WINS_TO_VICTORY} wins before you lose all ${START_LIVES} lives.`,
      `Each battle is one round: a win gives +1 win, a loss costs 1 life.`,
      `Opponents get tougher every round.`,
    ],
  },
  {
    title: "🏪 Shop & backpack",
    rules: [
      `You start with ${START_GOLD} 🪙 and earn ${GOLD_PER_ROUND} 🪙 at the start of every new round. Unspent gold carries over.`,
      `The shop offers ${SHOP_SIZE} new items every round.`,
      `Weapons sometimes show up as rare poisoned versions (${POISON_VARIANT_CHANCE * 100}% chance per weapon offer). They cost ${POISONED_EXTRA_PRICE} 🪙 more.`,
      `Bought items go to the first free slot of your ${BACKPACK_COLS}×${BACKPACK_ROWS} backpack and stay there for the whole run.`,
      `Sell a backpack item for half its price, rounded down. Reroll the shop offers for 1 🪙.`,
      `Backpack actions are available only while shopping.`,
      `Only items in your backpack fight. Their position doesn't matter.`,
      `Select a backpack item to move it; choose another slot to move or swap. Use Cancel to clear the selection.`,
    ],
  },
  {
    title: "⚔️ Battle",
    rules: [
      `Battles run on their own. Your hero has ${HERO_BASE_HP} HP; every item fires whenever its cooldown is up.`,
      `Damage hits block first; only the rest is lost from HP. Unused block stays for the rest of the battle.`,
      `☠️ Poison: ${POISON_RULE}`,
      `💕 ${HEAL_RULE}`,
      `Knock the enemy out to win. ${STATUS_HELP.timer} If both fall at once, you lose.`,
    ],
  },
];
