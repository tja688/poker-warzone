import { AnimatePresence, motion } from "motion/react";
import { Layers, Trophy } from "lucide-react";
import { PlayingCard } from "../cards";
import { evaluate, type Card } from "../game/engine";
import type { View03 } from "../game/ai-v03";
import { playCue } from "./feedback";
import { FieldStrip03 } from "./FieldStrip03";
import { ownBattle, type Draft03 } from "./useDraft03";
import type { Ceremony, Flight } from "./ceremony03";

type Face =
  | { key: string; faceDown: true; slot: string }
  | { key: string; faceDown: false; card: Card; badge?: string };

export function Board03({
  view,
  concealed,
  draft,
  ceremony,
  feedback,
  canPlay,
  onInspect,
  onRiver,
  sound,
}: {
  view: View03;
  concealed: number[];
  draft: Draft03;
  ceremony: Ceremony | null;
  feedback: string;
  canPlay: boolean;
  onInspect: (open: boolean) => void;
  onRiver: () => void;
  sound: boolean;
}) {
  const yours = ceremony
    ? ceremony.lines[0].map((_, index) => present(ceremony, 0, index))
    : liveFaces(view, 0, concealed);
  const theirs = ceremony
    ? ceremony.lines[1].map((_, index) => present(ceremony, 1, index))
    : liveFaces(view, 1, []);
  const ownName = ownBattle(view);
  const title = heading(view, ceremony);
  const select = canPlay && view.phase === "action";
  const ghosts = !ceremony && draft.mode === "absorb" ? draft.take.length : 0;
  return (
    <main
      className={`game-board ${view.actor === 0 ? "human-turn" : ""}`}
      aria-label={`第 ${view.round} 局`}
    >
      <div className="reserve-region opponent">
        <span className="side-label">对手</span>
        <FieldStrip03
          view={view}
          seat={1}
          selected={[]}
          enabled={false}
          onSelect={() => {}}
          onInspect={onInspect}
        />
      </div>
      <section className="battle-region enemy-battle" aria-label="对手战区">
        <div className="hand-row">
          {theirs.map((face) => (
            <FaceCard key={face.key} face={face} />
          ))}
          {!ceremony &&
            Array.from({ length: Math.max(0, 5 - theirs.length) }, (_, index) => (
              <PlayingCard key={`enemy-slot-${index}`} />
            ))}
        </div>
        <div className="hand-label">
          <span>对手</span>
          <span>
            {theirs.some((face) => face.faceDown)
              ? `暗牌 ${theirs.filter((face) => face.faceDown).length}`
              : "明牌"}
          </span>
        </div>
      </section>
      <div className="table-seam">
        <span className="deck-count" aria-label="牌库">
          <Layers />
        </span>
        <div className="turn-announcement" role="status">
          <AnimatePresence mode="wait">
            <motion.strong
              key={title}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              {(view.phase === "roundOver" || view.phase === "finished") && (
                <Trophy size={18} />
              )}
              {title}
            </motion.strong>
          </AnimatePresence>
          <span className="match-score" aria-label={`你 ${view.scores[0]} 比 ${view.scores[1]} 对手`}>
            {view.scores[0]} : {view.scores[1]} · 先到 3 胜
          </span>
          {view.river.length > 0 && (
            <button type="button" className="river-button" onClick={onRiver}>
              牌河 {view.river.length}
            </button>
          )}
          {feedback && <span>{feedback}</span>}
        </div>
        <div className="round-track" aria-label={`第 ${view.round} 局，共五局`}>
          {[1, 2, 3, 4, 5].map((n) => (
            <span
              className={n === view.round ? "current" : n < view.round ? "done" : ""}
              key={n}
            >
              {n}
            </span>
          ))}
        </div>
      </div>
      <section className="battle-region your-battle" aria-label="你的战区">
        <div className="hand-row">
          {yours.map((face) => (
            <FaceCard
              key={face.key}
              face={face}
              selected={!face.faceDown && draft.give.includes(face.card)}
              onClick={
                select && draft.mode === "swap" && !face.faceDown
                  ? () => {
                      draft.pickGive(face.card);
                      playCue("pick", sound);
                    }
                  : undefined
              }
            />
          ))}
          {!ceremony &&
            draft.mode === "absorb" &&
            draft.take.map((card) => (
              <PlayingCard key={`ghost-${card}`} card={card} ghost />
            ))}
          {!ceremony &&
            Array.from({ length: Math.max(0, 5 - yours.length - ghosts) }, (_, index) => (
              <PlayingCard key={`your-slot-${index}`} />
            ))}
        </div>
        <div className="hand-label">
          <span>你的战区</span>
          {ownName.length > 0 && !ceremony && <b>{evaluate(ownName).name}</b>}
          <span>{(ceremony ? ceremony.lines[0].length : ownName.length)}/5</span>
        </div>
      </section>
      <div className="reserve-region yours">
        <span className="side-label">你的场地</span>
        <FieldStrip03
          view={view}
          seat={0}
          selected={draft.take}
          enabled={select}
          onSelect={(card) => {
            draft.pick(card);
            playCue("pick", sound);
          }}
          onInspect={onInspect}
        />
      </div>
    </main>
  );
}

