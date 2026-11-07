import { test } from "node:test";
import { strict as assert } from "node:assert";
import { applyAction03, createGame03, legalActions03, nextRound03, viewFor, type Game03 } from "./engine-v03";
import { balanced, chooseFair, chooseOracle, DEFAULT_SAMPLES, fairPolicies } from "./ai-v03";
import type { Card, PlayerId } from "./engine";

const other = (p: PlayerId): PlayerId => (p === 0 ? 1 : 0);

function covered(g: Game03, seat: PlayerId): Card[] {
  const battle = g.core.players[seat].fields[g.core.round - 1];
  const holes = g.core.players[seat].fields.filter((f) => f.kind === "normal").flatMap((f) => f.cards);
  return [...battle.cards.filter((c) => g.hidden[seat].includes(c)), ...holes];
}

function blind(g: Game03): Game03 {
  const next = structuredClone(g);
  const seat = other(next.actor);
  const secret = covered(next, seat);
  const deck = next.core.deck;
  for (let i = 0; i < secret.length && i < deck.length; i++) {
    const fromDeck = deck[i];
    const hidden = secret[i];
    deck[i] = hidden;
    for (const field of next.core.players[seat].fields) {
      const at = field.cards.indexOf(hidden);
      if (at >= 0) field.cards[at] = fromDeck;
    }
    const hid = next.hidden[seat].indexOf(hidden);
    if (hid >= 0) next.hidden[seat][hid] = fromDeck;
  }
  return next;
}

test(`bench-v03 均衡策略 ${DEFAULT_SAMPLES} 次抽样，最慢一次决策低于 300ms`, (t) => {
  let g = createGame03("bench-v03");
  const times: number[] = [];
  while (times.length < 20 && g.phase !== "finished") {
    if (g.phase === "roundOver") {
      g = nextRound03(g);
      continue;
    }
    const view = viewFor(g, g.actor);
    const t0 = performance.now();
    const action = chooseFair(view, balanced);
    times.push(performance.now() - t0);
    assert.ok(view.actions.includes(action));
    g = applyAction03(g, action);
  }
  assert.equal(times.length, 20);
  const worst = Math.max(...times);
  t.diagnostic(`samples=${DEFAULT_SAMPLES} slowest=${worst.toFixed(1)}ms`);
  assert.ok(worst < 300, `slowest=${worst.toFixed(1)}ms`);
});

test("对手暗牌换掉之后，公平出牌不变", () => {
  const games = [createGame03("iso-1"), createGame03("iso-2")];
  const absorbed = createGame03("iso-3");
  games.push(applyAction03(absorbed, legalActions03(absorbed)[0]));
  for (const g of games) {
    const swapped = blind(g);
    assert.notDeepEqual(covered(g, other(g.actor)), covered(swapped, other(g.actor)));
    const view = viewFor(g, g.actor);
    const again = viewFor(swapped, g.actor);
    assert.deepEqual(view, again);
    for (const policy of fairPolicies) {
      assert.deepEqual(chooseFair(view, policy), chooseFair(again, policy));
    }
    assert.deepEqual(chooseOracle(g), chooseFair(view, balanced));
  }
});

test("空操作列表会抛错，且公平决策不调用 Math.random", () => {
  const g = createGame03("empty-actions");
  const view = viewFor(g, other(g.actor));
  assert.equal(view.actions.length, 0);
  assert.throws(() => chooseFair(view, balanced), /当前没有合法操作/);
  const random = Math.random;
  let calls = 0;
  Math.random = () => {
    calls++;
    return random();
  };
  try {
    chooseFair(viewFor(g, g.actor), balanced);
    chooseOracle(g, 4);
  } finally {
    Math.random = random;
  }
  assert.equal(calls, 0);
});
