---
name: workflow-agent-budget
description: 一个 workflow 的子 agent 控制在十个上下；复核按组批量判，不按条乘人数
metadata:
  node_type: memory
  type: feedback
  originSessionId: c790f439-dd17-4af4-a34b-18711867efb4
  modified: 2026-11-04T01:22:18.726Z
---

一个 workflow 起的子 agent 总数控制在十个上下，派之前先算清楚最多会起几个。复核、核实这类按条目展开的阶段，按组批量判（一组一个 agent、组里逐条给结论），不要每条配几个人。

2026-10-21 的审查 workflow 是 6 个找问题的、1 个去重的，再给去重后的 33 条每条配 2 个复核的，一共 73 个。用户问"怎么起了 73 个子 Agent 呢？你要控制一下，不然额度要爆炸了"。当时停掉后改成按视角分 6 组复核，续跑时前面的结果走缓存，总数降到 13 个。

**Why:** 子 agent 数直接决定额度消耗。Ultracode 开着也不代表不计成本，用户看得到 agent 数，会在意。
**How to apply:**
- 写脚本时把总数写进 meta 的 phases 说明，派出去时告诉用户会起几个。
- 条目数事先不知道的阶段（复核、逐文件处理）一律分组批量，组数封顶；要多视角就让一个 agent 在同一条上做几种检查，不加人。
- 超过十几个的形状先问用户。和 [[one-review-round-is-enough]] 一起，是用户对 AGENTS.md "多 agent 编排优先"的成本约束。
