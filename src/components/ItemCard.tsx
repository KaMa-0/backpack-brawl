import type { ReactNode } from "react";
import { TICK_SECONDS } from "../battle";
import { describeEffects } from "../items";
import { COOLDOWN_HELP, EFFECT_HELP, RARE_HELP, setHelp } from "../rules";
import { SETS, withSetBonus } from "../sets";
import type { ItemDef, SetId } from "../types";
import { SetBadge } from "./SetBadge";

interface ItemCardProps {
  item: ItemDef;
  /** Sets that would be active with this item; their bonus is included in the shown effects. */
  activeSets?: SetId[];
  /** Extra content below the stats, e.g. a buy button. */
  children?: ReactNode;
}

export function ItemCard({ item, activeSets = [], children }: ItemCardProps) {
  const effects = withSetBonus(item, activeSets);
  const bonusSet = item.set && activeSets.includes(item.set) ? item.set : null;

  return (
    <article className={`flex flex-col gap-2 rounded-lg border-2 bg-ink/40 p-3 ${item.variantOf ? "border-poison/70" : "border-gold/40"}`}>
      <div className="flex items-start gap-3">
        <span className="text-3xl leading-none" aria-hidden>
          {item.icon}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-display font-bold">{item.name}</h3>
          {item.set && <SetBadge setId={item.set} />}
          {item.variantOf && (
            <p title={RARE_HELP} className={`text-xs font-bold text-poison ${HELP}`}>
              ✨ Rare poisoned version
            </p>
          )}
        </div>
      </div>
      <ul className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
        {describeEffects(effects).map(({ effect, label }) => (
          <li key={effect} title={EFFECT_HELP[effect]} className={HELP}>
            {label}
          </li>
        ))}
        <li title={COOLDOWN_HELP} className={`text-muted ${HELP}`}>
          ⏱️ every {item.cooldown * TICK_SECONDS}s
        </li>
      </ul>
      {bonusSet && (
        <p title={setHelp(bonusSet)} className={`text-xs font-bold text-gold ${HELP}`}>
          ✓ {SETS[bonusSet].name} bonus included
        </p>
      )}
      {children}
    </article>
  );
}

/** Hover hint styling for texts that have an explanatory tooltip. */
const HELP = "cursor-help underline decoration-dotted decoration-muted/60 underline-offset-2";
