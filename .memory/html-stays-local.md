---
name: html-stays-local
description: 做的 HTML 页面（原型、报告等）不发到 claude.ai 的 Artifact，只在本机写文件、用浏览器打开给用户看
metadata:
  node_type: memory
  type: feedback
  originSessionId: 6b5e9ce5-00ff-48cc-99ba-a927306fc7c3
  modified: 2026-11-04T01:22:23.466Z
---

2026-10-16 agent 把模型广场的原型用 Artifact 发到了 claude.ai，用户说："以后用 claude artifact 别传到 claude.ai 上，关掉，我本地看就好"。那一份已删。

**Why:** 用户只想在本机看，不想东西传到云上。

**How to apply:** 原型、报告这类 HTML 一律写成本地文件（放 scratchpad 或项目里被 gitignore 的目录），用 `open <文件>` 在浏览器里打开，回复里给完整的绝对路径。不调用 Artifact 的 publish，也不建议改用别的方式发布。用户点名要发时再发。

相关：[[speakmore-model-plaza]]。
