export type Card = string;
export type PlayerId = 0 | 1;
export type Strategy = "random" | "greedy" | "strategic";
export interface Field {
  kind: "normal" | "battle" | "control";
  cards: Card[];
  used: boolean;
}
export interface Player {
  fields: Field[];
  score: number;
  discarded: boolean;
  stuck: boolean;
}
export interface Action {
  kind: "absorb" | "swap" | "discard";
  take: Card[];
  give: Card[];
  target?: number;
}
export interface Hand {
  grade: number;
  name: string;
  ranks: number[];
}
export interface RoundResult {
  round: number;
  winner: PlayerId | "draw";
  hands: [Card[], Card[]];
  grades: [Hand, Hand];
  starter: PlayerId;
  actions: [number, number];
}
export interface GameState {
  seed: string;
  rngState: number;
  deck: Card[];
  players: [Player, Player];
  round: number;
  turn: PlayerId;
  starter: PlayerId;
  firstStarter: PlayerId;
  phase: "play" | "roundOver" | "finished";
  winner: PlayerId | "draw" | null;
  history: RoundResult[];
  log: string[];
  turnNumber: number;
  roundActions: [number, number];
}
export const HAND_NAMES = [
  "",
  "高牌",
  "一对",
  "两对",
  "三条",
  "顺子",
  "同花",
  "葫芦",
  "四条",
  "同花顺",
];
export const FULL_DECK: Card[] = [..."23456789TJQKA"].flatMap((rank) =>
  [..."CDHS"].map((suit) => rank + suit),
);
const rank = (c: Card) => "23456789TJQKA".indexOf(c[0]) + 2;
const other = (p: PlayerId): PlayerId => (p === 0 ? 1 : 0);
const who = (p: PlayerId) => (p === 0 ? "你" : "对手");
export function seedHash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++)
    h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}
