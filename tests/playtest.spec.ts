import { test, expect } from "@playwright/test";
import {
  createGame,
  chooseAction,
  applyAction,
  nextRound,
  legalActions,
  type GameState,
} from "../src/game/engine";
import { mkdirSync } from "node:fs";
const captureDir = ".local/screenshots";
mkdirSync(captureDir, { recursive: true });
function humanGame() {
  for (let i = 0; i < 30; i++) {
    const s = createGame(`QA-${i}`);
    if (s.turn === 0) return s;
  }
  throw Error("No human starter seed");
}
function swapGame() {
  for (let seed = 0; seed < 40; seed++) {
    let s = createGame(`SWAP-${seed}`);
    for (let turn = 0; turn < 200 && s.phase !== "finished"; turn++) {
      if (s.phase === "roundOver") {
        s = nextRound(s);
        continue;
      }
      if (s.turn === 0 && legalActions(s).some((a) => a.kind === "swap"))
        return s;
      s = applyAction(s, chooseAction(s, "strategic"));
    }
  }
  throw Error("No swap fixture");
}
async function saveFixture(
  page: import("@playwright/test").Page,
  game: GameState,
) {
  await page.addInitScript((s) => {
    if (!localStorage.getItem("poker-warzone-v1"))
      localStorage.setItem("poker-warzone-v1", JSON.stringify(s));
  }, game);
}
async function saved(page: import("@playwright/test").Page) {
  return page.evaluate(
    () => JSON.parse(localStorage.getItem("poker-warzone-v1")!) as GameState,
  );
}

test("desktop: manual absorb, save/resume, rules, complete AI match", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const game = humanGame();
  await saveFixture(page, game);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("./");
  await expect(
    page.getByRole("heading", { name: "每张牌，都有去处。" }),
  ).toBeVisible();
  await page.screenshot({ path: `${captureDir}/desktop.png`, fullPage: true });
  const cards = page.locator(".your-area .field-strip button.playing-card");
  await cards.first().click();
  await expect(page.getByRole("button", { name: /确认吸牌/ })).toBeEnabled();
  await page.getByRole("button", { name: /确认吸牌/ }).click();
  await expect
    .poll(async () => (await saved(page)).turnNumber)
    .toBeGreaterThan(game.turnNumber);
  const seed = (await saved(page)).seed;
  await page.reload();
  await expect(page.locator(".table-footer")).toContainText(seed);
  await page.getByRole("button", { name: "怎么玩" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "AI 代打 / 观战" }).click();
  for (let round = 0; round < 5; round++) {
    await expect(page.locator(".result-panel")).toBeVisible({ timeout: 35000 });
    const state = await saved(page);
    if (state.phase === "finished") break;
    await page.getByRole("button", { name: /进入第 .* 战区/ }).click();
  }
  expect((await saved(page)).phase).toBe("finished");
  await page.screenshot({ path: `${captureDir}/finished.png`, fullPage: true });
  expect(errors).toEqual([]);
});

test("phone and tablet: swap selection, legal confirmation, no overflow, reset", async ({
  page,
}) => {
  const state = swapGame();
  await saveFixture(page, state);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("./");
  await page.getByRole("button", { name: "换牌", exact: true }).click();
  await page.locator(".target-options button").last().click();
  await expect(page.getByRole("button", { name: /确认换牌/ })).toBeEnabled();
  await page.screenshot({ path: `${captureDir}/phone.png`, fullPage: true });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const before = await saved(page);
  await page.getByRole("button", { name: /确认换牌/ }).click();
  await expect
    .poll(async () => (await saved(page)).turnNumber)
    .toBeGreaterThan(before.turnNumber);
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.screenshot({ path: `${captureDir}/tablet.png`, fullPage: true });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "新对局" }).click();
  await page.getByLabel("对局种子").fill("MOBILE-RESET");
  await page.getByLabel("对手风格").selectOption("random");
  await page.getByRole("button", { name: "发牌，开始" }).click();
  await expect(page.locator(".table-footer")).toContainText("MOBILE-RESET");
  await page.setViewportSize({ width: 320, height: 740 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("simulation worker: batch stats, export JSON, cancellation", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("./");
  await page.getByRole("button", { name: "模拟实验室", exact: true }).click();
  await page.getByLabel("模拟场数").fill("100");
  await page.getByRole("button", { name: "开始批量模拟" }).click();
  await expect(
    page.getByRole("heading", { name: "模拟完成", exact: true }),
  ).toBeVisible({ timeout: 60000 });
  await expect(page.locator(".assertion-banner")).toContainText("规则断言通过");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "JSON", exact: true }).click();
  const file = await download;
  const stream = await file.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  const result = JSON.parse(Buffer.concat(chunks).toString());
  expect(result.completed).toBe(100);
  expect(result.wins[0] + result.wins[1] + result.draws).toBe(100);
  expect(result.handCounts.reduce((x: number, y: number) => x + y, 0)).toBe(
    result.rounds * 2,
  );
  expect(result.assertionFailures).toBe(0);
  await page.screenshot({ path: `${captureDir}/lab.png`, fullPage: true });
  await page.getByLabel("模拟场数").fill("200000");
  await page.getByRole("button", { name: "开始批量模拟" }).click();
  await page.getByRole("button", { name: "停止模拟" }).click();
  await expect(
    page.getByRole("button", { name: "开始批量模拟" }),
  ).toBeEnabled();
  expect(errors).toEqual([]);
});
