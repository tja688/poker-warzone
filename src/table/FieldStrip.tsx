import { useState } from "react";
import { Check, Swords } from "lucide-react";
import { Button } from "../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../components/ui/dialog";
import { PlayingCard, CardRow, cardText } from "../cards";
import type { Action, Card, GameState, PlayerId } from "../game/engine";
export function FieldStrip({
  game,
  player,
  selected,
  onSelect,
  mode,
  enabled,
  onInspect,
}: {
  game: GameState;
  player: PlayerId;
  selected: Card[];
  onSelect: (c: Card) => void;
  mode: Action["kind"];
  enabled: boolean;
  onInspect: (open: boolean) => void;
}) {
  const [expanded, setExpanded] = useState<number | null>(null);
  const fields = game.players[player].fields;
  const detail = expanded === null ? null : fields[expanded];
  const pickControl =
    enabled && player === 0 && mode === "absorb" && !detail?.used;
  const close = () => {
    setExpanded(null);
    onInspect(false);
  };
  return (
    <>
      <div
        className={`field-strip ${player === 0 ? "player-reserve" : "enemy-reserve"}`}
        aria-label={player === 0 ? "你的场地" : "对手场地"}
      >
        {fields.map((field, i) => (
          <div
            className={`field ${i === game.round - 1 ? "active-field" : ""} ${field.kind === "control" ? "control-field" : ""}`}
            key={i}
          >
            <span className="field-number">{i + 1}</span>
            {i === game.round - 1 ? (
              <div className="battle-marker">
                <Swords />
                <span>战区</span>
              </div>
            ) : field.kind === "control" ? (
              <Button
                variant="ghost"
                className={`control-stack ${selected.some((c) => field.cards.includes(c)) ? "chosen" : ""}`}
                aria-label={`查看${player === 0 ? "你的" : "对手的"}${i + 1}号控制区`}
                onClick={() => {
                  setExpanded(i);
                  onInspect(true);
                }}
              >
                <span className="control-faces">
                  {field.cards.map((c) => (
                    <span className={/[HD]/.test(c[1]) ? "red" : ""} key={c}>
                      {cardText(c)}
                    </span>
                  ))}
                </span>
                <span className="control-caption">
                  <Check size={12} />
                  {field.used ? "已使用" : "控制区"}
                </span>
              </Button>
            ) : field.cards.length ? (
              <PlayingCard
                card={field.cards[0]}
                small
                selected={selected.includes(field.cards[0])}
                onClick={
                  player === 0 ? () => onSelect(field.cards[0]) : undefined
                }
                disabled={!enabled}
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
                : pickControl
                  ? "选一张加入本次吸牌。"
                  : "每个控制区整场只能吸取一张。"}
            </DialogDescription>
          </DialogHeader>
          {detail && (
            <CardRow
              cards={detail.cards}
              selected={selected}
              shared={false}
              onSelect={
                pickControl
                  ? (c) => {
                      onSelect(c);
                      close();
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
