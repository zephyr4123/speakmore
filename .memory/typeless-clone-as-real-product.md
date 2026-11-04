---
name: typeless-clone-as-real-product
description: 仿刻（SpeakMore）要按真实产品的标准打磨，启动方式等从用户层面考虑，不再当玩具对待
metadata:
  node_type: memory
  type: feedback
  originSessionId: abb1c590-5137-4efe-b88f-657a8192a95e
  modified: 2026-11-04T01:21:44.869Z
---

Typeless 仿刻要当成一个真实的产品去打磨。用户 2026-10-13 真机试用成功后的原话："服务端和客户端的启动方式，咱们也要从产品和用户的层面去打磨，把它当成一个真实的产品去做"。

**Why:** 第一版做出来时定位是"学习用的玩具"，启动要开两个终端各敲一条命令，其中一条 agent 还给错过。真机一试，用户认为速度和整理效果"达到了预想中根本没想到的高度"，于是把标准提高了。

**How to apply:** 之后给仿刻做决定时按"一个不懂内部结构的人怎么用它"来想：怎么启动、怎么知道它在不在运行、出错时看到什么、权限怎么引导。不要再用"玩具阶段可以不要"当理由省掉面向用户的环节。启动方式在 2026-10-13 按这个标准改了两轮，现在是一个 `speakmore` 命令（见 [[typeless-clone-open-source-panel]]）；再告诉用户怎么启动时以仓库根 `README.md` 的"装和用"为准，不要再给开两个终端的命令。范围没有变，仍然只做语音转写（[[typeless-clone-scope-dictation]]）；"哪些环节算面向用户"是 agent 的理解，拿不准时问一句。相关：[[typeless-clone-real-recordings-ok]]。
