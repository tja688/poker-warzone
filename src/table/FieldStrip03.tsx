import { useState } from "react";
import { Check, Swords } from "lucide-react";
import { Button } from "../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { PlayingCard, cardText } from "../cards";
import type { View03 } from "../game/ai-v03";

type Seen = View03["players"][number]["fields"][number]["cards"][number];

export function FieldStrip03({
  view,
  seat,
  selected,
  enabled,
  onSelect,
  onInspect,
}: {
  view: View03;
  seat: 0 | 1;
  selected: string[];
  enabled: boolean;
  onSelect: (card: string) => void;
  onInspect: (open: boolean) => void;
}) {
  const [expanded, setExpanded] = useState<number | null>(null);
  const fields = view.players[seat].fields;
  const detail = expanded === null ? null : fields[expanded];
  const close = () => {
    setExpanded(null);
    onInspect(false);
  };
  return (
    <>
      <div
        className={`field-strip ${seat === 0 ? "player-reserve" : "enemy-reserve"}`}
        aria-label={seat === 0 ? "你的场地" : "对手场地"}
      >
        {fields.map((field, index) => (
          <div
            className={`field ${index === view.round - 1 ? "active-field" : ""} ${field.kind === "control" && index !== view.round - 1 ? "control-field" : ""}`}
            key={index}
          >
            <span className="field-number">{index + 1}</span>
            {index === view.round - 1 ? (
              <div className="battle-marker">
                <Swords />
                <span>战区</span>
              </div>
            ) : field.kind === "control" ? (
              <ControlStack
                seat={seat}
                index={index}
                cards={field.cards}
                used={field.used}
                selected={selected}
                onOpen={() => {
                  setExpanded(index);
                  onInspect(true);
                }}
              />
            ) : field.cards.length ? (
              <ReserveCard
                card={field.cards[0]}
                selected={selected}
                enabled={enabled && seat === 0}
                onSelect={onSelect}
              />
            ) : (
              <div className="refill-slot" aria-label="下回合补牌">
                —
              </div>
            )}
          </div>
        ))}
      </div>
      <Dialog
        open={expanded !== null}
        onOpenChange={(open) => {
          if (!open) close();
        }}
      >
        <DialogContent className="control-dialog">
          <DialogHeader>
            <DialogTitle>
              {expanded === null ? "控制区" : `${expanded + 1} 号控制区`}
            </DialogTitle>
            <DialogDescription>
              {detail?.used
                ? "本场已吸取过一张，余牌保留。"
                : enabled && seat === 0 && !detail?.used
                  ? "选一张加入本次吸牌。"
                  : "控制区的牌已经亮过。"}
            </DialogDescription>
          </DialogHeader>
          {detail && (
            <div className="hand-row">
              {detail.cards.map((card) =>
                card.hidden ? (
                  <PlayingCard key={card.slot} faceDown slot={card.slot} shared={false} />
                ) : (
                  <PlayingCard
                    key={card.card}
                    card={card.card}
                    shared={false}
                    selected={selected.includes(card.card)}
                    disabled={!enabled || seat !== 0 || detail.used}
                    onClick={
                      enabled && seat === 0 && !detail.used
                        ? () => {
                            onSelect(card.card);
                            close();
                          }
                        : undefined
                    }
                  />
                ),
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function ReserveCard({
  card,
  selected,
  enabled,
  onSelect,
}: {
  card: Seen;
  selected: string[];
  enabled: boolean;
  onSelect: (card: string) => void;
}) {
  if (card.hidden)
    return <PlayingCard faceDown slot={card.slot} small shared />;
  return (
    <PlayingCard
      card={card.card}
      small
      selected={selected.includes(card.card)}
      disabled={!enabled}
      onClick={enabled ? () => onSelect(card.card) : undefined}
    />
  );
}

function ControlStack({
  seat,
  index,
  cards,
  used,
  selected,
  onOpen,
}: {
  seat: 0 | 1;
  index: number;
  cards: Seen[];
  used: boolean;
  selected: string[];
  onOpen: () => void;
}) {
  const faces = cards.flatMap((card) => (card.hidden ? [] : [card.card]));
  const chosen = faces.some((card) => selected.includes(card));
  return (
    <Button
      variant="ghost"
      className={`control-stack ${chosen ? "chosen" : ""}`}
      aria-label={`查看${seat === 0 ? "你的" : "对手的"}${index + 1}号控制区`}
      onClick={onOpen}
    >
      <span className="control-faces">
        {cards.map((card) =>
          card.hidden ? (
            <span key={card.slot}>暗</span>
          ) : (
            <span className={/[HD]/.test(card.card[1]) ? "red" : ""} key={card.card}>
              {cardText(card.card)}
            </span>
          ),
        )}
      </span>
      <span className="control-caption">
        <Check size={12} />
        {used ? "已使用" : "控制区"}
      </span>
    </Button>
  );
}
