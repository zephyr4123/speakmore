---
name: speakmore-pr17-bailian-no-words
description: "PR #17（外部贡献）百炼转写没认出字回 400，10-24 合并并补成\"当空原文\"，随 0.17.1 发布；智谱、MiniMax、OpenAI 的静音检测真 key 测过都正常"
metadata:
  node_type: memory
  type: project
  originSessionId: abb1c590-5137-4efe-b88f-657a8192a95e
  modified: 2026-11-04T01:22:58.523Z
---

2026-10-24 合并外部 PR #17，同一天随 0.17.1 发布。

- **问题：** 百炼的 qwen-audio-3.1、qwen-audio-3.0、fun-asr 没认出字（静音、只有杂音）时不回空原文，回 400 CLIENT_ERROR "ASR_RESPONSE_HAVE_NO_WORDS"。验 key 用的就是静音，所以检测失败，热键录不了音。qwen3-asr-flash 不受影响，它会回"。"。
- **PR 的改法：** 只在验 key 时接受这条回话。
- **本项目补的（8b4fba4）：** 挪到百炼接口那一层统一当成空原文。这样按了热键没说话时也报"没有听到声音"，不再报百炼拒绝了请求。
- **已用真 key 验过的：** 百炼四个转写型号检测都通过、杂音交出空文字、真录音照常转写；智谱 glm-asr-2512、MiniMax asr-1.0 检测通过、真录音照常转写；这几家加上 OpenAI 和百炼音频直出，错的 key 都报 401。
- **顺带看到的：** 智谱对 2 秒合成杂音回了一个"#"，别家是空的。只拿合成杂音试过，真环境噪声会不会这样、润色后会不会贴出去，未验证。
- **回复：** 已在 PR 下回了作者，PR 合并时自动关了。发版后不用再回。

相关：[[speakmore-pr14-on-demand-model]]、[[typeless-clone-gemini-key]]。
