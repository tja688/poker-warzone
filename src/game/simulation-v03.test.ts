import { test } from "node:test";
import { strict as assert } from "node:assert";
import { compareHands, evaluate, type PlayerId } from "./engine";
import { balanced, station } from "./ai-v03";
import {
  applyAction03,
  createGame03,
  nextRound03,
  type Config03,
  type Game03,
} from "./engine-v03";
import type { PersonaId } from "../store-v03";
import {
  configSlug,
  createSimulationResult03,
  makeSetup,
  oracle,
  policyByName,
  recordFinishedGame,
  scanSetups,
  simulateOne03,
  type Decide03,
} from "./simulation-v03";

type NoOracleOnTable = Exclude<
  PersonaId,
  "solid" | "balanced" | "bluff"
> extends never
  ? true
  : never;
const noOracleOnTable: NoOracleOnTable = true;

test("the table persona union has no oracle", () => {
  assert.equal(noOracleOnTable, true);
  assert.equal(policyByName("oracle"), oracle);
  assert.throws(() => policyByName("greedy"));
});

test("one station game finishes with a winner and a conserved chip sum", () => {
  const setup = makeSetup({
    privateHands: true,
    hiddenSlots: 1,
    multiplier: 1,
    antes: [1, 1, 1, 1, 1],
    startingChips: 8,
  });
  const result = createSimulationResult03({
    games: 1,
    seed: "station-smoke",
    samples: 1,
    setup,
    policies: [station, station],
  });
  simulateOne03(result.config, 0, result);
  assert.equal(result.assertionFailures, 0);
  assert.equal(result.completed, 1);
  assert.equal(result.wins[0] + result.wins[1] + result.draws, 1);
});

test("the scan grid is the section 5.3 cells and keeps cap 8", () => {
  const setups = scanSetups();
  assert.equal(setups.length, 2 * 3 * 2 * 3 * 3);
  assert.equal(new Set(setups.map((setup) => setup.cap)).size, 1);
  assert.equal(setups[0].cap, 8);
  assert.equal(new Set(setups.map(configSlug)).size, setups.length);
  assert.throws(() =>
    makeSetup({
      privateHands: true,
      hiddenSlots: 3,
      multiplier: 2,
      antes: [1, 1, 1, 2, 2],
      startingChips: 10,
    }),
  );
});
