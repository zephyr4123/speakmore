---
name: cloud-changes-user-runs
description: 证书、CDN、DNS 解析、发版公证这类对外改动会被权限拦下，写成能自己挂后台的脚本或命令给用户跑；给的命令单独一行、越短越好
metadata:
  node_type: memory
  type: feedback
  originSessionId: abb1c590-5137-4efe-b88f-657a8192a95e
  modified: 2026-11-04T01:21:32.890Z
---

2026-10-16 配模型国内源时，申请证书、加 CDN 域名、加解析被自动模式拦了。用户说："cdn/证书/dns解析相关的给我命令,我来跑……给我的这个命令要能挂在后台,而不是阻塞你"。

**Why:** 这类改动要用户点头；用户跑的时候不想等，agent 也不该停下来等。头两次 agent 给的命令用户没看到（夹在工具调用中间），第三次那行长命令粘贴时被换行断开，报 parse error。

**How to apply:**
- 脚本写进 scratchpad，自己挂到后台（检测到没在后台就 `nohup` 重新拉起自己），日志写到同目录。这样用户只需粘一个路径，没有空格、不会被换行断开。
- 命令放在回复的最后、单独一个代码块，前面加 `!`。给完就停下，等用户跑起来再接着做别的。
- 每一步先查有没有，重跑不重复建。bash 里变量后面紧跟中文要写成 `${var}`，不然会被当成变量名的一部分。
- 用 `tail -f` 盯日志的监视不会自己退出：看到"全部完成"就马上停掉，用户问过"为啥你一直不退出来"。
- 只读的查询（DescribeXxx）可以自己跑。相关：[[speakmore-model-mirror]]。
- 发版同理：2026-10-16 本机跑 `npm run release`（要把应用传给苹果公证）也被拦了。发版前 agent 能做的是本机只签名不公证地打包（`MAC_NOTARY_PROFILE= npm run dist`）验证，打标签、push、`npm run ship` 等用户点头后由用户跑，见 [[speakmore-release-on-cos]]。
