import { lazy, Suspense, useState } from "react";
import { MotionConfig } from "motion/react";
import { GameTable03 } from "./table/GameTable03";
import { readRules, writeRules, type RulesVersion } from "./rules";
const ClassicTable = lazy(() =>
  import("./table/GameTable").then((mod) => ({ default: mod.GameTable })),
);
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
  return <Tables />;
}

function Tables() {
  const [rules, setRules] = useState(readRules);
  const choose = (next: RulesVersion) => {
    writeRules(next);
    const url = new URL(location.href);
    url.searchParams.set("rules", next);
    history.replaceState(null, "", url);
    setRules(next);
  };
  return (
    <MotionConfig
      reducedMotion="user"
      transition={{ type: "spring", stiffness: 420, damping: 34 }}
    >
      <Suspense fallback={null}>
        {rules === "v0.1" ? (
          <ClassicTable rules={rules} onRules={choose} />
        ) : (
          <GameTable03 rules={rules} onRules={choose} />
        )}
      </Suspense>
    </MotionConfig>
  );
}
