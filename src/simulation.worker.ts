/// <reference lib="webworker" />
import {
  createSimulationResult,
  simulateOne,
  type SimulationConfig,
} from "./game/simulation";
self.onmessage = async (event: MessageEvent<SimulationConfig>) => {
  const config = event.data;
  const result = createSimulationResult(config);
  const start = performance.now();
  let lastUpdate = start;
  try {
    for (let i = 0; i < config.games; i++) {
      simulateOne(config, i, result);
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
