import test from "node:test";
import assert from "node:assert/strict";
import {
  applyAction,
  assertInvariants,
  chooseAction,
  compareHands,
  createGame,
  evaluate,
  FULL_DECK,
  legalActions,
  nextRound,
  type Card,
  type Field,
  type GameState,
  type PlayerId,
} from "./engine";
import { runSimulation } from "./simulation";

function fixture(
  hands: [Card[], Card[]],
  normals: [Card[], Card[]] = [[], []],
): GameState {
  const s = createGame("fixture");
  s.turn = 0;
  s.starter = 0;
  s.firstStarter = 0;
  s.round = 1;
  s.turnNumber = 1;
  s.history = [];
  s.log = [];
  s.roundActions = [0, 0];
  s.phase = "play";
  s.winner = null;
  for (const id of [0, 1] as const) {
    s.players[id] = {
      fields: [
        { kind: "battle", cards: hands[id], used: false },
        ...Array.from(
          { length: 4 },
          (_, i) =>
            ({
              kind: "normal",
              cards: normals[id][i] ? [normals[id][i]] : [],
              used: false,
            }) as Field,
        ),
      ],
      score: 0,
      discarded: false,
      stuck: false,
    };
  }
  const used = s.players.flatMap((p) => p.fields.flatMap((f) => f.cards));
  assert.equal(new Set(used).size, used.length);
  s.deck = FULL_DECK.filter((c) => !used.includes(c));
  return s;
}
function findGame(predicate: (s: GameState) => boolean): GameState {
  for (let seed = 0; seed < 30; seed++) {
    let s = createGame(`find-${seed}`);
    for (let i = 0; i < 150 && s.phase !== "finished"; i++) {
      if (predicate(s)) return s;
      s =
        s.phase === "roundOver"
          ? nextRound(s)
          : applyAction(s, chooseAction(s, "greedy"));
    }
  }
  throw Error("Fixture not found");
}