function liveFaces(view: View03, seat: 0 | 1, concealed: number[]): Face[] {
  const field = view.players[seat].fields[view.round - 1];
  if (!field) return [];
  return field.cards.map((card, index) => {
    if (card.hidden) return { key: card.slot, faceDown: true, slot: card.slot };
    return {
      key: card.card,
      faceDown: false,
      card: card.card,
      badge: seat === 0 && concealed.includes(index) ? "暗" : undefined,
    };
  });
}

function present(ceremony: Ceremony, seat: 0 | 1, index: number): Face {
  const card = ceremony.lines[seat][index];
  if (!card.hidden) return { key: card.card, faceDown: false, card: card.card };
  const order = ceremony.flips.findIndex(
    (flip) => flip.seat === seat && flip.index === index,
  );
  if (order >= 0 && order < ceremony.shown) {
    const revealed = ceremony.flips[order].card;
    return { key: revealed, faceDown: false, card: revealed };
  }
  return { key: card.slot, faceDown: true, slot: card.slot };
}

function FaceCard({
  face,
  selected,
  onClick,
}: {
  face: Face;
  selected?: boolean;
  onClick?: () => void;
}) {
  if (face.faceDown)
    return <PlayingCard faceDown slot={face.slot} selected={selected} onClick={onClick} />;
  return (
    <PlayingCard card={face.card} badge={face.badge} selected={selected} onClick={onClick} />
  );
}

function heading(view: View03, ceremony: Ceremony | null) {
  if (ceremony && !ceremony.chipsMoved) return "翻开暗牌";
  if (view.phase === "finished") {
    if (view.winner === "draw") return "战区平局";
    return view.winner === 0 ? "你先到三胜" : "对手先到三胜";
  }
  if (view.phase === "roundOver") {
    const last = view.results.at(-1);
    if (last?.winner === "draw") return "这一局平局";
    return last?.winner === 0 ? "拿下战区" : "对手拿下战区";
  }
  if (view.actor === 0) return "轮到你了";
  return "对手行动中";
}

export function ChipRow({
  you,
  pot,
  opp,
  pulse,
}: {
  you: number;
  pot: number;
  opp: number;
  pulse: number;
}) {
  return (
    <div className="felt-chips">
      <ChipStack count={you} label={`你的筹码 ${you}`} />
      <ChipStack count={pot} label={`赌注 ${pot}`} pot pulse={pulse} />
      <ChipStack count={opp} label={`对手筹码 ${opp}`} />
    </div>
  );
}

function ChipStack({
  count,
  label,
  pot,
  pulse = 0,
}: {
  count: number;
  label: string;
  pot?: boolean;
  pulse?: number;
}) {
  const discs = Math.min(6, Math.max(count, 0));
  return (
    <span
      className={`chip-stack ${pot ? "pot" : ""} ${pot && pulse ? "pot-push" : ""}`}
      aria-label={label}
    >
      <span className="chip-discs" key={pot ? pulse : "stack"}>
        {Array.from({ length: discs }, (_, index) => (
          <i key={index} />
        ))}
      </span>
      <b>{count}</b>
    </span>
  );
}

export function BackFlights({
  flights,
  onDone,
}: {
  flights: Flight[];
  onDone: () => void;
}) {
  if (!flights.length) return null;
  return (
    <div className="card-flights" aria-hidden="true">
      {flights.map((flight, index) => (
        <motion.div
          key={flight.key}
          className="flying-card"
          style={{ width: flight.width, height: flight.height }}
          initial={{ x: flight.x, y: flight.y, scale: 1, opacity: 1 }}
          animate={{ x: flight.toX, y: flight.toY, scale: 0.15, rotate: -16, opacity: 0 }}
          transition={{ duration: 0.36, delay: index * 0.025, ease: [0.22, 1, 0.36, 1] }}
          onAnimationComplete={index === flights.length - 1 ? onDone : undefined}
        >
          {flight.slot || !flight.card ? (
            <PlayingCard faceDown slot={flight.slot ?? flight.key} shared={false} />
          ) : (
            <PlayingCard card={flight.card} shared={false} />
          )}
        </motion.div>
      ))}
    </div>
  );
}
