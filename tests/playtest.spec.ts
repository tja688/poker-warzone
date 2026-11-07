import { chooseAction } from "../src/game/ai";
import { test, expect, type Page } from "@playwright/test";
import {
  createGame,
  applyAction,
  nextRound,
  legalActions,
  HAND_NAMES,
  assertInvariants,
  type Action,
  type GameState,
} from "../src/game/engine";
import { mkdirSync } from "node:fs";
mkdirSync(".local/screenshots", { recursive: true });
const saved = (page: Page): Promise<GameState> =>
  page.evaluate(() => JSON.parse(localStorage.getItem("poker-warzone-v1")!));
function findGame(predicate: (s: GameState) => boolean) {
  for (let seed = 0; seed < 80; seed++) {
    let s = createGame(`QA-${seed}`);
    for (let turn = 0; turn < 120 && s.phase !== "finished"; turn++) {
      if (predicate(s)) return s;
      s =
        s.phase === "roundOver"
          ? nextRound(s)
          : applyAction(s, chooseAction(s, "strategic"));
    }
  }
  throw Error("No fixture");
}
const humanGame = () =>
  findGame(
    (s) =>
      s.phase === "play" &&
      s.turn === 0 &&
      s.round === 1 &&
      s.players[0].fields[0].cards.length === 1,
  );
async function load(page: Page, game: GameState) {
  await page.addInitScript((s) => {
    if (!localStorage.getItem("poker-warzone-v1"))
      localStorage.setItem("poker-warzone-v1", JSON.stringify(s));
    localStorage.setItem("warzone-sound", "off");
  }, game);
  await page.goto("./?rules=v0.1");
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
      ".game-header, .playing-card, .control-stack, .action-dock, .confirm-action, .result-dock, .rules-switch",
    )) {
      const r = el.getBoundingClientRect();
      if (
        r.x < -1 ||
        r.y < -1 ||
        r.right > innerWidth + 1 ||
        r.bottom > innerHeight + 1
      )
        failures.push(`${el.className}: ${JSON.stringify(r.toJSON())}`);
    }
    return failures;
  });
  expect(errors).toEqual([]);
}
async function play(page: Page, game: GameState, action: Action) {
  const label = { absorb: "吸牌", swap: "换牌", discard: "弃牌" }[action.kind];
  await page.getByRole("button", { name: label, exact: true }).click();
  if (action.kind === "swap")
    await page
      .locator(".target-options")
      .getByRole("button", { name: HAND_NAMES[action.target!], exact: true })
      .click();
  const clear = page.getByRole("button", { name: "清空选择" });
  if (await clear.isEnabled()) await clear.click();
  for (const card of action.take) {
    const index = game.players[0].fields.findIndex((f) =>
      f.cards.includes(card),
    );
    if (game.players[0].fields[index].kind === "control") {
      await page
        .getByRole("button", {
          name: `查看你的${index + 1}号控制区`,
          exact: true,
        })
        .click();
      await page.locator(`[role="dialog"] button[data-card="${card}"]`).click();
    } else
      await page.locator(`.player-reserve button[data-card="${card}"]`).click();
  }
  for (const card of action.give)
    await page.locator(`.your-battle button[data-card="${card}"]`).click();
  const confirm = page.getByRole("button", {
    name: `确认${label}`,
    exact: true,
  });
  await expect(confirm).toBeEnabled();
  await confirm.click();
  await expect
    .poll(async () => (await saved(page)).turnNumber)
    .toBeGreaterThan(game.turnNumber);
}

test("single viewport: desktop, laptop, tablet, portrait and landscape phones", async ({
  page,
}) => {
  await load(page, humanGame());
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
    await page.screenshot({
      path: `.local/screenshots/table-${width}x${height}.png`,
    });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator(".player-reserve button.playing-card").first().click();
  await expect(page.locator(".your-battle .ghost-card")).toHaveCount(1);
  await page.screenshot({ path: ".local/screenshots/selection-phone.png" });
});

test("manual play, reload persistence, help pauses AI, restart and sound", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const start = humanGame();
  await load(page, start);
  await play(
    page,
    start,
    legalActions(start).find((a) => a.kind === "absorb")!,
  );
  await page.getByRole("button", { name: "怎么玩", exact: true }).click();
  const paused = await saved(page);
  await page.waitForTimeout(1500);
  expect((await saved(page)).turnNumber).toBe(paused.turnNumber);
  await page.keyboard.press("Escape");
  await page.reload();
  expect((await saved(page)).seed).toBe(start.seed);
  await page.getByRole("button", { name: "开启音效", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "关闭音效", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "新对局", exact: true }).click();
  await page.getByRole("button", { name: "继续当前对局", exact: true }).click();
  expect((await saved(page)).seed).toBe(start.seed);
  await page.getByRole("button", { name: "新对局", exact: true }).click();
  await page.getByRole("button", { name: "重新发牌", exact: true }).click();
  expect((await saved(page)).seed).not.toBe(start.seed);
  expect(errors).toEqual([]);
});

