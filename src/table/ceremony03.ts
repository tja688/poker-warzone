import { viewFor, type Action03, type Game03 } from "../game/engine-v03";
import { describeAction, type Card } from "../game/engine";
import type { View03 } from "../game/ai-v03";

export type LineCard =
  | { hidden: false; card: Card }
  | { hidden: true; slot: string };
export type Flip = { seat: 0 | 1; index: number; slot: string; card: Card };
export type Ceremony = {
  round: number;
  resultCount: number;
  lines: [LineCard[], LineCard[]];
  flips: Flip[];
  shown: number;
  chipsMoved: boolean;
};
export type Flight = {
  key: string;
  slot: string | null;
  card: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
  toX: number;
  toY: number;
};

export function playPhases(phase: View03["phase"]) {
  return phase === "action";
}

/** Seat 1's view marks which of our battle slots are face-down. Return indexes only. */
export function ownConcealed(game: Game03): number[] {
  const seat = viewFor(game, 1);
  const field = seat.players[0].fields[seat.round - 1];
  if (!field) return [];
  return field.cards.flatMap((card, index) => (card.hidden ? [index] : []));
}

function lineOf(view: View03, seat: 0 | 1, concealed: number[]): LineCard[] {
  const field = view.players[seat].fields[view.round - 1];
  if (!field) return [];
  return field.cards.map((card, index) => {
    if (seat === 0 && concealed.includes(index))
      return { hidden: true, slot: `0-${view.round - 1}-${index}` };
    if (card.hidden) return { hidden: true, slot: card.slot };
    return { hidden: false, card: card.card };
  });
}

export function buildCeremony(
  prev: View03,
  concealed: number[],
  hands: [Card[], Card[]],
  resultCount: number,
): Ceremony {
  const lines: [LineCard[], LineCard[]] = [
    lineOf(prev, 0, concealed),
    lineOf(prev, 1, []),
  ];
  const flips: Flip[] = [];
  for (const seat of [1, 0] as const)
    lines[seat].forEach((card, index) => {
      if (card.hidden)
        flips.push({ seat, index, slot: card.slot, card: hands[seat][index] });
    });
  return {
    round: prev.round,
    resultCount,
    lines,
    flips,
    shown: 0,
    chipsMoved: false,
  };
}

export function told(action: Action03, actor: 0 | 1) {
  const who = actor === 0 ? "你" : "对手";
  if (action.kind === "absorb") return actor === 0 ? `你${describeAction(action)}` : "对手吸牌";
  if (action.kind === "swap") return actor === 0 ? `你${describeAction(action)}` : "对手换牌";
  if (action.kind === "discard") return actor === 0 ? `你${describeAction(action)}` : "对手弃牌";
  return who;
}

export function captureRetreat(): Flight[] {
  const deck = document.querySelector(".deck-count")?.getBoundingClientRect();
  if (!deck || matchMedia("(prefers-reduced-motion: reduce)").matches) return [];
  return [...document.querySelectorAll(".battle-region .playing-card")].map(
    (element, index) => {
      const rect = element.getBoundingClientRect();
      const slot = element.getAttribute("data-slot");
      const card = slot ? null : element.getAttribute("data-card");
      return {
        key: slot ?? card ?? `flight-${index}`,
        slot,
        card,
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        toX: deck.x + deck.width / 2 - rect.width / 2,
        toY: deck.y + deck.height / 2 - rect.height / 2,
      };
    },
  );
}
