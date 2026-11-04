---
name: speakmore-two-pipelines
description: 识别分三种平级的模式让用户选：native（音频直接给能收音频的模型）、local（本机或云端转写再交任意 API 润色）、private（数据隐私，只用本机模型转写、什么都不上传、不要 key），严格状态机；本地模型不替用户选
metadata:
  node_type: memory
  type: project
  originSessionId: 6b5e9ce5-00ff-48cc-99ba-a927306fc7c3
  modified: 2026-11-04T01:19:56.400Z
---

2026-10-16 用户定的方向。宣传片发出后，小红书和抖音上催更的主要是两件事：Windows 适配，以及能接更多 API。用户的判断是：现在把音频直接发给大模型，只有千问、OpenAI、Gemini 收音频，没法接所有 API；所以另开一条链路，先用本地小模型转写，再把文字交给任意 API 润色。

用户原话："这两条是截然不同的路，地位必须平级、并行，谁也不能覆盖谁，优先级没有高低之分。"

**Why:** 让只有纯文字 API 的用户也能用，同时不牺牲原生链路。
**How to apply:**
- 两条链路平级，由用户在设置里选。不做"原生失败就退到本地"这类主次关系，也不把一条写成另一条的特例。
- 先搭识别内核的两条链路，Windows 外壳之后再做。用户说内核搭好后，外壳适配比较简单。
- 评测在 `bench/`（说明见 bench/README.md），用实测数据来选模型；判官是 Claude 自己，见 [[bench-judge-is-claude]]。
- 第一轮评测结果（2026-10-16，97 条真实录音，共 42.5 分钟，判官是 Claude，本机是 Apple 芯片）：
  - Qwen3-ASR 0.6B Q8 走 transcribe.cpp 加 Metal 最准：均分 4.14，每条 p50 231 ms、p90 731 ms，内存 2.0 GB。同一个文件只用 CPU 时一样准，但 p50 1.06 s、p90 3.5 s，内存 4.5 GB。
  - SenseVoice Q8 加 Metal 最快：均分 3.94，p50 73 ms，内存 1.2 GB。纯中文和 Qwen3 差不多，弱在英文词（中英夹杂 3.51 对 4.02）。
  - sherpa-onnx 的 Qwen3 int8 有两个坑：导出时 KV 缓存定死 512，要按 20 秒分段；有一段输入会输出乱码。
  - 原生链路（Gemini 一步到成品）整条 p50 4.0 s。
  - 用户的室友说"0.6B 很慢"：只用 CPU 时确实慢，用 Metal 后快 4 到 5 倍。
