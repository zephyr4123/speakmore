---
name: update-e2e-isolation
description: 真机测更新时要钉住 SPEAKMORE_APP 和 SPEAKMORE_BIN_DIR；临时签名的 SpeakMore.app 被 open 打开会弹麦克风授权，可能覆盖正式版的授权；Windows 上 install.ps1 会改开始菜单快捷方式和 Path
metadata:
  node_type: memory
  type: project
  originSessionId: 6b5e9ce5-00ff-48cc-99ba-a927306fc7c3
  modified: 2026-11-04T01:21:41.340Z
---

0.10.1 起更新在内核里（src/update），App 和命令行共用。真机测更新时容易碰到用户真在用的那一份，2026-10-19 踩过：

- **Mac 一定钉住 `SPEAKMORE_APP`**：不钉的话找 App 会落到 /Applications 里真的那个，测试家目录的更新会想把它也换掉。那次被"开发者不同"的核对挡住了，没动到。
- **一定钉住 `SPEAKMORE_BIN_DIR`**：用户有终端安装，~/.local/bin/speakmore 指着真的家目录，安装脚本会把它改指过去。
- **临时签名的 SpeakMore.app 被 `open` 打开时，系统当成新应用**，会弹麦克风授权。应用标识和正式版一样，用户点了允许以后，正式版的麦克风授权可能被覆盖，下次听写会再问一次。所以 App 那条路径要么只在发版前测一次，要么用命令行、App 不在跑的方式测。直接从 shell 执行 App 里的程序不会弹，因为权限算在终端头上。
- **Windows 上 install.ps1 会改写开始菜单的「SpeakMore」快捷方式，并往用户 Path 里加一项**，名字是固定的。测之前先备份，测完还原；脚本在会话临时目录的 e2e/win 下，有 prepare、start-app、restore 三个。
- 测试发布包（0.11.0 起的按块摆法）：版本号临时改成 `0.11.0-e2e.N` 这类预发号（install.sh 只认 0.11.0 及以上，预发号比正式版旧），`MAC_SIGNING_IDENTITY= MAC_NOTARY_PROFILE= node scripts/release/release.mjs` 不签名不公证也出 App 的清单；打两个版本，用前一个装、后一个当下载地址（`SPEAKMORE_INSTALL_BASE`）测更新。打包期间别 `git add -A`：10-19 就这样把临时版本号提交进去过一次。
- **Windows 换用户目录做隔离（10-20）**：把 `USERPROFILE`、`LOCALAPPDATA`、`APPDATA` 换成临时目录前，先在里面建好 `AppData\Roaming\Microsoft\Windows\Start Menu\Programs` 和 `Desktop`：`[Environment]::GetFolderPath` 照 `%USERPROFILE%` 展开、目录在才交回，不建的话 install.ps1 建快捷方式那一步报空路径；建了以后快捷方式落在假目录里，真的不用备份（用户 Path 还是真的，照旧备份还原）。
- **写给 Windows PowerShell 5.1 的测试脚本要带 BOM**：不带的话按 GBK 读，中文注释会吞掉换行，下一行跟着成了注释（10-20 还原脚本因此没还原 Path）。
- **照 `irm | iex` 在同一作用域里跑 install.ps1**：它的 `$script:Base` 这些会盖掉测试脚本里同名的变量（PowerShell 变量名不分大小写），测试脚本的变量起个不会撞的名字。
- **从会话里传脚本给 Windows（10-21）**：`scripts/dev/win.sh` 把整段脚本塞进一条命令，过了 cmd 约 8000 字符的上限就报"命令行太长"，长脚本走 `win-desktop.sh`（它按文件传）。自己在 zsh 里写 scp 时目标写成 `"${WIN_SSH_TARGET}:路径"`：不加花括号的 `$WIN_SSH_TARGET:s…` 会被 zsh 当成修饰符，文件没传过去，反倒在本地生成名字里带账号和 IP 的文件。
- 测试起的 App 用了假的用户目录，搜狗输入法会往里写日志并一直开着，那几个文件要等它退出才删得掉。
- Mac 上从 shell 直接执行测试 App 时，连 `CFFIXED_USER_HOME` 一起换成假目录，不然偏好设置写进真的；执行过的 App 会登记进 LaunchServices，删之前 `lsregister -u` 注销。
- Mac 的测试家目录用短路径，别带 `//`：install.sh 要比对拼好的目录在不在家目录里（10-19 查出过 a//b 比不上的毛病，已修）。

**Why:** 第一次跑时差点去换用户 /Applications 里的 App，用户的 PATH 链接、开始菜单、麦克风授权也都是真的。
**How to apply:** 发版前真机测更新时，照 [[speakmore-release-on-cos]] 打本机测试包，环境变量先钉住再起 App；碰 Windows 桌面会话前照 [[speakmore-windows-followups]] 先问用户。
