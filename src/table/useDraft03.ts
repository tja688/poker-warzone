import { useState } from "react";
import type { Action, Card } from "../game/engine";
import type { Action03 } from "../game/engine-v03";
import type { View03 } from "../game/ai-v03";

const sameSet = (a: Card[], b: Card[]) =>
  a.length === b.length && a.every((card) => b.includes(card));
const sameOrder = (a: Card[], b: Card[]) =>
  a.length === b.length && a.every((card, index) => card === b[index]);

export type CardAction = Action & { hidden?: Card };
export function isCardAction(action: Action03): action is CardAction {
  return (
    action.kind === "absorb" ||
    action.kind === "swap" ||
    action.kind === "discard"
  );
}

export function ownBattle(view: View03): Card[] {
  const field = view.players[0].fields[view.round - 1];
  if (!field) return [];
  return field.cards.flatMap((card) => (card.hidden ? [] : [card.card]));
}

/** Incoming cards that land on a face-down battle slot, in battle order. */
export function heirs(
  action: CardAction,
  battle: Card[],
  concealed: number[],
): Card[] {
  if (action.kind !== "swap") return [];
  const outgoing = battle.filter((card) => action.give.includes(card));
  const picked: Card[] = [];
  for (let i = 0; i < outgoing.length; i++) {
    if (concealed.includes(battle.indexOf(outgoing[i])))
      picked.push(action.take[i]);
  }
  return picked;
}

export function useDraft03(view: View03, concealed: number[]) {
  const actions = view.actions.filter(isCardAction);
  const battle = ownBattle(view);
  const fields = view.players[0].fields;
  const first = actions.find((action) => action.kind === "absorb") ?? actions[0];
  const signature = `${view.phase}:${view.actor}:${view.round}:${view.results.length}:${battle.join(".")}`;
  const [stamp, setStamp] = useState(signature);
  const [mode, setMode] = useState<CardAction["kind"]>(first?.kind ?? "absorb");
  const [take, setTake] = useState<Card[]>([]);
  const [give, setGive] = useState<Card[]>([]);
  const [target, setTarget] = useState<number | undefined>();
  const [hidden, setHidden] = useState<Card | undefined>();
  const [order, setOrder] = useState<Card[] | undefined>();
  if (stamp !== signature) {
    setStamp(signature);
    setMode(first?.kind ?? "absorb");
    setTake([]);
    setGive([]);
    setTarget(undefined);
    setHidden(undefined);
    setOrder(undefined);
  }

  const absorbs = actions.filter(
    (action) => action.kind === "absorb" && sameSet(action.take, take),
  );
  const swaps = actions.filter(
    (action): action is CardAction & { kind: "swap" } =>
      action.kind === "swap" &&
      sameSet(action.take, take) &&
      sameSet(action.give, give) &&
      action.target === target,
  );
  const discards = actions.filter(
    (action) => action.kind === "discard" && sameSet(action.take, take),
  );
  const hiddenChoices = [
    ...new Map(
      absorbs.flatMap((action) =>
        action.kind === "absorb" && action.hidden
          ? [[action.hidden, action] as const]
          : [],
      ),
    ).values(),
  ];
  let ready: Action03 | null = null;
  if (view.actor === 0 && view.phase === "action") {
    if (mode === "absorb")
      ready =
        absorbs.length === 1
          ? absorbs[0]
          : (absorbs.find(
              (action) => action.kind === "absorb" && action.hidden === hidden,
            ) ?? null);
    else if (mode === "swap")
      ready =
        swaps.length === 1
          ? swaps[0]
          : (swaps.find((action) => order && sameOrder(action.take, order)) ??
            null);
    else ready = discards.length === 1 ? discards[0] : null;
  }

  function fieldOf(card: Card) {
    return fields.find(
      (field) =>
        field.kind !== "battle" &&
        field.cards.some((entry) => !entry.hidden && entry.card === card),
    );
  }
  function pick(card: Card) {
    if (mode === "swap") {
      setTake(
        take.includes(card) ? take.filter((item) => item !== card) : [...take, card],
      );
      setOrder(undefined);
      return;
    }
    if (take.includes(card)) {
      setTake(take.filter((item) => item !== card));
      setHidden(undefined);
      return;
    }
    const field = fieldOf(card);
    if (!field) return;
    let next = take;
    if (mode === "absorb" && field.kind === "control")
      next = next.filter(
        (item) => !field.cards.some((entry) => !entry.hidden && entry.card === item),
      );
    if (mode === "absorb" && next.length >= 5 - battle.length) return;
    setTake([...next, card]);
    setHidden(undefined);
  }
  function loadSwap(action?: CardAction) {
    if (!action || action.kind !== "swap") {
      setTake([]);
      setGive([]);
      setTarget(undefined);
      return;
    }
    setTake([...action.take]);
    setGive([...action.give]);
    setTarget(action.target);
    setOrder(undefined);
  }

  const swapActions = actions.filter(
    (action): action is CardAction & { kind: "swap" } => action.kind === "swap",
  );
  const targets = [...new Set(swapActions.map((action) => action.target!))].sort(
    (a, b) => a - b,
  );
  const modes = (["absorb", "swap", "discard"] as const).filter((kind) =>
    actions.some((action) => action.kind === kind),
  );

  return {
    mode,
    modes,
    take,
    give,
    target,
    targets,
    hidden,
    order,
    ready,
    battle,
    hiddenChoices: hiddenChoices.length > 1 ? hiddenChoices : [],
    orderChoices: swaps.length > 1 ? swaps : [],
    changeMode: (next: CardAction["kind"]) => {
      setMode(next);
      setHidden(undefined);
      setOrder(undefined);
      if (next === "swap") loadSwap(swapActions[0]);
      else {
        setTake([]);
        setGive([]);
        setTarget(undefined);
      }
    },
    pick,
    pickGive: (card: Card) => {
      setGive(
        give.includes(card) ? give.filter((item) => item !== card) : [...give, card],
      );
      setOrder(undefined);
    },
    pickTarget: (next: number) => {
      loadSwap(swapActions.find((action) => action.target === next));
    },
    pickHidden: (card: Card) => setHidden(card),
    pickOrder: (takeOrder: Card[]) => setOrder(takeOrder),
    clear: () => {
      setTake([]);
      setGive([]);
      setHidden(undefined);
      setOrder(undefined);
    },
  };
}

export type Draft03 = ReturnType<typeof useDraft03>;
