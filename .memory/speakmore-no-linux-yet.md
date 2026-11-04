---
name: speakmore-no-linux-yet
description: "Linux 桌面暂不支持（issue #6 留着不关），用户量上来再议；整理笔记、关联 Obsidian 这类不在范围（#7 已关）"
metadata:
  node_type: memory
  type: project
  originSessionId: 6b5e9ce5-00ff-48cc-99ba-a927306fc7c3
  modified: 2026-11-04T01:21:44.367Z
---

2026-10-18 用户定了：Linux 桌面现在不做。issue #6（Ubuntu Wayland）已回复原因，**保持打开**，以后 SpeakMore 的使用者多了再接着做。

**Why:** 用户量少，只有用户一个人开发。加 Linux 等于再适配一个系统，验证和出包的工作量会上一个量级。用户原话："这个是不是任务量太重了，相当于又要适配一个系统，我不是太愿意"。agent 起先推荐过做 #6，看的是缺口，低估了长期维护成本。当时日志里的 Linux 需求只有个位数（5 个 IP 的安装脚本在系统检查就退出，3 个 IP 用 Linux 浏览器点过下载）。

**How to apply:**
- 别再主动提议做 Linux。用户重启时可沿用当时的方案：按能力探测、热键和贴字各一条降级链（系统接口 → X11 → 自定义快捷键 / 剪贴板兜底）；全量测试矩阵只在 Linux 小程序指纹变了才跑，平时一台 Ubuntu 24.04 arm64 虚拟机冒烟。
- issue #7（自动整理成笔记、关联 Obsidian、多设备、导入录音）以"不计划做"关闭：在 Obsidian 里听写本来就能用，其余属于语音笔记和知识管理类产品，不在范围里（[[typeless-clone-scope-dictation]]）。
- 回复里没写用户口述的"不如用 Typeless"：查过 Typeless 也没有这类功能，写了会误导提问的人。已告诉用户，用户没要求加回去。

相关：[[speakmore-download-stats]]、[[issues-on-user-cue]]
