import { Link, Outlet, useLocation } from "react-router";
import { ROUTES, routeForGame } from "../game";
import { useGame } from "../state/GameContext";

export function Layout() {
  const location = useLocation();
  const { game, notice, dismissNotice } = useGame();
  const isHallOfFame = location.pathname === ROUTES.hall;
  const backRoute = routeForGame(game);

  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-4">
      <header className="flex items-center justify-between border-b-2 border-panel-edge py-4">
        <h1 className="font-display text-2xl font-bold sm:text-3xl">
          <Link to={ROUTES.start}>
            🎒 Backpack <span className="text-gold">Brawl</span>
          </Link>
        </h1>
        {isHallOfFame ? (
          <Link
            to={backRoute}
            className="rounded-md border border-panel-edge px-3 py-2 text-sm font-bold hover:border-gold"
          >
            ← Back
          </Link>
        ) : (
          <Link
            to={ROUTES.hall}
            className="rounded-md border border-panel-edge px-3 py-2 text-sm font-bold hover:border-gold"
          >
            🏆 Hall of Fame
          </Link>
        )}
      </header>

      {notice && (
        <div role="status" className="mt-4 flex items-start justify-between gap-3 rounded-lg border border-gold bg-gold/10 px-4 py-3 text-sm">
          <p>ℹ️ {notice}</p>
          <button type="button" onClick={dismissNotice} aria-label="Dismiss message" className="font-bold text-muted hover:text-gold">
            ✕
          </button>
        </div>
      )}

      <main className="flex flex-1 flex-col gap-4 py-6">
        <Outlet />
      </main>

      <footer className="border-t border-panel-edge py-3 text-xs tracking-wider text-muted">
        Backpack Brawl · practical exam starter
      </footer>
    </div>
  );
}
