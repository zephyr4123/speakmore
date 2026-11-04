---
name: ui-review-in-dev-window
description: 改界面时从源码起一个隔离的 App 给用户看，做完不关；用户直接在开发窗口上提意见，不用打包
metadata:
  node_type: memory
  type: feedback
  originSessionId: abb1c590-5137-4efe-b88f-657a8192a95e
  modified: 2026-11-04T01:20:45.417Z
---

改桌面端界面（主窗口的页面、样式）时，验完不要把测试用的窗口关掉：从源码起的那个隔离 App 留着，用户直接在上面看。2026-10-21 用户原话："你做完验证完之后不要把测试用的页面给撤了，我直接在你开发的页面上直接看，不用打包给我再看，这样反馈快一些"。

**Why:** 打包、安装一轮要好几分钟，用户想边看边提意见，反馈越快越好。

**How to apply:** 用隔离家目录（SPEAKMORE_HOME 设成 /tmp 下的短路径，热键换成正式版不用的那个，开发用的 key 经 scripts/dev/with-key.sh 进环境，本机模型用 `cp -c` 克隆一份）起 `node_modules/.bin/electron . --remote-debugging-port=9333`，再起一次同样的命令就会打开主窗口；改完代码用调试协议的 Page.reload 刷新，停在改的那一页。收尾时告诉用户窗口在哪、热键是哪个。验证照旧照 [[desktop-copy-and-look]] 在真窗口里逐个查。
