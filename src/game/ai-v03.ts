import {
  compareHands,
  evaluate,
  FULL_DECK,
  seedHash,
  type Action,
  type Card,
  type Hand,
  type PlayerId,
} from "./engine";
import {
  viewFor,
  type Action03,
  type Game03,
} from "./engine-v03";

// Fair decisions read the view only. chooseOracle is the one function that sees opponent cards.
export type View03 = ReturnType<typeof viewFor>;

export const solid = {
  kind: "personality",
  rate: 1 / 20,
  tighter: 0.08,
  raiseGap: 0.17,
} as const;
export const balanced = {
  kind: "personality",
  rate: 1 / 8,
  tighter: 0,
  raiseGap: 0.125,
} as const;
export const bluff = {
  kind: "personality",
  rate: 1 / 4,
  tighter: -0.08,
  raiseGap: 0.08,
} as const;
export const station = { kind: "station" } as const;
export const randomBet = { kind: "randomBet" } as const;
export const fairPolicies = [solid, balanced, bluff, station, randomBet] as const;
export type Policy = (typeof fairPolicies)[number];
type Personality = typeof solid | typeof balanced | typeof bluff;

export const DEFAULT_SAMPLES = 32;

const VERY_LOW = 0.12;
const rank = (c: Card) => "23456789TJQKA".indexOf(c[0]) + 2;
const other = (p: PlayerId): PlayerId => (p === 0 ? 1 : 0);

function valueOf(hand: Hand): number {
  let v = hand.grade;
  for (let i = 0; i < hand.ranks.length; i++)
    v += (hand.ranks[i] / 15 ** (i + 1)) * 0.8;
  return v;
}
function handValue(cards: Card[]): number {
  return valueOf(evaluate(cards));
}
function potential(cards: Card[], unseen: Card[]): number {
  const room = 5 - cards.length;
  if (!room) return handValue(cards);
  const values = cards.map(rank);
  const suits = [..."CDHS"].map((s) => cards.filter((c) => c[1] === s).length);
  let score = handValue(cards) * 0.8;
  const counts = new Map<number, number>();
  for (const v of values) counts.set(v, (counts.get(v) || 0) + 1);
  const unseenRank = new Array<number>(15).fill(0);
  for (const c of unseen) unseenRank[rank(c)]++;
  for (const [v, n] of counts) {
    const remaining = unseenRank[v] ?? 0;
    score +=
      (((n === 3 ? 1.1 : n === 2 ? 0.65 : 0.055) * remaining * room) /
        Math.max(1, unseen.length)) *
      12;
  }
  const flushNeed = 5 - Math.max(...suits);
  if (flushNeed <= room) score += (0.25 * (5 - flushNeed)) / (flushNeed + 1);
  let bestStraight = 0;
  for (let high = 5; high <= 14; high++) {
    const route = [high, high - 1, high - 2, high - 3, high - 4].map((v) =>
      v === 1 ? 14 : v,
    );
    const hits = route.filter((v) => values.includes(v)).length;
    if (5 - hits <= room) bestStraight = Math.max(bestStraight, hits);
  }
  score += bestStraight * 0.08;
  score += values.reduce((a, b) => a + b, 0) * 0.001;
  return score;
}

