import { runSimulation, type SimulationConfig } from "../src/game/simulation";
import type { Strategy } from "../src/game/engine";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
const args = process.argv.slice(2);
function value(key: string, fallback: string) {
  const i = args.indexOf(`--${key}`);
  return i < 0 ? fallback : args[i + 1];
}
const strategies = [value("a", "greedy"), value("b", "greedy")];
if (strategies.some((s) => !["random", "greedy", "strategic"].includes(s)))
  throw Error("策略必须为 random / greedy / strategic");
const config: SimulationConfig = {
  games: Number(value("games", "1000")),
  seed: value("seed", "baseline-01"),
  strategies: strategies as [Strategy, Strategy],
};
const result = runSimulation(config),
  output = value("out", "");
if (output) {
  const path = resolve(output);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(result, null, 2) + "\n");
}
console.log(JSON.stringify(result, null, 2));
