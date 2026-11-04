---
name: refactor-surgical-clean
description: 定了要重构的，就做干净、手术式，不为项目自己这边（发布、分发、更新的做法）的旧写法留兼容尾巴
metadata:
  node_type: memory
  type: feedback
  originSessionId: c790f439-dd17-4af4-a34b-18711867efb4
  modified: 2026-11-04T01:22:35.636Z
---

2026-10-20 定分发重构时用户说："这次做就一定要做的干净，不要考虑啥兼容问题……既然决定重构就要做的干净，大刀阔斧，手术式"。

**Why:** 改的是项目自己的发布和分发策略，用户认为不影响 App 使用者手里正在用的版本；留着新旧两套只会让结构变脏。

**How to apply:**
- 旧的脚本、目录排法、配置项、文档段落直接换掉、删干净，不并存、不加开关。
- 真会碰到 App 使用者手里旧版本的地方（比如旧版本 `speakmore update` 要读的下载地址、旧版本默认的模型源），先说清楚影响，再按用户的意思办，不要默默留兼容，也不要默默弄断。
- AGENTS.md 红线 6（破坏性变更要有迁移和回滚）照样适用于用户的数据和对外接口；这条说的是项目自己内部的做法。相关：[[speakmore-distribution-rework]]。