function isCard(a: Action03): a is Action & { hidden?: Card } {
  return a.kind === "absorb" || a.kind === "swap" || a.kind === "discard";
}
function shown(view: View03, p: PlayerId, fieldIndex: number): Card[] {
  const cards: Card[] = [];
  for (const c of view.players[p].fields[fieldIndex].cards)
    if (!c.hidden) cards.push(c.card);
  return cards;
}
function normalsOf(view: View03, p: PlayerId): Card[] {
  const cards: Card[] = [];
  view.players[p].fields.forEach((f, i) => {
    if (i === view.round - 1 || f.kind !== "normal") return;
    for (const c of f.cards) if (!c.hidden) cards.push(c.card);
  });
  return cards;
}
function controlSet(view: View03, p: PlayerId): Set<Card> {
  const cards = new Set<Card>();
  for (const f of view.players[p].fields)
    if (f.kind === "control" && !f.used)
      for (const c of f.cards) if (!c.hidden) cards.add(c.card);
  return cards;
}
function ownIds(view: View03): Card[] {
  const ids: Card[] = [];
  for (const f of view.players[view.player].fields)
    for (const c of f.cards) if (!c.hidden) ids.push(c.card);
  return ids;
}
function seenIds(view: View03): Set<Card> {
  const ids = new Set<Card>();
  for (const p of view.players)
    for (const f of p.fields)
      for (const c of f.cards) if (!c.hidden) ids.add(c.card);
  for (const r of view.river) ids.add(r.card);
  for (const result of view.results)
    for (const hand of result.hands ?? []) for (const c of hand) ids.add(c);
  return ids;
}
function poolFor(view: View03, extra: readonly Card[]): Card[] {
  const seen = seenIds(view);
  for (const c of extra) seen.add(c);
  return FULL_DECK.filter((c) => !seen.has(c));
}
function hashMaterial(view: View03): string {
  return JSON.stringify({
    player: view.player,
    phase: view.phase,
    actor: view.actor,
    round: view.round,
    starter: view.starter,
    scores: view.scores,
    config: view.config,
    river: view.river,
    results: view.results,
    winner: view.winner,
    players: view.players,
    own: ownIds(view),
  });
}
function mix(base: number, salt: number): number {
  let x = Math.imul(base ^ salt, 0x9e3779b1);
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b);
  return (x ^ (x >>> 13)) >>> 0;
}
function nextBattle(current: Card[], a: Action & { hidden?: Card }): Card[] {
  if (a.kind === "discard") return current;
  if (a.kind === "absorb") return [...current, ...a.take];
  return [...current.filter((c) => !a.give.includes(c)), ...a.take];
}
function exposure(card: Card, battle: Card[]): number {
  const v = rank(card);
  const others = battle.filter((c) => c !== card);
  let score = 0;
  if (others.some((c) => rank(c) === v)) score += 3;
  if (battle.filter((c) => c[1] === card[1]).length >= 3) score += 2;
  if (
    others.some((c) => {
      const d = Math.abs(rank(c) - v);
      return d >= 1 && d <= 4;
    })
  )
    score += 1;
  return score;
}
function climbScore(
  a: Action & { hidden?: Card },
  current: Card[],
  unseen: Card[],
  opp: Card[],
  enemy: Hand | null,
  controls: Set<Card>,
  normals: Card[],
  round: number,
): number {
  const next = nextBattle(current, a);
  const usedControls = a.take.filter((c) => controls.has(c)).length;
  let score = potential(next, unseen) * 100 + next.length * 1.3;
  if (next.length === 5) {
    score += evaluate(next).grade * 12;
    if (enemy && opp.length === 5 && compareHands(evaluate(next), enemy) > 0)
      score += 18;
  }
  score -= usedControls * (round < 4 ? 8 : 2);
  if (a.kind === "swap") score += 3;
  if (a.kind === "discard") {
    const keep = normals.filter((c) => !a.take.includes(c));
    const usefulness = (c: Card) => {
      const v = rank(c);
      let u = current.some((x) => rank(x) === v) ? 8 : 0;
      if (current.length < 5) {
        u += current.filter((x) => x[1] === c[1]).length * 0.65;
        u += current.filter((x) => Math.abs(rank(x) - v) <= 3).length * 0.25;
        u += v * 0.035;
      }
      return u;
    };
    score -= 8;
    score += a.take.reduce((sum, c) => sum + 1.6 - usefulness(c), 0);
    score += keep.reduce((sum, c) => sum + usefulness(c) * 0.1, 0);
  }
  return score;
}
function climb(view: View03): Action03 | null {
  const current = shown(view, view.player, view.round - 1);
  const opp = shown(view, other(view.player), view.round - 1);
  const unseen = poolFor(view, []);
  const enemy = opp.length === 5 ? evaluate(opp) : null;
  const controls = controlSet(view, view.player);
  const normals = normalsOf(view, view.player);
  let best: Action03 | null = null;
  let bestScore = -Infinity;
  let bestEx = -1;
  for (const a of view.actions) {
    if (!isCard(a)) continue;
    const score = climbScore(
      a,
      current,
      unseen,
      opp,
      enemy,
      controls,
      normals,
      view.round,
    );
    const ex =
      a.kind === "absorb" && a.hidden ? exposure(a.hidden, nextBattle(current, a)) : 0;
    if (score > bestScore + 1e-10) {
      best = a;
      bestScore = score;
      bestEx = ex;
    } else if (score > bestScore - 1e-10 && ex > bestEx) {
      best = a;
      bestEx = ex;
    }
  }
  return best;
}

