# 扑克战区 · 网页 Playtest

根据 [规则策划案 v0.1](docs/rules-v0.1.md) 制作的单机测试版。完整游戏逻辑与 AI 对局模拟共用一个确定性引擎，无后端、无账号。

在线试玩：**https://tja688.github.io/poker-warzone/**

![牌桌界面](docs/screenshots/desktop.png)

## 游玩

- 先赢下 3 个战区的玩家获胜。双方桌面全部明牌。
- **吸牌**：点选普通区或未使用控制区的牌，再确认。战区至多 5 张，每控制区整场仅可吸 1 张。
- **换牌**：选择更高目标牌型，预选组合可手动调整；换入、换出张数必须等于该目标的最小值，不能只换踢脚。
- **弃牌**：每小局一次，挑选普通区的任意非空子集；空位在下回合开始补牌。
- 无合法操作自动卡住，双方卡住后比牌。结算后手动进入下一战区。
- 手机、平板和电脑均以点选操作，不需要拖拽。可用键盘 Tab / Enter 操作。默认静音，可选轻量提示音。
- 自动保存到当前浏览器。新对局可指定种子与 AI 风格；同种子和行动顺序能复现相同发牌。AI 代打可以随时接管。

## 本地运行

Node.js 24：

```sh
npm ci
npm run dev
npm test
npm run build
npm run test:e2e
```

开发地址以 Vite 实际输出为准。构建产物 `dist/` 可放在任意静态服务器，资源路径使用相对地址。

## 模拟

网页的「模拟实验室」在 Web Worker 中批量运行，可选随机、贪心、策略 AI，支持停止及 CSV / JSON 导出，单批最多 200,000 场。结束或停止后显示已完成场数。

命令行不受页面数量输入限制：

```sh
npm run simulate -- --games 10000 --seed baseline-01 --a greedy --b greedy --out docs/simulation-baseline.json
npm run simulate -- --games 1000 --seed compare-01 --a greedy --b strategic --out docs/simulation-comparison.json
```

输出大局胜负、首轮先手胜率、上局胜者续局胜率、平均小局数、打满 5 局比例、平局、牌型和操作分布。各概率的分母在实验室明确说明。模拟结论仅反映指定策略与种子，不能替代玩家体验测试。

AI 设计见 [docs/ai.md](docs/ai.md)，验证与实测结果见 [docs/playtest-report.md](docs/playtest-report.md)。

## 部署

推送 `main` 后，GitHub Actions 执行测试与构建，随后部署 GitHub Pages。仓库 Settings → Pages 的发布源为 GitHub Actions。

## 实现边界

按原文采用 A2345、踢脚、花色不分大小、先补牌后洗牌等【默认】处理。策划案 Q1–Q6 保留讨论，本次不加入下注、肉鸽、多人网络或主动跳过规则。

架构：`src/game/engine.ts` 规则与 AI；`src/game/simulation.ts` 批量统计；`src/simulation.worker.ts` 后台模拟；`src/App.tsx` 牌桌；`src/Lab.tsx` 实验室。UI 使用 React、shadcn/ui Nova、Lucide 和 Zustand。没有外部字体或图片请求；字体随构建自托管。
