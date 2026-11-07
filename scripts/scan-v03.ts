import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { balanced, station } from "../src/game/ai-v03";
import type { Config03 } from "../src/game/engine-v03";
import {
  configSlug,
  createSimulationResult03,
  oracle,
  scanSetups,
  SIM_SAMPLES,
  simulateOne03,
  type SimPolicy,
  type SimulationConfig03,
} from "../src/game/simulation-v03";

const SCAN_SEED = "scan-v03";
const SCAN_GAMES = 2000;
const PROBE_GAMES = 20;
const PROBE_BUDGET_MS = 80;
const OUT_DIR = resolve("docs/simulation-v0.3");

const BLOCKS: { id: string; policies: [SimPolicy, SimPolicy] }[] = [
  { id: "balanced-vs-station", policies: [balanced, station] },
  { id: "oracle-vs-balanced", policies: [oracle, balanced] },
  { id: "balanced-vs-balanced", policies: [balanced, balanced] },
];

const heavy: Config03 = {
  privateHands: true,
  hiddenSlots: 2,
  multiplier: 2,
  antes: [1, 1, 1, 1, 1],
  startingChips: 12,
  cap: 8,
};

function probe(samples: number) {
  const config: SimulationConfig03 = {
    games: PROBE_GAMES,
    seed: "scan-v03-probe",
    samples,
    setup: heavy,
    policies: [oracle, balanced],
  };
  const result = createSimulationResult03(config);
  const times: number[] = [];
  for (let i = 0; i < PROBE_GAMES; i++) {
    const start = performance.now();
    simulateOne03(config, i, result);
    times.push(performance.now() - start);
  }
  times.sort((a, b) => a - b);
  const mean = times.reduce((sum, time) => sum + time, 0) / times.length;
  const median = (times[9] + times[10]) / 2;
  return {
    samples,
    mean,
    median,
    max: times[times.length - 1],
    failures: result.assertionFailures,
    completed: result.completed,
  };
}

function chooseSamples() {
  const tried: string[] = [];
  let samples = SIM_SAMPLES;
  while (samples >= 1) {
    const timed = probe(samples);
    tried.push(
      `samples=${timed.samples} games=${PROBE_GAMES} meanMs=${timed.mean.toFixed(1)} medianMs=${timed.median.toFixed(1)} maxMs=${timed.max.toFixed(1)} failures=${timed.failures} completed=${timed.completed}`,
    );
    if (timed.failures !== 0 || timed.completed !== PROBE_GAMES)
      throw Error("抽样探测没有完成 20 场");
    if (timed.mean <= PROBE_BUDGET_MS || samples === 1) break;
    samples = Math.floor(samples / 2);
  }
  console.log(
    `抽样探测 setup=${configSlug(heavy)} policies=oracle-vs-balanced ${tried.join(" | ")} chosen=${samples}`,
  );
  return samples;
}

const samples = chooseSamples();
if (process.argv.includes("--probe")) process.exit(0);

mkdirSync(OUT_DIR, { recursive: true });
for (const setup of scanSetups()) {
  const blocks = BLOCKS.map((block) => ({
    id: block.id,
    result: runBlock(setup, block.policies),
  }));
  const file = {
    seed: SCAN_SEED,
    games: SCAN_GAMES,
    samples,
    setup,
    blocks,
  };
  writeFileSync(
    resolve(OUT_DIR, `${configSlug(setup)}.json`),
    JSON.stringify(file, null, 2) + "\n",
  );
  console.log(configSlug(setup));
}

function runBlock(setup: Config03, policies: [SimPolicy, SimPolicy]) {
  const config: SimulationConfig03 = {
    games: SCAN_GAMES,
    seed: SCAN_SEED,
    samples,
    setup,
    policies,
  };
  const result = createSimulationResult03(config);
  const start = performance.now();
  for (let i = 0; i < SCAN_GAMES; i++) simulateOne03(config, i, result);
  result.durationMs = performance.now() - start;
  return result;
}
