import {
  ArrowDownToLine,
  ArrowLeftRight,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { HAND_NAMES, evaluate } from "../game/engine";
import { ACTION_NAMES, type Selection } from "./useSelection";
const icons = {
  absorb: ArrowDownToLine,
  swap: ArrowLeftRight,
  discard: Trash2,
};
export function ActionDock({
  selection: s,
  enabled,
  onConfirm,
  error,
}: {
  selection: Selection;
  enabled: boolean;
  onConfirm: () => void;
  error: string;
}) {
  const hasDraft = s.take.length > 0 || s.give.length > 0;
  const hint = !enabled
    ? "等待对手行动"
    : s.mode === "absorb"
      ? `选牌加入战区 · 还可放 ${5 - s.battle.length} 张`
      : s.mode === "swap"
        ? "点牌调整换入、换出"
        : "选择普通牌弃掉 · 下回合补牌";
  return (
    <footer className="action-dock">
      <div className="action-modes" aria-label="行动方式">
        {(["absorb", "swap", "discard"] as const).map((mode) => {
          const Icon = icons[mode];
          return (
            <Button
              variant="ghost"
              key={mode}
              aria-pressed={s.mode === mode}
              disabled={!enabled || !s.actions.some((a) => a.kind === mode)}
              onClick={() => s.changeMode(mode)}
            >
              <Icon />
              <span>{ACTION_NAMES[mode]}</span>
            </Button>
          );
        })}
      </div>
      <div className="action-detail">
        {enabled && s.mode === "swap" ? (
          <div className="swap-options">
            <div className="target-options">
              {s.targets.map((t) => (
                <Button
                  variant="ghost"
                  key={t}
                  aria-pressed={s.target === t}
                  onClick={() => s.pickTarget(t)}
                >
                  {HAND_NAMES[t]}
                </Button>
              ))}
            </div>
            {s.choices.length > 1 && (
              <div className="combination">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="上一组换牌"
                  onClick={() => s.cycle(-1)}
                >
                  <ChevronLeft />
                </Button>
                <span>
                  {s.choiceIndex + 1}/{s.choices.length}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="下一组换牌"
                  onClick={() => s.cycle(1)}
                >
                  <ChevronRight />
                </Button>
              </div>
            )}
          </div>
        ) : (
          <p className="action-hint">{hint}</p>
        )}
        <div className="selection-summary" aria-live="polite">
          {error ? (
            <span role="alert">{error}</span>
          ) : hasDraft ? (
            s.valid ? (
              <>
                <b>
                  {s.mode === "discard"
                    ? `弃掉 ${s.take.length} 张`
                    : `${evaluate(s.battle).name} → ${s.preview?.name}`}
                </b>
                <span>
                  {s.mode === "swap"
                    ? `换 ${s.take.length} 张`
                    : s.mode === "absorb"
                      ? `吸入 ${s.take.length} 张`
                      : "每局一次"}
                </span>
              </>
            ) : (
              <span>
                {s.mode === "swap"
                  ? "换入换出须等量，以最少张数升级牌型"
                  : "继续选牌"}
              </span>
            )
          ) : (
            <span>
              {enabled ? "点一下选中，再点取消" : "对手的牌也全部可见"}
            </span>
          )}
        </div>
      </div>
      <div className="commit-controls">
        <Button
          variant="ghost"
          size="icon"
          aria-label="清空选择"
          disabled={!hasDraft || !enabled}
          onClick={s.clear}
        >
          <X />
        </Button>
        <Button
          className="confirm-action"
          disabled={!enabled || !s.valid}
          onClick={onConfirm}
          aria-label={`确认${ACTION_NAMES[s.mode]}`}
        >
          <span>
            {ACTION_NAMES[s.mode]}
            {s.valid ? ` ${s.take.length} 张` : ""}
          </span>
          <ArrowRight />
        </Button>
      </div>
    </footer>
  );
}
