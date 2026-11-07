import {
  legalActions,
  evaluate,
  compareHands,
  seedHash,
  FULL_DECK,
  type Action,
  type Card,
  type GameState,
  type Player,
  type PlayerId,
  type Strategy,
} from "./engine";
// Public-information policy only. This module never reads deck order or rngState.
const rank = (c: Card) => "23456789TJQKA".indexOf(c[0]) + 2;
const other = (p: PlayerId): PlayerId => (p === 0 ? 1 : 0);
const ordinary = (p: Player) =>
  p.fields.filter((f) => f.kind === "normal").flatMap((f) => f.cards);
const battle = (s: GameState, p: PlayerId) =>
  s.players[p].fields[s.round - 1].cards;

function handValue(cards: Card[]): number {
  const h = evaluate(cards);
  let v = h.grade;
  for (let i = 0; i < h.ranks.length; i++)
    v += (h.ranks[i] / 15 ** (i + 1)) * 0.8;
  return v;
}
/** Public-card heuristic: no simulation from the actual hidden deck. */
function potential(cards: Card[], unseen: Card[]): number {
  const room = 5 - cards.length;
  if (!room) return handValue(cards);
  const values = cards.map(rank);
  const suits = [..."CDHS"].map((s) => cards.filter((c) => c[1] === s).length);
  let score = handValue(cards) * 0.8;
  const counts = new Map<number, number>();
  for (const v of values) counts.set(v, (counts.get(v) || 0) + 1);
  for (const [v, n] of counts) {
    const remaining = unseen.filter((c) => rank(c) === v).length;
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
export function chooseAction(s: GameState, strategy: Strategy): Action {
  const actions = legalActions(s);
  if (!actions.length) throw Error("当前没有合法操作");
  const publicKey = JSON.stringify({
    round: s.round,
    turn: s.turn,
    players: s.players,
    turnNumber: s.turnNumber,
  });
  if (strategy === "random")
    return actions[seedHash(publicKey) % actions.length];
  const p = s.players[s.turn],
    current = battle(s, s.turn),
    opp = battle(s, other(s.turn));
  const controls = p.fields
    .filter((f) => f.kind === "control" && !f.used)
    .flatMap((f) => f.cards);
  const unseen = FULL_DECK.filter(
    (c) => !s.players.some((p) => p.fields.some((f) => f.cards.includes(c))),
  );
  const enemy = evaluate(opp);
  let best = actions[0],
    bestScore = -Infinity;
  for (const a of actions) {
    const next =
      a.kind === "discard"
        ? current
        : [...current.filter((c) => !a.give.includes(c)), ...a.take];
    const usedControls = a.take.filter((c) => controls.includes(c)).length;
    let score: number;
    if (strategy === "greedy") {
      // The baseline's opening absorb uses all available controls when capacity allows.
      score = handValue(next) * 100 + next.length * 2;
      if (current.length === 1 && a.kind === "absorb")
        score += usedControls * 1000;
      if (a.kind === "discard") score -= 10;
      score +=
        a.kind === "discard" ? a.take.length * 0.02 : -a.take.length * 0.001;
    } else {
      score = potential(next, unseen) * 100 + next.length * 1.3;
      if (next.length === 5) {
        score += evaluate(next).grade * 12;
        if (opp.length === 5 && compareHands(evaluate(next), enemy) > 0)
          score += 18;
      }
      score -= usedControls * (s.round < 4 ? 8 : 2);
      if (a.kind === "swap") score += 3;
      // Discard only if necessary; preserve useful routes and toss weak unrelated ranks.
      if (a.kind === "discard") {
        const normals = ordinary(p);
        const keep = normals.filter((c) => !a.take.includes(c));
        const usefulness = (c: Card) => {
          const v = rank(c);
          let u = current.some((x) => rank(x) === v) ? 8 : 0;
          if (current.length < 5) {
            u += current.filter((x) => x[1] === c[1]).length * 0.65;
            u +=
              current.filter((x) => Math.abs(rank(x) - v) <= 3).length * 0.25;
            u += v * 0.035;
          }
          return u;
        };
        score -= 8;
        score += a.take.reduce((sum, c) => sum + 1.6 - usefulness(c), 0);
        score += keep.reduce((sum, c) => sum + usefulness(c) * 0.1, 0);
      }
    }
    // Stable source-order tie breaking; seed and hidden RNG never enter decision scores.
    if (score > bestScore + 1e-10) {
      best = a;
      bestScore = score;
    }
  }
  return best;
}
