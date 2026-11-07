import { ArrowDownToLine, ArrowLeftRight, ArrowRight, Trash2, X } from "lucide-react";
import { Button } from "../components/ui/button";
import { HAND_NAMES } from "../game/engine";
import { cardText } from "../cards";
import type { Action03 } from "../game/engine-v03";
import type { View03 } from "../game/ai-v03";
import { heirs, type Draft03 } from "./useDraft03";

const NAMES = { absorb: "吸牌", swap: "换牌", discard: "弃牌" } as const;
const ICONS = {
  absorb: ArrowDownToLine,
  swap: ArrowLeftRight,
  discard: Trash2,
} as const;

export function ActionDock03({
  view,
  draft,
  concealed,
  enabled,
  error,
  onSubmit,
}: {
  view: View03;
  draft: Draft03;
  concealed: number[];
  enabled: boolean;
  error: string;
  onSubmit: (action: Action03) => void;
}) {
  if (view.phase !== "action" || view.actor !== 0)
    return (
      <footer className="action-dock">
        <p className="action-hint">等待对手行动</p>
      </footer>
    );
  return (
    <CardDock
      view={view}
      draft={draft}
      concealed={concealed}
      enabled={enabled}
      error={error}
      onSubmit={onSubmit}
    />
  );
}

function CardDock({
  view,
  draft,
  concealed,
  enabled,
  error,
  onSubmit,
}: {
  view: View03;
  draft: Draft03;
  concealed: number[];
  enabled: boolean;
  error: string;
  onSubmit: (action: Action03) => void;
}) {
  const ready = enabled ? draft.ready : null;
  return (
    <footer className="action-dock">
      <div className="action-modes" aria-label="行动方式">
        {draft.modes.map((mode) => {
          const Icon = ICONS[mode];
          return (
            <Button
              variant="ghost"
              key={mode}
              aria-pressed={draft.mode === mode}
              onClick={() => draft.changeMode(mode)}
            >
              <Icon />
              <span>{NAMES[mode]}</span>
            </Button>
          );
        })}
      </div>
      <div className="action-detail">
        {draft.mode === "swap" && draft.targets.length > 0 && (
          <div className="swap-options">
            <div className="target-options">
              {draft.targets.map((item) => (
                <Button
                  variant="ghost"
                  key={item}
                  aria-pressed={draft.target === item}
                  onClick={() => draft.pickTarget(item)}
                >
                  {HAND_NAMES[item]}
                </Button>
              ))}
            </div>
          </div>
        )}
        {draft.hiddenChoices.length > 1 && (
          <div className="target-options" aria-label="选择暗牌">
            {draft.hiddenChoices.map(
              (action) =>
                action.kind === "absorb" &&
                action.hidden && (
                  <Button
                    variant="ghost"
                    key={action.hidden}
                    aria-pressed={draft.hidden === action.hidden}
                    onClick={() => draft.pickHidden(action.hidden!)}
                  >
                    {cardText(action.hidden)} 扣下
                  </Button>
                ),
            )}
          </div>
        )}
        {draft.orderChoices.length > 1 && (
          <div className="target-options" aria-label="继承暗位">
            {draft.orderChoices.map((action) => {
              const incoming = heirs(action, draft.battle, concealed);
              const label = incoming.length
                ? `${incoming.map(cardText).join(" ")} 继承暗位`
                : `${action.take.map(cardText).join(" ")} 顺序`;
              return (
                <Button
                  variant="ghost"
                  key={action.take.join("-")}
                  aria-pressed={
                    !!draft.order &&
                    draft.order.length === action.take.length &&
                    draft.order.every((card, index) => card === action.take[index])
                  }
                  onClick={() => draft.pickOrder(action.take)}
                >
                  {label}
                </Button>
              );
            })}
          </div>
        )}
        <div className="selection-summary" aria-live="polite">
          {error ? <span role="alert">{error}</span> : <span>{enabled ? "点牌，再确认" : ""}</span>}
        </div>
      </div>
      <div className="commit-controls">
        <Button
          variant="ghost"
          size="icon"
          aria-label="清空选择"
          disabled={!enabled || (draft.take.length === 0 && draft.give.length === 0)}
          onClick={draft.clear}
        >
          <X />
        </Button>
        <Button
          className="confirm-action"
          disabled={!ready}
          aria-label={`确认${NAMES[draft.mode]}`}
          onClick={() => ready && onSubmit(ready)}
        >
          <span>{NAMES[draft.mode]}</span>
          <ArrowRight />
        </Button>
      </div>
    </footer>
  );
}
