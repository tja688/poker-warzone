import { Check, ShieldCheck } from "lucide-react";
import {
  NativeSelect,
  NativeSelectOption,
} from "./components/ui/native-select";
import {
  ANTE_ROWS,
  HIDDEN_SLOTS,
  MULTIPLIERS,
  STARTING_CHIPS,
  type SimPolicyName,
  type SimulationResult03,
} from "./game/simulation-v03";

export const policyLabels: Record<SimPolicyName, string> = {
  solid: "稳健",
  balanced: "均衡",
  bluff: "诈唬",
  station: "跟注站",
  randomBet: "随机下注",
  oracle: "透视",
};

const policyOrder: SimPolicyName[] = [
  "solid",
  "balanced",
  "bluff",
  "station",
  "randomBet",
  "oracle",
];

const pct = (n: number, d: number) =>
  d ? `${((100 * n) / d).toFixed(1)}%` : "—";
const fmt = (n: number) => n.toLocaleString("zh-CN");

export function V03Setup({
  running,
  policyA,
  policyB,
  setPolicyA,
  setPolicyB,
  privateHands,
  setPrivateHands,
  hiddenSlots,
  setHiddenSlots,
  multiplier,
  setMultiplier,
  antes,
  setAntes,
  startingChips,
  setStartingChips,
}: {
  running: boolean;
  policyA: SimPolicyName;
  policyB: SimPolicyName;
  setPolicyA: (value: SimPolicyName) => void;
  setPolicyB: (value: SimPolicyName) => void;
  privateHands: boolean;
  setPrivateHands: (value: boolean) => void;
  hiddenSlots: (typeof HIDDEN_SLOTS)[number];
  setHiddenSlots: (value: (typeof HIDDEN_SLOTS)[number]) => void;
  multiplier: (typeof MULTIPLIERS)[number];
  setMultiplier: (value: (typeof MULTIPLIERS)[number]) => void;
  antes: string;
  setAntes: (value: string) => void;
  startingChips: (typeof STARTING_CHIPS)[number];
  setStartingChips: (value: (typeof STARTING_CHIPS)[number]) => void;
}) {
  return (
    <>
      <div className="strategy-pair">
        {(
          [
            ["A", policyA, setPolicyA],
            ["B", policyB, setPolicyB],
          ] as const
        ).map(([label, value, setter]) => (
          <div key={label}>
            <label className="form-label" htmlFor={`policy-${label}`}>
              玩家 {label}
            </label>
            <NativeSelect
              id={`policy-${label}`}
              value={value}
              disabled={running}
              onChange={(e) => setter(e.target.value as SimPolicyName)}
            >
              {policyOrder.map((key) => (
                <NativeSelectOption key={key} value={key}>
                  {policyLabels[key]}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
        ))}
      </div>
      <label className="form-label" htmlFor="lab-private">
        手牌
      </label>
      <NativeSelect
        id="lab-private"
        value={privateHands ? "true" : "false"}
        disabled={running}
        onChange={(e) => setPrivateHands(e.target.value === "true")}
      >
        <NativeSelectOption value="true">私有</NativeSelectOption>
        <NativeSelectOption value="false">公开</NativeSelectOption>
      </NativeSelect>
      <label className="form-label" htmlFor="lab-hidden">
        暗位
      </label>
      <NativeSelect
        id="lab-hidden"
        value={String(hiddenSlots)}
        disabled={running}
        onChange={(e) => setHiddenSlots(Number(e.target.value) as 0 | 1 | 2)}
      >
        {HIDDEN_SLOTS.map((slot) => (
          <NativeSelectOption key={slot} value={String(slot)}>
            {slot}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      <label className="form-label" htmlFor="lab-multiplier">
        倍数
      </label>
      <NativeSelect
        id="lab-multiplier"
        value={String(multiplier)}
        disabled={running}
        onChange={(e) => setMultiplier(Number(e.target.value) as 1 | 2)}
      >
        {MULTIPLIERS.map((value) => (
          <NativeSelectOption key={value} value={String(value)}>
            {value}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      <label className="form-label" htmlFor="lab-antes">
        底注
      </label>
      <NativeSelect
        id="lab-antes"
        value={antes}
        disabled={running}
        onChange={(e) => setAntes(e.target.value)}
      >
        {ANTE_ROWS.map((row) => (
          <NativeSelectOption key={row.join(",")} value={row.join(",")}>
            {row.join(",")}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      <label className="form-label" htmlFor="lab-chips">
        起始筹码
      </label>
      <NativeSelect
        id="lab-chips"
        value={String(startingChips)}
        disabled={running}
        onChange={(e) =>
          setStartingChips(Number(e.target.value) as 8 | 10 | 12)
        }
      >
        {STARTING_CHIPS.map((value) => (
          <NativeSelectOption key={value} value={String(value)}>
            {value}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </>
  );
}

export function Results03({ result }: { result: SimulationResult03 }) {
  const n = result.completed;
  return (
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
          <dt>击倒率</dt>
          <dd>{pct(result.knockouts, n)}</dd>
        </div>
        <div>
          <dt>筹码赛完</dt>
          <dd>{pct(result.chipFinishes, n)}</dd>
        </div>
        <div>
          <dt>首轮先手赢整场</dt>
          <dd>{pct(result.firstStarterWins, n)}</dd>
        </div>
        <div>
          <dt>每小局撤退率</dt>
          <dd>{pct(result.retreats, result.rounds)}</dd>
        </div>
        <div>
          <dt>撤退方本可赢</dt>
          <dd>{pct(result.retreatWouldWin, result.retreats)}</dd>
        </div>
        <div>
          <dt>落后方最终获胜</dt>
          <dd>{pct(result.trailerWins, n)}</dd>
        </div>
        <div>
          <dt>领先方开局即撤</dt>
          <dd>{pct(result.leaderOpenRetreats, result.leaderOpenChances)}</dd>
        </div>
      </dl>
      <p className="fine-print">
        撤退方本可赢比较的是撤退当时双方战区，含扣着的牌。这个比较只进统计。第
        2 小局后筹码相同，或不到两小局，这场不算落后翻盘。领先方开局即撤只计第
        4、第 5 局，且领先方是该局先手并在第一手撤退。
      </p>
      <div
        className={`assertion-banner ${result.assertionFailures ? "failed" : ""}`}
      >
        <ShieldCheck size={20} />
        <div>
          <b>
            {result.assertionFailures
              ? `${result.assertionFailures} 场被排除`
              : "规则断言通过"}
          </b>
          <p>
            完整场的筹码合计等于起始筹码的两倍，并且每场都有胜者。失败场不进入上面的比率。大局平局必须为
            0。
          </p>
        </div>
        <Check size={18} />
      </div>
    </>
  );
}
