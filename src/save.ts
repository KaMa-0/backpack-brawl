import { buildOpponentFighter, buildPlayerFighter, simulateBattle } from "./battle";
import { newGame } from "./game";
import { hasItem } from "./items";
import { applyBattleResult, runOutcome } from "./run";
import { BACKPACK_SIZE, SHOP_SIZE } from "./shop";
import type { BattleReplay, GameState, Opponent, RunState } from "./types";

export const SAVE_KEY = "backpack-brawl.run";
export const SAVE_VERSION = 1;

interface SaveEnvelope {
  version: 1;
  game: GameState;
}

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface RestoredGame {
  game: GameState;
  notice: string | null;
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;
const isInteger = (value: unknown): value is number => typeof value === "number" && Number.isInteger(value);

function validRunRound(run: RunState): boolean {
  const losses = 3 - run.lives;
  const played = run.wins + losses;
  const outcome = runOutcome(run);
  return run.round === (outcome ? played : played + 1);
}

function validRun(value: unknown): value is RunState {
  if (!isRecord(value)) return false;
  const r = value;
  if (typeof r.runId !== "string" || r.runId.length === 0) return false;
  if (!isInteger(r.round) || r.round < 1 || r.round > 5) return false;
  if (!isInteger(r.gold) || r.gold < 0) return false;
  if (!isInteger(r.lives) || r.lives < 0 || r.lives > 3) return false;
  if (!isInteger(r.wins) || r.wins < 0 || r.wins > 5) return false;
  if (!isInteger(r.seed) || r.seed < 0 || r.seed > 0xffffffff) return false;
  if (!isInteger(r.nextUid) || r.nextUid < 1) return false;
  if (!Array.isArray(r.shop) || r.shop.length !== SHOP_SIZE) return false;
  if (!r.shop.every((id) => id === null || (typeof id === "string" && hasItem(id)))) return false;
  if (!Array.isArray(r.backpack) || r.backpack.length !== BACKPACK_SIZE) return false;

  const uids = new Set<string>();
  let largestUid = 0;
  for (const slot of r.backpack) {
    if (slot === null) continue;
    if (!isRecord(slot) || typeof slot.uid !== "string" || typeof slot.itemId !== "string") return false;
    if (!hasItem(slot.itemId) || uids.has(slot.uid)) return false;
    uids.add(slot.uid);
    if (/^item-(\d+)$/.test(slot.uid)) largestUid = Math.max(largestUid, Number(slot.uid.slice(5)));
  }
  if (largestUid >= r.nextUid) return false;
  if (!validRunRound(r as unknown as RunState)) return false;

  const outcome = runOutcome(r as unknown as RunState);
  if (outcome === "victory" && r.wins !== 5) return false;
  if (outcome === "defeat" && r.lives !== 0) return false;
  if (!outcome && (r.wins === 5 || r.lives === 0)) return false;
  return true;
}

function validOpponent(value: unknown, round: number): value is Opponent {
  if (!isRecord(value)) return false;
  return typeof value.id === "string" && value.id.length > 0 &&
    typeof value.name === "string" && typeof value.icon === "string" &&
    isInteger(value.hp) && value.hp > 0 && value.round === round &&
    Array.isArray(value.items) && value.items.length <= BACKPACK_SIZE &&
    value.items.every((id) => typeof id === "string" && hasItem(id));
}

function validBattle(value: unknown, run: RunState): value is BattleReplay {
  if (!isRecord(value)) return false;
  if (!isInteger(value.frame)) return false;

  const opponent = validOpponent(value.opponent, run.round)
    ? value.opponent
    : run.round > 1 && validOpponent(value.opponent, run.round - 1)
      ? value.opponent
      : null;
  if (!opponent) return false;
  if (!isRecord(value.player) || !isRecord(value.enemy) || !isRecord(value.result)) return false;

  const player = buildPlayerFighter(run.backpack);
  const enemy = buildOpponentFighter(opponent);
  const expected = simulateBattle(player, enemy);
  if (!deepEqual(value.result, expected)) return false;
  const last = expected.frames.length - 1;
  if (value.frame < 0 || value.frame > last) return false;

  if (value.frame === last) {
    const winner = expected.winner;
    if (winner === "player" && run.wins < 1) return false;
    if (winner === "opponent" && run.lives >= 3) return false;
  }
  return true;
}

function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function saveGame(game: GameState, storage: StorageLike | undefined = typeof localStorage === "undefined" ? undefined : localStorage): void {
  if (!storage) return;
  try {
    if (!validGame(game)) return;
    storage.setItem(SAVE_KEY, JSON.stringify({ version: SAVE_VERSION, game } satisfies SaveEnvelope));
  } catch {
    // Storage may be blocked or full; the run in memory remains usable.
  }
}

export function clearSavedGame(storage: StorageLike | undefined = typeof localStorage === "undefined" ? undefined : localStorage): void {
  try { storage?.removeItem(SAVE_KEY); } catch { /* Storage may be unavailable. */ }
}

export function restoreGame(seed: number, storage: StorageLike | undefined = typeof localStorage === "undefined" ? undefined : localStorage): RestoredGame {
  if (!storage) return { game: newGame(seed), notice: null };
  let raw: string | null;
  try { raw = storage.getItem(SAVE_KEY); } catch { return { game: newGame(seed), notice: null }; }
  if (raw === null) return { game: newGame(seed), notice: null };

  try {
    const envelope = JSON.parse(raw) as unknown;
    if (!isRecord(envelope) || envelope.version !== SAVE_VERSION || !isRecord(envelope.game)) throw new Error("invalid save");
    const game = envelope.game as unknown as GameState;
    if (!validGame(game)) throw new Error("impossible save");

    if (game.phase === "searching") {
      return {
        game: { ...game, phase: "shop", search: null, battle: null, error: "Search cancelled after refresh. Nothing was rerolled or spent. Try again." },
        notice: null,
      };
    }
    if (game.phase === "battle" && game.battle) {
      const battle = game.battle;
      if (battle.frame < battle.result.frames.length - 1) {
        const finished = { ...battle, frame: battle.result.frames.length - 1 };
        return {
          game: { ...game, battle: finished, run: applyBattleResult(game.run, battle.result.winner) },
          notice: null,
        };
      }
      return { game: { ...game, battle: { ...battle, frame: battle.result.frames.length - 1 } }, notice: null };
    }
    return { game, notice: null };
  } catch {
    clearSavedGame(storage);
    return { game: { ...newGame(seed), error: "The saved run was invalid or incompatible, so a fresh playable run was started." }, notice: "Saved run discarded" };
  }
}

function validGame(value: unknown): value is GameState {
  if (!isRecord(value)) return false;
  if (!["shop", "searching", "battle", "finished"].includes(value.phase as string)) return false;
  if (!validRun(value.run)) return false;
  const run = value.run as RunState;
  if (value.error !== null && typeof value.error !== "string") return false;

  if (value.phase === "shop") return value.battle === null && value.search === null;
  if (value.phase === "searching") {
    if (value.battle !== null) return false;
    if (!isRecord(value.search)) return false;
    return typeof value.search.id === "string" && value.search.id.length > 0 && value.search.round === run.round;
  }
  if (value.phase === "battle") {
    if (value.search !== null) return false;
    return validBattle(value.battle, run);
  }
  if (value.phase === "finished") {
    return value.battle === null && value.search === null && runOutcome(run) !== null;
  }
  return false;
}
