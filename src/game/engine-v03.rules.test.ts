import { test } from "node:test";
import { strict as assert } from "node:assert";
import { applyAction03, createGame03, legalActions03, nextRound03, viewFor, type Game03 } from "./engine-v03";
import { chooseFair, balanced } from "./ai-v03";
import { FULL_DECK, type Card } from "./engine";

function cardsOf(g: Game03): Card[] {
  return [...g.core.deck, ...g.core.players.flatMap((p) => p.fields.flatMap((f) => f.cards))];
}

test("没有下注动作，先到三胜，暗牌不进对手视图", () => {
  const opening = createGame03("no-bet");
  assert.equal(opening.core.players[0].score + opening.core.players[1].score, 0);
  assert.ok(legalActions03(opening).every((a) => a.kind === "absorb" || a.kind === "swap" || a.kind === "discard"));
  assert.throws(() => applyAction03(opening, { kind: "discard", take: [], give: [] }), /不合法的行动/);
  assert.deepEqual(opening, createGame03("no-bet"));

  let g = opening;
  let guard = 0;
  while (g.phase !== "finished") {
    assert.ok(++guard < 400);
    const all = cardsOf(g);
    assert.equal(all.length, 52);
    assert.equal(new Set(all).size, 52);
    assert.ok(all.every((c) => FULL_DECK.includes(c)));
    const foe = viewFor(g, g.actor === 0 ? 1 : 0);
    const hidden = g.hidden[g.actor];
    const text = JSON.stringify(foe);
    for (const card of hidden) assert.equal(text.includes(`"card":"${card}"`), false);
    if (g.phase === "roundOver") {
      const last = g.results.at(-1)!;
      assert.equal(last.hands[0].length, 5);
      assert.equal(last.hands[1].length, 5);
      const scores = g.core.players.map((p) => p.score);
      assert.ok(scores[0] < 3 || scores[1] < 3 || g.phase === "roundOver");
      g = nextRound03(g);
      continue;
    }
    g = applyAction03(g, chooseFair(viewFor(g, g.actor), balanced, 1));
  }
  const scores = [g.core.players[0].score, g.core.players[1].score];
  assert.ok(scores[0] >= 3 || scores[1] >= 3);
  if (g.winner === "draw") assert.ok(scores[0] >= 3 && scores[1] >= 3);
  else assert.equal(g.winner, scores[0] >= 3 ? 0 : 1);
  assert.ok(g.results.length <= 5);
  assert.ok(g.core.players.every((p) => p.fields.filter((f) => f.kind === "control").length === p.score));
});
