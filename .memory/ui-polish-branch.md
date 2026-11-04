---
name: ui-polish-branch
description: 10-21 起在 ui-polish 分支（从 engine-tree 开出）逐页打磨主窗口界面；做完了哪些、下一块是首页的花费统计；和引擎页一起等用户说再审、再问合并
metadata:
  node_type: memory
  type: project
  originSessionId: c790f439-dd17-4af4-a34b-18711867efb4
  modified: 2026-11-04T01:21:05.639Z
---

2026-10-21 引擎页做完后，用户说"优化其他 ui，再开一个分支"，分支 `ui-polish` 从 `engine-tree` 开出（两批改动连着，最后一起审）。

已做完、已提交（真窗口中英、深浅都看过）：
- 首页：去掉右边一列（口述卡、版本号），热键写到标题下面、键帽照实体键画；版本号挪到侧栏底下；识别方式胶囊前面是状态小圆点。
- 词典页：去掉图标色块、每个词前的羽毛图标、"转写 热词 | 润色 提示词"那行（用户说 App 的用户只需要知道这是词典）；词像索引一样细线分隔。
- 引擎页：环节节点去掉星光、声波、魔杖图标的方块，只留字。
- 设置：下拉框用 appearance: base-select 画成胶囊、打开是玻璃单子；所有按钮一律胶囊，抽成一条共用样式（见 [[desktop-copy-and-look]]）。

- 首页花费卡（10-21 第一版，等用户看着再调）：表格换成柱状趋势（今天按钟头、本月按天、累计按用了多久）加每个型号一行占比细线，只用主题色；指着型号柱子里只亮它那一份。数据层加了 history.usageOverTime 和 src/usage/series.mjs。用户又要了一条淡的平滑趋势线叠在柱子上（hub/trend.mjs，高斯平滑加单调三次曲线），柱子密了也看得出起伏。
  隔离实例 /tmp/sm-engine 的账里灌了 694 次假听写看样子（脚本和原库备份在会话 scratchpad 的 seed-spend.mjs、history.db.before-spend-seed），不再需要时还原。

**Why:** 用户要逐页把"AI 味"和"初学者味"去掉，改完一起审。
**How to apply:** 接着在 ui-polish 上小步改、随做随提；改完在开发窗口给用户看（[[ui-review-in-dev-window]]）。用户没说审之前不开对抗性审查；审完再问合并主干。分段控件（首页时段、引擎页渠道）10-21 用户点头后也改成胶囊了。相关：[[plaza-tree-prototype]]。

**10-21 进入收尾**（用户说"OK 了，进入收尾和审查"）：顺序是对抗性审查（workflow 一轮）→ 逐条核实、修 → README 和官网的图与说法（旧模型页、首页识别方式选单、推荐组合、密钥这几张要重截，docs/media.json、website 用的同一批）→ 版本号（打算 0.13.0）→ 照 [[speakmore-release-on-cos]] 先只推标签、用户跑 ship、传完推 main、部署官网 → 线上包 Mac、Windows 真装真启动（[[acceptance-end-to-end]]）。合并、推送前仍要问用户。
- 审查已完（wf_95000394-f9d，按视角分组复核共 13 个 agent）：33 条确认 31、驳回 2，31 条全修并提交，开发窗口逐条核过；README（中英 16 张新图，多了一张花费卡）、官网文案和图已改、图已上桶；版本号 0.13.0 已提交（5b8d202）。下一步问用户合并、推标签。
- README 截图的家目录 /tmp/smr-zh、/tmp/smr-en（各带一份 850 MB 的本机模型、开发用密钥存在里面），GitHub 上查完 camo 后删掉。
- **10-21 已合并发布**：合进 main（6f33bd1）随 0.13.0 发布，线上包两台验过（见 [[speakmore-release-on-cos]]）。README 截图的临时家目录已删。
- Windows 从源码跑的验证已过：单测 1256 条 1193 过、0 失败；首页花费卡（墨主题深浅色）、引擎页、设置下拉框（base-select）、词典都看过。开发机的家目录 speakmore-dev\home 里灌了假用量，原库备份 data\history.db.before-ui-review；本机到开发机的调试隧道开在 19333。收尾时还原两边灌过假数据的库、关隧道。

