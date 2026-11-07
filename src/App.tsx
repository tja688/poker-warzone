import { lazy, Suspense } from "react";
import { MotionConfig } from "motion/react";
import { GameTable } from "./table/GameTable";
const Lab = lazy(() => import("./Lab"));
// Research tools have a separate URL and bundle; the game has no tool navigation.
export default function App() {
  if (new URLSearchParams(location.search).has("lab"))
    return (
      <main className="lab-page">
        <header>
          <a href="./">← 回到牌桌</a>
          <h1>模拟实验室</h1>
        </header>
        <Suspense fallback={<p>载入中…</p>}>
          <Lab />
        </Suspense>
      </main>
    );
  return (
    <MotionConfig
      reducedMotion="user"
      transition={{ type: "spring", stiffness: 420, damping: 34 }}
    >
      <GameTable />
    </MotionConfig>
  );
}
