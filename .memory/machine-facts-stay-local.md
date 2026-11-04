---
name: machine-facts-stay-local
description: 本机的凭据名、加载器路径、账号、目录布局、姓名邮箱都不写进仓库；仓库里只认 .machine.env 的变量名，提交前用脚本查
metadata:
  node_type: memory
  type: feedback
  originSessionId: abb1c590-5137-4efe-b88f-657a8192a95e
  modified: 2026-11-04T01:22:29.358Z
---

这个仓库要开源。本机特有的东西，包括凭据叫什么、加载器在哪、登录了哪些账号、目录怎么摆、shell 配置长什么样、用户的姓名邮箱和公司，一律不写进会进 git 的文件。记忆、文档、脚本、提交信息都算。要用到时走配置：值写在不进 git 的 `.machine.env`，仓库里只出现变量名（`SECRETS_LOADER`、`GEMINI_CREDENTIAL`、`GITHUB_ACCOUNT`），样板是 `.machine.env.example`。

**Why:** 用户 2026-10-13 开源前的要求，原话："咱们要抹掉本机的凭据名，这个东西要做成配置驱动。每个用户的凭据名不一样，但要能够立马直接读取到，又不会暴露出我真实的电脑情况。"同一天为此重写过一次 git 历史。用户同时说明：记忆要保留并随项目迁移，工作习惯可以公开，逆向分析文档可以公开。

**How to apply:**
- 写记忆时，机器相关的事实只写"在 `.machine.env` 的哪个变量里"，不写值。引用用户的原话时，原话里带这类名字的，换成变量名并说明换过。
- 新增一项因机器而异的配置时，同时改 `.machine.env.example` 和读它的脚本，不在别处写死。
- 提交前跑 `scripts/checks/check-no-machine-facts.sh`，它拿 `.machine.env` 里的值、本机用户名和家目录、全局 git 邮箱去查会进 git 的文件和提交信息，有命中就不通过。
- 本仓库的提交邮箱已设成 GitHub 的匿名邮箱，是仓库本地配置，没有动全局。重新克隆后要再设一次，上面的脚本会查出来。

相关：[[typeless-clone-gemini-key]]、[[github-account-check]]。
