/// <reference lib="webworker" />
import {
  createSimulationResult,
  simulateOne,
  type SimulationConfig,
} from "./game/simulation";
import {
  createSimulationResult03,
  simulateOne03,
  type SimulationConfig03,
  type SimulationResult03,
} from "./game/simulation-v03";
import type { SimulationResult } from "./game/simulation";

type Job = SimulationConfig | SimulationConfig03;
type Report = SimulationResult | SimulationResult03;

function is03(job: Job): job is SimulationConfig03 {
  return "setup" in job;
}

self.onmessage = async (event: MessageEvent<Job>) => {
  const config = event.data;
  const result: Report = is03(config)
    ? createSimulationResult03(config)
    : createSimulationResult(config);
  const start = performance.now();
  let lastUpdate = start;
  try {
    for (let i = 0; i < config.games; i++) {
      if (is03(config)) simulateOne03(config, i, result as SimulationResult03);
      else simulateOne(config, i, result as SimulationResult);
      if (performance.now() - lastUpdate > 120 || i === config.games - 1) {
        result.durationMs = performance.now() - start;
        self.postMessage({
          type: i === config.games - 1 ? "done" : "progress",
          result,
        });
        lastUpdate = performance.now();
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }
  } catch (error) {
    self.postMessage({
      type: "error",
      message: error instanceof Error ? error.message : String(error),
      result,
    });
  }
};
