# 主队还有救吗？世界杯出线命运实验室

一个面向知乎「足球季 Vibe Coding 挑战赛」的互动项目原型。

新版结构：

- 首页：选择主队，直接看当前结论。
- 规则：图文解释 2026 扩军后与以往世界杯赛制的差异。
- 模拟：输入或调整比分，实时刷新积分榜和晋级率。
- 路径：点击较好、边缘、危险路径，查看需要的比分，并一键套用到模拟器。
- 夺冠树：读取真实 32 强对阵和已完赛淘汰赛结果，未赛场次继续模拟 16 强、8 强、4 强、决赛和冠军概率。
- 知乎热议：通过 Netlify Function 调用知乎开放平台 `zhihu_search`，读取当前主队相关站内讨论；未配置 token 时退回知乎搜索入口。
- 词典：每个术语直接展示三张足球主持人解说图，覆盖速懂版、现场版、避坑版，并可下载术语卡。
- 海报：导出主队命运海报或术语解释图。

核心玩法：

- 选择主队，查看当前小组排名和晋级概率。
- 手动改剩余比赛比分，实时刷新积分榜。
- 基于 48 队、12 组、8 个最佳第三名晋级的赛制做蒙特卡洛模拟。
- 自动生成“今晚该支持谁”和“最爽/钢丝/破防剧本”。
- 用真实淘汰赛对阵锁定已经晋级/出局的球队，并估算剩余夺冠概率。
- 从首页读取知乎站内讨论，继续查看主队、出线规则和世界杯扩军讨论。
- 一键导出可分享的命运海报。
- 每个主要模块都有“刘看山解说”按钮，点击后弹出功能解释。
- 页面导航使用 hash 地址，浏览器后退/前进可以在首页、模拟、路径、词典、海报之间切换。

内置数据已按公开赛程静态更新至 2026-06-30：小组赛比分写在 `src/data/tournament.ts`，淘汰赛对阵、比分、点球和晋级队写在 `src/data/knockout.json`。它不是浏览器实时 API，适合参赛发布后继续用脚本或手动方式维护。

图片素材：

- `public/liukanshan/`：用户提供的刘看山图片，作为解说员头像和弹窗插图。
- `public/liukanshan/coach-avatar.jpg`：从刘看山图片裁出的解说按钮头像。
- `public/liukanshan/liukanshan-kick.gif`：用本地刘看山图片合成的首页踢球动图。
- `public/generated/football-analyst.png`：使用内置图片生成工具生成的足球术语页主视觉。提示词要求成年、全着装、足球分析师风格、无文字和无水印。
- `public/generated/terms/`：使用内置图片生成工具生成的 6 张术语专属底图，包括越位、净胜球、最佳第三名、补时、VAR、点球。图片不内嵌文字，解释文字由网页覆盖。

## 运行

```bash
npm install
npm run dev
```

默认地址：

```text
http://127.0.0.1:5174
```

## 知乎开放平台接入

首页的“知乎热议”模块已经接入 `netlify/functions/zhihu-search.mjs`。前端不会直接保存或发送 Access Secret，而是请求：

```text
/.netlify/functions/zhihu-search?query=法国 世界杯&count=6
```

Netlify Function 会在服务端调用：

```text
https://developer.zhihu.com/api/v1/content/zhihu_search
```

需要在 Netlify 的环境变量里配置：

```text
ZHIHU_TOKEN=你的知乎开放平台 Access Secret
```

本地如果只运行 `npm run dev`，函数不会被 Vite 直接托管，页面会自动退回到知乎站内搜索入口。要完整本地测试 Netlify Function，可以用 Netlify CLI，并在本地 `.env` 或终端环境变量里配置 `ZHIHU_TOKEN`。

## 更新比分

本地一键更新：

```bash
npm run update:scores
npm run build
```

Windows 也可以直接双击根目录的 `一键更新比分并构建.cmd`。

脚本会从 ESPN 世界杯比分接口读取赛程和已完赛比赛：小组赛只回写 `src/data/tournament.ts`，淘汰赛会同步到 `src/data/knockout.json`。如果仓库已经连接 Netlify，推荐使用 GitHub Actions：

1. 打开 GitHub 仓库的 `Actions`。
2. 选择 `Update World Cup Scores`。
3. 点击 `Run workflow`。

工作流会自动更新比分、验证构建、提交变更；Netlify 连接该仓库后会随提交自动重新部署。

## 部署到 Netlify

项目已包含 `netlify.toml`：

```toml
[build]
  command = "npm run build"
  publish = "dist"
```

推荐方式：

1. 把 `E:\worldcup-fate-lab` 推到 GitHub。
2. 在 Netlify 里选择 `Add new site`，连接这个仓库。
3. Build command 填 `npm run build`。
4. Publish directory 填 `dist`。
5. 在 Netlify 的 Environment variables 里添加 `ZHIHU_TOKEN`。
6. 部署后打开站点即可。

移动端适配：

- 手机底部固定导航。
- 首页、规则页、夺冠树、词典图廊都会在窄屏下自动单列。
- 比分模拟器、路径战术单和 32 强对阵会避免横向挤压。
