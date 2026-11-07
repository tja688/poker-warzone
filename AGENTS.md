# 扑克战区

这是验证玩法的单机游戏。主入口直接进入完整牌桌；保持一屏可玩，操作优先于说明。

1. 开始修改时读 `docs/architecture.md` 的修改地图。规则依据是 `docs/rules-v0.1.md`；用户明确提出的新版规则优先，并记录与 v0.1 的差异。
2. 改玩法时先落实到 `src/game/engine.ts` 的合法操作和状态推进，再接 UI、AI、模拟。展示层只提交引擎认可的 Action。
3. 改视觉或交互时读 `DESIGN.md`。工具入口为 `?lab`，主牌桌只保留当前决策需要的信息。新增界面验证宽度与高度，不能靠隐藏溢出裁掉功能。
4. 改状态结构或规则版本时按 `docs/architecture.md` 的存档段处理旧局。规则文本及 `public/rules-v0.1.md` 是同一规则的文档与发布副本。
5. 完成后运行 `npm test`、`npm run build`、`npm run test:e2e`，检查 `.local/screenshots` 中桌面、窄竖屏、短横屏及结算截图。测试标准见 `docs/architecture.md`。

发布沿用当前仓库的 GitHub Pages 工作流。推送后核对相同 commit 的 Actions 部署结果与线上入口；仅 build 成功不算发布完成。
