import { HAND_NAMES } from "../game/engine";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";

export function Help03({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="help-dialog">
        <DialogHeader>
          <DialogTitle>暗牌，先到三胜</DialogTitle>
          <DialogDescription>
            对手的手牌和暗牌是牌背。先赢下三个战区的人获胜。
          </DialogDescription>
        </DialogHeader>
        <dl className="rules-list">
          <div>
            <dt>暗牌</dt>
            <dd>开局战区那张是暗的。第一次吸牌再扣下一张，之后吸入的牌都亮着。</dd>
          </div>
          <div>
            <dt>换牌</dt>
            <dd>换进暗位的牌继承牌背。换出和弃掉的牌进入牌河。</dd>
          </div>
        </dl>
        <div className="hand-ranks">
          {HAND_NAMES.slice(1).map((name, i) => (
            <span key={name}>
              {i + 1}. {name}
            </span>
          ))}
        </div>
        <a
          className="rules-link"
          href="./rules-v0.3.md"
          target="_blank"
          rel="noreferrer"
        >
          完整规则 ↗
        </a>
      </DialogContent>
    </Dialog>
  );
}
