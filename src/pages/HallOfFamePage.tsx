import { useEffect, useState } from "react";
import { fetchHallOfFame } from "../api";
import { loadHallSubmission } from "../hallSubmission";
import type { HallEntry } from "../types";

export function HallOfFamePage() {
  const [entries, setEntries] = useState<HallEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const ownRunId = loadHallSubmission()?.runId;

  useEffect(() => {
    let cancelled = false;
    fetchHallOfFame()
      .then((value) => { if (!cancelled) setEntries(value); })
      .catch((reason: unknown) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "Could not load the hall of fame.");
      });
    return () => { cancelled = true; };
  }, [attempt]);

  function retry() {
    setEntries(null);
    setError(null);
    setAttempt((value) => value + 1);
  }

  return (
    <section className="mx-auto w-full max-w-2xl rounded-lg border-2 border-gold bg-panel p-6">
      <h2 className="mb-4 text-center font-display text-3xl font-bold">🏆 Hall of Fame</h2>
      {entries === null && !error && <p className="text-center text-muted" role="status">Loading the champions…</p>}
      {error && (
        <div className="flex flex-col items-center gap-3 text-center">
          <p className="text-life" role="alert">{error}</p>
          <button type="button" onClick={retry} className="rounded-md bg-gold px-4 py-2 font-bold text-ink">Try again</button>
        </div>
      )}
      {entries !== null && entries.length === 0 && <p className="text-center text-muted">No finished runs yet. Be the first champion.</p>}
      {entries !== null && entries.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="text-xs uppercase tracking-wider text-muted">
              <tr><th className="p-2">#</th><th className="p-2">Name</th><th className="p-2">Result</th><th className="p-2">Wins</th><th className="p-2">Rounds</th></tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.runId} className={`border-t border-panel-edge ${entry.runId === ownRunId ? "bg-gold/15" : ""}`}>
                  <td className="p-2 font-bold text-gold">{entry.rank}</td>
                  <td className="p-2 font-bold">
                    {entry.name}
                    {entry.runId === ownRunId && <span className="ml-2 text-xs text-gold">(your run)</span>}
                  </td>
                  <td className="p-2">{entry.victory ? "👑 Victory" : "🪦 Defeat"}</td>
                  <td className="p-2">{entry.wins}</td>
                  <td className="p-2">{entry.rounds}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-4 text-center text-xs text-muted">Ranking: victories first, then more wins, then fewer rounds. Ties: the earlier submission ranks higher.</p>    </section>
  );
}
