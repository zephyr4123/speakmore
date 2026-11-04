---
name: rea-is-the-primary-tool
description: 本项目做逆向时以 REA 的 MCP 工具和 skill 为主干，不要用自写脚本另起一套绕开它
metadata:
  node_type: memory
  type: feedback
  originSessionId: fc395de3-9408-4fc0-a1cd-c93df2b01863
  modified: 2026-11-04T01:22:28.964Z
---

在本项目做逆向分析，主干必须是 REA：先调 `reverse-engineer-anything` skill，用 `mcp__rea__*` 工具出结论并引用它返回的 Evidence ID。自写脚本、第三方工具只用来补 REA 确实做不了的环节，补完的产物要喂回 REA 继续分析，并在汇报里说明"这一步为什么没用 REA"。

**Why:** 2026-10-12 逆向 Typeless 时，agent 发现代码被 javascript-obfuscator 混淆后，转头自己写 asar 解包、跑 webcrack、grep 读代码，REA 只调了一次就没再看。用户中途打断，原话："你可别跑偏了哈,我们是基于 rea 去做这个事,它的 mcp 和 skills 都是你的工具，你不要自己做美了不看 rea 了"。这个仓库本身就是围绕 REA 建的（见 [[rea-project-level-install]]）。

**How to apply:**
- 每个分析环节先问"REA 有没有对应工具"，有就用它；工具清单和可用性用 `binary_session` 查（`result.tool_availability`）。
- 遇到 REA 的硬缺口再用外部手段。已知一处：`recover_javascript_sources` 只支持 Linux x64，本机（macOS arm64）还原被混淆的 JS 得用 webcrack，还原后的目录再交给 `analyze_javascript_application`。
- 文档里的结论标 Evidence ID；来自自写脚本的结论单独标注来源。
