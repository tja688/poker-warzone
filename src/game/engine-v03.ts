import { createGame, legalActions as classicActions, evaluate, compareHands, type Action, type Card, type GameState, type PlayerId } from './engine';

/** Dark-card match. Face-down cards stay here. The win condition is first to three zones, same as v0.1. */
export interface Config03 {
  privateHands: boolean;
  hiddenSlots: 0 | 1 | 2;
  multiplier: number;
  antes: [number, number, number, number, number];
  startingChips: number;
  cap: number;
}
export const DEFAULT_CONFIG: Config03 = { privateHands: true, hiddenSlots: 2, multiplier: 2, antes: [1, 1, 1, 2, 2], startingChips: 10, cap: 8 };
export type Action03 = Action & { hidden?: Card };
export interface Result03 { winner: PlayerId | 'draw'; starter: PlayerId; hands: [Card[], Card[]]; }
export interface Game03 {
  core: GameState;
  config: Config03;
  phase: 'action' | 'roundOver' | 'finished';
  actor: PlayerId;
  hidden: [Card[], Card[]];
  firstAbsorb: [boolean, boolean];
  river: { player: PlayerId; card: Card; reason: 'swap' | 'discard' }[];
  results: Result03[];
  winner: PlayerId | 'draw' | null;
}
const other = (p: PlayerId): PlayerId => p === 0 ? 1 : 0;
function random(g: Game03): number {
  g.core.rngState = (g.core.rngState + 0x6d2b79f5) >>> 0;
  let t = g.core.rngState;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function shuffle(g: Game03) {
  for (let i = g.core.deck.length - 1; i > 0; i--) {
    const j = Math.floor(random(g) * (i + 1));
    [g.core.deck[i], g.core.deck[j]] = [g.core.deck[j], g.core.deck[i]];
  }
}
function refill(g: Game03, p: PlayerId) {
  for (const f of g.core.players[p].fields)
    if (f.kind === 'normal' && f.cards.length === 0) {
      const c = g.core.deck.shift();
      if (!c) throw Error('牌库意外耗尽');
      f.cards.push(c);
    }
}
const battle = (g: Game03, p: PlayerId) => g.core.players[p].fields[g.core.round - 1].cards;
function sameSet(a: Card[], b: Card[]) {
  return a.length === b.length && new Set(a).size === a.length && a.every(c => b.includes(c));
}
function sameOrder(a: Card[], b: Card[]) {
  return a.length === b.length && a.every((c, i) => c === b[i]);
}
function validConfig(config: Config03) {
  const antes = config?.antes;
  if (config?.hiddenSlots !== 0 && config?.hiddenSlots !== 1 && config?.hiddenSlots !== 2) return false;
  if (typeof config.privateHands !== 'boolean') return false;
  if (!Number.isFinite(config.startingChips) || config.startingChips <= 0) return false;
  if (!Number.isFinite(config.multiplier) || config.multiplier <= 0) return false;
  if (!Number.isFinite(config.cap) || config.cap <= 0) return false;
  if (!Array.isArray(antes) || antes.length !== 5) return false;
  return antes.every(n => Number.isFinite(n) && n > 0 && n <= config.cap);
}
/** Face-down slots make take order a real choice, so each assignment is its own action. */
function expandSwap(g: Game03, player: PlayerId, action: Action): Action03[] {
  const outgoing = battle(g, player).filter(c => action.give.includes(c));
  const downAt = outgoing.map((card, index) => g.hidden[player].includes(card) ? index : -1).filter(index => index >= 0);
  if (!downAt.length || action.take.length <= 1) return [action];
  const incoming = action.take;
  const placements: Card[][] = [];
  const used = incoming.map(() => false);
  const choose = (n: number, draft: number[]) => {
    if (n === downAt.length) {
      const take: Card[] = [];
      const picked = new Set(draft);
      const rest = incoming.filter((_, index) => !picked.has(index));
      let cursor = 0;
      for (let slot = 0; slot < outgoing.length; slot++) {
        const down = downAt.indexOf(slot);
        take.push(down >= 0 ? incoming[draft[down]] : rest[cursor++]);
      }
      placements.push(take);
      return;
    }
    for (let i = 0; i < incoming.length; i++) if (!used[i]) {
      used[i] = true;
      choose(n + 1, [...draft, i]);
      used[i] = false;
    }
  };
  choose(0, []);
  return placements.map(take => ({ ...action, take }));
}
export function legalActions03(g: Game03): Action03[] {
  if (g.phase !== 'action') return [];
  const player = g.actor;
  return classicActions(g.core, player).flatMap((action): Action03[] => {
    if (action.kind === 'absorb' && !g.firstAbsorb[player] && g.config.hiddenSlots > 1)
      return action.take.map(hidden => ({ ...action, hidden }));
    if (action.kind === 'swap') return expandSwap(g, player, action);
    return [action];
  });
}
function settleShowdown(g: Game03) {
  const hands: [Card[], Card[]] = [[...battle(g, 0)], [...battle(g, 1)]];
  if (hands.some(h => h.length !== 5)) throw Error('亮牌时战区不足五张');
  const cmp = compareHands(evaluate(hands[0]), evaluate(hands[1]));
  const winner: PlayerId | 'draw' = cmp === 0 ? 'draw' : cmp > 0 ? 0 : 1;
  g.results.push({ winner, starter: g.core.starter, hands });
  for (const p of [0, 1] as const) {
    const f = g.core.players[p].fields[g.core.round - 1];
    if (winner === 'draw' || winner === p) {
      g.core.players[p].score++;
      f.kind = 'control';
      f.used = false;
    } else {
      g.core.deck.push(...f.cards);
      f.cards = [];
      f.kind = 'normal';
      f.used = false;
    }
  }
  g.hidden = [[], []];
  g.core.phase = 'roundOver';
  const scores = [g.core.players[0].score, g.core.players[1].score];
  if (scores[0] >= 3 || scores[1] >= 3) {
    g.phase = 'finished';
    g.winner = scores[0] >= 3 && scores[1] >= 3 ? 'draw' : scores[0] >= 3 ? 0 : 1;
  } else g.phase = 'roundOver';
}
function prepare(g: Game03) {
  for (let skip = 0; skip < 2; skip++) {
    g.core.turn = g.actor;
    g.core.turnNumber++;
    refill(g, g.actor);
    shuffle(g);
    if (classicActions(g.core, g.actor).length) return;
    g.core.players[g.actor].stuck = true;
    if (g.core.players[other(g.actor)].stuck) {
      settleShowdown(g);
      return;
    }
    g.actor = other(g.actor);
  }
  throw Error('回合推进异常');
}
export function createGame03(seed: string, config: Config03 = DEFAULT_CONFIG): Game03 {
  if (!validConfig(config)) throw Error('规则配置无效');
  const core = createGame(seed);
  const cfg = structuredClone(config);
  const hiddenOf = (p: PlayerId): Card[] => cfg.hiddenSlots ? [...core.players[p].fields[core.round - 1].cards] : [];
  return {
    core, config: cfg, phase: 'action', actor: core.turn,
    hidden: [hiddenOf(0), hiddenOf(1)], firstAbsorb: [false, false],
    river: [], results: [], winner: null,
  };
}
function sameMove(a: Action03, b: Action03) {
  if (a.kind !== b.kind || a.hidden !== b.hidden || a.target !== b.target || !sameSet(a.give, b.give)) return false;
  return a.kind === 'swap' ? sameOrder(a.take, b.take) : sameSet(a.take, b.take);
}
export function applyAction03(state: Game03, action: Action03): Game03 {
  const a = legalActions03(state).find(x => sameMove(x, action));
  if (!a) throw Error('不合法的行动');
  const g = structuredClone(state), p = g.actor;
  const player = g.core.players[p], current = battle(g, p);
  for (const f of player.fields) if (f.kind !== 'battle' && f.cards.some(c => a.take.includes(c))) {
    f.cards = f.cards.filter(c => !a.take.includes(c));
    if (f.kind === 'control') f.used = true;
  }
  if (a.kind === 'discard') {
    player.discarded = true;
    for (const card of a.take) g.river.push({ player: p, card, reason: 'discard' });
    g.core.deck.push(...a.take);
  } else if (a.kind === 'absorb') {
    current.push(...a.take);
    if (!g.firstAbsorb[p] && g.config.hiddenSlots > 1 && a.hidden) g.hidden[p].push(a.hidden);
    g.firstAbsorb[p] = true;
  } else {
    const outgoing = current.filter(c => a.give.includes(c));
    for (let i = 0; i < outgoing.length; i++) {
      const at = current.indexOf(outgoing[i]);
      const incoming = a.take[i];
      current[at] = incoming;
      if (g.hidden[p].includes(outgoing[i])) g.hidden[p] = g.hidden[p].map(c => c === outgoing[i] ? incoming : c);
    }
    for (const card of outgoing) g.river.push({ player: p, card, reason: 'swap' });
    g.core.deck.push(...outgoing);
  }
  g.core.roundActions[p]++;
  g.actor = other(p);
  prepare(g);
  return g;
}
export function nextRound03(state: Game03): Game03 {
  if (state.phase !== 'roundOver') throw Error('当前不能进入下一战区');
  const g = structuredClone(state), last = g.results.at(-1);
  if (!last) throw Error('当前不能进入下一战区');
  g.core.round++;
  if (g.core.round > 5) throw Error('不应存在第六战区');
  g.core.phase = 'play';
  g.core.starter = last.winner === 'draw' ? (random(g) < .5 ? 0 : 1) : other(last.winner);
  g.firstAbsorb = [false, false];
  g.river = [];
  g.core.roundActions = [0, 0];
  for (const p of [0, 1] as const) { g.core.players[p].stuck = false; g.core.players[p].discarded = false; }
  refill(g, g.core.starter);
  refill(g, other(g.core.starter));
  shuffle(g);
  for (const p of [0, 1] as const) {
    const f = g.core.players[p].fields[g.core.round - 1];
    if (f.kind !== 'normal' || f.cards.length !== 1) throw Error('新战区必须有一张初始牌');
    f.kind = 'battle';
  }
  g.hidden = [g.config.hiddenSlots ? [...battle(g, 0)] : [], g.config.hiddenSlots ? [...battle(g, 1)] : []];
  g.phase = 'action';
  g.actor = g.core.starter;
  prepare(g);
  return g;
}
/** Only serializable public facts and the requesting player's own cards. */
export function viewFor(g: Game03, player: PlayerId) {
  return {
    player, phase: g.phase, actor: g.actor, round: g.core.round, starter: g.core.starter,
    scores: [g.core.players[0].score, g.core.players[1].score] as [number, number],
    config: { ...g.config, antes: [...g.config.antes] as Config03['antes'] }, river: g.river.map(x => ({ ...x })),
    results: structuredClone(g.results), winner: g.winner,
    players: g.core.players.map((pl, p) => ({ discarded: pl.discarded, stuck: pl.stuck, score: pl.score, fields: pl.fields.map((f, i) => ({
      kind: f.kind, used: f.used, cards: f.cards.map((c, slot) => p !== player && ((f.kind === 'normal' && g.config.privateHands) || (f.kind === 'battle' && g.hidden[p as PlayerId].includes(c))) ? { hidden: true as const, slot: `${p}-${i}-${slot}` } : { hidden: false as const, card: c })
    })) })),
    actions: g.actor === player ? legalActions03(g) : [],
  };
}
