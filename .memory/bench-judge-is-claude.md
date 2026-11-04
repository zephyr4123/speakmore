---
name: bench-judge-is-claude
description: 评测里的判官是 Claude 自己（协作的这个 agent），不用任何接进 App 的模型打分；Gemini 3.6 Flash 的成品只当参照
metadata:
  node_type: memory
  type: feedback
  originSessionId: abb1c590-5137-4efe-b88f-657a8192a95e
  modified: 2026-11-04T01:20:56.066Z
---

评测本地转写时，判官是 Claude 自己，分数由 Claude 来打。不要调 Gemini 或其他接进 App 的模型来打分。参照答案是 App 原生链路的成品：Gemini 3.6 Flash、思考档位 MINIMAL、用 App 的提示词。

用户 2026-10-16 的原话："这个判官不是任何一个接入的 API LLM，是你，是你 Claude Opus 5.5……你千万不要用 Gemini 3.6 Flash 去作为评分，它的识别结果只不过是可以当作一个参考标杆。"当时 agent 先写了一个调 Gemini 打分的判官，被用户当场纠正。

**Why:** 用户认为当前最强的模型最适合当判官；参照本身也是模型听出来的，会听错。
**How to apply:**
- 判分走 `bench/judge.mjs`：pending 导出一批待判的，agent 按 `bench/lib/stages/judge.mjs` 的评分标准逐格打分，写成 verdicts.jsonl，再用 record 存进结果库。不调接口。
- 参照可能听错，例如把同事的称呼写成了别的词、把"提测"写成"提车"。能看出转写才是原话时不扣分，在 note 里写"参照存疑"。几个模型各写各的、拿不准的（比如人名的同音字），两种写法都不扣分。录音里的人名、原话不写进记忆和提交说明（`.memory` 会公开）。
- 评分尺度要前后一致：错处都能从上下文猜回、而且不密，给 4 分；关键词（人名、英文术语、数字）错了又猜不回，给 3 分。尺度改了，就用 `pending --clips … --force` 把受影响的格子重判。

相关：[[speakmore-two-pipelines]]。
