import { create } from "zustand";
import {
  applyAction,
  assertInvariants,
  createGame,
  nextRound,
  type Action,
  type GameState,
  type Strategy,
} from "./game/engine";
import { freshSeed } from "./seed";
export { freshSeed };

const SAVE_KEY = "poker-warzone-v1";
const AI_KEY = "poker-warzone-ai-v1";
function loadStrategy(): Strategy {
  try {
    const value = localStorage.getItem(AI_KEY);
    if (value === "random" || value === "greedy" || value === "strategic")
      return value;
  } catch {}
  return "strategic";
}
function loadGame(): GameState {
  try {
    const saved = localStorage.getItem(SAVE_KEY);
    if (saved) {
      const game = JSON.parse(saved) as GameState;
      assertInvariants(game);
      return game;
    }
  } catch {
    /* A damaged or old save starts a fresh game. */
  }
  const game = createGame(freshSeed());
  save(game);
  return game;
}
function save(game: GameState) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(game));
  } catch {
    /* Gameplay works without storage. */
  }
}
interface Store {
  game: GameState;
  strategy: Strategy;
  error: string;
  act: (a: Action) => void;
  advance: () => void;
  restart: (seed: string, strategy: Strategy) => void;
  setError: (error: string) => void;
}
export const useGame = create<Store>((set, get) => ({
  game: loadGame(),
  strategy: loadStrategy(),
  error: "",
  act: (a) => {
    try {
      const game = applyAction(get().game, a);
      assertInvariants(game);
      save(game);
      set({ game, error: "" });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : "操作失败，请重新选牌" });
    }
  },
  advance: () => {
    try {
      const game = nextRound(get().game);
      save(game);
      set({ game, error: "" });
    } catch (e) {
      set({ error: String(e) });
    }
  },
  restart: (seed, strategy) => {
    const game = createGame(seed || freshSeed());
    save(game);
    try {
      localStorage.setItem(AI_KEY, strategy);
    } catch {}
    set({ game, strategy, error: "" });
  },
  setError: (error) => set({ error }),
}));
