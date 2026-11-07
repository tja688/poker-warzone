import { useEffect, useMemo, useRef, useState } from "react";
import {
  CircleHelp,
  RotateCcw,
  Spade,
  Volume2,
  VolumeX,
} from "lucide-react";
import { Button } from "../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { PlayingCard } from "../cards";
import { viewFor, type Action03, type Game03 } from "../game/engine-v03";
import { balanced, chooseFair, type View03 } from "../game/ai-v03";
import type { RulesVersion } from "../rules";
import { freshSeed } from "../seed";
import { useGame03 } from "../store-v03";
import { playCue, TIMING } from "./feedback";
import { RulesSwitch } from "./RulesSwitch";
import { Help03 } from "./Help03";
import { ActionDock03 } from "./ActionDock03";
import { useDraft03 } from "./useDraft03";
import { BackFlights, Board03 } from "./Board03";
import {
  buildCeremony,
  captureRetreat,
  ownConcealed,
  playPhases,
  told,
  type Ceremony,
} from "./ceremony03";

function readSound() {
  try {
    return localStorage.getItem("warzone-sound") !== "off";
  } catch {
    return true;
  }
}

export function GameTable03({
  rules,
  onRules,
}: {
  rules: RulesVersion;
  onRules: (rules: RulesVersion) => void;
}) {
  const { game, act, advance, restart, error, setError } = useGame03();
  const view = useMemo(() => viewFor(game, 0), [game]);
  const concealed = useMemo(() => ownConcealed(game), [game]);
  const draft = useDraft03(view, concealed);
  const [help, setHelp] = useState(false);
  const [reset, setReset] = useState(false);
  const [riverOpen, setRiverOpen] = useState(false);
  const [inspecting, setInspecting] = useState(false);
  const [sound, setSound] = useState(readSound);
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(false);
  const [potPulse, setPotPulse] = useState(0);
  const [flights, setFlights] = useState<ReturnType<typeof captureRetreat>>([]);
  const [snapshot, setSnapshot] = useState({ view, concealed });
  const [ceremony, setCeremony] = useState<Ceremony | null>(null);
  const pending = useRef(false);
  const soundRef = useRef(sound);
  soundRef.current = sound;
  const cued = useRef(false);
  const paused = help || reset || riverOpen || inspecting;

  const last = view.results.at(-1);
  const entering =
    snapshot.view !== view &&
    playPhases(snapshot.view.phase) &&
    (view.phase === "roundOver" || view.phase === "finished") &&
    view.results.length === snapshot.view.results.length + 1 &&
    !!last?.hands;
  const ephemeral =
    entering && last?.hands
      ?         buildCeremony(
          snapshot.view,
          snapshot.concealed,
          last.hands,
          view.results.length,
        )
      : null;
  const active =
    ceremony &&
    ceremony.round === view.round &&
    ceremony.resultCount === view.results.length
      ? ceremony
      : ephemeral;

  useEffect(() => {
    const prev = snapshot;
    const settled = view.results.at(-1);
    const showdown =
      prev.view !== view &&
      playPhases(prev.view.phase) &&
      (view.phase === "roundOver" || view.phase === "finished") &&
      settled?.hands &&
      view.results.length === prev.view.results.length + 1;
    if (showdown && settled.hands) {
      cued.current = false;
      setCeremony(
        buildCeremony(
          prev.view,
          prev.concealed,
          settled.hands,
          view.results.length,
        ),
      );
    } else if (playPhases(view.phase)) setCeremony(null);
    setSnapshot({ view, concealed });
  }, [view, concealed]);

  useEffect(() => {
    if (!ceremony || ceremony.chipsMoved) return;
    const timer = window.setInterval(() => {
      setCeremony((current) => {
        if (!current || current.chipsMoved) return current;
        const shown = current.shown + 1;
        if (shown > current.flips.length) return { ...current, chipsMoved: true };
        return { ...current, shown };
      });
    }, TIMING.reveal);
    return () => window.clearInterval(timer);
  }, [ceremony?.round, ceremony?.resultCount, ceremony?.chipsMoved]);

  useEffect(() => {
    if (!ceremony?.chipsMoved || cued.current) return;
    cued.current = true;
    const last = view.results.at(-1);
    playCue(last?.winner === 0 ? "win" : last?.winner === "draw" ? "play" : "lose", soundRef.current);
  }, [ceremony]);

  function perform(action: Action03, expected: Game03 = game) {
    if (pending.current || useGame03.getState().game !== expected) return;
    pending.current = true;
    setBusy(true);
    const actor = expected.actor;
    act(action);
    const next = useGame03.getState().game;
    if (next === expected) {
      pending.current = false;
      setBusy(false);
      return;
    }
    setFeedback(told(action, actor));
    const settled = viewFor(next, 0).results.at(-1);
    if (!settled) playCue("play", soundRef.current);
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      pending.current = false;
      setBusy(false);
    }, TIMING.settle);
    return () => clearTimeout(timer);
  }, [game]);

  useEffect(() => {
    if (paused || busy || view.actor !== 1) return;
    if (!playPhases(view.phase)) return;
    const expected = game;
    const timer = setTimeout(() => {
      try {
        perform(chooseFair(viewFor(expected, 1), balanced), expected);
      } catch (reason) {
        setError(String(reason));
      }
    }, TIMING.aiThink);
    return () => clearTimeout(timer);
  }, [game, paused, busy, view.actor, view.phase]);

  const newMatch = () => {
    pending.current = false;
    setBusy(false);
    setFeedback("");
    setCeremony(null);
    setFlights([]);
    restart(freshSeed());
    setReset(false);
    playCue("play", sound);
  };
  const toggleSound = () => {
    const next = !sound;
    setSound(next);
    try {
      localStorage.setItem("warzone-sound", next ? "on" : "off");
    } catch {
      /* Mute still applies for this visit. */
    }
    playCue("pick", next);
  };
  const showResult =
    (view.phase === "roundOver" || view.phase === "finished") &&
    (!active || active.chipsMoved);
  const canPlay = view.actor === 0 && playPhases(view.phase) && !busy && !paused && !active;

  return (
    <div className="game-shell table-v03">
      <header className="game-header">
        <div className="brand">
          <Spade fill="currentColor" />
          <h1>扑克战区</h1>
        </div>
        <div className="header-actions">
          <RulesSwitch value={rules} onChange={onRules} />
          <Button
            variant="ghost"
            size="icon"
            aria-label={sound ? "关闭音效" : "开启音效"}
            onClick={toggleSound}
          >
            {sound ? <Volume2 /> : <VolumeX />}
          </Button>
          <Button variant="ghost" size="icon" aria-label="怎么玩" onClick={() => setHelp(true)}>
            <CircleHelp />
          </Button>
          <Button variant="ghost" size="icon" aria-label="新对局" onClick={() => setReset(true)}>
            <RotateCcw />
          </Button>
        </div>
      </header>
      <Board03
        view={view}
        concealed={concealed}
        draft={draft}
        ceremony={active}
        feedback={feedback}
        canPlay={canPlay}
        onInspect={setInspecting}
        onRiver={() => setRiverOpen(true)}
        sound={sound}
      />
      {showResult ? (
        <ResultBar
          view={view}
          onNext={() => {
            setFeedback("");
            setCeremony(null);
            if (view.phase === "finished") newMatch();
            else advance();
          }}
        />
      ) : (
        <ActionDock03
          view={view}
          draft={draft}
          concealed={concealed}
          enabled={canPlay}
          error={error}
          onSubmit={(action) => perform(action)}
        />
      )}
      <BackFlights flights={flights} onDone={() => setFlights([])} />
      <Help03 open={help} onOpenChange={setHelp} />
      <RiverDialog view={view} open={riverOpen} onOpenChange={setRiverOpen} />
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

function ResultBar({
  view,
  onNext,
}: {
  view: View03;
  onNext: () => void;
}) {
  const last = view.results.at(-1);
  const finished = view.phase === "finished";
  const detail = finished
    ? view.winner === "draw"
      ? "双方都到三胜"
      : `${view.scores[0]} : ${view.scores[1]}`
    : last?.winner === "draw"
      ? "双方各得一胜"
      : last?.winner === 0
        ? "你得一胜"
        : "对手得一胜";
  return (
    <footer className="result-dock">
      <div>
        <strong>{finished ? "整场结束" : `第 ${view.round} 局已结算`}</strong>
        <span>{detail}</span>
      </div>
      <Button className="confirm-action" onClick={onNext}>
        {finished ? "再来一局" : "下一局"}
      </Button>
    </footer>
  );
}

function RiverDialog({
  view,
  open,
  onOpenChange,
}: {
  view: View03;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>牌河</DialogTitle>
          <DialogDescription>本局换出和弃掉的牌。</DialogDescription>
        </DialogHeader>
        <div className="river-strip">
          {view.river.map((entry, index) => (
            <PlayingCard key={`${entry.card}-${index}`} card={entry.card} shared={false} small />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