test("all nine poker categories, wheel and royal flush", () => {
  const cases: [Card[], number][] = [
    [["AS", "KD", "9C", "5H", "2S"], 1],
    [["AS", "AD", "KC", "5H", "2S"], 2],
    [["AS", "AD", "KC", "KH", "2S"], 3],
    [["AS", "AD", "AC", "5H", "2S"], 4],
    [["AS", "2D", "3C", "4H", "5S"], 5],
    [["AS", "JS", "9S", "5S", "2S"], 6],
    [["AS", "AD", "AC", "KH", "KS"], 7],
    [["AS", "AD", "AC", "AH", "2S"], 8],
    [["TS", "JS", "QS", "KS", "AS"], 9],
  ];
  for (const [cards, grade] of cases)
    assert.equal(evaluate(cards).grade, grade, cards.join(" "));
  assert.deepEqual(evaluate(["AS", "2S", "3S", "4S", "5S"]).ranks, [5]);
  assert.equal(
    compareHands(
      evaluate(["AS", "2D", "3C", "4H", "5S"]),
      evaluate(["2S", "3D", "4C", "5H", "6S"]),
    ),
    -1,
  );
});
test("partial hands do not count flushes or straights; pairs/trips/quads do count", () => {
  assert.equal(evaluate(["2S", "3S", "4S", "5S"]).grade, 1);
  assert.equal(evaluate(["AS", "AD"]).grade, 2);
  assert.equal(evaluate(["AS", "AD", "KC", "KH"]).grade, 3);
  assert.equal(evaluate(["AS", "AD", "AC"]).grade, 4);
  assert.equal(evaluate(["AS", "AD", "AC", "AH"]).grade, 8);
});
test("kickers and pair hierarchy obey standard poker; suits never break ties", () => {
  assert.equal(
    compareHands(
      evaluate(["AS", "AD", "KC", "5H", "2S"]),
      evaluate(["AH", "AC", "QD", "JS", "9H"]),
    ),
    1,
  );
  assert.equal(
    compareHands(
      evaluate(["AS", "AD", "2C", "2H", "KS"]),
      evaluate(["KH", "KC", "QD", "QS", "AH"]),
    ),
    1,
  );
  assert.equal(
    compareHands(
      evaluate(["AS", "KD", "9C", "5H", "2S"]),
      evaluate(["AH", "KC", "9D", "5S", "2C"]),
    ),
    0,
  );
  assert.equal(
    compareHands(
      evaluate(["KS", "KD", "KC", "AH", "AS"]),
      evaluate(["QH", "QC", "QD", "JS", "JH"]),
    ),
    1,
  );
});
test("spec example: minimum exchange computed separately for each exact target", () => {
  const s = fixture(
    [["KS", "KH", "7D", "4C", "2S"], ["AS"]],
    [["KD", "7S", "9H", "5C"], []],
  );
  const swaps = legalActions(s).filter((a) => a.kind === "swap");
  assert.equal(
    Math.min(...swaps.filter((a) => a.target === 3).map((a) => a.take.length)),
    1,
  );
  assert.equal(
    Math.min(...swaps.filter((a) => a.target === 4).map((a) => a.take.length)),
    1,
  );
  assert.equal(
    Math.min(...swaps.filter((a) => a.target === 7).map((a) => a.take.length)),
    2,
  );
  assert(swaps.filter((a) => a.target === 4).every((a) => a.take.length === 1));
  assert(!swaps.some((a) => a.take.includes("9H"))); // Any extra 9H would be an unnecessary kicker change.
  assert.throws(() =>
    applyAction(s, { kind: "swap", target: 2, take: ["9H"], give: ["2S"] }),
  );
  assert.throws(() =>
    applyAction(s, {
      kind: "swap",
      target: 4,
      take: ["KD", "9H"],
      give: ["2S", "4C"],
    }),
  );
});
test("the initial battle card may be exchanged; partial-hand swaps are legal", () => {
  const s = fixture([["KS", "2H"], ["AS"]], [["2D", "9C", "5S", "4H"], []]);
  assert(
    legalActions(s).some(
      (a) =>
        a.kind === "swap" &&
        a.take.includes("2D") &&
        a.give.includes("KS") &&
        a.target === 2,
    ),
  );
});
test("illegal actions preserve state, legal actions are pure and return cards at bottom", () => {
  const s = fixture(
    [["KS", "KH", "7D", "4C", "2S"], ["AS"]],
    [
      ["KD", "7S", "9H", "5C"],
      ["3C", "6C", "8C", "TC"],
    ],
  );
  const before = JSON.stringify(s);
  assert.throws(() =>
    applyAction(s, { kind: "discard", take: ["KS"], give: [] }),
  );
  assert.equal(JSON.stringify(s), before);
  const a = legalActions(s).find((a) => a.kind === "swap" && a.target === 4)!;
  const after = applyAction(s, a);
  assert.equal(JSON.stringify(s), before);
  assert(
    !after.players[1].fields
      .flatMap((f) => f.cards)
      .some((c) => a.give.includes(c)),
  );
  assertInvariants(after);
});
test("a bottom-returned card cannot be the next refill; refill precedes shuffle", () => {
  const s = fixture(
    [["KS", "KH", "7D", "4C", "2S"], ["AS"]],
    [["KD", "7S", "9H", "5C"], []],
  );
  const top = s.deck.slice(0, 4);
  const a = legalActions(s).find((a) => a.kind === "swap" && a.target === 4)!;
  const after = applyAction(s, a);
  assert.deepEqual(
    after.players[1].fields.slice(1).map((f) => f.cards[0]),
    top,
  );
  assert(a.give.every((c) => after.deck.includes(c)));
  assertInvariants(after);
});
test("discard is a nonempty chosen subset, once per round, normal cards only", () => {
  const s = fixture(
    [["AS"], ["KS"]],
    [
      ["2D", "3D", "4C", "7H"],
      ["5C", "6C", "8C", "9C"],
    ],
  );
  const actions = legalActions(s).filter((a) => a.kind === "discard");
  assert.equal(actions.length, 15);
  assert(actions.some((a) => a.take.length === 1));
  assert.throws(() => applyAction(s, { kind: "discard", take: [], give: [] }));
  const after = applyAction(s, actions[0]);
  assert(after.players[0].discarded);
  assert(legalActions(after, 0).every((a) => a.kind !== "discard"));
});
test("absorb nonempty up to five; empty ordinary slots refill only on own next turn", () => {
  const s = fixture(
    [["AS"], ["KS"]],
    [
      ["2D", "3D", "4C", "7H"],
      ["5C", "6C", "8C", "9C"],
    ],
  );
  const a = legalActions(s).find(
    (a) => a.kind === "absorb" && a.take.length === 2,
  )!;
  const after = applyAction(s, a);
  assert.equal(after.players[0].fields[0].cards.length, 3);
  assert.equal(
    after.players[0].fields.filter(
      (f) => f.kind === "normal" && f.cards.length === 0,
    ).length,
    2,
  );
  const afterOpponent = applyAction(after, chooseAction(after, "greedy"));
  if (afterOpponent.phase === "play" && afterOpponent.turn === 0)
    assert(
      afterOpponent.players[0].fields
        .filter((f) => f.kind === "normal")
        .every((f) => f.cards.length === 1),
    );
});
test("controls cannot swap/discard and can supply only one card per control, once per big game", () => {
  const s = createGame("controls");
  s.round = 3;
  s.turn = 0;
  s.starter = 0;
  s.history = [];
  s.roundActions = [0, 0];
  s.players[0] = {
    score: 2,
    discarded: false,
    stuck: false,
    fields: [
      { kind: "control", cards: ["2C", "3C", "4C", "5C", "6C"], used: false },
      { kind: "control", cards: ["7C", "8C", "9C", "TC", "JC"], used: false },
      { kind: "battle", cards: ["QC"], used: false },
      { kind: "normal", cards: ["KC"], used: false },
      { kind: "normal", cards: ["AC"], used: false },
    ],
  };
  s.players[1] = {
    score: 0,
    discarded: false,
    stuck: false,
    fields: [
      { kind: "normal", cards: ["2D"], used: false },
      { kind: "normal", cards: ["3D"], used: false },
      { kind: "battle", cards: ["4D"], used: false },
      { kind: "normal", cards: ["5D"], used: false },
      { kind: "normal", cards: ["6D"], used: false },
    ],
  };
  s.deck = FULL_DECK.filter(
    (c) => !s.players.some((p) => p.fields.some((f) => f.cards.includes(c))),
  );
  assertInvariants(s);
  const p = s.turn,
    controls = s.players[p].fields.filter((f) => f.kind === "control"),
    actions = legalActions(s);
  const controlCards = controls.flatMap((f) => f.cards);
  for (const a of actions) {
    if (a.kind === "swap" || a.kind === "discard")
      assert(a.take.every((c) => !controlCards.includes(c)));
    if (a.kind === "absorb")
      for (const f of controls)
        assert(a.take.filter((c) => f.cards.includes(c)).length <= 1);
  }
  const a = actions.find(
    (a) =>
      a.kind === "absorb" &&
      controls.every((f) => a.take.some((c) => f.cards.includes(c))),
  );
  assert(a, "mixed control absorption exists");
  const after = applyAction(s, a);
  for (const f of after.players[p].fields.filter((f) => f.kind === "control")) {
    assert.equal(f.used, true);
    assert.equal(f.cards.length, 4);
  }
  if (after.phase === "play")
    for (const a of legalActions(after, p))
      assert(
        a.take.every(
          (c) =>
            !after.players[p].fields
              .filter((f) => f.kind === "control")
              .some((f) => f.cards.includes(c)),
        ),
      );
});
test("tie awards both a point and retains both hands as controls", () => {
  const s = fixture(
    [
      ["AS", "KS", "QS", "JS", "TS"],
      ["AH", "KH", "QH", "JH", "TH"],
    ],
    [
      ["3C", "6D", "7H", "8S"],
      ["3D", "6C", "7S", "8H"],
    ],
  );
  s.players[1].discarded = true;
  s.players[1].stuck = true;
  const all = legalActions(s).find(
    (a) => a.kind === "discard" && a.take.length === 4,
  )!;
  const after = applyAction(s, all);
  assert.equal(after.phase, "roundOver");
  assert.equal(after.history[0].winner, "draw");
  assert.deepEqual(
    after.players.map((p) => p.score),
    [1, 1],
  );
  assert(after.players.every((p) => p.fields[0].kind === "control"));
  assertInvariants(after);
});
test("loser starts next round; loser field refills, old controls remain unchanged", () => {
  let s = findGame(
    (s) => s.phase === "roundOver" && s.history.at(-1)?.winner !== "draw",
  );
  const winner = s.history.at(-1)!.winner as PlayerId;
  const old = JSON.stringify(s.players[winner].fields[0]);
  const next = nextRound(s);
  assert.equal(next.starter, winner === 0 ? 1 : 0);
  assert.equal(JSON.stringify(next.players[winner].fields[0]), old);
  assert.equal(next.players[winner === 0 ? 1 : 0].fields[0].cards.length, 1);
  assert(next.players.every((p) => !p.discarded));
  assertInvariants(next);
});
test("same seed and actions replay exactly; finished states cannot advance or act", () => {
  let a = createGame("replay"),
    b = createGame("replay");
  while (a.phase !== "finished") {
    assert.deepEqual(a, b);
    if (a.phase === "roundOver") {
      a = nextRound(a);
      b = nextRound(b);
    } else {
      const action = chooseAction(a, "greedy");
      a = applyAction(a, action);
      b = applyAction(b, action);
    }
  }
  assert.deepEqual(a, b);
  assert.throws(() => nextRound(a));
  assert.throws(() => applyAction(a, { kind: "discard", take: [], give: [] }));
  assert(a.history.length <= 5);
});
test("round setup refills both players in starter order before marking the next battle", () => {
  const s = findGame(
    (s) => s.phase === "roundOver" && s.history.at(-1)?.winner !== "draw",
  );
  const winner = s.history.at(-1)!.winner as PlayerId,
    starter: PlayerId = winner === 0 ? 1 : 0;
  for (const p of s.players)
    for (const f of p.fields)
      if (f.kind === "normal") {
        s.deck.push(...f.cards);
        f.cards = [];
      }
  const expected = s.deck.slice(0, 9),
    next = nextRound(s);
  assert.deepEqual(
    next.players[starter].fields
      .filter((f) => f.kind !== "control")
      .flatMap((f) => f.cards),
    expected.slice(0, 5),
  );
  assert.deepEqual(
    next.players[winner].fields
      .filter((f) => f.kind !== "control")
      .flatMap((f) => f.cards),
    expected.slice(5),
  );
  assertInvariants(next);
});
test("both reaching three wins on a tied round ends the big game as a draw", () => {
  const s = createGame("final-draw");
  s.round = 3;
  s.turn = 0;
  s.starter = 0;
  s.history = [];
  s.roundActions = [0, 0];
  const hands: Card[][] = [
    ["AS", "KS", "QS", "JS", "TS"],
    ["AH", "KH", "QH", "JH", "TH"],
  ];
  const pool = FULL_DECK.filter((c) => !hands.flat().includes(c));
  for (const p of [0, 1] as const)
    s.players[p] = {
      score: 2,
      discarded: p === 1,
      stuck: p === 1,
      fields: [
        { kind: "control", cards: pool.splice(0, 5), used: false },
        { kind: "control", cards: pool.splice(0, 5), used: false },
        { kind: "battle", cards: hands[p], used: false },
        { kind: "normal", cards: [pool.shift()!], used: false },
        { kind: "normal", cards: [pool.shift()!], used: false },
      ],
    };
  s.deck = pool;
  const a = legalActions(s).find((a) => a.kind === "discard")!;
  const end = applyAction(s, a);
  assert.equal(end.phase, "finished");
  assert.equal(end.winner, "draw");
  assert.deepEqual(
    end.players.map((p) => p.score),
    [3, 3],
  );
  assertInvariants(end);
});
test("AI never reads hidden deck order, hidden RNG, or seed", () => {
  const original = findGame((s) => s.phase === "play" && s.round >= 2);
  const changed = structuredClone(original);
  changed.deck.reverse();
  changed.rngState = 123;
  changed.seed = "another secret";
  for (const strategy of ["random", "greedy", "strategic"] as const)
    assert.deepEqual(
      chooseAction(original, strategy),
      chooseAction(changed, strategy),
    );
});
test("full invariant tournament: 243 seeded games across every AI pairing", () => {
  for (const a of ["random", "greedy", "strategic"] as const)
    for (const b of ["random", "greedy", "strategic"] as const) {
      const result = runSimulation({
        games: 27,
        seed: `tournament-${a}-${b}`,
        strategies: [a, b],
      });
      assert.equal(result.completed, 27);
      assert.equal(result.assertionFailures, 0);
      assert.equal(result.wins[0] + result.wins[1] + result.draws, 27);
      assert.equal(
        result.handCounts.reduce((a, b) => a + b, 0),
        result.rounds * 2,
      );
      assert(result.transitions <= result.rounds - result.completed);
      assert(
        result.transitions >=
          result.rounds - result.completed - result.roundDraws,
      );
      assert(
        result.previousWinnerWins + result.previousWinnerDraws <=
          result.transitions,
      );
    }
});