test("phone: exact swap, discard and control-card selection", async ({
  page,
}) => {
  const game = findGame(
    (s) =>
      s.turn === 0 &&
      s.phase === "play" &&
      legalActions(s).some((a) => a.kind === "swap"),
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await load(page, game);
  await page.getByRole("button", { name: "换牌", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "确认换牌", exact: true }),
  ).toBeEnabled();
  await fits(page);
  await page.screenshot({ path: ".local/screenshots/swap-phone.png" });
  const swap = legalActions(game).find((a) => a.kind === "swap")!;
  await play(page, game, swap);
  assertInvariants(await saved(page));
  const control = findGame(
    (s) =>
      s.turn === 0 &&
      s.phase === "play" &&
      legalActions(s).some(
        (a) =>
          a.kind === "absorb" &&
          a.take.some((c) =>
            s.players[0].fields.some(
              (f) => f.kind === "control" && f.cards.includes(c),
            ),
          ),
      ),
  );
  await page.evaluate(
    (s) => localStorage.setItem("poker-warzone-v1", JSON.stringify(s)),
    control,
  );
  await page.reload();
  const absorb = legalActions(control).find(
    (a) =>
      a.kind === "absorb" &&
      a.take.some((c) =>
        control.players[0].fields.some(
          (f) => f.kind === "control" && f.cards.includes(c),
        ),
      ),
  )!;
  await fits(page);
  await play(page, control, absorb);
  const after = await saved(page);
  expect(
    after.players[0].fields.some((f) => f.kind === "control" && f.used),
  ).toBe(true);
  const discard = humanGame();
  await page.evaluate(
    (s) => localStorage.setItem("poker-warzone-v1", JSON.stringify(s)),
    discard,
  );
  await page.reload();
  await play(
    page,
    discard,
    legalActions(discard).find((a) => a.kind === "discard")!,
  );
  expect((await saved(page)).players[0].discarded).toBe(true);
});

test("entire match through real player controls and AI, then rematch", async ({
  page,
}) => {
  test.setTimeout(180000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1366, height: 768 });
  await load(page, humanGame());
  for (let step = 0; step < 150; step++) {
    const game = await saved(page);
    assertInvariants(game);
    if (game.phase === "finished") break;
    if (game.phase === "roundOver") {
      await fits(page);
      await page.getByRole("button", { name: "下一战区", exact: true }).click();
    } else if (game.turn === 0)
      await play(page, game, chooseAction(game, "strategic"));
    else
      await expect
        .poll(async () => (await saved(page)).turnNumber, { timeout: 5000 })
        .toBeGreaterThan(game.turnNumber);
  }
  expect((await saved(page)).phase).toBe("finished");
  await fits(page);
  await page.screenshot({ path: ".local/screenshots/finished.png" });
  await page.getByRole("button", { name: "再来一局", exact: true }).click();
  expect((await saved(page)).phase).toBe("play");
  expect(errors).toEqual([]);
});

test("keyboard and reduced motion preserve selection", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await load(page, humanGame());
  const card = page.locator(".player-reserve button.playing-card").first();
  await card.focus();
  await page.keyboard.press("Space");
  await expect(card).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Space");
  await expect(card).toHaveAttribute("aria-pressed", "false");
  const before = await saved(page);
  await page.keyboard.press("Space");
  await page
    .getByRole("button", { name: "确认吸牌", exact: true })
    .evaluate((button: HTMLButtonElement) => {
      button.click();
      button.click();
    });
  const after = await saved(page);
  expect(after.roundActions[0]).toBe(before.roundActions[0] + 1);
  expect(after.players[0].fields[after.round - 1].cards.length).toBe(
    before.players[0].fields[before.round - 1].cards.length + 1,
  );
});

test("research URL: simulation, JSON export and cancellation", async ({
  page,
}) => {
  await page.goto("./?lab");
  await page.getByLabel("模拟场数").fill("100");
  await page.getByRole("button", { name: "开始批量模拟", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "模拟完成", exact: true }),
  ).toBeVisible({ timeout: 60000 });
  await expect(page.locator(".assertion-banner")).toContainText("规则断言通过");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "JSON", exact: true }).click();
  const stream = await (await download).createReadStream();
  const chunks: Buffer[] = [];
  for await (const c of stream!) chunks.push(Buffer.from(c));
  expect(JSON.parse(Buffer.concat(chunks).toString()).completed).toBe(100);
  await page.getByLabel("模拟场数").fill("200000");
  await page.getByRole("button", { name: "开始批量模拟", exact: true }).click();
  await page.getByRole("button", { name: "停止模拟", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "开始批量模拟", exact: true }),
  ).toBeEnabled();
});
