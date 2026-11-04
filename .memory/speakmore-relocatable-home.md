---
name: speakmore-relocatable-home
description: "issue #10 引出的目录可配置重构（10-20 定）：只留一个定位文件、整个 .speakmore 可装到别处并一键整体迁移，老版本要自动迁移；做完要多 agent 对抗审查加两台机器端到端"
metadata:
  node_type: memory
  type: project
  originSessionId: c790f439-dd17-4af4-a34b-18711867efb4
  modified: 2026-11-04T01:22:18.612Z
---

2026-10-20 用户定的（issue #10，已回复"第一条承接、第二条婉拒"）：

- **只留一个定位文件，其余全在 `<自选目录>/.speakmore` 下**：Mac `~/Library/Application Support/com.zephyrxiang.speakmore/location.json`（起初说 ~/.config，设计审查后改了：~/.config 常被 dotfiles 工具同步到别的电脑；也不放 0.1 的旧数据目录），Windows `%LOCALAPPDATA%\SpeakMore\location.json`。只为默认位置以外存在、只在明确选了位置时写（搬家、安装时选文件夹）；SPEAKMORE_HOME 只管这一次，从不写它。写死的路径全部拆掉，不用软链接（用户明确否掉了）。
- 只给一个根目录配置项，模型、缓存、安装位置不分开设。
- 入口：安装时可选位置（Setup.exe 第一次安装问一句、安装命令用 `SPEAKMORE_INSTALL_DIR`）、`speakmore move` 命令、App 设置里"存储位置 → 更改"。Mac、Windows 都做。
- 边界：目录在移动硬盘上没接时明确报错，不悄悄新建空目录；卸载时删定位文件。
- **向后兼容是硬要求**：老版本（含 0.10.0 以前）升级时自动走标准迁移，不能让老用户升级后用不了。
- **完成标准**：多 agent 对抗性审查（用户开了 ultracode，但说别起太多 agent、别打爆额度）＋ Mac 和 Windows 两台端到端（Windows 游戏电脑开着，可以随时测）。用户说，出一点差错 App 就起不来，要非常谨慎。
- 本地大模型润色已婉拒：不测、不打包、模型广场不收，用户自己用 vLLM/SGLang/Ollama 走自定义服务接。

- **已随 0.12.0 发布（10-20）**，#10 回复后关闭，两台用户真在用的都升上来了；分支已合并、删掉。之前的记录：分支 relocatable-home 做完——第一次安装时选位置（Mac App 对话框、install.sh/install.ps1 终端里问、Setup.exe 系统对话框）、`speakmore move`、App 设置"更改…"；审查一轮修了 26 条；两台端到端全过，三处系统对话框用户亲手点过。验证记录在 docs/development.md"验证到哪一步"。（发版经过见 [[speakmore-release-on-cos]]）

**Why:** Windows 用户想把模型（一个约 0.8 GB）和数据放到 C 盘以外，迁移时整体带走。
**How to apply:** 在 relocatable-home 分支上做；之后接着做 [[speakmore-hotkey-any-key]]。相关：[[speakmore-release-on-cos]]、[[update-e2e-isolation]]、[[refactor-surgical-clean]]。