function random(s: GameState): number {
  s.rngState = (s.rngState + 0x6d2b79f5) >>> 0;
  let t = s.rngState;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function shuffle(s: GameState) {
  for (let i = s.deck.length - 1; i > 0; i--) {
    const j = Math.floor(random(s) * (i + 1));
    [s.deck[i], s.deck[j]] = [s.deck[j], s.deck[i]];
  }
}
function clone(s: GameState): GameState {
  return {
    ...s,
    deck: [...s.deck],
    players: s.players.map((p) => ({
      ...p,
      fields: p.fields.map((f) => ({ ...f, cards: [...f.cards] })),
    })) as [Player, Player],
    history: [...s.history],
    log: [...s.log],
    roundActions: [...s.roundActions],
  };
}
function log(s: GameState, text: string) {
  s.log.push(text);
}
function refill(s: GameState, p: PlayerId) {
  for (const f of s.players[p].fields)
    if (f.kind === "normal" && f.cards.length === 0) {
      const c = s.deck.shift();
      if (!c) throw Error("牌库意外耗尽");
      f.cards.push(c);
    }
}

/** Standard poker comparison key, also defined for partial hands. */
export function evaluate(cards: Card[]): Hand {
  const values = cards.map(rank).sort((a, b) => b - a);
  const counts = new Map<number, number>();
  for (const v of values) counts.set(v, (counts.get(v) || 0) + 1);
  const groups = [...counts].sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  const five = cards.length === 5;
  const flush = five && cards.every((c) => c[1] === cards[0][1]);
  const unique = [...new Set(values)];
  let straight = 0;
  if (five && unique.length === 5) {
    if (unique[0] - unique[4] === 4) straight = unique[0];
    else if (unique.join(",") === "14,5,4,3,2") straight = 5;
  }
  let grade = 1,
    ranks = values;
  if (straight && flush) {
    grade = 9;
    ranks = [straight];
  } else if (groups[0]?.[1] === 4) {
    grade = 8;
    ranks = [groups[0][0], ...values.filter((v) => v !== groups[0][0])];
  } else if (five && groups[0]?.[1] === 3 && groups[1]?.[1] === 2) {
    grade = 7;
    ranks = [groups[0][0], groups[1][0]];
  } else if (flush) {
    grade = 6;
  } else if (straight) {
    grade = 5;
    ranks = [straight];
  } else if (groups[0]?.[1] === 3) {
    grade = 4;
    ranks = [groups[0][0], ...values.filter((v) => v !== groups[0][0])];
  } else if (groups[0]?.[1] === 2 && groups[1]?.[1] === 2) {
    grade = 3;
    const pairs = groups
      .filter((g) => g[1] === 2)
      .map((g) => g[0])
      .sort((a, b) => b - a);
    ranks = [...pairs, ...values.filter((v) => !pairs.includes(v))];
  } else if (groups[0]?.[1] === 2) {
    grade = 2;
    ranks = [groups[0][0], ...values.filter((v) => v !== groups[0][0])];
  }
  return { grade, name: HAND_NAMES[grade], ranks };
}
export function compareHands(a: Hand, b: Hand): number {
  if (a.grade !== b.grade) return Math.sign(a.grade - b.grade);
  for (let i = 0; i < Math.max(a.ranks.length, b.ranks.length); i++) {
    const d = (a.ranks[i] || 0) - (b.ranks[i] || 0);
    if (d) return Math.sign(d);
  }
  return 0;
}
function combinations<T>(arr: T[], n: number): T[][] {
  const result: T[][] = [];
  function visit(start: number, chosen: T[]) {
    if (chosen.length === n) {
      result.push(chosen);
      return;
    }
    for (let i = start; i <= arr.length - (n - chosen.length); i++)
      visit(i + 1, [...chosen, arr[i]]);
  }
  visit(0, []);
  return result;
}
function ordinary(p: Player): Card[] {
  return p.fields.filter((f) => f.kind === "normal").flatMap((f) => f.cards);
}
function battle(s: GameState, p: PlayerId): Card[] {
  return s.players[p].fields[s.round - 1].cards;
}

/** Enumerate exact legal actions. Minimum exchange size is separate for every target. */
export function legalActions(
  s: GameState,
  player: PlayerId = s.turn,
): Action[] {
  if (s.phase !== "play" || s.players[player].stuck) return [];
  const p = s.players[player],
    current = battle(s, player),
    normals = ordinary(p),
    out: Action[] = [];
  const room = 5 - current.length;
  if (room > 0) {
    const sources = p.fields.filter(
      (f) => f.kind === "normal" || (f.kind === "control" && !f.used),
    );
    function absorb(i: number, cards: Card[]) {
      if (i === sources.length) {
        if (cards.length) out.push({ kind: "absorb", take: cards, give: [] });
        return;
      }
      absorb(i + 1, cards);
      if (cards.length < room)
        for (const c of sources[i].cards) absorb(i + 1, [...cards, c]);
    }
    absorb(0, []);
  }
  const grade = evaluate(current).grade;
  const minima = new Map<number, number>();
  for (let n = 1; n <= Math.min(normals.length, current.length); n++) {
    for (const take of combinations(normals, n))
      for (const give of combinations(current, n)) {
        const next = [...current.filter((c) => !give.includes(c)), ...take];
        const t = evaluate(next).grade;
        if (t <= grade || (minima.has(t) && minima.get(t) !== n)) continue;
        minima.set(t, n);
        out.push({ kind: "swap", take, give, target: t });
      }
  }
  if (!p.discarded)
    for (let n = 1; n <= normals.length; n++)
      for (const take of combinations(normals, n))
        out.push({ kind: "discard", take, give: [] });
  return out;
}
const sameSet = (a: Card[], b: Card[]) =>
  a.length === b.length &&
  new Set(a).size === a.length &&
  a.every((c) => b.includes(c));
function equalAction(a: Action, b: Action) {
  return (
    a.kind === b.kind &&
    a.target === b.target &&
    sameSet(a.take, b.take) &&
    sameSet(a.give, b.give)
  );
}

function settle(s: GameState) {
  const hands: [Card[], Card[]] = [[...battle(s, 0)], [...battle(s, 1)]];
  if (hands.some((h) => h.length !== 5)) throw Error("比牌时战区没有满 5 张");
  const grades: [Hand, Hand] = [evaluate(hands[0]), evaluate(hands[1])];
  const cmp = compareHands(grades[0], grades[1]);
  const winner = cmp === 0 ? "draw" : cmp > 0 ? 0 : 1;
  s.history.push({
    round: s.round,
    winner,
    hands,
    grades,
    starter: s.starter,
    actions: [...s.roundActions],
  });
  for (const p of [0, 1] as const) {
    const f = s.players[p].fields[s.round - 1];
    if (winner === "draw" || winner === p) {
      s.players[p].score++;
      f.kind = "control";
      f.used = false;
    } else {
      s.deck.push(...f.cards);
      f.cards = [];
      f.kind = "normal";
      f.used = false;
    }
  }
  log(
    s,
    `第 ${s.round} 战区：${winner === "draw" ? "平局，双方各得一胜" : who(winner) + "获胜"}（${grades[0].name} / ${grades[1].name}）`,
  );
  const won = s.players.map((p) => p.score >= 3);
  if (won[0] || won[1]) {
    s.phase = "finished";
    s.winner = won[0] && won[1] ? "draw" : won[0] ? 0 : 1;
  } else {
    s.phase = "roundOver";
    s.winner = null;
  }
}
/** Every actual turn, including a stuck skip, refills first and then shuffles. */
function prepareTurn(s: GameState) {
  for (let skip = 0; skip < 2; skip++) {
    s.turnNumber++;
    refill(s, s.turn);
    shuffle(s);
    if (legalActions(s).length) return;
    s.players[s.turn].stuck = true;
    log(s, `${who(s.turn)}没有合法操作，自动卡住`);
    if (s.players[other(s.turn)].stuck) {
      settle(s);
      return;
    }
    s.turn = other(s.turn);
  }
  throw Error("回合推进异常");
}
function setupRound(s: GameState) {
  for (const p of s.players) {
    p.discarded = false;
    p.stuck = false;
  }
  s.roundActions = [0, 0];
  refill(s, s.starter);
  refill(s, other(s.starter));
  shuffle(s);
  for (const p of s.players) {
    const f = p.fields[s.round - 1];
    if (f.kind !== "normal" || f.cards.length !== 1)
      throw Error("新战区必须有一张初始牌");
    f.kind = "battle";
  }
  s.turn = s.starter;
  s.phase = "play";
  log(s, `第 ${s.round} 战区开始，${who(s.starter)}先手`);
  prepareTurn(s);
}
export function createGame(seed: string): GameState {
  const player = (): Player => ({
    fields: Array.from({ length: 5 }, () => ({
      kind: "normal",
      cards: [],
      used: false,
    })),
    score: 0,
    discarded: false,
    stuck: false,
  });
  const s: GameState = {
    seed,
    rngState: seedHash(seed),
    deck: [...FULL_DECK],
    players: [player(), player()],
    round: 1,
    turn: 0,
    starter: 0,
    firstStarter: 0,
    phase: "play",
    winner: null,
    history: [],
    log: [],
    turnNumber: 0,
    roundActions: [0, 0],
  };
  shuffle(s);
  refill(s, 0);
  refill(s, 1);
  s.starter = random(s) < 0.5 ? 0 : 1;
  s.firstStarter = s.starter;
  setupRound(s);
  return s;
}
export function applyAction(state: GameState, action: Action): GameState {
  const canonical = legalActions(state).find((a) => equalAction(a, action));
  if (!canonical)
    throw Error("不合法的行动：请重新选择来源、目标与最少换牌数量");
  const s = clone(state),
    p = s.players[s.turn],
    current = battle(s, s.turn),
    a = canonical;
  for (const f of p.fields)
    if (f.kind !== "battle") {
      const removed = f.cards.some((c) => a.take.includes(c));
      if (removed) {
        f.cards = f.cards.filter((c) => !a.take.includes(c));
        if (f.kind === "control") f.used = true;
      }
    }
  if (a.kind === "discard") {
    p.discarded = true;
    s.deck.push(...a.take);
  } else if (a.kind === "absorb") {
    current.push(...a.take);
  } else {
    p.fields[s.round - 1].cards = [
      ...current.filter((c) => !a.give.includes(c)),
      ...a.take,
    ];
    s.deck.push(...a.give);
  }
  s.roundActions[s.turn]++;
  log(s, `${who(s.turn)}${describeAction(a)}`);
  s.turn = other(s.turn);
  prepareTurn(s);
  return s;
}
export function nextRound(state: GameState): GameState {
  if (state.phase !== "roundOver") throw Error("当前不能进入下一战区");
  const s = clone(state),
    last = s.history.at(-1)!;
  s.round++;
  if (s.round > 5) throw Error("不应存在第六战区");
  s.starter =
    last.winner === "draw" ? (random(s) < 0.5 ? 0 : 1) : other(last.winner);
  setupRound(s);
  return s;
}
export function describeAction(a: Action): string {
  const text = (c: Card) =>
    `${c[0] === "T" ? "10" : c[0]}${({ C: "♣", D: "♦", H: "♥", S: "♠" } as Record<string, string>)[c[1]]}`;
  return a.kind === "discard"
    ? `弃牌 ${a.take.map(text).join(" ")}`
    : a.kind === "absorb"
      ? `吸入 ${a.take.map(text).join(" ")}`
      : `换入 ${a.take.map(text).join(" ")}，换出 ${a.give.map(text).join(" ")} → ${HAND_NAMES[a.target!]}`;
}

export function assertInvariants(s: GameState): void {
  const fail = (message: string) => {
    throw Error(`规则断言失败：${message}`);
  };
  if (s.round < 1 || s.round > 5) fail("战区超出 1–5");
  if (s.turn !== 0 && s.turn !== 1) fail("回合座位无效");
  const all = [
    ...s.deck,
    ...s.players.flatMap((p) => p.fields.flatMap((f) => f.cards)),
  ];
  if (
    all.length !== 52 ||
    new Set(all).size !== 52 ||
    all.some((c) => !FULL_DECK.includes(c))
  )
    fail("52 张牌未守恒或出现重复");
  if (s.deck.length < 18) fail("牌库不足 18 张");
  for (const p of [0, 1] as const) {
    const pl = s.players[p];
    if (pl.fields.length !== 5) fail("场地不是 5 个");
    if (pl.score !== pl.fields.filter((f) => f.kind === "control").length)
      fail("胜场与控制区数量失配");
    for (const [i, f] of pl.fields.entries()) {
      if (f.kind === "normal" && (f.cards.length > 1 || f.used))
        fail("普通区容量或使用标记错误");
      if (
        f.kind === "battle" &&
        (i !== s.round - 1 ||
          f.cards.length < 1 ||
          f.cards.length > 5 ||
          f.used)
      )
        fail("战区容量或位置错误");
      if (
        f.kind === "control" &&
        (i >= s.round ||
          f.cards.length < 4 ||
          f.cards.length > 5 ||
          f.cards.length !== (f.used ? 4 : 5))
      )
        fail("控制区容量、位置或使用标记错误");
      if (s.phase === "play" && i === s.round - 1 && f.kind !== "battle")
        fail("缺少当前战区");
    }
    if (s.phase === "play" && pl.score >= 3) fail("已获 3 胜但未结束");
    if (s.roundActions[p] > 13) fail("每人每局超过 13 次行动");
  }
  for (const h of s.history) {
    if (h.hands.some((a) => a.length !== 5)) fail("结算未满五张");
    if (h.actions.some((n) => n > 13)) fail("历史回合超过上限");
  }
  if (s.phase === "play" && !legalActions(s).length)
    fail("停在无合法操作的回合");
  if (s.phase === "finished" && !s.players.some((p) => p.score >= 3))
    fail("胜场未达到结束条件");
}
