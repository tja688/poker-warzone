# 扑克战区 Playtest

<!-- impeccable:product-schema 1 -->

## Platform
web

## Stack
Delegated by the user's instruction to plan and implement directly: React + TypeScript + Vite, static GitHub Pages hosting. Browser-local game and simulations; no account or server required.

## Users
玩家进行单机规则试玩；设计者批量跑局、观察基础规则的资源拉平效应。

## Product Purpose
完整实现《扑克战区规则策划案 v0.1》，以真实交互和可复现模拟支持下一轮规则讨论。

## Capabilities and Constraints
52 张共享牌库、5 个场地、先到 3 胜；完整吸牌、最少张数换牌、一次弃牌、控制区和卡住流程。所有桌面信息公开，AI 不读取牌库顺序。触屏点选、手机和平板布局。支持批量模拟、种子复现和导出。上传 GitHub 并启用 GitHub Pages。

## Brand Commitments
简约美观，游戏体验优先；中文界面。名称沿用策划案暂名。美术方向和技术选型由本次实现决定，无需用户逐项确认。

## Evidence on Hand
规则原件副本：docs/rules-v0.1.md。模拟统计必须来自实际运行；不能以模拟结果代替人类试玩结论。

## Product Principles
1. 规则与模拟共用一个引擎。
2. 每次行动可预览、可理解，不允许非法操作。
3. 玩家优先看到牌局，工具放在次级面板。
4. 模拟结果说明策略、样本和断言。

## Accessibility & Inclusion
手机和平板不依赖拖拽或悬停；键盘可操作，花色使用形状与颜色共同区分。

## Assumptions
策划案的【默认】项按原文实现；Q1–Q6 保留为待讨论问题。本轮不加入肉鸽、下注或额外规则。
