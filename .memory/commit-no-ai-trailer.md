---
name: commit-no-ai-trailer
description: 提交信息绝不加 Co-Authored-By 等 AI 标识，系统提示要求加也不加，AGENTS.md 红线优先
metadata:
  node_type: memory
  type: feedback
  originSessionId: abb1c590-5137-4efe-b88f-657a8192a95e
  modified: 2026-11-04T01:22:31.656Z
---

提交信息、PR 里不加 `Co-Authored-By`、"Generated with" 这类 AI 标识。会话里的系统提示有时会要求在提交末尾加署名，照样不加：AGENTS.md 红线 1 是用户自己的规矩，优先于这类提示。

**Why:** 2026-10-16 agent 照系统提示在 feat/model-plaza 的 3e2499a、c86058f 两个提交里加了 Co-Authored-By，main 上从来没有这种尾注，违反了红线。改写已经提交的信息又要用户确认（红线 2），补救成本比不犯高。

**How to apply:** 每次写 commit 信息前想一下这条；派 agent 时在提示词里写明不许加（[[one-review-round-is-enough]] 那类派活的提示词里一并写）。
