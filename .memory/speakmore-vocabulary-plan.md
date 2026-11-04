---
name: speakmore-vocabulary-plan
description: "词典功能 10-19 随 0.10.0 发布，#9 已关，官网已加；还待用户定：西里尔形近字归一、评测参照错 4 条和 multicard 判法"
metadata:
  node_type: memory
  type: project
  originSessionId: 6b5e9ce5-00ff-48cc-99ba-a927306fc7c3
  modified: 2026-11-04T01:22:00.970Z
---

2026-10-19 用户说"开分支，彻底开干"，在 feat/vocabulary 上做。用户的要求：
- 整条链路都支持词表：本机转写、云端转写、原生识别、润色，热词、上下文、提示词三种做法都要覆盖。
- 严格策略模式：统一接口加各模型的适配策略，改一个模型只动一小块，"不能拧成一团麻花"。
- 做完全面端到端验证，本机模型也要测完；开发 key 的额度可以用（不太过分）。
- 界面对齐 Typeless 的词典页，讲清两点：词表只存在本机、支持哪些模型。要极高审美（"不要像前端初学者"）；用户嫌信息栏一行塞了内容、模型名、识别方式太挤，已改成两栏加短标签。
- 做完起一轮对抗性审查。

已提交（分支上 4 个 commit，main 上还有一个记忆 commit 755c9c0 没推）：
- 449adb1 src/vocabulary/（terms 规整导入、support 收法和挑词）+ storage/vocabulary.mjs（~/.speakmore/vocabulary.json）
- b29415b 链路：server.mjs 每次听写读一次词典交给 prepare/refine；收法写在模型清单（catalog.mjs、asr/cloud/vendors.mjs），放进请求由适配器管
- 797b623 词典页（renderer/hub/vocabulary.*、app/vocabulary.mjs、docs/PRODUCT.md）
- 5339db3 命令行 speakmore dict

实测定下的（都在代码注释里）：百炼 qwen3-asr-flash 的 system 消息 content 必须写成数组，写成字符串回 400；智谱 hotwords 每个词一个字段；sherpa-onnx 的 Qwen3 KV 只有 512 个位置，热词 400 字开始截音频，限 120 字；transcribe.cpp 版限 600 字（CPU 上多 0.3 秒）；MiniMax、SenseVoice 不收。

10-19 加了爬山（用户点名试 claude-api skill 的 hillclimb，要当成这个理论的一次实践记下来）：三处写法（nativePromptWith、polishPromptWith、contextOf）各爬 1–3 轮，一处都没留下，记录在 bench/results/vocabulary-hillclimb-2026-10-19.md，全模型对比在 vocabulary-2026-10-19.md。工具：scripts/dev/climb-vocabulary.mjs（run/score/split）、climb-vocabulary-pack.mjs（只拷训练集给分析员）、bench/lib/vocabulary.mjs（共用判法；佳明和 Garmin 都算对是用户定的）。待用户定：fun-asr 会把词典原样吐进成品（要不要不给它送词典）、西里尔形近字归一、参照错 4 条和 multicard 判法要不要修。

10-19 收尾：App 端到端（数据隐私、转写加润色、原生）带词典都写对了，第一次跑查出收法里混了函数、本机模型装不上，已改成纯数据。一轮对抗审查（链路、存储与命令行、界面三路）27 条全改，单测 1046 个全过，界面在真窗口里验过。没做的：跨进程加锁（窗口只有几毫秒，代码注释写了理由）；原生和润色共用一个提示词上限（接小上下文本机大模型可能挤爆，未验证）。

**Why:** 用户早就想做，issue #9 给了契机；用户要的是能长期维护的结构和真实验证过的效果。

**10-19 发布（0.10.0）：** 发版前在游戏电脑上补测了一轮（单测、两种本地运行库带词典听写、GBK/UTF-16 导入、词典页、原生选文件窗口），查出 Windows 上词典文件被别的程序开着时换不上，加了最多半秒的重试再发。两台电脑正式装好启动过，#9 已回复并关闭，官网"更多特性"加了词典。

**How to apply:** 已随 0.10.0 发布；fun-asr 定了不送词典（13dfd00）。待用户定：西里尔形近字归一、评测里 4 条参照错和 multicard 判法要不要修再爬一轮。原来的步骤（都做完了）：1. 读 bench/_work/vocabulary/report.md（scripts/dev/eval-vocabulary.mjs，30 条原版录音，各模型带不带词典对比，含"硬塞"计数），效果写进 bench/results/vocabulary-2026-10-19.md，必要时调上限或提示词；2. App 端到端（scripts/dev/e2e.mjs，家目录放 vocabulary.json，native、local、private 各一遍）；3. 文档：docs/development.md、README 中英；4. 一轮对抗审查；5. 合并、推送前问用户。开发窗口用 /tmp/smv 家目录、热键右 Control，驱动脚本在会话 scratchpad/ui/cdp.mjs。相关：[[speakmore-model-plaza]]、[[speakmore-two-pipelines]]、[[desktop-copy-and-look]]
