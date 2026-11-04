---
name: architecture-unified-io-strategy
description: 架构原则：统一输入输出、策略模式、插件化可热插拔；不打补丁，遇到问题从抽象和分层上根治
metadata:
  node_type: memory
  type: feedback
  originSessionId: abb1c590-5137-4efe-b88f-657a8192a95e
  modified: 2026-11-04T01:22:32.617Z
---

要换的模型和要兼容的系统都很多，所以设计时要统一输入和输出，用策略模式：上层只认接口，具体实现可以替换、删除，也可以热插拔。遇到问题不打补丁，从抽象和分层上根治。

用户 2026-10-16 的原话："一定要遵循一个很重要的原则：统一输入和输出……策略模式在这里是一个非常重要的设计原则……不要打补丁，所有遇到的问题都要根治，去想怎么抽象、怎么分层，这样才是正确的道路。"同一天用户还说过，整体架构要"插件化、模块化、可热插拔：支持替换，也支持删除"。

**Why:** 本地转写要接很多模型和运行库，以后还要做 Windows（CPU、GPU 的环境都不一样）。没有统一接口，每加一样东西就要到处改。
**How to apply:**
- 录音无论从哪来，先统一成 16 kHz 单声道（`src/server/audio` 的 `toSpeech`、`decodeWav`），再交给任何模型。
- 本地转写统一成 `transcribe(samples) → { text }`（`src/server/asr/engines/`）。各系统的差别（Metal、Vulkan、CPU）关在各自的适配器里。
- 模型只在清单里放下载链接和 sha256，文件不进仓库。下载、校验、删除走 `src/server/asr/store.mjs`，以后模型广场也用它。
- Windows 那一层等真正做 Windows 时再抽出来，现在只保证接口不绑死 Mac。用户的说法是"慢慢走、慢慢改，根据结果和数据去反馈"。

相关：[[speakmore-two-pipelines]]、[[bench-judge-is-claude]]。
