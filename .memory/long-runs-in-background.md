---
name: long-runs-in-background
description: 评测、批量调模型这类要跑几分钟的任务一律挂后台，不占着主对话
metadata:
  node_type: memory
  type: feedback
  originSessionId: 6b5e9ce5-00ff-48cc-99ba-a927306fc7c3
  modified: 2026-11-04T01:22:11.401Z
---

评测、批量调模型、长时间的回放这类要跑几分钟的任务，用后台方式起（run_in_background），跑完再看结果，不在前台等着。

用户原话（2026-10-16，agent 在前台起 60 条的提示词评测时被打断）："一会儿你要起评测的话，你就挂后台去跑，不要占着你的主进程，因为我还有东西要跟你讨论呢。"

**Why:** 用户经常边等结果边要和 agent 讨论别的事，前台跑长任务会把对话卡住。
**How to apply:** 预计超过一分钟左右的命令都挂后台，输出写进日志文件，完成通知到了再读；起完就回到对话里。发版那种交给用户跑的脚本照 [[cloud-changes-user-runs]]。
