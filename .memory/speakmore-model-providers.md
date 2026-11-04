---
name: speakmore-model-providers
description: SpeakMore 接哪家模型由用户点名；DeepSeek 因不收音频已放弃，OpenAI 已接（默认 gpt-audio-mini），通义 Qwen-Omni 是查过的候选
metadata:
  node_type: memory
  type: project
  originSessionId: abb1c590-5137-4efe-b88f-657a8192a95e
  modified: 2026-11-04T01:20:08.718Z
---

SpeakMore 的模型层是策略：每家一个适配器（`src/server/providers/`），整理流程各家共用。接哪家由用户点名，2026-10-13 的原话："我说要加哪个厂商你再加，不要加我没提过的。"

**Why:** 同一天用户先点了 DeepSeek。agent 查官方文档：DeepSeek 的对话接口只收文字、图片和文件（文件也只认图片），没有音频输入，也没有语音识别接口。用户说"不支持音频的话就不考虑它了"，让 agent 搜能收音频的。查到官方写明能"音频加提示词一次出成品"的有 OpenAI（gpt-audio 系列）和阿里通义（Qwen-Omni，有美国区，收 WAV、MP3、AAC 等，不收 Ogg/WebM）；用户选了先接 OpenAI，因为用户本机有一把实验用的 OpenAI key。

**How to apply:**
- 不主动加新厂商。用户提到某家时，先查官方文档确认它能不能收音频、收哪些格式，再动手；只能转写不能整理的要说清会变成两步、多一截延迟。
- 再提通义时，适配器可以照 OpenAI 的写（请求格式几乎一样），但它的地址按地区和工作空间变，要先问用户用哪个地区。
- OpenAI 默认用 gpt-audio-mini：同 6 段录音实测，gpt-audio-1.5 会把成品包成 JSON、偶尔回 500 "invalid content"。数字在 `docs/implementation-notes.md` 的"不止一家模型"。
- OpenAI 的提示词不拿成批录音评估，边用边调。用户 2026-10-13 的原话："相似度差不多就好,不用了,更多的是边用边调"。
- 发布包里不带 GPL、LGPL 的包，不开例外：同一天用户没让 codec-parser（LGPL，拆 Ogg 用）进发布包，所以服务端只把 WebM 转成 WAV，Ogg 不转。以后接不收 Opus 的厂商（比如通义）也只能从 WebM 转；要转 Ogg 得先找许可证合适的库或问用户。

相关：[[typeless-clone-gemini-key]]、[[typeless-clone-real-recordings-ok]]、[[typeless-clone-scope-dictation]]。
