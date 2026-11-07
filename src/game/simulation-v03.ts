import { compareHands, evaluate, type PlayerId } from "./engine";
import {
  balanced,
  bluff,
  chooseFair,
  chooseOracle,
  randomBet,
  solid,
  station,
  type Policy,
} from "./ai-v03";
import {
  applyAction03,
  createGame03,
  nextRound03,
  viewFor,
  type Action03,
  type Config03,
  type Game03,
  type Result03,
} from "./engine-v03";

/** Table personas stay solid, balanced, and bluff. Oracle exists only here. */
export const oracle = { kind: "oracle" } as const;
export type SimPolicy = Policy | typeof oracle;
export type SimPolicyName =
  | "solid"
  | "balanced"
  | "bluff"
  | "station"
  | "randomBet"
  | "oracle";

export const SIM_SAMPLES = 8;
export const ANTE_ROWS = [
  [1, 1, 1, 1, 1],
  [1, 1, 1, 2, 2],
  [1, 1, 2, 2, 4],
] as const;
export const HIDDEN_SLOTS = [0, 1, 2] as const;
export const MULTIPLIERS = [1, 2] as const;
export const STARTING_CHIPS = [8, 10, 12] as const;

const POLICIES: Record<SimPolicyName, SimPolicy> = {
  solid,
  balanced,
  bluff,
  station,
  randomBet,
  oracle,
};

export interface SimulationConfig03 {
  games: number;
  seed: string;
  samples: number;
  setup: Config03;
  policies: [SimPolicy, SimPolicy];
}

export interface GameMarks {
  retreats: number;
  retreatWouldWin: number;
  leaderOpenRetreats: number;
  leaderOpenChances: number;
}

export interface SimulationResult03 {
  rules: "v0.3";
  config: SimulationConfig03;
  completed: number;
  wins: [number, number];
  draws: number;
  knockouts: number;
  chipFinishes: number;
  rounds: number;
  retreats: number;
  retreatWouldWin: number;
  trailerWins: number;
  leaderOpenRetreats: number;
  leaderOpenChances: number;
  firstStarterWins: number;
  assertionFailures: number;
  durationMs: number;
}

export type Decide03 = (game: Game03) => Action03;

export function policyByName(name: string): SimPolicy {
  if (Object.hasOwn(POLICIES, name)) return POLICIES[name as SimPolicyName];
  throw Error(
    "策略必须为 solid / balanced / bluff / station / randomBet / oracle",
  );
}

export function policyName(policy: SimPolicy): SimPolicyName {
  if (
    policy.kind === "oracle" ||
    policy.kind === "station" ||
    policy.kind === "randomBet"
  )
    return policy.kind;
  if (policy.rate === solid.rate && policy.tighter === solid.tighter)
    return "solid";
  if (policy.rate === bluff.rate && policy.tighter === bluff.tighter)
    return "bluff";
  return "balanced";
}

export function anteFromKey(key: string): Config03["antes"] {
  const row = ANTE_ROWS.find((antes) => antes.join(",") === key);
  if (!row) throw Error("底注必须为 1,1,1,1,1 / 1,1,1,2,2 / 1,1,2,2,4");
  return [row[0], row[1], row[2], row[3], row[4]];
}

function oneOf<T extends number>(value: number, allowed: readonly T[], message: string): T {
  const found = allowed.find((item) => item === value);
  if (found === undefined) throw Error(message);
  return found;
}

export function makeSetup(input: {
  privateHands: boolean;
  hiddenSlots: number;
  multiplier: number;
  antes: readonly number[];
  startingChips: number;
}): Config03 {
  return {
    privateHands: input.privateHands,
    hiddenSlots: oneOf(input.hiddenSlots, HIDDEN_SLOTS, "暗位必须为 0 / 1 / 2"),
    multiplier: oneOf(input.multiplier, MULTIPLIERS, "倍数必须为 1 / 2"),
    antes: anteFromKey(input.antes.join(",")),
    startingChips: oneOf(
      input.startingChips,
      STARTING_CHIPS,
      "起始筹码必须为 8 / 10 / 12",
    ),
    cap: 8,
  };
}

