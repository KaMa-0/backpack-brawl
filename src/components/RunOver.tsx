import { useRef, useState } from "react";
import { Link } from "react-router";
import { submitHallRun } from "../api";
import { ROUTES } from "../game";
import type { RunOutcome } from "../run";
import type { RunState } from "../types";

export function RunOver({ run, outcome, onNewRun }: { run: RunState; outcome: RunOutcome; onNewRun: () => void }) {
  const victory = outcome === "victory";
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const nameValid = name.trim().length >= 2 && name.trim().length <= 24;

  async function handleSubmit() {
    if (inFlight.current || submitted) return;
    if (!nameValid) {
      setError("Enter a name with 2–24 characters.");
      return;
    }
    inFlight.current = true;
    setSubmitting(true);
    setError(null);
    try {
      await submitHallRun({ runId: run.runId, name: name.trim(), wins: run.wins, lives: run.lives, rounds: run.round });
      setSubmitted(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not submit this run.");
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  }

  return (
    <section className={`mx-auto flex w-full max-w-lg flex-col items-center gap-4 rounded-lg border-2 bg-panel p-8 text-center ${victory ? "border-gold" : "border-life"}`}>
      <p className="text-6xl" aria-hidden>{victory ? "👑" : "🪦"}</p>
      <h2 className="font-display text-3xl font-bold">{victory ? "Champion of the arena!" : "Your run is over"}</h2>
      <p className="text-muted">{run.wins} {run.wins === 1 ? "win" : "wins"} in {run.round} {run.round === 1 ? "round" : "rounds"}, {run.lives} {run.lives === 1 ? "life" : "lives"} left.</p>

      {!submitted ? (
        <div className="flex w-full max-w-sm flex-col gap-2">
          <label htmlFor="hall-name" className="text-sm font-bold">Hall of Fame name</label>
          <input id="hall-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={24} disabled={submitting} placeholder="Your champion name" className="rounded-md border border-panel-edge bg-ink px-3 py-2 text-parchment" />
          {error && <p className="text-sm text-life" role="alert">{error}</p>}
          <button type="button" onClick={handleSubmit} disabled={submitting} className="rounded-md bg-gold px-5 py-2 font-display font-bold text-ink hover:brightness-110 disabled:opacity-60">
            {submitting ? "Submitting…" : error ? "Retry submission" : "Submit to Hall of Fame"}
          </button>
        </div>
      ) : (
        <p className="rounded-md border border-gold px-4 py-2 text-gold" role="status">✓ Run saved to the Hall of Fame</p>
      )}

      <div className="flex flex-wrap justify-center gap-2">
        <button type="button" onClick={onNewRun} autoFocus className="rounded-md bg-gold px-5 py-2 font-display font-bold text-ink hover:brightness-110">🎒 New run</button>
        <Link to={ROUTES.hall} className="rounded-md border border-panel-edge px-5 py-2 font-display font-bold hover:border-gold">🏆 View Hall</Link>
      </div>
    </section>
  );
}
