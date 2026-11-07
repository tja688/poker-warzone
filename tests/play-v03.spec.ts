import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { createGame, type GameState } from "../src/game/engine";
import {
  applyAction03,
  createGame03,
  legalActions03,
  nextRound03,
  viewFor,
  type Action03,
  type Game03,
} from "../src/game/engine-v03";
import { balanced, bluff, chooseFair, solid } from "../src/game/ai-v03";

mkdirSync(".local/screenshots", { recursive: true });

const personas = [
  ["bluff", bluff],
  ["balanced", balanced],
  ["solid", solid],
] as const;

function cardLabel(card: string) {
  const suits: Record<string, string> = { S: "♠", H: "♥", D: "♦", C: "♣" };
  return `${card[0] === "T" ? "10" : card[0]}${suits[card[1]]}`;
}
function hiddenFrom(game: Game03, seat: 0 | 1, battleOnly: boolean) {
  const ids: string[] = [];
  game.core.players[seat].fields.forEach((field) => {
    if (battleOnly && field.kind !== "battle") return;
    if (!battleOnly && field.kind === "control") return;
    const cards =
      field.kind === "battle"
        ? field.cards.filter((card) => game.hidden[seat].includes(card))
        : field.kind === "normal"
          ? field.cards
          : [];
    ids.push(...cards);
  });
  return ids;
}
const saved = (page: Page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem("poker-warzone-v03")!) as Game03);
async function absent(page: Page, ids: string[]) {
  const hits = await page.evaluate((cards) => {
    const html = document.documentElement.innerHTML;
    return cards.filter((id) => new RegExp(`(^|[^A-Z0-9])${id}([^A-Z0-9]|$)`).test(html));
  }, ids);
  expect(hits).toEqual([]);
}
async function visibleSecrets(page: Page, ids: string[]) {
  return page.evaluate((cards) => {
    const present = new Set(
      [...document.querySelectorAll(".enemy-battle [data-card]")].map((el) =>
        el.getAttribute("data-card"),
      ),
    );
    return cards.filter((id) => present.has(id)).length;
  }, ids);
}
function scripted(game: Game03): Action03 {
  const actions = legalActions03(game);
  const seat = game.actor;
  const one = actions.find(
    (action) =>
      action.kind === "absorb" &&
      action.take.length === 1 &&
      action.take.every((card) =>
        game.core.players[seat].fields.some(
          (field) => field.kind === "normal" && field.cards.includes(card),
        ),
      ),
  );
  return (
    actions.find((action) => action.kind === "call") ||
    actions.find((action) => action.kind === "pass") ||
    one ||
    actions.find((action) => action.kind === "discard") ||
    actions.find((action) => action.kind === "swap") ||
    actions.find((action) => action.kind !== "retreat" && action.kind !== "raise") ||
    actions[0]
  );
}
function findAiRaise() {
  for (const [id, policy] of personas) {
    for (let seed = 0; seed < 40; seed++) {
      let game = createGame03(`R-${id}-${seed}`);
      for (let turn = 0; turn < 80 && game.phase !== "finished"; turn++) {
        if (game.phase === "roundOver") {
          game = nextRound03(game);
          continue;
        }
        const actions = legalActions03(game);
        if (game.actor === 1 && actions.some((action) => action.kind === "raise")) {
          const choice = chooseFair(viewFor(game, 1), policy);
          if (choice.kind === "raise") return { game, persona: id };
          game = applyAction03(game, choice);
          continue;
        }
        game = applyAction03(game, scripted(game));
      }
    }
  }
  throw new Error("no ai raise");
}
function findWhere(label: string, stop: (game: Game03) => boolean) {
  for (let seed = 0; seed < 80; seed++) {
    let game = createGame03(`${label}-${seed}`);
    for (let turn = 0; turn < 500 && game.phase !== "finished"; turn++) {
      if (stop(game)) return game;
      if (game.phase === "roundOver") {
        game = nextRound03(game);
        continue;
      }
      game = applyAction03(game, scripted(game));
    }
    if (stop(game)) return game;
  }
  throw new Error(label);
}
function findAbsorb() {
  for (let seed = 0; seed < 80; seed++) {
    const game = createGame03(`ABS-${seed}`);
    if (game.actor !== 0 || game.phase !== "action") continue;
    const groups = new Map<string, Extract<Action03, { kind: "absorb" }>[]>();
    for (const action of legalActions03(game)) {
      if (action.kind !== "absorb" || action.take.length < 2) continue;
      const normal = action.take.every((card) =>
        game.core.players[0].fields.some(
          (field) => field.kind === "normal" && field.cards.includes(card),
        ),
      );
      if (!normal || !action.hidden) continue;
      const key = [...action.take].sort().join(",");
      groups.set(key, [...(groups.get(key) ?? []), action]);
    }
    for (const group of groups.values()) {
      const choices = [...new Set(group.map((action) => action.hidden))];
      if (choices.length > 1 && choices[0])
        return { game, take: group[0].take, hidden: choices[0], other: choices[1]! };
    }
  }
  throw new Error("no absorb");
}
async function boot(
  page: Page,
  game: Game03,
  persona = "balanced",
  classic?: GameState,
) {
  await page.addInitScript(
    (payload) => {
      localStorage.setItem("poker-warzone-v03", JSON.stringify(payload.game));
      localStorage.setItem("poker-warzone-persona-v03", payload.persona);
      localStorage.setItem("warzone-sound", "off");
      if (payload.classic)
        localStorage.setItem("poker-warzone-v1", JSON.stringify(payload.classic));
    },
    { game, persona, classic },
  );
  await page.goto("./?rules=v0.3");
}
async function fits(page: Page) {
  const errors = await page.evaluate(() => {
    const failures: string[] = [];
    if (
      document.documentElement.scrollWidth > innerWidth ||
      document.documentElement.scrollHeight > innerHeight
    )
      failures.push("document scrolls");
    for (const el of document.querySelectorAll(
      ".game-header, .playing-card, .control-stack, .action-dock, .confirm-action, .result-dock, .rules-switch, .chip-stack, .bet-button, .persona-name",
    )) {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      if (
        rect.x < -1 ||
        rect.y < -1 ||
        rect.right > innerWidth + 1 ||
        rect.bottom > innerHeight + 1
      )
        failures.push(`${el.className}: ${JSON.stringify(rect.toJSON())}`);
    }
    return failures;
  });
  expect(errors).toEqual([]);
}