- 2026-10-16 实现成两种"模式"（设置项 `mode`：`native` / `local`），按用户要求分层、严格状态机：模型只能在它那种模式里换（`speakmore model` 只管 native；`transcriber`、`polish` 只管 local 的两跳），不在那种模式里换就报错；切模式可以连带那种模式自己的设置。内核在 `src/app/modes.mjs`，App 设置页和命令行都走它。
- 2026-10-17 改了切换的规矩（用户在 Windows 上走引导时卡死：刚装好是原生 + Gemini、没 key，想切数据隐私要等模型下完，哪种都切不过去，按热键一直说缺 Gemini 的 key；用户问"状态机是不是要做减法"）：**选哪种是用户的事，能不能用是状态，两件事分开**。切模式、换模型当场生效、写进设置，不先验 key、不等下载（`keys.switchRoute`、`service.setRoute`），只拦写错的；还差的 key、下载记在状态里，横幅和引导照实说并带去补的按钮，下好了服务自己装上。`app/pending-switch.mjs` 那个"等下载完再切"的补丁删了。别再把"验过才换"加回来。
- `speakmore config set` 不经过状态机：2026-10-16 用户同意按 agent 的建议留作手动改设置的后门，只在改模式管的几项时提示平时用哪个命令、写的是另一种模式的设置时说切过去才用上。别再把它收进状态机。
- 端到端（[[speakmore-model-mirror]] 里也记了下载速度）：local 模式 Qwen3 Q8 + DeepSeek flash，松开到出字 1.2–1.75 s，转写不到 0.7 s，大头是润色请求。记录在 `bench/results/e2e-local-2026-10-16.md`。
- 2026-10-16 用户在自己电脑上用 local（Qwen3-ASR Q8 + DeepSeek flash）实际听写后说："效果比原生 Gemini 的还好，这个是让我比较震惊的一个事"。两种模式仍然平级，不因此把 local 设成默认；但写宣传、README 时可以引用这条真实反馈。
- 0.7.1（2026-10-16 已发）：本机模型由用户点了才下；每个模型（原生、润色、本机）都能"检查"，本机的是用系统朗读念一句交给它转；用量按模型分开，本机转写那一跳也记一笔（provider 是 local，不花钱）。
- 不替用户选模型，做成模型广场、按实测打标签，见 [[speakmore-model-plaza]]。
- 本地模型的调研（2026-10-16）：首选 Qwen3-ASR-0.6B（Apache-2.0，Q8 约 0.8 GB，FLEURS 普通话 CER 7.57%）；轻量备选 SenseVoice-Small（约 0.24 GB，CER 10.12%，许可证是 FunASR 自定义的）。运行库可选 sherpa-onnx-node（Apache-2.0）或 transcribe-cpp（MIT），两者在 npm 上都有 Mac 两种芯片和 Windows 的预编译包。榜单是朗读语音，中英夹杂的口述没有公开数字，要用真录音实测。
- 长录音对比（2026-10-16，用户点名要测）：三条 Typeless 长录音（113、170、172 秒）加一条 SpeakMore 自己的（136 秒）。local 5 次全都完整；原生在那条 136 秒的上截断 2/11（算上 10-15 用户自己碰到的那次），回的是 STOP、只出 11 个 token，停在开头第一个 1.4 秒的停顿处。代码信任 STOP，所以没拦下来。社区也有"STOP 不代表完整"的报告。成品质量 agent 交叉比了三家（没有标准答案）：Typeless 最好（会分点、会精简）；local 中文准、口头禅清得比原生干净，但中英夹杂的英文词容易听错（pipeline→platform、Agent as a Judge→AI judge）；原生英文词准，但会有中文同音错字（V4.1→V2.1、口子→扣子）。花费 local 约是原生的 1/18；两分多钟的长录音两边耗时差不多（5–6 秒），local 的速度优势只在短句上明显。用 ffmpeg 把 Typeless 的 Ogg 换封装成 WebM 后，解码会变得很慢（172 秒要 12 秒）；App 自己录的 136 秒只要 0.27 秒。这只影响测试，不是产品的问题。
- 润色提示词 2026-10-16 调过（记录在 docs/implementation-notes.md）：精简成几条原则反而更差，例子不是束缚；只合了"分点写重、加一个步骤例子"那版。用户的决定：**润色不开思考**（原话"一定不打开思考，一定不做，速度优先"）；和 Typeless 的差距是模型和价钱的差距，接受（"用这么点钱……能达到这样已经很满意了"），不再往下调。
- 待办，用户说先不做：截断检查。原生是 Gemini 返回 STOP 却只出了半句；润色那一跳 DeepSeek 也出过一次。local 可以用"成品比原文短太多"来判断，原生用"字数和有声时长对不上"来判断，查出来就重发一次。

相关：[[speakmore-model-providers]]、[[typeless-clone-open-source-panel]]、[[typeless-clone-scope-dictation]]。
- 2026-10-17 加第三种模式 private（界面叫"数据隐私"）：有人反馈要纯本地、没有任何上传的。只用本机模型转写，原文直接交出，不润色、不要 key。设置 `privateTranscriber`（SPEAKMORE_PRIVATE_TRANSCRIBER），只认本机模型，和 local 的第一跳分开存；`speakmore mode private`，`speakmore transcriber` 在 private 里换它的那一项；key 状态是 ready、source none，存 key 要写明哪一家。用户说之后再往外扩：把更多小模型放到 COS 上给用户下。

- **2026-10-22 起名不许带优劣**：agent 给三种方式配了“最准 · 费用较高”“便宜”这类取舍，用户说“这个你可别乱打标签啊”。用户的依据：
  - 两步那条（本机 Qwen3 0.6B Q8 加 DeepSeek 或任一 LLM）效果很好、最快，Windows 有显卡时几乎秒出。
  - 一步那条里两家是国外 API，对国内用户几乎致命；国内能收音频的又比较蠢。
  - 所以名字不能落在过程上，也不能落在优劣上。用户要直观的短名，举的例子是“混合”“直出”“local”，或 high/low/medium 这类。
  - **How to apply**：方式的名字和说明只写事实（音频、文字发到哪、要不要密钥、支不支持翻译），不写准不准、贵不贵，排名式的名字也不用。
