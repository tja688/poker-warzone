import { useMemo, useState } from "react";
import {
  evaluate,
  legalActions,
  type Action,
  type Card,
  type GameState,
} from "../game/engine";
const same = (a: Card[], b: Card[]) =>
  a.length === b.length && a.every((c) => b.includes(c));
export const ACTION_NAMES = { absorb: "吸牌", swap: "换牌", discard: "弃牌" };
/** UI draft only. The engine owns legality. Parent keys this hook's owner by
 * seed/round/turn so drafts cannot survive a move, reload or restart. */
export function useSelection(game: GameState) {
  const actions = useMemo(
    () => (game.phase === "play" && game.turn === 0 ? legalActions(game) : []),
    [game],
  );
  const initial =
    actions.find((a) => a.kind === "absorb") ||
    actions.find((a) => a.kind === "swap") ||
    actions[0];
  const [mode, setMode] = useState<Action["kind"]>(initial?.kind || "absorb");
  const [take, setTake] = useState<Card[]>(
    initial?.kind === "swap" ? initial.take : [],
  );
  const [give, setGive] = useState<Card[]>(
    initial?.kind === "swap" ? initial.give : [],
  );
  const [target, setTarget] = useState<number | undefined>(
    initial?.kind === "swap" ? initial.target : undefined,
  );
  const battle =
    game.phase === "play"
      ? game.players[0].fields[game.round - 1].cards
      : game.history.at(-1)!.hands[0];
  const swaps = actions.filter((a) => a.kind === "swap");
  const targets = [...new Set(swaps.map((a) => a.target!))].sort(
    (a, b) => a - b,
  );
  const choices = swaps.filter((a) => a.target === target);
  const valid = actions.find(
    (a) =>
      a.kind === mode &&
      same(a.take, take) &&
      same(a.give, give) &&
      (mode !== "swap" || a.target === target),
  );
  function setDraftFromAction(a?: Action) {
    setTake(a?.take || []);
    setGive(a?.give || []);
    setTarget(a?.target);
  }
  function changeMode(next: Action["kind"]) {
    setMode(next);
    setDraftFromAction(next === "swap" ? swaps[0] : undefined);
  }
  function pick(card: Card) {
    if (take.includes(card)) {
      setTake(take.filter((c) => c !== card));
      return;
    }
    let next = take;
    const field = game.players[0].fields.find((f) => f.cards.includes(card))!;
    if (mode === "absorb") {
      if (field.kind === "control")
        next = next.filter((c) => !field.cards.includes(c));
      if (next.length >= 5 - battle.length) return;
    }
    setTake([...next, card]);
  }
  const previewCards =
    mode === "discard"
      ? battle
      : [...battle.filter((c) => !give.includes(c)), ...take];
  return {
    mode,
    take,
    give,
    target,
    actions,
    targets,
    choices,
    valid,
    battle,
    preview: previewCards.length <= 5 ? evaluate(previewCards) : null,
    changeMode,
    pick,
    pickGive: (c: Card) =>
      setGive(give.includes(c) ? give.filter((x) => x !== c) : [...give, c]),
    pickTarget: (t: number) =>
      setDraftFromAction(swaps.find((a) => a.target === t)),
    cycle: (offset: number) => {
      const i = choices.findIndex(
        (a) => same(a.take, take) && same(a.give, give),
      );
      setDraftFromAction(
        choices[(i + offset + choices.length) % choices.length],
      );
    },
    choiceIndex: choices.findIndex(
      (a) => same(a.take, take) && same(a.give, give),
    ),
    clear: () => {
      setTake([]);
      setGive([]);
    },
  };
}
export type Selection = ReturnType<typeof useSelection>;
