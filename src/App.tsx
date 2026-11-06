import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import {
  ArrowDownToLine,
  ArrowLeftRight,
  ArrowRight,
  BookOpen,
  Check,
  ChevronRight,
  CircleHelp,
  FlaskConical,
  Layers,
  Pause,
  Play,
  Plus,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Spade,
  Swords,
  Trash2,
  Trophy,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "./components/ui/dialog";
import {
  NativeSelect,
  NativeSelectOption,
} from "./components/ui/native-select";
import {
  applyAction,
  chooseAction,
  describeAction,
  evaluate,
  HAND_NAMES,
  legalActions,
  type Action,
  type Card,
  type GameState,
  type PlayerId,
  type Strategy,
} from "./game/engine";
import { CardRow, PlayingCard, cardText } from "./cards";
import { freshSeed, useGame } from "./store";
const Lab = lazy(() => import("./Lab"));
const strategyNames: Record<Strategy, string> = {
  random: "随性 · 随机策略",
  greedy: "进取 · 贪心策略",
  strategic: "谋略 · 资源规划",
};
const modeNames = { absorb: "吸牌", swap: "换牌", discard: "弃牌" };
const sameCards = (a: Card[], b: Card[]) =>
  a.length === b.length && a.every((x) => b.includes(x));

function Rules() {
  return (
    <div className="rules-body">
      <p className="rule-lead">
        一副扑克，五个场地。
        <br />
        把有限的资源，留给值得赢的一局。
      </p>
      <div className="rule-block">
        <h3>先赢 3 局，赢得整场</h3>
        <p>
          依次在 1–5 号场地交战。每局从 1 张牌开始，逐渐组成 5
          张德州扑克牌；双方都没有合法操作时比牌。平局双方各得 1 胜。
        </p>
      </div>
      <div className="rule-block">
        <h3>每回合，只做一件事</h3>
        <p>
          <b>吸牌：</b>点选普通场地的牌，或每个未使用控制区的 1
          张牌，加入战区，最多 5 张。
        </p>
        <p>
          <b>换牌：</b>
          先选更高目标牌型，从普通区换入牌、从战区换出等量牌，必须恰好使用该目标所需的最少张数。不能只换踢脚。
        </p>
        <p>
          <b>弃牌：</b>每小局 1 次，可挑选任意非空普通牌子集回到牌库底部。
        </p>
      </div>
      <div className="rule-block">
        <h3>赢下场地，也改变资源</h3>
        <p>
          赢下的战区成为控制区，牌一直保留。每个控制区整场只能吸取 1
          张；不能用它换牌或弃牌。败者战区回收，之后成为普通场地。
        </p>
      </div>
      <div className="rule-block">
        <h3>自动补牌，自动比牌</h3>
        <p>
          回合开始先补满自己的空普通场地，再洗牌。放回底部的牌不会被紧接着的下一次补牌抽到。有合法操作时不能跳过；卡住时自动过回合。下一局败者先手，平局随机。
        </p>
      </div>
      <div className="hand-rank-list">
        {HAND_NAMES.slice(1).map((name, i) => (
          <span key={name}>
            <b>{i + 1}</b>
            {name}
          </span>
        ))}
      </div>
      <p className="fine-print">
        牌型由低到高。不足 5 张不认顺子、同花、葫芦、同花顺。A 可构成
        A2345；同牌型依次比点数和踢脚，花色不分大小。按策划案 v0.1
        的【默认】项实现。
      </p>
    </div>
  );
}

function NewGame({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const currentStrategy = useGame((s) => s.strategy);
  const restart = useGame((s) => s.restart);
  const [seed, setSeed] = useState("");
  const [strategy, setStrategy] = useState<Strategy>(currentStrategy);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="settings-dialog">
        <DialogHeader>
          <DialogTitle>开始一场新对局</DialogTitle>
          <DialogDescription>
            当前对局会被替换。相同种子与行动顺序可以复现相同发牌。
          </DialogDescription>
        </DialogHeader>
        <label className="form-label" htmlFor="opponent">
          对手风格
        </label>
        <NativeSelect
          id="opponent"
          value={strategy}
          onChange={(e) => setStrategy(e.target.value as Strategy)}
        >
          {Object.entries(strategyNames).map(([k, v]) => (
            <NativeSelectOption key={k} value={k}>
              {v}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <label className="form-label" htmlFor="seed">
          对局种子 <span>选填</span>
        </label>
        <Input
          id="seed"
          placeholder="留空随机生成"
          value={seed}
          maxLength={64}
          onChange={(e) => setSeed(e.target.value)}
        />
        <Button
          className="primary-action"
          onClick={() => {
            restart(seed.trim() || freshSeed(), strategy);
            onOpenChange(false);
          }}
        >
          发牌，开始 <ArrowRight size={16} />
        </Button>
      </DialogContent>
    </Dialog>
  );
}

function FieldStrip({
  game,
  player,
  selected,
  onSelect,
  mode,
  canPlay,
}: {
  game: GameState;
  player: PlayerId;
  selected: Card[];
  onSelect: (c: Card) => void;
  mode: Action["kind"];
  canPlay: boolean;
}) {
  const fields = game.players[player].fields;
  const [expanded, setExpanded] = useState<number | null>(null);
  const detail = expanded === null ? null : fields[expanded];
  const canPick =
    player === 0 &&
    canPlay &&
    mode === "absorb" &&
    detail?.kind === "control" &&
    !detail.used;
  return (
    <>
      <div className="field-strip">
        {fields.map((f, i) => {
          const active = i === game.round - 1;
          const canSelect =
            player === 0 &&
            canPlay &&
            !active &&
            (mode === "absorb"
              ? f.kind === "normal" || (f.kind === "control" && !f.used)
              : f.kind === "normal");
          return (
            <div
              className={`field ${active ? "active-field" : ""} ${f.kind === "control" ? "control-field" : ""}`}
              key={i}
            >
              <div className="field-caption">
                <span>
                  <b>{i + 1}</b>{" "}
                  {active && game.phase === "play"
                    ? "战区"
                    : f.kind === "control"
                      ? "控制区"
                      : "普通区"}
                </span>
                {f.kind === "control" && !active && <ShieldCheck size={12} />}
              </div>
              <div
                className={`field-cards ${f.cards.length > 1 ? "stacked" : ""}`}
              >
                {active ? (
                  <div className="battle-marker">
                    {game.phase === "play" ? (
                      <Swords size={20} />
                    ) : f.kind === "control" ? (
                      <ShieldCheck size={20} />
                    ) : (
                      <RotateCcw size={20} />
                    )}
                    <span>
                      {game.phase === "play"
                        ? "交战中"
                        : f.kind === "control"
                          ? "已控制"
                          : "已回收"}
                    </span>
                  </div>
                ) : f.cards.length ? (
                  f.cards.map((c, j) => (
                    <div
                      key={c}
                      className="mini-card-wrap"
                      style={{ "--stack": j } as React.CSSProperties}
                    >
                      <PlayingCard
                        small
                        card={c}
                        selected={selected.includes(c)}
                        onClick={canSelect ? () => onSelect(c) : undefined}
                      />
                    </div>
                  ))
                ) : (
                  <div className="empty-field">下回合补牌</div>
                )}
              </div>
              {f.kind === "control" && !active && (
                <Button
                  variant="ghost"
                  className="control-expand"
                  onClick={() => setExpanded(i)}
                  aria-label={`展开${player === 0 ? "你的" : "对手的"}${i + 1}号控制区`}
                >
                  {f.used ? "已吸取" : "可吸 1 张"}
                  <ChevronRight size={9} />
                </Button>
              )}
            </div>
          );
        })}
      </div>
      <Dialog
        open={expanded !== null}
        onOpenChange={(open) => {
          if (!open) setExpanded(null);
        }}
      >
        <DialogContent className="control-dialog">
          <DialogHeader>
            <DialogTitle>
              {canPick
                ? "选择一张控制区牌"
                : `查看${player === 0 ? "你的" : "对手的"}控制区`}
            </DialogTitle>
            <DialogDescription>
              {detail?.used
                ? "这个控制区本场已经吸取过，余牌继续保留。"
                : canPick
                  ? "点选一张牌，再回到牌桌确认吸入。每个控制区整场只能吸取一次。"
                  : "桌面所有牌公开。控制区只能用于吸牌，不能换牌或弃牌。"}
            </DialogDescription>
          </DialogHeader>
          {detail && (
            <CardRow
              cards={detail.cards}
              selected={selected}
              onSelect={
                canPick
                  ? (c) => {
                      onSelect(c);
                      setExpanded(null);
                    }
                  : undefined
              }
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function Battle() {
  const { game, strategy, auto, act, advance, setAuto, error, setError } =
    useGame();
  const [mode, setMode] = useState<Action["kind"]>("absorb");
  const [take, setTake] = useState<Card[]>([]);
  const [give, setGive] = useState<Card[]>([]);
  const [target, setTarget] = useState<number | undefined>();
  const [showLog, setShowLog] = useState(false);
  const [sound, setSound] = useState(false);
  const canPlay = game.phase === "play" && game.turn === 0 && !auto;
  const actions = useMemo(
    () => (canPlay ? legalActions(game) : []),
    [game, canPlay],
  );
  const battle = (p: PlayerId) =>
    game.phase === "play"
      ? game.players[p].fields[game.round - 1].cards
      : game.history.at(-1)?.hands[p] || [];
  const playerCards = battle(0),
    enemyCards = battle(1);
  const validAction = actions.find(
    (a) =>
      a.kind === mode &&
      sameCards(a.take, take) &&
      sameCards(a.give, give) &&
      (mode !== "swap" || a.target === target),
  );
  const swapGroups = useMemo(() => {
    const groups = new Map<number, Action[]>();
    actions
      .filter((a) => a.kind === "swap")
      .forEach((a) => {
        const t = a.target!;
        groups.set(t, [...(groups.get(t) || []), a]);
      });
    return [...groups.entries()].sort((a, b) => a[0] - b[0]);
  }, [actions]);
  useEffect(() => {
    setTake([]);
    setGive([]);
    setTarget(undefined);
    setError("");
    if (game.phase === "play" && game.turn === 0) {
      const a = legalActions(game);
      setMode(
        a.some((x) => x.kind === "absorb")
          ? "absorb"
          : a.some((x) => x.kind === "swap")
            ? "swap"
            : "discard",
      );
    }
  }, [game.turnNumber, game.round, game.phase, setError]);
  useEffect(() => {
    if (game.phase !== "play" || (game.turn === 0 && !auto)) return;
    const t = setTimeout(
      () => {
        try {
          act(chooseAction(game, game.turn === 0 ? "greedy" : strategy));
        } catch (e) {
          setError(String(e));
          setAuto(false);
        }
      },
      auto ? 280 : 750,
    );
    return () => clearTimeout(t);
  }, [game, strategy, auto, act, setError, setAuto]);
  useEffect(() => {
    if (!sound || game.turnNumber === 0) return;
    try {
      const ctx = new AudioContext();
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.frequency.value = game.phase === "play" ? 380 : 620;
      gain.gain.setValueAtTime(0.025, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
      oscillator.start();
      oscillator.stop(ctx.currentTime + 0.1);
      oscillator.onended = () => {
        void ctx.close();
      };
    } catch {
      /* Sound is optional. */
    }
  }, [game.turnNumber, sound, game.phase]);
  const selectMode = (m: Action["kind"]) => {
    setMode(m);
    setTake([]);
    setGive([]);
    setTarget(undefined);
  };
  function selectTake(card: Card) {
    if (!canPlay) return;
    setTake((prev) => {
      if (prev.includes(card)) return prev.filter((c) => c !== card);
      if (mode === "absorb") {
        const field = game.players[0].fields.find((f) =>
          f.cards.includes(card),
        );
        if (field?.kind === "control")
          prev = prev.filter((c) => !field.cards.includes(c));
        if (prev.length >= 5 - playerCards.length) return prev;
      }
      return [...prev, card];
    });
  }
  const selectGive = (card: Card) => {
    if (mode === "swap" && canPlay)
      setGive((prev) =>
        prev.includes(card) ? prev.filter((c) => c !== card) : [...prev, card],
      );
  };
  function suggest() {
    if (!canPlay) return;
    const a = chooseAction(game, "strategic");
    setMode(a.kind);
    setTake(a.take);
    setGive(a.give);
    setTarget(a.target);
  }
  const previewCards =
    mode === "discard"
      ? playerCards
      : [...playerCards.filter((c) => !give.includes(c)), ...take];
  const preview =
    previewCards.length && previewCards.length <= 5
      ? evaluate(previewCards)
      : null;
  const last = game.history.at(-1);
  const modeHint =
    mode === "absorb"
      ? `点选下方场地的牌，最多吸入 ${5 - playerCards.length} 张。控制区每区限 1 张。`
      : mode === "swap"
        ? "选择目标牌型，再点选换入与换出的牌；也可调整预选组合。"
        : "点选要弃掉的普通场地牌，下回合自动补回。";
  const status =
    game.phase === "finished"
      ? "整场结束"
      : game.phase === "roundOver"
        ? "本局已结算"
        : auto
          ? "AI 观战中"
          : game.turn === 0
            ? "轮到你行动"
            : "对手正在思考";
  return (
    <div className="battle-layout">
      <main className="table-area">
        <div className="match-bar">
          <div className="match-score">
            <span>你</span>
            <b>{game.players[0].score}</b>
            <span className="score-divider">:</span>
            <b>{game.players[1].score}</b>
            <span>对手</span>
          </div>
          <div
            className="round-track"
            aria-label={`第${game.round}战区，共5个`}
          >
            {[1, 2, 3, 4, 5].map((n) => (
              <span
                className={
                  n === game.round ? "current" : n < game.round ? "done" : ""
                }
                key={n}
              >
                {n < game.round ? <Check size={12} /> : n}
              </span>
            ))}
          </div>
          <div className="win-condition">
            先赢 <b>3</b> 局
          </div>
        </div>
        <section className="opponent-area" aria-label="对手公开场地">
          <div className="player-label">
            <div className="player-title">
              <span className="avatar enemy">
                <Spade size={17} />
              </span>
              <b>对手</b>
              <span className="muted desktop-only">
                {strategyNames[strategy]}
              </span>
            </div>
            <span className="discard-status">
              {game.players[1].discarded ? "弃牌已用" : "弃牌可用"}
            </span>
          </div>
          <FieldStrip
            game={game}
            player={1}
            selected={[]}
            onSelect={() => {}}
            mode={mode}
            canPlay={false}
          />
          <div className="battle-heading">
            <span>对手战区</span>
            <b>
              {evaluate(enemyCards).name}
              <small> · {enemyCards.length}/5</small>
            </b>
          </div>
          <CardRow cards={enemyCards} slots />
        </section>
        <div className="table-divider">
          <span className="deck-counter">
            <Layers size={16} />
            <b>{game.deck.length}</b> 张牌库
          </span>
          <span
            className={`turn-status ${canPlay ? "your-turn" : ""}`}
            role="status"
          >
            <span className="status-dot" />
            {status}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="sound-button"
            aria-label={sound ? "关闭音效" : "开启音效"}
            onClick={() => setSound(!sound)}
          >
            {sound ? <Volume2 size={15} /> : <VolumeX size={15} />}
          </Button>
        </div>
        <section className="your-area" aria-label="你的场地">
          <div className="battle-heading">
            <span>你的战区</span>
            <b>
              {evaluate(playerCards).name}
              <small> · {playerCards.length}/5</small>
            </b>
          </div>
          <CardRow
            cards={playerCards}
            slots
            selected={give}
            onSelect={mode === "swap" && canPlay ? selectGive : undefined}
          />
          <div className="player-label">
            <div className="player-title">
              <span className="avatar you">
                <Spade size={17} />
              </span>
              <b>你</b>
              <span className="muted desktop-only">明牌，信息全部公开</span>
            </div>
            <span className="discard-status">
              {game.players[0].discarded ? "本局弃牌已用" : "本局可弃牌 1 次"}
            </span>
          </div>
          <FieldStrip
            game={game}
            player={0}
            selected={take}
            onSelect={selectTake}
            mode={mode}
            canPlay={canPlay}
          />
        </section>
        {canPlay && take.length > 0 && (
          <div className="mobile-confirm">
            <div>
              <b>
                {mode === "discard"
                  ? `弃掉 ${take.length} 张普通牌`
                  : preview?.name || "请调整选牌"}
              </b>
              <span>
                {validAction ? "确认后结束本回合" : "所选组合尚不合法"}
              </span>
            </div>
            <Button
              disabled={!validAction}
              onClick={() => validAction && act(validAction)}
            >
              执行{modeNames[mode]} · {take.length} 张<ArrowRight size={15} />
            </Button>
          </div>
        )}
        <div className="table-footer">
          <span>
            种子 <code>{game.seed}</code>
          </span>
          <span>第 {game.turnNumber} 回合 · 规则 v0.1</span>
        </div>
      </main>
      <aside className="action-panel">
        {game.phase === "play" ? (
          <>
            <div className="panel-heading">
              <h2>你的行动</h2>
              <Button
                variant="ghost"
                size="sm"
                disabled={!canPlay}
                onClick={suggest}
              >
                <Sparkles size={14} />
                建议
              </Button>
            </div>
            <p className="panel-intro">用好眼前的牌，也为下一局留一点余地。</p>
            <div className="action-tabs" role="group" aria-label="行动类型">
              {(["absorb", "swap", "discard"] as const).map((m) => (
                <Button
                  key={m}
                  variant="ghost"
                  className={mode === m ? "active" : ""}
                  onClick={() => selectMode(m)}
                  disabled={!canPlay || !actions.some((a) => a.kind === m)}
                >
                  {m === "absorb" ? (
                    <Plus size={17} />
                  ) : m === "swap" ? (
                    <ArrowLeftRight size={17} />
                  ) : (
                    <Trash2 size={16} />
                  )}
                  <span>{modeNames[m]}</span>
                </Button>
              ))}
            </div>
            <div className="action-instructions">
              <h3>
                {mode === "absorb"
                  ? "把好牌，带进战区"
                  : mode === "swap"
                    ? "让牌型再上一级"
                    : "换一批新的选择"}
              </h3>
              <p>
                {canPlay ? modeHint : "等对手行动结束后，继续规划你的战区。"}
              </p>
            </div>
            {mode === "swap" && canPlay && (
              <div className="target-options" aria-label="目标牌型">
                {swapGroups.length ? (
                  swapGroups.map(([grade, group]) => (
                    <Button
                      key={grade}
                      variant="outline"
                      className={target === grade ? "chosen-target" : ""}
                      onClick={() => {
                        const a = group[0];
                        setTarget(grade);
                        setTake(a.take);
                        setGive(a.give);
                      }}
                    >
                      <span>{HAND_NAMES[grade]}</span>
                      <span>最少换 {group[0].take.length} 张</span>
                    </Button>
                  ))
                ) : (
                  <p className="muted">暂时没有能升级牌型的换法。</p>
                )}
              </div>
            )}
            <div className="action-preview">
              <span className="preview-label">行动预览</span>
              {take.length || give.length ? (
                <>
                  <p>
                    {mode === "discard"
                      ? "弃掉"
                      : mode === "swap"
                        ? "换入"
                        : "吸入"}{" "}
                    <b>{take.map(cardText).join("  ") || "未选"}</b>
                  </p>
                  {mode === "swap" && (
                    <p>
                      换出{" "}
                      <b>{give.map(cardText).join("  ") || "请点战区选牌"}</b>
                    </p>
                  )}
                  {mode !== "discard" && (
                    <div className="preview-result">
                      <ArrowRight size={14} />
                      <b>{preview?.name || "请选择合法数量"}</b>
                      <span>{previewCards.length}/5 张</span>
                    </div>
                  )}
                </>
              ) : (
                <p className="preview-empty">点选卡牌后，在这里确认。</p>
              )}
            </div>
            <div className="action-confirm">
              <Button
                className="primary-action"
                disabled={!validAction || !canPlay}
                onClick={() => validAction && act(validAction)}
              >
                {mode === "absorb" ? (
                  <ArrowDownToLine size={17} />
                ) : mode === "swap" ? (
                  <ArrowLeftRight size={17} />
                ) : (
                  <Trash2 size={16} />
                )}
                确认{modeNames[mode]}
                {take.length > 0 && ` · ${take.length} 张`}
                <ChevronRight size={17} />
              </Button>
              {take.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setTake([]);
                    setGive([]);
                  }}
                >
                  清空选择
                </Button>
              )}
            </div>
            {canPlay && take.length > 0 && !validAction && (
              <p className="selection-hint">
                {mode === "swap"
                  ? `请按目标所需最少张数选等量牌；所选结果必须恰好为${target ? HAND_NAMES[target] : "目标牌型"}。`
                  : "请选择合法来源与数量。"}
              </p>
            )}
          </>
        ) : (
          <div className="result-panel">
            <span className="result-emblem">
              <Trophy size={28} />
            </span>
            <h2>
              {game.phase === "finished"
                ? game.winner === "draw"
                  ? "势均力敌"
                  : game.winner === 0
                    ? "你赢得了整场"
                    : "对手赢得了整场"
                : last?.winner === "draw"
                  ? "这一局，平分秋色"
                  : last?.winner === 0
                    ? "你拿下了这个战区"
                    : "对手拿下了这个战区"}
            </h2>
            <p>
              {last?.grades[0].name} 对 {last?.grades[1].name}
            </p>
            <div className="final-score">
              {game.players[0].score}
              <span>:</span>
              {game.players[1].score}
            </div>
            <p className="muted">
              {game.phase === "finished"
                ? "每一局的资源选择，都在下一局留下回声。"
                : "胜者保留控制区，败者下一局先手。"}
            </p>
            {game.phase === "roundOver" ? (
              <Button className="primary-action" onClick={advance}>
                进入第 {game.round + 1} 战区
                <ArrowRight size={16} />
              </Button>
            ) : (
              <Button
                className="primary-action"
                onClick={() =>
                  useGame.getState().restart(freshSeed(), strategy)
                }
              >
                再来一场
                <RotateCcw size={16} />
              </Button>
            )}
          </div>
        )}
        {error && (
          <p role="alert" className="error-message">
            {error}
          </p>
        )}
        <div className="playback-control">
          <Button
            variant="outline"
            onClick={() => setAuto(!auto)}
            disabled={game.phase === "finished"}
          >
            {auto ? <Pause size={14} /> : <Play size={14} />}{" "}
            {auto ? "接管对局" : "AI 代打 / 观战"}
          </Button>
          <p>可随时接管。小局结算后手动继续。</p>
        </div>
        <div className="round-history">
          {game.history.map((h) => (
            <div key={h.round}>
              <span>战区 {h.round}</span>
              <b>
                {h.winner === "draw"
                  ? "平局"
                  : h.winner === 0
                    ? "你获胜"
                    : "对手获胜"}
              </b>
              <span>
                {h.grades[0].name} / {h.grades[1].name}
              </span>
            </div>
          ))}
        </div>
        <div className="log-section">
          <Button
            variant="ghost"
            className="log-toggle"
            onClick={() => setShowLog(!showLog)}
          >
            <BookOpen size={14} />
            回合记录<span>{showLog ? "收起" : "展开"}</span>
          </Button>
          {showLog && (
            <ol className="game-log">
              {game.log
                .slice(-24)
                .reverse()
                .map((line, i) => (
                  <li key={`${game.turnNumber}-${i}`}>{line}</li>
                ))}
            </ol>
          )}
        </div>
      </aside>
    </div>
  );
}

export default function App() {
  const [page, setPage] = useState<"game" | "lab">("game");
  const [newOpen, setNewOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  useEffect(() => {
    if (page === "lab") useGame.getState().setAuto(false);
  }, [page]);
  return (
    <div className="app-shell">
      <header className="site-header">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setPage("game");
          }}
        >
          <span className="brand-mark">
            <Spade size={23} />
          </span>
          <span>
            扑克战区<small>PLAYTEST / v0.1</small>
          </span>
        </a>
        <nav className="main-nav" aria-label="主导航">
          <Button
            variant="ghost"
            className={page === "game" ? "nav-active" : ""}
            onClick={() => setPage("game")}
          >
            <Swords size={16} />
            牌桌
          </Button>
          <Button
            variant="ghost"
            className={page === "lab" ? "nav-active" : ""}
            onClick={() => setPage("lab")}
          >
            <FlaskConical size={16} />
            模拟实验室
          </Button>
        </nav>
        <div className="header-actions">
          <Dialog open={rulesOpen} onOpenChange={setRulesOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" className="rules-trigger">
                <CircleHelp size={17} />
                <span>怎么玩</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="rules-dialog">
              <DialogHeader>
                <DialogTitle>怎么玩扑克战区</DialogTitle>
                <DialogDescription>
                  公开信息下的牌型与资源规划游戏。
                </DialogDescription>
              </DialogHeader>
              <Rules />
            </DialogContent>
          </Dialog>
          <Button variant="outline" onClick={() => setNewOpen(true)}>
            <RotateCcw size={15} />
            <span>新对局</span>
          </Button>
        </div>
      </header>
      <div className="page-intro">
        <div>
          <h1>
            {page === "game"
              ? "每张牌，都有去处。"
              : "让规则，接受一万次检验。"}
          </h1>
          <p>
            {page === "game"
              ? "五个场地，一副扑克。用你的选择，赢下三个战区。"
              : "同一套规则引擎，不同的策略。把直觉变成可以复核的数据。"}
          </p>
        </div>
        <span className="build-note">
          <span />
          {page === "game" ? "单机试玩 · 自动保存" : "本机运行 · 可复现"}
        </span>
      </div>
      {page === "game" ? (
        <Battle />
      ) : (
        <Suspense
          fallback={<div className="lab-loading">正在准备模拟实验室…</div>}
        >
          <Lab />
        </Suspense>
      )}
      <footer className="site-footer">
        <span>扑克战区 · 基础规则测试版</span>
        <span>52 张牌 / 5 个场地 / 先到 3 胜</span>
        <a
          href="https://github.com/tja688/poker-warzone"
          target="_blank"
          rel="noreferrer"
        >
          项目与规则 <ArrowRight size={12} />
        </a>
      </footer>
      <NewGame open={newOpen} onOpenChange={setNewOpen} />
    </div>
  );
}
