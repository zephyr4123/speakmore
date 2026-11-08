// 简体中文文案。结构和 en.js 一一对应（test/i18n.test.mjs 会查）。写法和出处的要求见 en.js 开头。
// 大标题行尾不加标点：两行字的重心靠位置和深浅分，标点挂在行尾会把重心拉偏

export default {
  meta: {
    title: "SpeakMore — 口述成文，划词即译",
    description:
      "语音输入、语音翻译、划词翻译，各由一个快捷键唤起。开源免费，支持 Mac 与 Windows；模型、识别方式与费用自选。",
  },
  nav: {
    trio: "功能",
    ways: "识别方式",
    speed: "性能",
    models: "模型",
    privacy: "隐私",
    developers: "开发者",
    download: "下载",
    github: "SpeakMore 的 GitHub 仓库",
    home: "SpeakMore 首页",
  },
  hero: {
    title: "口述成文，划词即译",
    // 手机上不在「Windows／上的」之间折：那里用不换行的空格，{wbr} 是可以折的地方（Hero.jsx 换成 <wbr>）
    lead: "Mac 与 Windows\u00a0上的{wbr}语音输入与翻译，开源免费",
    shotAlt: "SpeakMore 主窗口首页：三项功能的快捷键、字数、省时、语速与每日热力图，右上角为当前识别方式",
    barAlt: "口述时的悬浮条：左侧取消，中间为随语音起伏的声波，右侧完成",
  },
  // 快捷键的写法：Mac 和 Windows 的右侧那个键名字不同，按访客的系统显示
  keys: { alt: { mac: "右 ⌥", windows: "右 Alt" }, space: "空格", enter: "回车" },
  trio: {
    label: "三项功能",
    items: [
      { id: "demo", chord: ["alt"], name: "语音输入", text: "口述，整理后写入光标处" },
      { id: "translate", chord: ["alt", "space"], name: "语音翻译", text: "说一种语言，写出另一种" },
      { id: "lookup", chord: ["alt", "enter"], name: "划词翻译", text: "选中文字，译文显示在下方" },
    ],
  },
  demo: {
    title: "口述随意\n成文规整",
    said: "口述原话",
    written: "整理结果",
    examples: [
      {
        label: "去除口癖",
        said: "~~嗯，那个，~~我们后天开会吧，~~呃，~~记得把~~，把上周的数据带上。哦不对，是~~上个月的。",
        written: "我们后天开会吧，记得把上个月的数据带上",
      },
      {
        label: "整理条目",
        said: "明天要做三件事，~~第一个是~~改一下 README，~~第二个是~~发 0.6.2，~~然后第三个，嗯，就是~~把官网更新一下。",
        written: "明天要做三件事：\n\n1. 改一下 README\n2. 发 0.6.2\n3. 把官网更新一下",
      },
    ],
  },
  // 语音翻译的演示：群聊里回外国同事一句。口述和译文是 App 的真实输出（混合方式，DeepSeek V4.1 Flash）
  translate: {
    // 两项并列，不分先后：单色（两色只给"先铺垫、后落点"的句子，Section.jsx 的 Inline）
    title: "开口即译，语言任选",
    chat: {
      contact: "Emma",
      incoming: "Could you send me the revised schedule this week?",
      said: "~~嗯，~~好的，~~那个，~~修改后的时间表我周五之前发给你，~~呃，~~有问题随时找我。",
      written: "OK, I'll send you the revised schedule by Friday. Let me know if you have any questions.",
      saidLabel: "口述 · 中文",
      chip: "英文",
      placeholder: "输入消息",
      alt: "群聊中，Emma 用英文询问时间表；中文口述后，英文回复直接写入输入框",
    },
    points: [
      { title: "16 种目标语言", text: "设置中预设多种，口述时在悬浮条上临时切换。" },
      { title: "先整理，再翻译", text: "语气词与改口不进入译文，原文一并记入历史。" },
      { title: "1.3 秒成译", text: "混合方式的模型耗时中位数；直出 2.6 秒。" },
    ],
  },
  // 划词翻译：三张真截图（README 那批，在 Mac 上截的，name 是 docs/media.json 里的名字），中英文各用自己语言的那几张。
  // 第一张放大，后两张并排
  lookup: {
    title: "网页、PDF、终端\n划词即译",
    shots: [
      { name: "lookup-web", caption: "网页", alt: "在 arXiv 网页中选中一段英文摘要，选区下方的卡片显示中文译文" },
      { name: "lookup-pdf", caption: "PDF", alt: "在 PDF 中选中一段英文，卡片显示中文译文" },
      { name: "lookup-terminal", caption: "终端", alt: "在终端中选中 git help push 的英文说明，卡片显示中文译文" },
    ],
    points: [
      { title: "无需插件", text: "任意应用中选中即可翻译。" },
      { title: "不抢焦点", text: "卡片上可复制、换语言、固定。" },
      { title: "约 0.9 秒", text: "默认使用 DeepSeek V4.1 Flash。" },
    ],
  },
  models: {
    title: "主流模型\n任意接入",
    loopLabel: "可接入的模型",
    vendors: {
      gemini: "Google Gemini",
      openai: "OpenAI",
      qwen: "通义千问",
      bailian: "阿里云百炼",
      deepseek: "DeepSeek",
      kimi: "Kimi",
      zhipu: "智谱",
      minimax: "MiniMax",
      funaudiollm: "SenseVoice",
      custom: "自定义服务",
    },
    points: [
      { title: "密钥自备", text: "按平台加密存于本机，三项功能共用。" },
      { title: "实测标注", text: "评测过的模型标出得分。" },
      { title: "划词另选", text: "划词翻译单独选择文字模型，与语音互不影响。" },
    ],
    shotAlt: "引擎页：整理一步展开到 DeepSeek，详情中为渠道、价格与检测",
  },
  ways: {
    // "按需切换"是附带的一句，重音不该落在它上面：单色
    title: "三种识别方式，按需切换",
    lanes: { cloud: "云端", device: "本机", offline: "不联网" },
    items: [
      {
        id: "native",
        name: "直出",
        text: "录音直达音频大模型，一次成文。",
        facts: ["上传音频", "需要密钥"],
        steps: ["录音", "大模型", "成文"],
        carry: "音频",
      },
      {
        id: "local",
        name: "混合",
        text: "本机转文字，大模型整理或翻译。",
        facts: ["只上传文字", "需要密钥"],
        steps: ["录音", "本机转文字", "整理", "成文"],
        carry: "文字",
      },
      {
        id: "private",
        name: "离线",
        text: "全程本机，不联网。用于语音输入。",
        facts: ["不上传任何数据", "无需密钥"],
        steps: ["录音", "本机转文字", "成文"],
      },
    ],
  },
  speed: {
    // 两项并列：单色
    title: "速度快，占用少",
    headline: { label: "主流硬件", value: "2", prefix: "<", unit: "秒", text: "松开快捷键到文字出现" },
    stats: [
      { value: "0.23", unit: "秒", label: "本机转文字", note: "Apple 芯片" },
      { value: "850", unit: "MB", label: "本机模型", note: "下载一次即可" },
    ],
    hardware: {
      label: "支持的硬件",
      groups: [
        {
          id: "cpu",
          name: "处理器",
          note: "直接运行",
          items: [
            { icon: "apple", brand: "Apple", series: "M 系列" },
            { icon: "intel", brand: "Intel", series: "Core" },
            { icon: "amd", brand: "AMD", series: "Ryzen" },
          ],
        },
        {
          id: "gpu",
          name: "显卡",
          note: "自动加速",
          items: [
            { icon: "nvidia", brand: "NVIDIA", series: "GeForce" },
            { icon: "amd", brand: "AMD", series: "Radeon" },
            { icon: "intel", brand: "Intel", series: "Arc · Iris Xe" },
          ],
        },
      ],
    },
    long: { title: "长录音同样稳定", text: "近三分钟的口述，完整成文，不截断。", start: "0:00", end: "2:52" },
  },
  privacy: {
    title: "数据只留本机",
    items: [
      { icon: "offline", title: "不上传", text: "语音输入可在本机完成" },
      { icon: "account", title: "无需账号", text: "打开即可使用" },
      { icon: "key", title: "密钥加密", text: "经系统加密存于本机" },
      { icon: "history", title: "记录本机", text: "历史只存在这台电脑" },
    ],
    mirror: {
      title: "国内源下载\n快十余倍",
      text: "本机模型从国内源（魔搭）下载，850 MB 约一分半钟。",
      alt: "下载速度对比：国内源（魔搭）约 9.8 MB/s，Hugging Face 约 0.7 MB/s",
    },
  },
  cost: {
    title: "软件免费，没有订阅",
    text: "模型费用按用量，直接付给厂商；划词翻译每次约 ¥0.0008。",
    per: "/ 月",
    paid: { name: "混合", note: "每天 100 次语音输入" },
    // 「运行 AI」之间不折：AI 单独掉到第三行
    free: { name: "离线", note: "模型下载到本机，在自己的电脑上运行\u00a0AI" },
  },
  setup: {
    title: "首次引导\n四步上手",
    steps: ["演示三项功能", "检查快捷键", "开启权限", "前往引擎", "推荐组合一键启用"],
    alt: "首次引导第 {n} 步：{step}",
    after: "引导之后",
    afterAlt: "首次引导之后：{step}",
    previous: "上一步",
    next: "下一步",
  },
  features: {
    label: "更多特性",
    items: [
      { icon: "translate", title: "中英双语", text: "界面跟随系统语言" },
      { icon: "palette", title: "三套主题", text: "深浅色自动切换" },
      { icon: "dictionary", title: "词典", text: "人名与术语，按词典写法输出" },
      { icon: "history", title: "历史与花费", text: "三项功能统一记录" },
      { icon: "erase", title: "干净卸载", text: "数据集中一处，一条命令删除" },
    ],
  },
  developers: {
    title: "命令行与 App 对等",
    points: [
      { title: "命令行全覆盖", text: "切换方式与模型、管理密钥、下载模型、查看历史与花费。" },
      { title: "JSON 输出", text: "status、history、usage 均可输出 JSON，便于接入脚本。" },
      { title: "跨平台开发", text: "经 SSH 同步到 Windows，远程测试、重启、截屏。" },
      { title: "插件化架构", text: "各厂商实现同一接口，三项功能各自独立，1500 个单元测试把关。" },
    ],
    source: "在 GitHub 查看源码",
    terminal: { label: "终端演示", tabs: { cli: "命令行", windows: "Windows 开发" } },
    // 命令和输出照实写（输出取自真实运行，长的 JSON 用 … 截短）；命令行的输出跟着系统语言，Windows 开发那几个脚本的输出不分语言
    sessions: {
      cli: [
        {
          comment: "切换识别方式，当场生效",
          command: "speakmore mode private",
          output: ["切到了 private 模式：本机的 qwen3-asr-0.6b-q8，不整理、不上传。", "已经换上，不用重启。"],
        },
        {
          comment: "换一套主题",
          command: "speakmore theme indigo",
          output: ["主题换成了靛青（indigo）。", "已经生效，不用重启。"],
        },
        {
          comment: "状态，输出 JSON",
          command: "speakmore status --json",
          output: ['{"running":true,"status":{…},"settings":{"mode":{"value":"private",…},…},…}'],
        },
      ],
      windows: [
        {
          comment: "同步代码，在 Windows 上跑全部单测",
          command: "scripts/dev/win-test.sh",
          output: ["ℹ tests 1047 ℹ pass 1030 ℹ fail 0 ℹ skipped 17"],
        },
        {
          comment: "从源码重启 App，带调试端口",
          command: "scripts/dev/win-app.sh",
          output: ['{"t":"…","level":"info","event":"started","version":"{version}",…}'],
        },
        { comment: "截取 Windows 桌面", command: "scripts/dev/win-screenshot.sh desktop.png", output: ["desktop.png"] },
      ],
    },
  },
  download: {
    title: "立即开始",
    lead: "免费下载。macOS 12 及以上；Windows 10 及以上（64 位）。",
    buttons: { arm64: "下载 Apple 芯片版", windows: "下载 Windows 版" },
    intel: "Intel 芯片 Mac 版",
    terminal: { mac: "macOS · 终端", windows: "Windows · PowerShell" },
    copy: "复制",
    copied: "已复制",
  },
  footer: {
    license: "MIT 许可",
    source: "源代码",
    switchTo: "English",
    switchLabel: "Switch to English",
  },
};
