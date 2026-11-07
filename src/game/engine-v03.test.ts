import { test } from "node:test";
import { strict as assert } from "node:assert";
import { applyAction03, createGame03, legalActions03, viewFor, type Action03 } from "./engine-v03";
import { type Action, type Card } from "./engine";

type Move = Action & { hidden?: Card };
const moves = (actions: Action03[], kind: Move["kind"]) =>
  actions.filter((a): a is Move => a.kind === kind);

test("首次吸牌暗置，单张自动扣下，对手视图没有这张牌", () => {
  const g = createGame03("hidden-keep");
  const seat = g.actor;
  const covered = g.hidden[seat][0];
  const singles = moves(legalActions03(g), "absorb").filter((a) => a.take.length === 1);
  assert.equal(singles[0].hidden, singles[0].take[0]);
  const after = applyAction03(g, singles[0]);
  assert.ok(after.hidden[seat].includes(singles[0].hidden!));
  assert.ok(after.hidden[seat].includes(covered));
  const foe = JSON.stringify(viewFor(after, seat === 0 ? 1 : 0));
  assert.equal(foe.includes(`"card":"${singles[0].hidden}"`), false);
  assert.equal(foe.includes(`"card":"${covered}"`), false);
  const own = JSON.stringify(viewFor(after, seat));
  assert.equal(own.includes(`"card":"${singles[0].hidden}"`), true);
});

test("换出和弃掉的牌进入牌河", () => {
  let g = createGame03("river-keep");
  const seat = g.actor;
  const absorb = moves(legalActions03(g), "absorb").find((a) => a.take.length === 1)!;
  g = applyAction03(g, absorb);
  const discard = moves(legalActions03(g), "discard")[0];
  if (discard && g.actor !== seat) {
    g = applyAction03(g, discard);
    assert.ok(g.river.some((entry) => entry.reason === "discard"));
  }
});

test("同种子的第一手之后状态相同", () => {
  const a = createGame03("twin-keep");
  const b = createGame03("twin-keep");
  const move = legalActions03(a)[0];
  assert.deepEqual(applyAction03(a, move), applyAction03(b, move));
});
