import { HAND_NAMES } from "../game/engine";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
export function Help({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="help-dialog">
        <DialogHeader>
          <DialogTitle>先赢 3 个战区</DialogTitle>
          <DialogDescription>
            双方明牌。每回合做一件事，凑出更强的五张牌。
          </DialogDescription>
        </DialogHeader>
        <dl className="rules-list">
          <div>
            <dt>吸牌</dt>
            <dd>
              选普通场地的牌加入战区，最多五张。未用过的控制区也可各取一张。
            </dd>
          </div>
          <div>
            <dt>换牌</dt>
            <dd>
              先选更高牌型，再确认换牌。预选组合可点牌调整；必须用最少张数升级，不能只换踢脚。
            </dd>
          </div>
          <div>
            <dt>弃牌</dt>
            <dd>每局一次，选任意普通牌弃掉。空场地在自己下回合补满。</dd>
          </div>
        </dl>
        <p>
          双方都无牌可动时比牌。赢下的场地成为控制区，保留牌；输家的场地回收。平局双方各得一胜。
        </p>
        <div className="hand-ranks">
          {HAND_NAMES.slice(1).map((name, i) => (
            <span key={name}>
              {i + 1}. {name}
            </span>
          ))}
        </div>
        <a
          className="rules-link"
          href="./rules-v0.1.md"
          target="_blank"
          rel="noreferrer"
        >
          完整规则 ↗
        </a>
      </DialogContent>
    </Dialog>
  );
}