interface Seat {
  battle: Card[];
  hand: Card[];
  controls: Card[][];
  holes: number;
}
interface Deal {
  seats: [Seat, Seat];
  deck: Card[];
  at: number;
}
type Move =
  | { kind: "absorb"; card: Card; from: "hand" | "control" }
  | { kind: "swap"; card: Card; give: Card };

function seatFromView(
  view: View03,
  p: PlayerId,
  fill: () => Card | null,
): Seat | null {
  const battle: Card[] = [];
  const hand: Card[] = [];
  const controls: Card[][] = [];
  let holes = 0;
  const fields = view.players[p].fields;
  for (let i = 0; i < fields.length; i++) {
    const f = fields[i];
    if (i === view.round - 1) {
      for (const c of f.cards) {
        if (!c.hidden) battle.push(c.card);
        else {
          const card = fill();
          if (!card) return null;
          battle.push(card);
        }
      }
      continue;
    }
    if (f.kind === "normal") {
      if (f.cards.length === 0) holes++;
      for (const c of f.cards) {
        if (!c.hidden) hand.push(c.card);
        else {
          const card = fill();
          if (!card) return null;
          hand.push(card);
        }
      }
      continue;
    }
    if (f.kind === "control" && !f.used && f.cards.length) {
      const cards: Card[] = [];
      for (const c of f.cards) {
        if (!c.hidden) cards.push(c.card);
        else {
          const card = fill();
          if (!card) return null;
          cards.push(card);
        }
      }
      controls.push(cards);
    }
  }
  return { battle, hand, controls, holes };
}
function seatFromGame(g: Game03, p: PlayerId): Seat {
  const round = g.core.round - 1;
  const battle = g.core.players[p].fields[round].cards.slice();
  const hand: Card[] = [];
  const controls: Card[][] = [];
  let holes = 0;
  g.core.players[p].fields.forEach((f, i) => {
    if (i === round) return;
    if (f.kind === "normal") {
      if (f.cards.length === 0) holes++;
      else hand.push(...f.cards);
    } else if (f.kind === "control" && !f.used && f.cards.length)
      controls.push(f.cards.slice());
  });
  return { battle, hand, controls, holes };
}
function shuffle(cards: Card[], base: number, sample: number): Card[] {
  const deck = cards.slice();
  for (let i = deck.length - 1; i > 0; i--) {
    const j = mix(base, sample * 64 + i) % (i + 1);
    const tmp = deck[i];
    deck[i] = deck[j];
    deck[j] = tmp;
  }
  return deck;
}
function dealFair(view: View03, base: number, sample: number): Deal | null {
  const deck = shuffle(poolFor(view, []), base, sample);
  let cursor = 0;
  const take = () => (cursor < deck.length ? deck[cursor++] : null);
  const me = seatFromView(view, view.player, () => null);
  const opp = seatFromView(view, other(view.player), take);
  if (!me || !opp) return null;
  return {
    seats: view.player === 0 ? [me, opp] : [opp, me],
    deck,
    at: cursor,
  };
}
function dealKnown(view: View03, game: Game03, base: number, sample: number): Deal | null {
  const me = seatFromView(view, view.player, () => null);
  if (!me) return null;
  const opp = seatFromGame(game, other(view.player));
  const extra = [...opp.battle, ...opp.hand, ...opp.controls.flat()];
  const deck = shuffle(poolFor(view, extra), base, sample);
  return {
    seats: view.player === 0 ? [me, opp] : [opp, me],
    deck,
    at: 0,
  };
}
function draw(deal: Deal): Card | null {
  if (deal.at >= deal.deck.length) return null;
  return deal.deck[deal.at++];
}
function refill(seat: Seat, deal: Deal) {
  while (seat.holes > 0) {
    const card = draw(deal);
    if (!card) return;
    seat.hand.push(card);
    seat.holes--;
  }
}
// One-card moves only. Enumerating every legal swap misses the decision time budget.
function bestCheap(seat: Seat): Move | null {
  let best: Move | null = null;
  let bestScore = -Infinity;
  const grade = evaluate(seat.battle).grade;
  if (seat.battle.length < 5) {
    const consider = (card: Card, from: "hand" | "control") => {
      const score = handValue([...seat.battle, card]);
      if (score > bestScore) {
        bestScore = score;
        best = { kind: "absorb", card, from };
      }
    };
    for (const card of seat.hand) consider(card, "hand");
    for (const field of seat.controls)
      for (const card of field) consider(card, "control");
  }
  for (const card of seat.hand)
    for (let gi = 0; gi < seat.battle.length; gi++) {
      const next = seat.battle.slice();
      next[gi] = card;
      const hand = evaluate(next);
      if (hand.grade <= grade) continue;
      const score = valueOf(hand);
      if (score > bestScore) {
        bestScore = score;
        best = { kind: "swap", card, give: seat.battle[gi] };
      }
    }
  return best;
}
function applyMove(seat: Seat, move: Move, deal: Deal) {
  if (move.kind === "absorb") {
    if (move.from === "hand") {
      seat.hand.splice(seat.hand.indexOf(move.card), 1);
      seat.holes++;
    } else {
      const fi = seat.controls.findIndex((field) => field.includes(move.card));
      seat.controls.splice(fi, 1);
    }
    seat.battle.push(move.card);
    return;
  }
  seat.hand.splice(seat.hand.indexOf(move.card), 1);
  seat.holes++;
  const gi = seat.battle.indexOf(move.give);
  const out = seat.battle[gi];
  seat.battle[gi] = move.card;
  deal.deck.push(out);
}
function showdown(deal: Deal, viewer: PlayerId): number | null {
  const mine = deal.seats[viewer].battle;
  const theirs = deal.seats[viewer === 0 ? 1 : 0].battle;
  if (mine.length !== 5 || theirs.length !== 5) return null;
  const cmp = compareHands(evaluate(mine), evaluate(theirs));
  if (cmp > 0) return 1;
  if (cmp < 0) return 0;
  return 0.5;
}
function playout(deal: Deal, start: PlayerId, viewer: PlayerId): number | null {
  let actor = start;
  for (let step = 0; step < 48; step++) {
    refill(deal.seats[actor], deal);
    const move = bestCheap(deal.seats[actor]);
    if (!move) {
      const next: PlayerId = actor === 0 ? 1 : 0;
      refill(deal.seats[next], deal);
      if (!bestCheap(deal.seats[next])) return showdown(deal, viewer);
      actor = next;
      continue;
    }
    applyMove(deal.seats[actor], move, deal);
    actor = actor === 0 ? 1 : 0;
  }
  return null;
}
function showdownOnly(_view: View03): boolean {
  return false;
}
function nextActor(view: View03): PlayerId {
  return view.actor;
}
function equity(
  view: View03,
  samples: number,
  base: number,
  known: Game03 | null,
): number | null {
  const locked = showdownOnly(view);
  const start = nextActor(view);
  let wins = 0;
  let done = 0;
  for (let s = 0; s < samples; s++) {
    const deal = known
      ? dealKnown(view, known, base, s)
      : dealFair(view, base, s);
    if (!deal) continue;
    const outcome = locked
      ? showdown(deal, view.player)
      : playout(deal, start, view.player);
    if (outcome == null) continue;
    wins += outcome;
    done++;
  }
  return done ? wins / done : null;
}
function callLine(m: number, tighter: number): number {
  const raw = (2 * m - 1) / (4 * m) + tighter;
  if (raw < 0) return 0;
  if (raw > 0.95) return 0.95;
  return raw;
}
function bluffHits(base: number, rate: number): boolean {
  return mix(base, 0xb1ff) % 10000 < Math.round(rate * 10000);
}
function decide(view: View03): Action03 {
  if (!view.actions.length) throw Error("当前没有合法操作");
  const card = climb(view);
  if (!card) throw Error("当前没有合法操作");
  return card;
}

export function chooseFair(
  view: View03,
  _policy: Policy = balanced,
  _samples = DEFAULT_SAMPLES,
): Action03 {
  return decide(view);
}
export function chooseOracle(game: Game03, _samples = DEFAULT_SAMPLES): Action03 {
  return decide(viewFor(game, game.actor));
}
