import { chooseAction } from "./ai";
import {
  applyAction,
  assertInvariants,
  createGame,
  nextRound,
  type Strategy,
} from "./engine";
export interface SimulationConfig {
  games: number;
  seed: string;
  strategies: [Strategy, Strategy];
}
export interface SimulationResult {
  config: SimulationConfig;
  completed: number;
  wins: [number, number];
  draws: number;
  rounds: number;
  fiveRoundGames: number;
  roundDraws: number;
  transitions: number;
  previousWinnerWins: number;
  previousWinnerDraws: number;
  firstStarterWins: number;
  firstStarterDraws: number;
  handCounts: number[];
  actionCounts: { absorb: number; swap: number; discard: number };
  assertionFailures: number;
  durationMs: number;
}
export function createSimulationResult(
  config: SimulationConfig,
): SimulationResult {
  return {
    config,
    completed: 0,
    wins: [0, 0],
    draws: 0,
    rounds: 0,
    fiveRoundGames: 0,
    roundDraws: 0,
    transitions: 0,
    previousWinnerWins: 0,
    previousWinnerDraws: 0,
    firstStarterWins: 0,
    firstStarterDraws: 0,
    handCounts: Array(10).fill(0),
    actionCounts: { absorb: 0, swap: 0, discard: 0 },
    assertionFailures: 0,
    durationMs: 0,
  };
}
export function simulateOne(
  config: SimulationConfig,
  index: number,
  result: SimulationResult,
): void {
  let s = createGame(`${config.seed}:${index}`);
  const actions = { absorb: 0, swap: 0, discard: 0 };
  let guard = 0;
  try {
    assertInvariants(s);
    while (s.phase !== "finished") {
      if (++guard > 150) throw Error("单场推进超过安全上限");
      if (s.phase === "roundOver") s = nextRound(s);
      else {
        const a = chooseAction(s, config.strategies[s.turn]);
        actions[a.kind]++;
        s = applyAction(s, a);
      }
      assertInvariants(s);
    }
  } catch (e) {
    result.assertionFailures++;
    throw e;
  }
  // Only complete games contribute to any metric; cancellation never adds partial games.
  result.completed++;
  result.rounds += s.history.length;
  if (s.history.length === 5) result.fiveRoundGames++;
  if (s.winner === "draw") {
    result.draws++;
    result.firstStarterDraws++;
  } else if (s.winner !== null) {
    result.wins[s.winner]++;
    if (s.winner === s.firstStarter) result.firstStarterWins++;
  }
  for (let i = 0; i < s.history.length; i++) {
    const h = s.history[i];
    if (h.winner === "draw") result.roundDraws++;
    for (const hand of h.grades) result.handCounts[hand.grade]++;
    if (i > 0 && s.history[i - 1].winner !== "draw") {
      result.transitions++;
      if (h.winner === "draw") result.previousWinnerDraws++;
      else if (h.winner === s.history[i - 1].winner)
        result.previousWinnerWins++;
    }
  }
  for (const k of ["absorb", "swap", "discard"] as const)
    result.actionCounts[k] += actions[k];
}
export function runSimulation(config: SimulationConfig): SimulationResult {
  if (!Number.isSafeInteger(config.games) || config.games < 1)
    throw Error("局数必须为正整数");
  const result = createSimulationResult(config),
    start = performance.now();
  for (let i = 0; i < config.games; i++) simulateOne(config, i, result);
  result.durationMs = performance.now() - start;
  return result;
}
