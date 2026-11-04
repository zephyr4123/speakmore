---
name: bailian-cli-local
description: 阿里云百炼 CLI（bl）装在 .tools/bailian-cli，用旁边的 bl 包装脚本跑；没跑 bl skill init，因为它会往七个全局 agent 目录写 skill
metadata:
  node_type: memory
  type: reference
  originSessionId: 6b5e9ce5-00ff-48cc-99ba-a927306fc7c3
  modified: 2026-11-04T01:21:52.718Z
---

2026-10-16 用户让照百炼控制台给的 install.md 装 CLI，想看百炼上有多少模型、拿来扩充模型广场。

- 装法没照文档的 `npm install -g`：装在 `.tools/bailian-cli/`（已被 .gitignore 忽略），版本钉在 2.3.1。运行一律用 `.tools/bailian-cli/bl`，它把 `BAILIAN_CONFIG_DIR` 指到同目录的 `home/`，配置、登录态、telemetry.jsonl、wiki 数据都不进 `~/.bailian`。
- 没跑 `bl skill init`：`--dry-run` 显示它会往 ~/.agents、~/.claude-jivu、~/.codex、~/.cursor、~/.gemini、~/.copilot 等七个全局 skill 目录写，违反 [[rea-project-level-install]] 的只装本项目。
- 没登录。`bl model list`、`model search` 不用登录；单页最多 50 条（`--page-size 100` 起返回空）。
- 2026-10-16 的目录：125 个家族、354 个型号。和 SpeakMore 有关的：能当原生的 Qwen-Omni 系列、文件转写 12 个家族（qwen3-asr-flash、fun-asr、paraformer-v2 等）、文本生成 41 个家族（含百炼代理的 DeepSeek、Kimi、GLM、MiniMax）。

相关：[[speakmore-model-providers]]、[[speakmore-model-plaza]]。
