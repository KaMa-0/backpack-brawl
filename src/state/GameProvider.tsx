import { useEffect, useState, type ReactNode } from "react";
import { newGame } from "../game";
import { restoreGame, saveGame } from "../save";
import type { GameState } from "../types";
import { GameContext, type GameContextValue } from "./GameContext";

const randomSeed = () => Math.floor(Math.random() * 2 ** 32);

/** Holds the game state for all routes, restores it safely, and persists valid transitions. */
export function GameProvider({ children }: { children: ReactNode }) {
  // Read the save only once, when the app starts.
  const [restored] = useState(() => restoreGame(randomSeed()));
  const [game, setGame] = useState<GameState>(restored.game);
  const [notice, setNotice] = useState<string | null>(restored.notice);

  useEffect(() => {
    saveGame(game);
  }, [game]);

  const value: GameContextValue = {
    game,
    startNewRun: () => {
      setGame(newGame(randomSeed()));
      setNotice(null);
    },
    update: (transition) => setGame((current) => transition(current)),
    notice,
    dismissNotice: () => setNotice(null),
  };

  return <GameContext value={value}>{children}</GameContext>;
}