export function scanSetups(): Config03[] {
  const setups: Config03[] = [];
  for (const privateHands of [true, false])
    for (const hiddenSlots of HIDDEN_SLOTS)
      for (const multiplier of MULTIPLIERS)
        for (const antes of ANTE_ROWS)
          for (const startingChips of STARTING_CHIPS)
            setups.push(
              makeSetup({
                privateHands,
                hiddenSlots,
                multiplier,
                antes,
                startingChips,
              }),
            );
  return setups;
}

export function configSlug(setup: Config03): string {
  return `${setup.privateHands ? "private" : "open"}-h${setup.hiddenSlots}-m${setup.multiplier}-a${setup.antes.join("")}-c${setup.startingChips}`;
}

export function createSimulationResult03(
  config: SimulationConfig03,
): SimulationResult03 {
  return {
    rules: "v0.3",
    config: structuredClone(config),
    completed: 0,
    wins: [0, 0],
    draws: 0,
    knockouts: 0,
    chipFinishes: 0,
    rounds: 0,
    retreats: 0,
    retreatWouldWin: 0,
    trailerWins: 0,
    leaderOpenRetreats: 0,
    leaderOpenChances: 0,
    firstStarterWins: 0,
    assertionFailures: 0,
    durationMs: 0,
  };
}

function battle(game: Game03, player: PlayerId) {
  return game.core.players[player].fields[game.core.round - 1].cards;
}

export function recordFinishedGame(
  result: SimulationResult03,
  game: Game03,
  _marks: GameMarks,
): void {
  const winner = game.winner;
  const scores = [game.core.players[0].score, game.core.players[1].score];
  const drawOk = winner === "draw" && scores[0] >= 3 && scores[1] >= 3;
  const winOk =
    (winner === 0 || winner === 1) &&
    scores[winner] >= 3 &&
    scores[winner === 0 ? 1 : 0] < 3;
  if (game.phase !== "finished" || !(drawOk || winOk)) {
    result.assertionFailures++;
    return;
  }
  result.completed++;
  if (winner === "draw") result.draws++;
  else {
    result.wins[winner]++;
    if (winner === game.core.firstStarter) result.firstStarterWins++;
  }
  result.rounds += game.results.length;
}

function defaultDecide(config: SimulationConfig03): Decide03 {
  return (game) => {
    const policy = config.policies[game.actor];
    if (policy.kind === "oracle") return chooseOracle(game, config.samples);
    return chooseFair(viewFor(game, game.actor), policy, config.samples);
  };
}

export function simulateOne03(
  config: SimulationConfig03,
  index: number,
  result: SimulationResult03,
  decide: Decide03 = defaultDecide(config),
): void {
  const marks: GameMarks = {
    retreats: 0,
    retreatWouldWin: 0,
    leaderOpenRetreats: 0,
    leaderOpenChances: 0,
  };
  let game = createGame03(`${config.seed}:${index}`, config.setup);
  let guard = 0;
  let opening = true;
  try {
    while (game.phase !== "finished") {
      if (++guard > 500) throw Error("单场推进超过安全上限");
      if (game.phase === "roundOver") {
        game = nextRound03(game);
        opening = true;
        continue;
      }
      const action = decide(game);
      opening = false;
      game = applyAction03(game, action);
    }
  } catch (error) {
    result.assertionFailures++;
    throw error;
  }
  recordFinishedGame(result, game, marks);
}

export function runSimulation03(config: SimulationConfig03): SimulationResult03 {
  if (!Number.isSafeInteger(config.games) || config.games < 1)
    throw Error("局数必须为正整数");
  if (!Number.isSafeInteger(config.samples) || config.samples < 1)
    throw Error("抽样数必须为正整数");
  const result = createSimulationResult03(config);
  const start = performance.now();
  for (let i = 0; i < config.games; i++) simulateOne03(config, i, result);
  result.durationMs = performance.now() - start;
  return result;
}
