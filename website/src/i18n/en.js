// 英文文案。和 zh-CN.js 的结构一一对应（test/i18n.test.mjs 会查），改一份就改两份。
// 写法：书面语，短词短句，不用口语和俏皮话；数字都要有出处（README 的评测、成本两节，bench/results/ 的实测），页面上不写出处。
// 标题里的 \n 是换行的位置；口述里 ~~ 括起来的是会被删掉的部分。

export default {
  meta: {
    title: "SpeakMore — Speak it written. Select to translate.",
    description:
      "Voice input, voice translation and selection translation, each one hotkey away. Free and open source for Mac and Windows. Your model, your mode, your cost.",
  },
  nav: {
    trio: "Features",
    ways: "Modes",
    speed: "Speed",
    models: "Models",
    privacy: "Privacy",
    developers: "Developers",
    download: "Download",
    github: "SpeakMore on GitHub",
    home: "SpeakMore home",
  },
  hero: {
    title: "Speak it written. Select to translate.",
    lead: "Free, open-source voice input and translation for Mac and Windows",
    shotAlt:
      "SpeakMore's home window: the hotkeys of the three features, words, time saved, pace and a daily heatmap, with the active mode at the top right",
    barAlt: "The floating bar during dictation: cancel, a live waveform, done",
  },
  // How keys are written: the right-hand key is named differently on Mac and Windows; shown for the visitor's system
  keys: { alt: { mac: "Right ⌥", windows: "Right Alt" }, space: "Space", enter: "Return" },
  trio: {
    label: "Three features",
    items: [
      { id: "demo", chord: ["alt"], name: "Voice input", text: "Dictate; clean text at the cursor" },
      {
        id: "translate",
        chord: ["alt", "space"],
        name: "Voice translation",
        text: "Speak one language, write another",
      },
      { id: "lookup", chord: ["alt", "enter"], name: "Selection translation", text: "Select text; read it below" },
    ],
  },
  demo: {
    title: "Speak naturally.\nRead polished text.",
    said: "Spoken",
    written: "Written",
    examples: [
      {
        label: "Filler words",
        said: "~~Um, ~~so, let's meet the day after tomorrow, ~~uh, ~~and bring~~, bring last week's numbers. Actually no,~~ last month's numbers.",
        written: "So, let's meet the day after tomorrow, and bring last month's numbers.",
      },
      {
        label: "Lists",
        said: "~~Okay so ~~tomorrow I need to do three things, ~~first ~~fix the README, ~~second ~~ship version 0.6.2, ~~and third, um, ~~update the website.",
        written:
          "Tomorrow I need to do three things:\n\n1. Fix the README\n2. Ship version 0.6.2\n3. Update the website",
      },
    ],
  },
  // Voice translation demo: replying to a colleague in a group chat. Speech and translation are real app output (Hybrid mode, DeepSeek V4.1 Flash)
  translate: {
    title: "Speak one language.\nSend another.",
    chat: {
      contact: "Chen",
      incoming: "这周能把修改后的时间表发我吗？",
      said: "~~Um, ~~sure, I'll send you the~~, uh, the~~ revised timeline before Friday. Let me know if anything comes up.",
      written: "好的，我会在周五之前把修订后的时间表发给你。如果有什么问题，随时告诉我。",
      saidLabel: "Spoken · English",
      chip: "Chinese",
      placeholder: "Message",
      alt: "In a group chat, Chen asks in Chinese about the timeline; after a reply spoken in English, the Chinese translation is written into the text field",
    },
    points: [
      { title: "16 target languages", text: "Set several in Settings; switch on the voice bar while speaking." },
      {
        title: "Cleaned up, then translated",
        text: "Fillers and self-corrections stay out; the original is kept in history.",
      },
      { title: "1.3 s to translate", text: "Median model time in Hybrid mode; 2.6 s in Direct." },
    ],
  },
  // Selection translation: three real screenshots (the README set, taken on a Mac; name is the docs/media.json name);
  // each language uses its own. The first is shown large, the other two side by side
  lookup: {
    title: "Web, PDF, terminal.\nSelect to translate.",
    shots: [
      {
        name: "lookup-web",
        caption: "Web page",
        alt: "A paragraph selected on a Chinese web page, translated into English in a card below the selection",
      },
      {
        name: "lookup-terminal",
        caption: "Terminal",
        alt: "Chinese help text selected in a terminal, translated into English in a card",
      },
      {
        name: "lookup-app",
        caption: "Notes",
        alt: "Chinese text selected in a notes app, translated into English in a card",
      },
    ],
    points: [
      { title: "No plug-ins", text: "Works in any app." },
      { title: "Never takes focus", text: "Copy, change the language or pin the card." },
      { title: "About 0.9 s", text: "With the default DeepSeek V4.1 Flash." },
    ],
  },
  models: {
    title: "Leading models.\nAny you like.",
    loopLabel: "Supported model providers",
    vendors: {
      gemini: "Google Gemini",
      openai: "OpenAI",
      qwen: "Qwen",
      bailian: "Alibaba Cloud Bailian",
      deepseek: "DeepSeek",
      kimi: "Kimi",
      zhipu: "Zhipu",
      minimax: "MiniMax",
      funaudiollm: "SenseVoice",
      custom: "Custom service",
    },
    points: [
      { title: "Your own keys", text: "Encrypted per platform on this computer, shared by all three features." },
      { title: "Measured, not guessed", text: "Benchmarked models show their scores." },
      { title: "A model for selection", text: "Selection translation takes its own text model, independent of voice." },
    ],
    shotAlt: "The Engine page: the Refine step expanded to DeepSeek, with channels, prices and a check in the details",
  },
  ways: {
    title: "Three modes. Switch anytime.",
    lanes: { cloud: "Cloud", device: "Device", offline: "Offline" },
    items: [
      {
        id: "native",
        name: "Direct",
        text: "Audio goes straight to the audio model. One pass.",
        facts: ["Uploads audio", "Needs an API key"],
        steps: ["Audio", "Model", "Text"],
        carry: "Audio",
      },
      {
        id: "local",
        name: "Hybrid",
        text: "Transcribed on device, refined or translated by any model.",
        facts: ["Uploads text only", "Needs an API key"],
        steps: ["Audio", "On device", "Refine", "Text"],
        carry: "Text",
      },
      {
        id: "private",
        name: "Offline",
        text: "Fully on device, no network. For voice input.",
        facts: ["Uploads nothing", "No API key"],
        steps: ["Audio", "On device", "Text"],
      },
    ],
  },
  speed: {
    title: "Fast. And light.",
    headline: {
      label: "Mainstream hardware",
      value: "2",
      prefix: "<",
      unit: "s",
      text: "From releasing the key to text",
    },
    stats: [
      { value: "0.23", unit: "s", label: "On-device transcription", note: "Apple silicon" },
      { value: "850", unit: "MB", label: "On-device model", note: "One-time download" },
    ],
    hardware: {
      label: "Supported hardware",
      groups: [
        {
          id: "cpu",
          name: "Processors",
          note: "Runs directly",
          items: [
            { icon: "apple", brand: "Apple", series: "M series" },
            { icon: "intel", brand: "Intel", series: "Core" },
            { icon: "amd", brand: "AMD", series: "Ryzen" },
          ],
        },
        {
          id: "gpu",
          name: "Graphics",
          note: "Accelerated",
          items: [
            { icon: "nvidia", brand: "NVIDIA", series: "GeForce" },
            { icon: "amd", brand: "AMD", series: "Radeon" },
            { icon: "intel", brand: "Intel", series: "Arc · Iris\u00a0Xe" },
          ],
        },
      ],
    },
    long: {
      title: "Steady on long takes",
      text: "Nearly three minutes of speech, written in full, never cut off.",
      start: "0:00",
      end: "2:52",
    },
  },
  privacy: {
    title: "Your data.\nOn your computer.",
    items: [
      { icon: "offline", title: "No uploads", text: "Voice input, on device" },
      { icon: "account", title: "No account", text: "Open and start" },
      { icon: "key", title: "Encrypted keys", text: "Protected by the system" },
      { icon: "history", title: "Local history", text: "Stays on this computer" },
    ],
    mirror: {
      title: "China mirror.\nOver 10× faster.",
      text: "Download the on-device model from the China mirror (ModelScope): 850 MB in about a minute and a half.",
      alt: "Download speed: China mirror (ModelScope) about 9.8 MB/s, Hugging Face about 0.7 MB/s",
    },
  },
  cost: {
    title: "Free app. No subscription.",
    text: "Pay model providers directly, only for what you use; about $0.00012 per selection translation.",
    per: "/ month",
    paid: { name: "Hybrid", note: "100 dictations a day" },
    free: { name: "Offline", note: "Download the model and run AI on your own computer" },
  },
  setup: {
    title: "Onboarding.\nFour steps.",
    steps: [
      "See the three features",
      "Check the hotkeys",
      "Grant access",
      "Open Engine",
      "A recommended setup in one click",
    ],
    alt: "Setup step {n}: {step}",
    previous: "Previous step",
    next: "Next step",
  },
  features: {
    label: "More features",
    items: [
      { icon: "translate", title: "English and Chinese", text: "Follows the system language" },
      { icon: "palette", title: "Three themes", text: "Light and dark, automatic" },
      { icon: "dictionary", title: "Dictionary", text: "Names and terms, spelled as listed" },
      { icon: "history", title: "History and spend", text: "All three features, in one place" },
      { icon: "erase", title: "Clean uninstall", text: "One folder, removed in one command" },
    ],
  },
  developers: {
    title: "Command line.\nOn par with the app.",
    points: [
      {
        title: "Full command line",
        text: "Switch modes and models, manage keys, download models, check history and spend.",
      },
      { title: "JSON output", text: "status, history and usage print JSON for your scripts." },
      {
        title: "Cross-platform development",
        text: "Sync to Windows over SSH, then test, restart and capture the screen remotely.",
      },
      {
        title: "Plugin architecture",
        text: "Every provider implements one interface; the three features stay independent. 1,500 unit tests.",
      },
    ],
    source: "View source on GitHub",
    terminal: { label: "Terminal demo", tabs: { cli: "Command line", windows: "Windows development" } },
    sessions: {
      cli: [
        {
          comment: "Switch modes, effective immediately",
          command: "speakmore mode private",
          output: [
            "Switched to private mode: qwen3-asr-0.6b-q8 on this Mac; no refining, nothing uploaded.",
            "Switched, no restart needed.",
          ],
        },
        {
          comment: "Change the theme",
          command: "speakmore theme indigo",
          output: ["Theme set to Indigo (indigo).", "Applied, no restart needed."],
        },
        {
          comment: "Status as JSON",
          command: "speakmore status --json",
          output: ['{"running":true,"status":{…},"settings":{"mode":{"value":"private",…},…},…}'],
        },
      ],
      windows: [
        {
          comment: "Sync, then run every unit test on Windows",
          command: "scripts/dev/win-test.sh",
          output: ["ℹ tests 1047 ℹ pass 1030 ℹ fail 0 ℹ skipped 17"],
        },
        {
          comment: "Restart the app from source, with a debug port",
          command: "scripts/dev/win-app.sh",
          output: ['{"t":"…","level":"info","event":"started","version":"{version}",…}'],
        },
        {
          comment: "Capture the Windows desktop",
          command: "scripts/dev/win-screenshot.sh desktop.png",
          output: ["desktop.png"],
        },
      ],
    },
  },
  download: {
    title: "Get started",
    lead: "Free download. macOS 12 or later; Windows 10 or later (64-bit).",
    buttons: { arm64: "Download for Apple silicon", windows: "Download for Windows" },
    intel: "Mac with Intel",
    terminal: { mac: "macOS · Terminal", windows: "Windows · PowerShell" },
    copy: "Copy",
    copied: "Copied",
  },
  footer: {
    license: "MIT license",
    source: "Source",
    switchTo: "中文",
    switchLabel: "切换到中文",
  },
};
