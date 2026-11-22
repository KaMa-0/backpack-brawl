import { TICK_SECONDS } from "../battle";
import { describeEffects, getItem } from "../items";
import { BACKPACK_COLS } from "../shop";
import { moveBlocker, sellBlocker } from "../run";
import type { Backpack as BackpackSlots, ItemDef, RunState } from "../types";
import { useState } from "react";

/** Hover text for a backpack slot: name, effects and cooldown. */
const tooltip = (item: ItemDef) =>
  [item.name, ...describeEffects(item.effects).map(({ label }) => label), `⏱️ every ${item.cooldown * TICK_SECONDS}s`].join("\n");

export function Backpack({ run, onSell, onMove }: { run: RunState; onSell: (slotIndex: number) => void; onMove: (fromIndex: number, toIndex: number) => void }) {
  const backpack: BackpackSlots = run.backpack;
  const [selected, setSelected] = useState<number | null>(null);

  function handleSlot(index: number) {
    if (selected === null) {
      if (backpack[index]) setSelected(index);
      return;
    }
    if (selected === index) {
      setSelected(null);
      return;
    }
    if (moveBlocker(run, selected, index) === null) {
      onMove(selected, index);
      setSelected(null);
    }
  }

  return (
    <section className="rounded-lg border border-panel-edge bg-panel p-4">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h2 className="font-display text-xl font-bold">🎒 Backpack</h2>
          <p className="text-sm text-muted">Select an item, then choose another slot.</p>
        </div>
        {selected !== null && (
          <button type="button" onClick={() => setSelected(null)} className="rounded-md border border-panel-edge px-2 py-1 text-xs text-muted hover:border-gold hover:text-gold">
            Cancel
          </button>
        )}
      </div>
      <ul className="grid gap-2" style={{ gridTemplateColumns: `repeat(${BACKPACK_COLS}, minmax(0, 1fr))` }}>
        {backpack.map((slot, index) => {
          const item = slot ? getItem(slot.itemId) : null;
          const isSelected = selected === index;
          const moveAllowed = selected !== null && moveBlocker(run, selected, index) === null;
          return (
            <li
              key={slot?.uid ?? `empty-${index}`}
              title={item ? tooltip(item) : undefined}
              aria-label={item ? item.name : `Empty slot ${index + 1}`}
              className={[
                "relative flex aspect-square flex-col items-center justify-center gap-1 rounded-md border-2 p-1",
                item ? "border-gold/40 bg-ink/40" : "border-dashed border-panel-edge",
                isSelected ? "ring-2 ring-gold" : "",
                moveAllowed ? "cursor-pointer ring-1 ring-inset ring-gold/70" : "",
              ].join(" ")}
            >
              {item ? (
                <>
                  <button type="button" onClick={() => handleSlot(index)} aria-label={`${isSelected ? "Selected" : "Select"} ${item.name}`} className="flex h-full w-full flex-col items-center justify-center gap-1">
                    <span className="text-3xl leading-none sm:text-4xl" aria-hidden>{item.icon}</span>
                    <span className="text-center text-xs leading-tight">{item.name}</span>
                  </button>
                  {selected === null && (
                    <button type="button" onClick={() => onSell(index)} title={sellBlocker(run, index) ?? `Sell for ${Math.floor(item.price / 2)} 🪙`} className="absolute bottom-1 rounded bg-panel px-1 text-xs font-bold text-gold hover:brightness-125">
                      Sell · {Math.floor(item.price / 2)} 🪙
                    </button>
                  )}
                </>
              ) : (
                <button type="button" onClick={() => handleSlot(index)} disabled={selected === null} aria-label={`Empty slot ${index + 1}${selected !== null ? ", move here" : ""}`} className="h-full w-full rounded" />
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
