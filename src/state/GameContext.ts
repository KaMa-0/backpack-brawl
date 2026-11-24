import { createContext, useContext } from "react";
import type { GameState } from "../types";

export interface GameContextValue {
  /** The current run (restored from the browser or newly started). */
  game: GameState;
  /** Throws away the current run and starts a fresh one. */
  startNewRun: () => void;
  /** Applies a pure transition from game.ts to the current run. */
  update: (transition: (game: GameState) => GameState) => void;
  /** Message about what a refresh changed (see `RESTORE_NOTICES`), or `null`. */
  notice: string | null;
  dismissNotice: () => void;
}

export const GameContext = createContext<GameContextValue | null>(null);

export function useGame(): GameContextValue {
  const context = useContext(GameContext);
  if (!context) throw new Error("useGame must be used inside <GameProvider>");
  return context;
}

/** Used by the shop, battle and result pages. Since B6 there is always a run, so this is the same as `useGame`. */
export const useActiveGame = useGame;
