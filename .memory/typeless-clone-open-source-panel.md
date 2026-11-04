---
name: typeless-clone-open-source-panel
description: 仿刻定名 SpeakMore，代码在仓库根；按开源标准打磨：一行命令安装并启动、装的和产生的东西全在 ~/.speakmore、能一次删干净；先做 CLI，桌面端 App 以后用 Electron 做（2026-10-14 从 Tauri 改过来）
metadata:
  node_type: memory
  type: project
  originSessionId: abb1c590-5137-4efe-b88f-657a8192a95e
  modified: 2026-11-04T01:19:36.744Z
---

Typeless 的仿刻定名 **SpeakMore**，代码就在仓库根（一个 npm 包，命令 `speakmore`：`bin/`、`src/`、`native/`、`test/`、`scripts/`）；逆向分析在 `targets/typeless/`。用户 2026-10-13 起的名，原话："给这个产品起个名,speakmore,和typeless反着来"。记忆文件名里的 "typeless-clone" 指的都是它。

现阶段的目标是达到能开源的标准。用户 2026-10-13 的原话：

> 目标就一个：开源的第一步，是让用户一行命令就能把整个项目拉起来。桌面端 App 的事可以先往后放，咱们桌面端 App 是用 Tauri 框架去做，那是之后的事。现在要做到的是：用户输一行命令，填写一下 Gemini 的密钥，这东西就可以用了。这相当于在上面封装一层，把这些启动流程都简化掉，它自己去找配置。

> 要先做成 CLI 驱动的方式。在这个 CLI 里可以启动、可以查看历史（就像 Typeless 一样），也可以看一些配置之类的。先把 CLI 系统搭起来，这是产品的第一步，之后再去做桌面端 App 的事。

同一天稍后用户把"一行命令"的标准又提了一层，原话：

> 需要彻底调整一下咱们这个项目的运行时状态，就是要像 Claude Code 一样，要把所有产生和需要配置的东西都放到同一个隔离环境里，像 .speakmore/。这样子它一下子就能装到对应的位置，而且之后如果需要删除，它也能一下子彻底删除干净。

> onboarding 要做好，不要让用户自己 npm，把这些 onboarding 流程都做好，让用户一行命令就能安装+启动，并且有安装的预检查，让用户有一个好的体验。以及要有环境隔离的思想，无论是 key、安装的包都在 .speakmore 之下，就像 claude code 一样。

**Why:** 上一轮做成了"打包成应用 + 设置窗口"，用户看过后把衡量标准换成"陌生人从仓库拿到就能跑起来"，并且认为当时只打包了客户端、不够彻底。

桌面端的框架后来改了：2026-10-14 用户确认 Typeless 的界面是 Electron 写的（应用包里带着 Electron Framework），原话："那就仿照它就行了呀。咱们的 GUI 也用 Electron 去做就行了，那简单很多了……咱们之后的桌面端 App 就用 Electron 去写"。这之前 agent 跟用户讲过：后台本来就是 Electron，菜单栏、悬浮条、设置窗口都长在它身上；另起一个 Tauri 要么和 Electron 并存（冗余），要么把录音、key 加密、菜单栏从 Electron 里拆出去。用 Electron 就是在现有后台上加主窗口，不用拆。

**How to apply:**

- 评判每个决定时问"一个刚拿到仓库的人，要几步才能说出第一句话"。安装步骤、报错、README 都按这个人写；自己照陌生人的路径真跑一遍（打成包装到别处、在伪终端里走第一次使用），2026-10-13 这样跑出了三个单看代码发现不了的问题。
- 一切落在 `~/.speakmore/` 一个目录里（程序 `bin/ app/ runtime/`，用户的东西 `settings.json <厂商>-key.bin data/`，运行时的 `logs/ run/ cache/`），布局定在 `src/storage/paths.mjs`。新加任何会落盘的东西都放进这里；非放在目录以外不可的（命令链接、钥匙串条目），要让 `speakmore uninstall` 删得掉，删不掉的要在卸载时照实列出来。往 `~/Library`、全局 npm、shell 配置文件里写东西都算走偏。
- 给用户的安装方式是 `curl … install.sh | bash`：预检查 → 下载校验 → 装好 → 直接启动。不要求用户有 Node、npm、Xcode（包里自带 Electron，命令行也拿它当 Node 跑）。让用户自己敲 `npm install`/`npm link` 的步骤只留给"从源码开发"那一节。发 npm 这条路因此不再走（agent 的判断：它会把程序装到 `.speakmore` 以外；用户没有单独说过"不发 npm"）。
- 入口现在仍是 `speakmore` 命令，新功能先想它在命令行里是什么样。桌面端 App 用 Electron，开始做时直接在现有的后台应用上加主窗口（参照原版的首页、历史、词典）；设置窗口、历史窗口是它的雏形，往里加东西不算走偏。窗口和命令行跟后台说话现在是两套接口（窗口走 Electron 的 IPC，命令行走控制通道），新功能两边都要时，核心逻辑放在一处、两套接口只做转达。
- 范围仍受 [[typeless-clone-scope-dictation]] 约束，只做语音转写。原版主窗口的三张截图（首页的统计、历史、词典）存在 `targets/typeless/_work/ui-reference/`，不进 git；词典还没做，它对应现在和原版差得最多的地方（专有名词听错），做之前问一句。
- 开源前用户定下的几件事：`.memory/` 保留并随项目迁移，工作习惯可以公开，逆向文档保留，本机情况改成配置驱动（[[machine-facts-stay-local]]），git 历史里泄露隐私的内容要抹掉。
- 仓库 2026-10-13 已公开，在 GitHub 上叫 `speakmore`（名字是用户定的；本地目录名没改，仍是 reverse-anything），许可证 MIT。公开前旧的私有仓库由用户本人删掉，改写过的历史推到了新仓库。
- 发布包不放 GitHub Release（用户嫌太慢），放用户腾讯云的 COS，经 CDN 域名 `dl.zephyrxiang.com/speakmore/` 取；以后官网的下载链接也从这里取。怎么发见 [[speakmore-release-on-cos]]。推标签、传文件和 push 一样是往外发东西，每次都要先问用户。
- 产品原来在 `speakmore/` 子目录里（克隆下来是 `speakmore/speakmore`），2026-10-13 用户同意后挪到了仓库根。仓库根现在既是 npm 包又放着逆向资料和协作文件：进 npm 包的东西靠 `package.json` 的 `files` 白名单，打 .app 靠 `scripts/build/package.mjs` 里只拷指定的几样，往这两处加东西时别把 `targets/`、`.memory/` 带进去。

相关：[[typeless-clone-as-real-product]]、[[typeless-clone-real-recordings-ok]]、[[typeless-clone-gemini-key]]。
