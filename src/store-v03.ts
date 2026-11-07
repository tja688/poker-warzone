import { create } from "zustand";
import { freshSeed } from "./seed";
import {
  applyAction03,
  createGame03,
  legalActions03,
  nextRound03,
  viewFor,
  type Action03,
  type Game03,
} from "./game/engine-v03";

const SAVE_KEY = "poker-warzone-v03";
const PERSONA_KEY = "poker-warzone-persona-v03";
export type PersonaId = "solid" | "balanced" | "bluff";
const PHASES = ["action", "roundOver", "finished"] as const;

function loadPersona(): PersonaId {
  try {
    const value = localStorage.getItem(PERSONA_KEY);
    if (value === "solid" || value === "balanced" || value === "bluff")
      return value;
  } catch {
    /* Default persona. */
  }
  return "balanced";
}

/** A v0.1 save has no `core`. Reject it instead of playing classic state as dark-card poker. */
function loadGame(): Game03 {
  try {
    const saved = localStorage.getItem(SAVE_KEY);
    if (saved) {
      const game = JSON.parse(saved) as Game03;
      if (
        game?.core?.players?.length === 2 &&
        !("chips" in game) &&
        Array.isArray(game.hidden) &&
        game.hidden.length === 2 &&
        (PHASES as readonly string[]).includes(game.phase) &&
        game.config &&
        (game.config.hiddenSlots === 0 ||
          game.config.hiddenSlots === 1 ||
          game.config.hiddenSlots === 2)
      ) {
        viewFor(game, 0);
        legalActions03(game);
        return game;
      }
    }
  } catch {
    /* A damaged save starts a fresh v0.3 match. */
  }
  const game = createGame03(freshSeed());
  save(game);
  return game;
}

function save(game: Game03) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(game));
  } catch {
    /* Gameplay works without storage. */
  }
}

interface Store03 {
  game: Game03;
  persona: PersonaId;
  error: string;
  act: (action: Action03) => void;
  advance: () => void;
  restart: (seed: string) => void;
  setPersona: (persona: PersonaId) => void;
  setError: (error: string) => void;
}

export const useGame03 = create<Store03>((set, get) => ({
  game: loadGame(),
  persona: loadPersona(),
  error: "",
  act: (action) => {
    try {
      const game = applyAction03(get().game, action);
      save(game);
      set({ game, error: "" });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : "操作失败，请重新选牌" });
    }
  },
  advance: () => {
    try {
      const game = nextRound03(get().game);
      save(game);
      set({ game, error: "" });
    } catch (e) {
      set({ error: String(e) });
    }
  },
  restart: (seed) => {
    const game = createGame03(seed || freshSeed());
    save(game);
    set({ game, error: "" });
  },
  setPersona: (persona) => {
    try {
      localStorage.setItem(PERSONA_KEY, persona);
    } catch {
      /* The current match still uses the clicked persona. */
    }
    set({ persona });
  },
  setError: (error) => set({ error }),
}));
