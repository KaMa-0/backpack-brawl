import { setHelp } from "../rules";
import { SET_IDS, SET_THRESHOLD, SETS, setCounts, setMembers } from "../sets";
import type { SetId } from "../types";

/** Small chip that marks an item's set; hover explains the set. */
export function SetBadge({ setId, compact = false, className = "" }: { setId: SetId; compact?: boolean; className?: string }) {
  const set = SETS[setId];
  return (
    <span
      title={setHelp(setId)}
      aria-label={`${set.name} set`}
      className={`cursor-help rounded bg-ink/60 px-1 text-xs font-bold leading-5 ${setId === "fire" ? "text-burn" : "text-block"} ${className}`}
    >
      {set.icon}
      {!compact && ` ${set.name}`}
    </span>
  );
}

/**
 * Progress of every set for a list of item ids, e.g. "🔥 Fire 1/3".
 * With `onlyActive`, lists just the active bonuses (used in battle).
 */
export function SetProgress({ itemIds, onlyActive = false }: { itemIds: string[]; onlyActive?: boolean }) {
  const counts = setCounts(itemIds);
  const shown = SET_IDS.filter((id) => !onlyActive || counts[id] >= SET_THRESHOLD);
  if (shown.length === 0) return onlyActive ? <p className="text-xs text-muted">No set bonus active</p> : null;

  return (
    <ul className="flex flex-col gap-1 text-xs" aria-label="Set bonuses">
      {shown.map((id) => {
        const set = SETS[id];
        const active = counts[id] >= SET_THRESHOLD;
        return (
          <li
            key={id}
            title={setHelp(id)}
            className={`cursor-help rounded border px-2 py-1 ${active ? "border-gold bg-gold/10 text-parchment" : "border-panel-edge text-muted"}`}
          >
            <span className="font-bold">
              {set.icon} {set.name} {counts[id]}/{setMembers(id).length}
            </span>{" "}
            {active ? `✓ ${set.bonusText}` : `· ${SET_THRESHOLD} different items activate the bonus`}
          </li>
        );
      })}
    </ul>
  );
}
