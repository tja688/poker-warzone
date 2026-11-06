import { useEffect, useRef, useState } from "react";
import {
  ArrowDownToLine,
  Check,
  FlaskConical,
  Pause,
  Play,
  ShieldCheck,
} from "lucide-react";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "./components/ui/native-select";
import { HAND_NAMES, type Strategy } from "./game/engine";
import type { SimulationConfig, SimulationResult } from "./game/simulation";
const names: Record<Strategy, string> = {
  random: "随机",
  greedy: "贪心",
  strategic: "策略",
};
const pct = (n: number, d: number) =>
  d ? `${((100 * n) / d).toFixed(1)}%` : "—";
const fmt = (n: number) => n.toLocaleString("zh-CN");
function download(name: string, data: string, type: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([data], { type }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
function interval(n: number, d: number) {
  if (!d) return "暂无样本";
  const p = n / d,
    z = 1.96,
    den = 1 + (z * z) / d,
    center = (p + (z * z) / (2 * d)) / den,
    half = (z * Math.sqrt((p * (1 - p) + (z * z) / (4 * d)) / d)) / den;
  return `${(100 * (center - half)).toFixed(1)}–${(100 * (center + half)).toFixed(1)}%`;
}
export default function Lab() {
  const [games, setGames] = useState("1000");
  const [seed, setSeed] = useState("WARZONE-01");
  const [a, setA] = useState<Strategy>("greedy");
  const [b, setB] = useState<Strategy>("greedy");
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [stopped, setStopped] = useState(false);
  const worker = useRef<Worker | null>(null);
  useEffect(
    () => () => {
      worker.current?.terminate();
    },
    [],
  );
  function start() {
    const count = Number(games);
    if (!Number.isInteger(count) || count < 1 || count > 200000) {
      setError("请输入 1–200000 之间的整数局数。");
      return;
    }
    worker.current?.terminate();
    const w = new Worker(new URL("./simulation.worker.ts", import.meta.url), {
      type: "module",
    });
    worker.current = w;
    setRunning(true);
    setResult(null);
    setError("");
    setStopped(false);
    const config: SimulationConfig = {
      games: count,
      seed: seed.trim() || "WARZONE-01",
      strategies: [a, b],
    };
    w.onmessage = (e) => {
      if (e.data.result) setResult(e.data.result);
      if (e.data.type === "done") {
        setRunning(false);
        w.terminate();
      }
      if (e.data.type === "error") {
        setError(`模拟中止：${e.data.message}`);
        setRunning(false);
        w.terminate();
      }
    };
    w.onerror = (e) => {
      setError(`模拟未能完成：${e.message}`);
      setRunning(false);
      w.terminate();
    };
    w.postMessage(config);
  }
  function stop() {
    worker.current?.terminate();
    setRunning(false);
    setStopped(true);
  }
  function csv() {
    if (!result) return;
    const rows = [
      ["metric", "value"],
      ["seed", result.config.seed],
      ["strategy_a", result.config.strategies[0]],
      ["strategy_b", result.config.strategies[1]],
      ["requested", result.config.games],
      ...Object.entries(result)
        .filter(([k, v]) => typeof v === "number")
        .map(([k, v]) => [k, v]),
      ["wins_a", result.wins[0]],
      ["wins_b", result.wins[1]],
      ...result.handCounts.map((v, i) => [`hand_${HAND_NAMES[i] || i}`, v]),
      ...Object.entries(result.actionCounts).map(([k, v]) => [
        `action_${k}`,
        v,
      ]),
    ];
    download(
      `poker-warzone-${result.config.seed.replace(/[^a-zA-Z0-9_-]/g, "_")}.csv`,
      "\uFEFF" +
        rows
          .map((r) =>
            r.map((v) => `"${String(v).replaceAll('"', '""')}"`).join(","),
          )
          .join("\n"),
      "text/csv;charset=utf-8",
    );
  }
  const n = result?.completed || 0;
  return (
    <main className="lab-layout">
      <aside className="lab-config">
        <div className="panel-heading">
          <h2>对局设置</h2>
          <FlaskConical size={19} />
        </div>
        <p className="panel-intro">先用相同策略观察规则，再比较不同 AI。</p>
        <label className="form-label" htmlFor="games">
          模拟场数
        </label>
        <Input
          id="games"
          type="number"
          min={1}
          max={200000}
          value={games}
          disabled={running}
          onChange={(e) => setGames(e.target.value)}
        />
        <div className="count-presets">
          {[100, 1000, 10000, 100000].map((v) => (
            <Button
              key={v}
              size="sm"
              variant="ghost"
              disabled={running}
              onClick={() => setGames(String(v))}
            >
              {v >= 10000 ? `${v / 10000}万` : fmt(v)}
            </Button>
          ))}
        </div>
        <div className="strategy-pair">
          {(
            [
              ["A", a, setA],
              ["B", b, setB],
            ] as const
          ).map(([label, value, setter]) => (
            <div key={label}>
              <label className="form-label" htmlFor={`strategy-${label}`}>
                玩家 {label}
              </label>
              <NativeSelect
                id={`strategy-${label}`}
                value={value}
                disabled={running}
                onChange={(e) => setter(e.target.value as Strategy)}
              >
                {Object.entries(names).map(([k, v]) => (
                  <NativeSelectOption key={k} value={k}>
                    {v}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
          ))}
        </div>
        <label className="form-label" htmlFor="lab-seed">
          模拟种子
        </label>
        <Input
          id="lab-seed"
          value={seed}
          maxLength={64}
          disabled={running}
          onChange={(e) => setSeed(e.target.value)}
        />
        <p className="fine-print">
          同种子、同策略、同场数，得到相同结果。大局首轮先手独立随机。
        </p>
        <Button className="primary-action" onClick={running ? stop : start}>
          {running ? <Pause size={16} /> : <Play size={16} />}{" "}
          {running ? "停止模拟" : "开始批量模拟"}
        </Button>
        {error && (
          <p role="alert" className="error-message">
            {error}
          </p>
        )}
        <div className="strategy-notes">
          <h3>三种对手，三种思路</h3>
          <p>
            <b>随机</b> 从所有合法操作中选择，作为基线。
          </p>
          <p>
            <b>贪心</b> 追求眼前牌型，优先吸入可用控制牌；对应策划案的基准思路。
          </p>
          <p>
            <b>策略</b> 结合成牌潜力、对手明牌、控制区保留与选择性弃牌。
          </p>
          <p>三种 AI 均不读取牌库顺序。策略 AI 是启发式，强弱以实测为准。</p>
        </div>
      </aside>
      <section className="lab-results" aria-label="模拟结果">
        <div className="lab-result-header">
          <div>
            <h2>
              {running
                ? "模拟进行中"
                : result
                  ? stopped
                    ? "已停止 · 部分结果"
                    : "模拟完成"
                  : "等待第一批对局"}
            </h2>
            <p>
              {result
                ? `${names[result.config.strategies[0]]} A 对 ${names[result.config.strategies[1]]} B · ${fmt(n)} / ${fmt(result.config.games)} 场 · ${(result.durationMs / 1000).toFixed(1)} 秒`
                : "设置两位 AI，让它们在同一套规则下交手。"}
            </p>
          </div>
          {result && !running && (
            <div className="export-actions">
              <Button variant="outline" size="sm" onClick={csv}>
                <ArrowDownToLine size={14} />
                CSV
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  download(
                    "poker-warzone-simulation.json",
                    JSON.stringify(result, null, 2),
                    "application/json",
                  )
                }
              >
                <ArrowDownToLine size={14} />
                JSON
              </Button>
            </div>
          )}
        </div>
        <div
          className="simulation-progress"
          role="progressbar"
          aria-label="模拟进度"
          aria-valuenow={n}
          aria-valuemin={0}
          aria-valuemax={result?.config.games || Number(games) || 1000}
        >
          <span
            style={{
              width: result ? `${(100 * n) / result.config.games}%` : "0%",
            }}
          />
        </div>
        {result && n > 0 ? (
          <>
            <div className="win-overview">
              <div>
                <span>玩家 A 获胜</span>
                <b>{pct(result.wins[0], n)}</b>
                <small>{fmt(result.wins[0])} 场</small>
              </div>
              <div className="win-composition">
                <div className="win-bar">
                  <span
                    className="win-a"
                    style={{ width: `${(100 * result.wins[0]) / n}%` }}
                  />
                  <span
                    className="win-draw"
                    style={{ width: `${(100 * result.draws) / n}%` }}
                  />
                  <span
                    className="win-b"
                    style={{ width: `${(100 * result.wins[1]) / n}%` }}
                  />
                </div>
                <span>大局平局 {pct(result.draws, n)}</span>
              </div>
              <div>
                <span>玩家 B 获胜</span>
                <b>{pct(result.wins[1], n)}</b>
                <small>{fmt(result.wins[1])} 场</small>
              </div>
            </div>
            <dl className="stat-grid">
              <div>
                <dt>平均小局数</dt>
                <dd>
                  {(result.rounds / n).toFixed(2)}
                  <small> 局 / 场</small>
                </dd>
              </div>
              <div>
                <dt>打满 5 局</dt>
                <dd>{pct(result.fiveRoundGames, n)}</dd>
              </div>
              <div>
                <dt>首轮先手赢整场</dt>
                <dd>{pct(result.firstStarterWins, n)}</dd>
              </div>
              <div>
                <dt>小局平局率</dt>
                <dd>{pct(result.roundDraws, result.rounds)}</dd>
              </div>
            </dl>
            <div className="continuation-stat">
              <div>
                <h3>上局胜者，下一局还能赢吗？</h3>
                <p>
                  仅计上一局有唯一胜者、且还有下一局的样本；下一局平局另计。
                </p>
              </div>
              <b>{pct(result.previousWinnerWins, result.transitions)}</b>
              <div className="continuation-detail">
                <span>有效转移 {fmt(result.transitions)} 次</span>
                <span>
                  续局平局 {pct(result.previousWinnerDraws, result.transitions)}
                </span>
                <span>
                  95% Wilson 区间{" "}
                  {interval(result.previousWinnerWins, result.transitions)}
                </span>
              </div>
            </div>
            <div className="distribution">
              <h3>结算牌型分布</h3>
              <p>双方每次小局结算各计一手，共 {fmt(result.rounds * 2)} 手。</p>
              {HAND_NAMES.slice(1).map((name, i) => (
                <div className="distribution-row" key={name}>
                  <span>{name}</span>
                  <div>
                    <span
                      style={{
                        width: `${(100 * (result.handCounts[i + 1] || 0)) / Math.max(1, ...result.handCounts)}%`,
                      }}
                    />
                  </div>
                  <b>{pct(result.handCounts[i + 1] || 0, result.rounds * 2)}</b>
                </div>
              ))}
            </div>
            <div
              className={`assertion-banner ${result.assertionFailures ? "failed" : ""}`}
            >
              <ShieldCheck size={20} />
              <div>
                <b>
                  {result.assertionFailures
                    ? `${result.assertionFailures} 次规则断言失败`
                    : "规则断言通过"}
                </b>
                <p>
                  逐步检查 52 张守恒、场地容量、牌库余量、合法行动和回合上限。
                </p>
              </div>
              <Check size={18} />
            </div>
            <p className="fine-print">
              模拟衡量这些 AI
              在这些种子下的表现；不能直接证明人类玩家体验或规则的绝对平衡。统计分母包含平局，平局单独显示。大量模拟在手机上需要更长时间，可随时停止并导出已完成样本。
            </p>
          </>
        ) : (
          <div className="lab-empty">
            <div className="empty-cards">
              <PlayingCardPlaceholder />
              <PlayingCardPlaceholder />
              <PlayingCardPlaceholder />
            </div>
            <h3>每一次发牌，都是一个新样本。</h3>
            <p>
              从 1,000 场贪心对贪心开始，观察胜者的资源奖励
              <br className="desktop-only" />
              是否抵消了普通场地减少带来的影响。
            </p>
          </div>
        )}
      </section>
    </main>
  );
}
function PlayingCardPlaceholder() {
  return (
    <div>
      <FlaskConical size={27} />
    </div>
  );
}
