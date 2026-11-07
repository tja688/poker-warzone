import { runSimulation, type SimulationConfig } from "../src/game/simulation";
import type { Strategy } from "../src/game/engine";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  anteFromKey,
  makeSetup,
  policyByName,
  runSimulation03,
  SIM_SAMPLES,
  type SimulationConfig03,
} from "../src/game/simulation-v03";
const args = process.argv.slice(2);
function value(key: string, fallback: string) {
  const i = args.indexOf(`--${key}`);
  return i < 0 ? fallback : args[i + 1];
}
function boolFlag(key: string, fallback: boolean) {
  const raw = value(key, fallback ? "true" : "false");
  if (raw !== "true" && raw !== "false") throw Error(`${key} 必须为 true / false`);
  return raw === "true";
}
function write(output: string, result: unknown) {
  if (!output) return;
  const path = resolve(output);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(result, null, 2) + "\n");
}
const rules = value("rules", "v0.1");
if (rules !== "v0.1" && rules !== "v0.3")
  throw Error("规则必须为 v0.1 / v0.3");
if (rules === "v0.1") {
  const strategies = [value("a", "greedy"), value("b", "greedy")];
  if (strategies.some((s) => !["random", "greedy", "strategic"].includes(s)))
    throw Error("策略必须为 random / greedy / strategic");
  const config: SimulationConfig = {
    games: Number(value("games", "1000")),
    seed: value("seed", "baseline-01"),
    strategies: strategies as [Strategy, Strategy],
  };
  const result = runSimulation(config);
  write(value("out", ""), result);
  console.log(JSON.stringify(result, null, 2));
} else {
  const policies = [policyByName(value("a", "balanced")), policyByName(value("b", "balanced"))];
  const config: SimulationConfig03 = {
    games: Number(value("games", "1000")),
    seed: value("seed", "baseline-01"),
    samples: Number(value("samples", String(SIM_SAMPLES))),
    setup: makeSetup({
      privateHands: boolFlag("privateHands", true),
      hiddenSlots: Number(value("hiddenSlots", "2")),
      multiplier: Number(value("multiplier", "2")),
      antes: anteFromKey(value("antes", "1,1,1,2,2")),
      startingChips: Number(value("startingChips", "10")),
    }),
    policies: [policies[0], policies[1]],
  };
  const result = runSimulation03(config);
  write(value("out", ""), result);
  console.log(JSON.stringify(result, null, 2));
}
