---
name: github-account-check
description: 每次 GitHub 操作前用 scripts/checks/check-gh-account.sh 核对激活账号；本项目该用哪个账号写在本机配置 .machine.env
metadata:
  node_type: memory
  type: feedback
  originSessionId: 6b5e9ce5-00ff-48cc-99ba-a927306fc7c3
  modified: 2026-11-04T01:22:59.469Z
---

每次做 GitHub 操作前，先核对 `gh` 当前激活的账号是不是本项目该用的那个：`scripts/checks/check-gh-account.sh && <操作>`。该用哪个账号写在不进 git 的 `.machine.env` 里（`GITHUB_ACCOUNT`），不对时脚本会拦下并给出切换命令。

**Why:** 用户 2026-10-12 的要求。一台机器上可能登录了不止一个 GitHub 账号，而 gh 的"激活账号"是整台机器共享的状态，用户平时同时开多个会话，别的会话一操作就可能把它切走。git 远端走 https 时凭据也取自 gh 的激活账号，所以切错了不只是 `gh` 命令建错地方，`git push` 也会带错身份。

**How to apply:**
- 范围：所有碰 GitHub 的动作，包括 `gh repo / pr / issue / api …`，以及对 github.com 远端的 `git push / pull / fetch / clone`。
- 核对要紧挨着操作做，写在同一条命令里，不要沿用会话开头查过的结果，中间随时可能被别的会话切走。
- 一次只接一个 gh 写操作：`check && 操作A && 操作B` 也会在两步之间被切走。2026-10-18 回 #6、#7 时就是这样，#6 发出去了，#7 报 Enterprise Managed User 无权限，重新核对后单独发才成功。
- 建仓库、建 PR 这类带归属的操作，显式写全 `<账号>/<仓库名>`，账号不对时会直接报错而不是悄悄建到别处。
- 机器上另有自动切号的钩子时，它只是兜底，不替代这一步。

相关：[[machine-facts-stay-local]]。
