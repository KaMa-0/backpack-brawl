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
      className={`cursor-help rounded bg-ink/60 px-1 text-xs font-bold leading-5 ${set.colour} ${className}`}
    >
      {set.icon}
      {!compact && ` ${set.name}`}
    </span>
  );
}

/** Progress of every set for a list of item ids, e.g. "🔥 Fire 1/3". */
export function SetProgress({ itemIds }: { itemIds: string[] }) {
  const counts = setCounts(itemIds);

  return (
    <ul className="flex flex-col gap-1 text-xs" aria-label="Set bonuses">
      {SET_IDS.map((id) => {
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

/** A fighter's active set bonuses in battle (from `Fighter.activeSets`). */
export function ActiveSets({ sets }: { sets: SetId[] }) {
  if (sets.length === 0) return <p className="text-xs text-muted">No set bonus active</p>;

  return (
    <ul className="flex flex-col gap-1 text-xs" aria-label="Active set bonuses">
      {sets.map((id) => (
        <li key={id} title={setHelp(id)} className="cursor-help rounded border border-gold bg-gold/10 px-2 py-1 text-parchment">
          <span className="font-bold">
            {SETS[id].icon} {SETS[id].name}
          </span>{" "}
          ✓ {SETS[id].bonusText}
        </li>
      ))}
    </ul>
  );
}
