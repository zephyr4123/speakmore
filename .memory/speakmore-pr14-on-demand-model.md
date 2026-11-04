---
name: speakmore-pr14-on-demand-model
description: "PR #14（外部贡献，本机转写模型按需装载）怎么收的、定了什么；Ollama 和 LM Studio 的空闲释放走 customParams"
metadata:
  node_type: memory
  type: project
  originSessionId: 4b3f4054-1581-427e-aaee-1842cfa6c5c8
  modified: 2026-11-04T01:21:48.436Z
---

PR #14（reverieach，fork 分支 fix/local-asr-idle-release，允许维护者改）2026-10-22 验证、审查、改完，推回贡献者 reverieach 的分支、在 PR 里留言说明后合并（872dde2），跟下个版本发。

用户定的：
- 自定义润色服务（Ollama / LM Studio）的空闲释放**不做**，删掉 PR 里那套：Ollama 0.35 起 `/v1/chat/completions` 认 `keep_alive`，LM Studio 认 `ttl`（秒），用户写进 customParams 就行（实测都生效，README 写了）。
- 本机转写的内存设置**合成一项** `localModelMemory`：resident / 1m / 5m / 10m / 30m，没发过版不迁移。
- 交付：推到贡献者的 PR 分支再在 PR 里合并（外部贡献照这个办，推之前先问）。

实现要点：空闲从页面最后一条消息起算（server 的 onActivity），整理和检查期间 busy 挡住；按需装载没装上不拦热键、下次开口再装；冷启动 Mac 0.4–5 秒、Windows 1.2–1.9 秒，悬浮条 20 秒等待不放宽。

本机验证用的 Ollama 装在 `.tools/ollama`（模型目录、家目录都在里面，端口 11435）；`ollama pull` 会因为代理的 198.18 假地址被它自己拦下，改从魔搭下 GGUF 再 `ollama create`。Windows 端到端：录音文件用 tar 经 ssh 传（scp 落不到预期位置），桌面任务的输出中文是乱码但能读。

相关：[[speakmore-release-on-cos]] [[acceptance-end-to-end]] [[one-review-round-is-enough]]
