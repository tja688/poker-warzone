import { chooseAction } from "../game/ai";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import {
  ArrowRight,
  CircleHelp,
  Layers,
  RotateCcw,
  Spade,
  Trophy,
  Volume2,
  VolumeX,
} from "lucide-react";
import { Button } from "../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../components/ui/dialog";
import { CardRow, PlayingCard } from "../cards";
import {
  describeAction,
  evaluate,
  type Action,
  type GameState,
} from "../game/engine";
import { freshSeed, useGame } from "../store";
import { FieldStrip } from "./FieldStrip";
import { ActionDock } from "./ActionDock";
import { useSelection } from "./useSelection";
import { playCue, TIMING } from "./feedback";
import { Help } from "./Help";
import { CardFlights, captureFlights, type CardFlight } from "./CardFlights";
import { resultText } from "./resultText";

function readSound() {
  try {
    return localStorage.getItem("warzone-sound") !== "off";
  } catch {
    return true;
  }
}

/** Match lifetime controller: AI scheduling, sound and overlays live here.
 * TurnView holds only the current selection; rules and persistence stay in store. */
export function GameTable() {
  const { game, strategy, act, advance, restart, error, setError } = useGame();
  const [help, setHelp] = useState(false),
    [reset, setReset] = useState(false);
  const [inspecting, setInspecting] = useState(false),
    [sound, setSound] = useState(readSound);
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(false);
  const [flights, setFlights] = useState<CardFlight[]>([]);
  const pending = useRef(false);
  const paused = help || reset || inspecting;
  const soundRef = useRef(sound);
  soundRef.current = sound;

  function perform(action: Action, expected: GameState = game) {
    // Guard both repeated taps and stale timer callbacks before touching the store.
    if (pending.current || useGame.getState().game !== expected) return;
    pending.current = true;
    setBusy(true);
    const actor = expected.turn === 0 ? "你" : "对手";
    const outgoing = captureFlights(action);
    act(action);
    const next = useGame.getState().game;
    if (next !== expected) {
      setFlights(outgoing);
      setFeedback(`${actor}${describeAction(action)}`);
      playCue(
        next.phase !== "play"
          ? next.history.at(-1)?.winner === 0
            ? "win"
            : "lose"
          : "play",
        soundRef.current,
      );
    } else {
      pending.current = false;
      setBusy(false);
    }
  }
  useEffect(() => {
    const timer = setTimeout(() => {
      pending.current = false;
      setBusy(false);
    }, TIMING.settle);
    return () => clearTimeout(timer);
  }, [game]);
  useEffect(() => {
    if (paused || busy || game.phase !== "play" || game.turn !== 1) return;
    const timer = setTimeout(() => {
      try {
        perform(chooseAction(game, strategy), game);
      } catch (e) {
        setError(String(e));
      }
    }, TIMING.aiThink);
    return () => clearTimeout(timer);
  }, [game, strategy, paused, busy]);
  const newMatch = () => {
    pending.current = false;
    setBusy(false);
    setFeedback("");
    restart(freshSeed(), "strategic");
    setReset(false);
    playCue("play", sound);
  };
  const toggleSound = () => {
    const next = !sound;
    setSound(next);
    try {
      localStorage.setItem("warzone-sound", next ? "on" : "off");
    } catch {}
    playCue("pick", next);
  };
  return (
    <div className="game-shell">
      <header className="game-header">
        <div className="brand">
          <Spade fill="currentColor" />
          <h1>扑克战区</h1>
        </div>
        <div
          className="match-score"
          aria-label={`你 ${game.players[0].score} 比 ${game.players[1].score} 对手`}
        >
          <span>你</span>
          <motion.b
            key={`you-${game.players[0].score}`}
            initial={{ scale: 1.25 }}
            animate={{ scale: 1 }}
          >
            {game.players[0].score}
          </motion.b>
          <span className="score-slash">:</span>
          <motion.b
            key={`enemy-${game.players[1].score}`}
            initial={{ scale: 1.25 }}
            animate={{ scale: 1 }}
          >
            {game.players[1].score}
          </motion.b>
          <span>对手</span>
        </div>
        <div className="header-actions">
          <Button
            variant="ghost"
            size="icon"
            aria-label={sound ? "关闭音效" : "开启音效"}
            onClick={toggleSound}
          >
            {sound ? <Volume2 /> : <VolumeX />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="怎么玩"
            onClick={() => setHelp(true)}
          >
            <CircleHelp />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="新对局"
            onClick={() => setReset(true)}
          >
            <RotateCcw />
          </Button>
        </div>
      </header>
      <LayoutGroup id="match">
        <TurnView
          key={`${game.seed}:${game.round}:${game.turnNumber}:${game.phase}`}
          game={game}
          enabled={!busy && !help && !reset}
          feedback={feedback}
          error={error}
          sound={sound}
          onAction={perform}
          onInspect={setInspecting}
          onNext={() => {
            setFeedback("");
            advance();
          }}
          onNew={newMatch}
        />
      </LayoutGroup>
      <CardFlights flights={flights} onDone={() => setFlights([])} />
      <Help open={help} onOpenChange={setHelp} />
      <Dialog open={reset} onOpenChange={setReset}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>重新发牌？</DialogTitle>
            <DialogDescription>当前这场对局将结束。</DialogDescription>
          </DialogHeader>
          <div className="dialog-actions">
            <Button variant="ghost" onClick={() => setReset(false)}>
              继续当前对局
            </Button>
            <Button onClick={newMatch}>重新发牌</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TurnView({
  game,
  enabled,
  feedback,
  error,
  sound,
  onAction,
  onInspect,
  onNext,
  onNew,
}: {
  game: GameState;
  enabled: boolean;
  feedback: string;
  error: string;
  sound: boolean;
  onAction: (a: Action) => void;
  onInspect: (v: boolean) => void;
  onNext: () => void;
  onNew: () => void;
}) {
  const s = useSelection(game);
  const human = game.phase === "play" && game.turn === 0;
  const canPlay = human && enabled;
  const result = game.phase !== "play" ? game.history.at(-1)! : null;
  const enemy = result
    ? result.hands[1]
    : game.players[1].fields[game.round - 1].cards;
  const title = result
    ? game.phase === "finished"
      ? game.winner === "draw"
        ? "势均力敌"
        : game.winner === 0
          ? "你赢了"
          : "对手获胜"
      : result.winner === "draw"
        ? "本局平手"
        : result.winner === 0
          ? "拿下战区"
          : "对手拿下战区"
    : human
      ? "轮到你了"
      : game.players[0].stuck
        ? "你已成牌 · 对手继续"
        : "对手行动中";
  const pick = (c: string) => {
    if (!canPlay) return;
    s.pick(c);
    playCue("pick", sound);
  };
  return (
    <>
      <main
        className={`game-board ${human ? "human-turn" : ""} ${result ? "settled" : ""}`}
        aria-label={`第 ${game.round} 战区`}
      >
        <div className="reserve-region opponent">
          <span className="side-label">对手</span>
          <FieldStrip
            game={game}
            player={1}
            selected={[]}
            onSelect={() => {}}
            mode={s.mode}
            enabled={false}
            onInspect={onInspect}
          />
        </div>
        <section
          className={`battle-region enemy-battle ${result?.winner === 1 ? "winning-hand" : ""}`}
          aria-label="对手战区"
        >
          <div className="hand-label">
            <span>对手战区</span>
            <b>{evaluate(enemy).name}</b>
            <span>{enemy.length}/5</span>
          </div>
          <CardRow cards={enemy} slots />
        </section>
        <div className="table-seam">
          <span
            className="deck-count"
            aria-label={`牌库 ${game.deck.length} 张`}
          >
            <Layers />
            <b>{game.deck.length}</b>
          </span>
          <div
            className={`turn-announcement ${result ? "round-result" : ""}`}
            role="status"
          >
            <AnimatePresence mode="wait">
              <motion.strong
                key={title}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                {result && <Trophy size={18} />}
                {title}
              </motion.strong>
            </AnimatePresence>
            <span>
              {result ? resultText(result) : feedback || "先赢三个战区"}
            </span>
          </div>
          <div
            className="round-track"
            aria-label={`第 ${game.round} 战区，共五区`}
          >
            {[1, 2, 3, 4, 5].map((n) => (
              <span
                className={
                  n === game.round ? "current" : n < game.round ? "done" : ""
                }
                key={n}
              >
                {n}
              </span>
            ))}
          </div>
        </div>
        <section
          className={`battle-region your-battle ${result?.winner === 0 ? "winning-hand" : ""}`}
          aria-label="你的战区"
        >
          <div className="hand-row">
            {s.battle.map((c) => (
              <PlayingCard
                key={c}
                card={c}
                selected={s.give.includes(c)}
                onClick={
                  human && s.mode === "swap"
                    ? () => {
                        s.pickGive(c);
                        playCue("pick", sound);
                      }
                    : undefined
                }
                disabled={!canPlay}
              />
            ))}
            {Array.from(
              { length: Math.max(0, 5 - s.battle.length) },
              (_, i) => (
                <PlayingCard
                  key={`slot-${i}`}
                  card={s.mode === "absorb" ? s.take[i] : undefined}
                  ghost
                />
              ),
            )}
          </div>
          <div className="hand-label">
            <span>你的战区</span>
            <motion.b
              key={evaluate(s.battle).name}
              initial={{ scale: 1.1 }}
              animate={{ scale: 1 }}
            >
              {evaluate(s.battle).name}
            </motion.b>
            <span>{s.battle.length}/5</span>
            {s.mode === "swap" && s.give.length > 0 && (
              <em>抬起的牌将被换出</em>
            )}
          </div>
        </section>
        <div className="reserve-region yours">
          <span className="side-label">你的场地</span>
          <FieldStrip
            game={game}
            player={0}
            selected={s.take}
            onSelect={pick}
            mode={s.mode}
            enabled={canPlay}
            onInspect={onInspect}
          />
        </div>
      </main>
      {result ? (
        <footer className="result-dock">
          <div>
            <strong>
              {game.phase === "finished"
                ? "整场结束"
                : `第 ${game.round} 战区已结算`}
            </strong>
            <span>
              {game.phase === "finished"
                ? `${game.players[0].score} : ${game.players[1].score} · ${game.winner === "draw" ? "同时到达三胜" : "先到三胜"}`
                : result.winner === "draw"
                  ? "双方各得一胜"
                  : result.winner === 0
                    ? "你的战区成为控制区"
                    : "败者先手，下一局继续"}
            </span>
          </div>
          <Button
            className="confirm-action"
            onClick={game.phase === "finished" ? onNew : onNext}
          >
            {game.phase === "finished" ? "再来一局" : "下一战区"}
            <ArrowRight />
          </Button>
        </footer>
      ) : (
        <ActionDock
          selection={s}
          enabled={canPlay}
          error={error}
          onConfirm={() => {
            if (canPlay && s.valid) onAction(s.valid);
          }}
        />
      )}
    </>
  );
}
