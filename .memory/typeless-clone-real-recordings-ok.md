---
name: typeless-clone-real-recordings-ok
description: 用户同意用自己的真实录音（Typeless 历史、SpeakMore 自己的）调提示词、测模型；2026-10-16 起发给任何云端厂商都不用再问
metadata:
  node_type: memory
  type: project
  originSessionId: abb1c590-5137-4efe-b88f-657a8192a95e
  modified: 2026-11-04T01:20:22.454Z
---

可以用用户本机 Typeless 的真实历史录音来调仿刻的提示词。用户 2026-10-13 的原话："我们开始使用 Typeless 的真实录音去调一下 prompt"。

**Why:** 在这之前 agent 问过两次能不能抽历史录音发给 Gemini 做对比，用户没有回答，所以提示词只用系统朗读的合成语音测过。合成语音测不出真实口音下的效果，也看不出原版的格式习惯。

**How to apply:** 录音在 `~/Library/Application Support/Typeless/Recordings/`，对应的原版成品在同目录 `typeless.db` 的 `history_v2.refined_text`，可以当参照答案。发给 Gemini 时用 [[typeless-clone-gemini-key]] 那把 key。这个同意只针对"调仿刻的提示词"这个用途，而且只发给 Gemini。2026-10-13 问过要不要发给 OpenAI 调它的提示词，用户说不用、边用边调（[[speakmore-model-providers]]）；那天对比 OpenAI 模型时只用了 SpeakMore 自己的 6 段测试录音（`~/.speakmore/data/Recordings/`），这几段已经发给过 OpenAI。别的厂商也照此先问。录音和成品文字是用户说过的话，不进 git、不抄进文档，放 `targets/typeless/_work/`。用户点名要先解决的格式（换行、分点）已在 2026-10-13 调过一轮，结果在 `docs/implementation-notes.md` 的"用真实录音调过之后"。再调提示词时用 `scripts/dev/eval-prompt.mjs`：它固定用同一批 60 条录音（清单在 `targets/typeless/_work/prompt-eval/samples.json`），先用 `--label` 跑一遍现状当基线，改完再跑一遍对比，同一版本至少跑两遍，因为模型每次结果有出入。不要把 temperature 设回 0，实测那样写坏的成品会多一倍。相关：[[typeless-clone-scope-dictation]]、[[typeless-clone-as-real-product]]。

2026-10-16 用户点名让 agent 用 Typeless 的长录音测 local 链路，并和 Typeless 的成品对比。录音只在本机转写，转出的文字交给 DeepSeek 润色；同一批录音也发给了 Gemini（原生链路）。工作文件在 `targets/typeless/_work/longclip/`。

**2026-10-16 起不用再问：** 跑百炼的模型前 agent 问能不能把录音发给阿里云，用户原话"我不在意隐私的问题，发给阿里云是我同意的，你就不要再提这个事了。反正调 API 都已经调云端了……不要再问我了"。所以开发、测试时把用户的录音（SpeakMore 自己的、Typeless 的都算）发给任何要接的云端模型厂商都不用再问，直接用；只是录音和转出的文字照旧不进 git、不抄进文档。
