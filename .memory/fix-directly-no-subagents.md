---
name: fix-directly-no-subagents
description: 清单定了的修复活由 agent 自己直接改，不拆给子 agent 并行；改完统一审一遍
metadata:
  node_type: memory
  type: feedback
  originSessionId: abb1c590-5137-4efe-b88f-657a8192a95e
  modified: 2026-11-08T10:22:06.277Z
---

清单已经定下来的一批修复（比如设计第二步的 App、官网各项），agent 自己直接改，不派子 agent、不开 worktree 并行，改完统一审查一轮。

**Why:** 2026-11-08 agent 准备把第二步拆给两个 worktree 子 agent，用户打断：「不派子agent，你直接修，修完审查一下就好了，这样快一点，效率更高」。

**How to apply:** 子 agent 留给需要独立视角的活（核实别人的结论、对抗性审查）或大范围的只读调研；动手改代码的活自己做，一个逻辑单元一个 commit。审查照 [[one-review-round-is-enough]] 放在最后做一轮。
