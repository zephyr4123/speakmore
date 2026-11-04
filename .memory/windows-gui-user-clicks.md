---
name: windows-gui-user-clicks
description: 游戏电脑上要点系统窗口（选文件、系统对话框）时，直接告诉用户点哪里，不用 SendKeys、界面自动化去点
metadata:
  node_type: memory
  type: feedback
  originSessionId: 6b5e9ce5-00ff-48cc-99ba-a927306fc7c3
  modified: 2026-11-04T01:20:50.814Z
---

在 Windows 开发机上碰到系统画的窗口（选文件的"打开"窗口之类），用户在电脑前的话，直接列步骤让用户点，别用 SendKeys、界面自动化接口去操作。网页里面的部分照旧用调试端口（CDP）来做和核对。

**Why:** 2026-10-19 验词典导入时，SendKeys 被那台电脑的中文输入法截走、没输进去，再要改用界面自动化，用户打断说"你操作 windows 太麻烦了，你告诉我点啥"，然后自己点完了。
**How to apply:** 先确认用户在电脑前，再给两三步（照 [[user-action-requests-plain-steps]]）。用户点完以后，用 CDP、日志、文件去核对结果。那台机器的 Defender 实时保护是关着的，所以杀毒软件占着文件这种情况在那里测不出来。相关：[[speakmore-windows-followups]]。