test("v0.3 fits nine viewports", async ({ page }) => {
  const game = findWhere(
    "OPEN",
    (state) => state.actor === 0 && state.phase === "action" && state.core.round === 1,
  );
  await boot(page, game);
  await absent(page, hiddenFrom(game, 1, false));
  for (const [width, height] of [
    [1440, 900],
    [1366, 768],
    [1024, 768],
    [768, 1024],
    [390, 844],
    [375, 667],
    [320, 568],
    [844, 390],
    [667, 375],
  ]) {
    await page.setViewportSize({ width, height });
    await page.waitForTimeout(200);
    await fits(page);
    await page.screenshot({ path: `.local/screenshots/v03-table-${width}x${height}.png` });
  }
});

test("first absorb picks which card stays down", async ({ page }) => {
  const { game, take, hidden, other } = findAbsorb();
  await page.setViewportSize({ width: 390, height: 844 });
  await boot(page, game);
  await absent(page, hiddenFrom(game, 1, false));
  await page.getByRole("button", { name: "吸牌", exact: true }).click();
  for (const card of take)
    await page.locator(`.player-reserve button[data-card="${card}"]`).click();
  await page.getByRole("button", { name: `${cardLabel(hidden)} 扣下`, exact: true }).click();
  await fits(page);
  await page.getByRole("button", { name: "确认吸牌", exact: true }).click();
  await expect.poll(async () => (await saved(page)).core.turnNumber).toBeGreaterThan(game.core.turnNumber);
  const after = await saved(page);
  expect(after.hidden[0]).toContain(hidden);
  expect(after.hidden[0]).not.toContain(other);
  await absent(page, hiddenFrom(game, 1, false));
});

test("switching versions keeps both games, and the query picks the table", async ({ page }) => {
  const dark = findWhere("KEEP", (state) => state.actor === 0 && state.phase === "action");
  const classic = createGame("KEEP-V1");
  await boot(page, dark, "balanced", classic);
  await page.getByRole("button", { name: "吸牌", exact: true }).click();
  await page.locator(".player-reserve button.playing-card").first().click();
  const down = page.locator("[aria-label='选择暗牌'] button");
  if (await down.count()) await down.first().click();
  await page.getByRole("button", { name: "确认吸牌", exact: true }).click();
  await expect.poll(async () => (await saved(page)).core.turnNumber).toBeGreaterThan(dark.core.turnNumber);
  const progressed = await page.evaluate(() => localStorage.getItem("poker-warzone-v03"));
  await page.getByLabel("规则").selectOption("v0.1");
  await expect(page.getByText("先赢三个战区")).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("poker-warzone-v1")!).seed)).toBe(classic.seed);
  await page.getByLabel("规则").selectOption("v0.3");
  await expect(page.getByText("先到 3 胜")).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("poker-warzone-v03"))).toBe(progressed);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("poker-warzone-v1")!).seed)).toBe(classic.seed);
});

test("rules query, first visit, broken v0.3 save, and lab", async ({ page }) => {
  await page.goto("./");
  await expect(page.getByText("先到 3 胜")).toBeVisible();
  await page.goto("./?rules=v0.1");
  await expect(page.getByText("先赢三个战区")).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("poker-warzone-rules"))).toBe("v0.1");
  await page.goto("./?rules=v0.3");
  await expect(page.getByText("先到 3 胜")).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("poker-warzone-rules"))).toBe("v0.3");
  await page.evaluate(() => {
    localStorage.setItem("poker-warzone-v03", JSON.stringify({ phase: "play", players: [] }));
    localStorage.setItem("poker-warzone-v1", "keep-classic");
  });
  await page.goto("./?rules=v0.3");
  const repaired = await saved(page);
  expect(repaired.core?.seed).toBeTruthy();
  expect(repaired.phase).not.toBe("play");
  expect(await page.evaluate(() => localStorage.getItem("poker-warzone-v1"))).toBe("keep-classic");
  await page.evaluate(() => localStorage.setItem("poker-warzone-rules", "v0.1"));
  await page.goto("./?lab&rules=v0.3");
  await expect(page.getByRole("heading", { name: "模拟实验室" })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("poker-warzone-rules"))).toBe("v0.1");
});
