---
name: typeless-clone-gemini-key
description: 开发和评估时调模型的 key 经 scripts/dev/with-key.sh <gemini|openai|deepseek|bailian|moonshot|zhipu|minimax>（以脚本里的 case 为准） 加载，各家用哪把凭据写在本机配置 .machine.env；产品里的 key 由用户自己填
metadata:
  node_type: memory
  type: project
  originSessionId: abb1c590-5137-4efe-b88f-657a8192a95e
  modified: 2026-11-04T01:20:36.353Z
---

开发、端到端测试、跑评估脚本这类要真调模型的命令，一律写成 `scripts/dev/with-key.sh <gemini|openai> <命令…>`（路径从仓库根算；2026-10-13 以前叫 with-gemini-key.sh）。它读不进 git 的本机配置 `.machine.env`：用 `SECRETS_LOADER` 指的按需加载器，把 `GEMINI_CREDENTIAL` / `OPENAI_CREDENTIAL` 那把凭据只喂给这一条命令。环境里已经有那一家的 key（`GEMINI_API_KEY`、`OPENAI_API_KEY`）时它直接用。

**Why:** 用哪把凭据是用户点名选的：Gemini 那把是 2026-10-13 在本机几把里选的；OpenAI 那把用户同一天说"应该是一把用于实验的 key，就用它了"。每把有各自登记的用途范围，不能混用，所以 agent 不自己换别的。凭据名和加载器路径每台机器不一样，同一天用户要求把这些从仓库里抹掉、改成配置驱动，见 [[machine-facts-stay-local]]。

**How to apply:**
- 不要打印 key，不要写进文件，不要放进命令行参数。要确认它在不在，只看长度。
- 需要知道凭据名时读 `.machine.env`（里面只有名字和路径，没有密钥），不要去翻凭据目录。
- 给用户抄的命令也用这个脚本，不要让用户直接敲 `withkey`。加载器是 shell 函数，要先 source 才有，用户终端里同名的函数可能指向别处。2026-10-13 agent 给过不带 source 的命令，用户照抄后报"无此凭据"。
- 用户自己用产品时的 key 是亲手填进去的，那是另一份副本，由用户决定。agent 不替用户把 key 从凭据存放处搬进产品。

相关：[[typeless-clone-real-recordings-ok]]、[[skill-routing-general]]。

2026-10-16 加了阿里云百炼：`scripts/dev/with-key.sh bailian <命令>`，凭据里是 `BAILIAN_API_KEY`（另有 `DASHSCOPE_API_KEY` 引用同一个值，给百炼 CLI 和 DashScope SDK）。这把是用户为开发新建、让 agent 帮忙加的：用户复制到剪贴板，agent 用 `pbpaste` 管道直接写进凭据目录、只按计数核对格式、写完清空剪贴板，并登记在凭据目录的登记册里。以后再加 key 照这个做法，值不经过对话和终端。

2026-10-16 同一天又加了 Kimi 官方开放平台（国内站 api.moonshot.cn）：`scripts/dev/with-key.sh moonshot <命令>`，凭据里是 `MOONSHOT_API_KEY`，做法同上。加上后 `GET /v1/models` 返回 200，有 kimi-k3、kimi-k2.6、kimi-k2.7-code、kimi-k2.7-code-highspeed。
