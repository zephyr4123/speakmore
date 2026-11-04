---
name: speakmore-windows-followups
description: Windows 版还没做的：命名管道防抢占（管理员权限起的 App 普通命令行连不上，10-19 真碰到过）、审查剩下的低危项、经典滚动条；用户那台的正式安装 10-19 升到 0.10.0
metadata:
  node_type: memory
  type: project
  originSessionId: abb1c590-5137-4efe-b88f-657a8192a95e
  modified: 2026-11-04T01:21:11.549Z
---

0.9.0（2026-10-17）发布时，Windows 版对抗性审查里还没处理的：

- **命名管道可被别的账户抢占**（审查 #3，中危）：打算改成只有当前用户读得到的随机管道名。
- 低危：本机模型加载到显卡没有超时；没有显卡的 Windows 也推荐 Q8 版；命令行有几处说法还写着 Mac；开始菜单快捷方式没带 AppUserModelID，从管理员终端装的话命令行连不上管道（EPERM）。
- 0.9.3（issue #5）已经做掉的：程序按版本放进 versions\、current 记着用哪个，不挪不覆盖文件；`.install.*`、SPEAKMORE_HOME 规范化、删不掉的交给后台重试都随之解决。审查后又加了：不装 0.9.3 以前的版本、同一家目录同时只装一个、下载不走 Invoke-WebRequest（内存峰值 1952 → 262 MB）、升级时改指任务栏和桌面上的快捷方式副本。端到端脚本在会话临时目录（issue5/e2e3.ps1），十个场景。
- 还剩：`test/models/store.test.mjs`、`test/storage/history.test.mjs` 在 Windows 上每跑一次在 %TEMP% 留一个 speakmore-models-*/speakmore-history-* 目录（各一个文件，10-18 清过一次）；开机启动在程序路径带空格时显示成关着（记在 docs/implementation-notes.md）；快捷方式目标每个版本都变，按 exe 路径记的设置（显卡偏好、着色器缓存）每次升级重来，根治要一个固定位置的小启动程序加 AppUserModelID。
- 2026-10-19 用户说"清理干净"后，开发机上以前会话留的东西都删了：探测和安装、卸载试验的目录与计划任务、旧发布包、npm/Electron 缓存、rae-probe 系列、快照、%TEMP% 里测试留的目录。speakmore-dev 里现在只剩开发脚本要用的 repo、home、desktop、三个日志和计划任务 speakmore-dev（win-desktop.sh 默认的那个）。之后验收用 JOB= 另起的目录和计划任务，验完当场删。
- **收尾清理**（等 Windows 开发告一段落）：删掉开发机上的 speakmore-dev 目录和所有 speakmore-dev 开头的计划任务，关掉本机到开发机的 SSH 隧道（端口 19333）。

- **10-19 升级用户游戏电脑上的正式安装时碰到的**：那台装的是 0.9.0（不是 0.9.3），用 `speakmore update` 升到 0.10.0。升级是经 win-desktop.sh 的计划任务跑的，SSH 登录拿的是管理员令牌，它打开的 App 也是管理员权限（High）。用户在普通权限的 PowerShell 里跑命令行，连管道报 `connect EPERM`。从 SSH 停掉 App、用户自己用 `speakmore` 重新打开后（Medium）就好了。所以用户真在用的那份，升级和打开都让用户自己在普通终端里做，不经计划任务。根治就是上面的管道防抢占：建管道时显式给当前用户访问权限，不靠默认 DACL。
- 发版前在游戏电脑上看到的：整个 App 能滚动的地方都是系统经典滚动条（灰条带箭头），App 里从没设过滚动条样式，0.9.0 起就这样，用户还没说要不要改。

**Why:** 发版前用户要先上线，这些留到之后做；开发机是用户的真机，不能留垃圾。
**How to apply:** 用户提 Windows 相关的活时先看这里；在用户的 Windows 桌面会话里跑东西前先问（之前被拒过一次）。相关：[[speakmore-release-on-cos]]。
