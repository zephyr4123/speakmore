// 英文：默认的语言，也是别的语言缺了哪句时的退路。别的语言照着这一份的结构写，名字和参数一一对上。
// {名字} 是参数；{ one, other } 是按 count 分单复数（Intl.PluralRules 的分法）。
// 给人看的一句话句尾不带标点（它常要接在别的话后面），整句的说明才带。

export default {
  common: {
    sentence: "{text}.",
    unknownReason: "unknown reason",
    close: "Close",
    cancel: "Cancel",
  },

  units: {
    seconds: "{value}s",
    minutesSeconds: "{minutes}m {seconds}s",
    minutes: "{minutes} min",
    hoursMinutes: "{hours} hr {minutes} min",
    min: "min",
    hr: "hr",
    words: { one: "word", other: "words" },
    wpm: "WPM",
    days: { one: "day", other: "days" },
  },

  periods: {
    today: "Today",
    month: "This month",
    total: "All time",
  },

  months: {
    jan: "Jan",
    feb: "Feb",
    mar: "Mar",
    apr: "Apr",
    may: "May",
    jun: "Jun",
    jul: "Jul",
    aug: "Aug",
    sep: "Sep",
    oct: "Oct",
    nov: "Nov",
    dec: "Dec",
  },

  permissions: {
    microphone: "Microphone",
    listen: "Input Monitoring",
    trusted: "Accessibility",
    granted: "Granted",
    denied: "Not granted",
    checking: "Checking…",
    openSettings: "System Settings",
    request: "Allow",
  },

  // Key names, short names inside a combination, and keycaps (codes from src/hotkeys/keys.mjs). Letters, digits, F keys and
  // punctuation read the same in every language: their text is in the key table and named builds the name. Windows wording is under windows
  keys: {
    named: "{label}",
    ControlLeft: { name: "Left Control", short: "Left Control", keycap: "Left ⌃" },
    ControlRight: { name: "Right Control", short: "Right Control", keycap: "Right ⌃" },
    ShiftLeft: { name: "Left Shift", short: "Left Shift", keycap: "Left ⇧" },
    ShiftRight: { name: "Right Shift", short: "Right Shift", keycap: "Right ⇧" },
    AltLeft: { name: "Left Option", short: "Left Option", keycap: "Left ⌥" },
    AltRight: { name: "Right Option", short: "Right Option", keycap: "Right ⌥" },
    MetaLeft: { name: "Left Command", short: "Left Command", keycap: "Left ⌘" },
    MetaRight: { name: "Right Command", short: "Right Command", keycap: "Right ⌘" },
    Fn: { name: "Globe (fn)", short: "fn", keycap: "fn" },
    ContextMenu: { name: "Menu key", short: "Menu", keycap: "Menu" },
    Space: { name: "Space", short: "Space", keycap: "Space" },
    Escape: { name: "esc", short: "esc", keycap: "esc" },
    Enter: { name: "Return", short: "Return", keycap: "↩" },
    Tab: { name: "Tab", short: "Tab", keycap: "⇥" },
    Backspace: { name: "Delete", short: "Delete", keycap: "⌫" },
    Delete: { name: "Forward Delete", short: "Forward Delete", keycap: "⌦" },
    Insert: { name: "Insert", short: "Insert", keycap: "Insert" },
    Home: { name: "Home", short: "Home", keycap: "Home" },
    End: { name: "End", short: "End", keycap: "End" },
    PageUp: { name: "Page Up", short: "Page Up", keycap: "Page Up" },
    PageDown: { name: "Page Down", short: "Page Down", keycap: "Page Down" },
    ArrowUp: { name: "Up Arrow", short: "Up", keycap: "↑" },
    ArrowDown: { name: "Down Arrow", short: "Down", keycap: "↓" },
    ArrowLeft: { name: "Left Arrow", short: "Left", keycap: "←" },
    ArrowRight: { name: "Right Arrow", short: "Right", keycap: "→" },
    CapsLock: { name: "Caps Lock", short: "Caps Lock", keycap: "⇪" },
    NumLock: { name: "Num Lock", short: "Num Lock", keycap: "Num Lock" },
    ScrollLock: { name: "Scroll Lock", short: "Scroll Lock", keycap: "Scroll Lock" },
    Pause: { name: "Pause", short: "Pause", keycap: "Pause" },
    PrintScreen: { name: "Print Screen", short: "Print Screen", keycap: "PrtSc" },
  },

  chord: {
    named: "{first}+{second}",
    // Mac menus put no plus sign between keys; our keycaps carry Left/Right, so a space keeps them readable
    text: "{first} {second}",
    empty: "No keys",
    unknown: "Unknown key {code}",
    tooMany: "Two keys at most",
    twice: "{key} is listed twice",
    blocked: "{key} can't be part of a shortcut",
    typingAlone: "{key} needs a modifier: on its own it types",
    shiftAlone: "Shift on its own can't be a shortcut: input methods use it to switch languages",
    twoPlain: "One of the two keys has to be a modifier",
    escapeCombo: "esc can't be combined with other keys",
    shiftTyping: "Shift with a typing key types capitals or symbols; pick another modifier",
  },

  // What a shortcut can do (src/hotkeys/actions.mjs): one row per action in Settings and onboarding, name on the left, chords on the right
  actions: {
    dictate: { name: "Voice input" },
    translate: { name: "Voice translation" },
    lookup: { name: "Selection translation" },
    cancel: { name: "Cancel" },
  },

  // The shortcut settings (src/hotkeys/settings.mjs)
  hotkeySetting: {
    describe: "Shortcut for {action}: any combination of up to two keys; see the README for how to write it",
    notList: 'must be one combination (AltRight, ControlRight+F9) or a list of them (["AltRight","ControlRight"])',
    problem: "{chord}: {reason}",
  },

  // Recording a shortcut in Settings and onboarding (src/app/hotkey-recording.mjs, src/renderer/shared/hotkey-editor.mjs)
  hotkeyRecord: {
    prompt: "Press keys",
    hint: "Up to two keys · esc to cancel",
    hintCapturing: "One key · click elsewhere to cancel",
    tooMany: "Two keys at most",
    unknownKey: "Key not recognized",
    systemTaken: "Used by a system shortcut",
    appTaken: "Used by another app",
    saveFailed: "Couldn't save",
    add: "Add another",
    addLabel: "Add another combination for {action}",
    reset: "Reset",
    resetLabel: "Reset {action} to default",
    change: "Change {chord}",
    remove: "Remove {chord}",
    saved: "Saved",
    limit: "Up to {count}",
    needsListen: "Needs Input Monitoring permission",
    helperStopped: "Key listening isn't running, so shortcuts can't be recorded now",
    envOverride: "{variable} takes precedence; remove it to change this here",
  },

  // Found before handing the shortcuts to the helper, or reported back by it (src/hotkeys/bindings.mjs); listed under what's missing
  hotkeyProblem: {
    chord: "{action}'s {chord} doesn't work: {reason}",
    fallback: "{action} uses the default {chord} for now",
    needsTrusted: "SpeakMore needs Accessibility access in System Settings first",
    registerFailed: "the system wouldn't register it; another app may be using it",
    invalid: "the helper doesn't recognize this combination",
  },

  // Why a combination can't be bound, or what to watch out for (src/hotkeys/validate.mjs)
  binding: {
    notAvailable: "{key} isn't available on this system",
    capturingSingle: "{action} takes a single key that isn't a modifier (an F key, the Menu key or esc)",
    escapeOnlyCapturing: "esc on its own is only for actions that work while you talk",
    macCommandTyping: "Command with a typing key is an app shortcut (copy, paste, save…)",
    macControlTyping:
      "Control with a typing key is a system or text-editing shortcut (switching input sources, moving the cursor…)",
    macFnTyping: "Globe with a letter, digit or symbol is a system shortcut",
    macFnFKey: "fn with an F key is just that F key; bind the F key on its own",
    macControlF: "Control with F1–F8 is a system keyboard-navigation shortcut",
    macCommandF: "Command with F1–F12 is a system shortcut (Command-F5 turns VoiceOver on and off)",
    macF11: "F11 is the system's Show Desktop",
    winMeta: "The Windows key and its combinations belong to Windows",
    winControlTyping: "Ctrl with a typing key is an app shortcut (copy, paste, save…)",
    winAltSpace: "Left Alt+Space opens the window menu",
    winAltEnter: "Left Alt+Enter adds a line break inside a spreadsheet cell",
    winCloses: "This closes the window",
    winShiftSwitch: "Ctrl+Shift and Alt+Shift switch input languages and keyboard layouts",
    winF12: "Windows reserves F12 on its own for debuggers",
    winShiftF10: "Shift+F10 opens the context menu",
    leftOnly:
      "Everyday shortcuts start with left-hand modifiers (Command-C, Shift-Command-Z), so this would fire by accident all the time: use a right-hand modifier, or add fn",
    required: "{action} needs at least one combination",
    tooMany: "An action takes {count} combinations at most",
    repeated: "Listed twice",
    taken: "Already used by {action}",
    usesCapturingKey: "{key} is the key for {action}: while you talk, pressing it only cancels",
    capturingKeyUsed: "{key} is part of a {action} combination: an action that works only while you talk can't use it",
    fnSystem:
      "If the Globe key has another job in System Settings (switching input sources, emoji, dictation), that fires too; most external keyboards have no fn",
    // Said precisely when the helper can read the system setting (refineWarning in src/hotkeys/validate.mjs)
    fnSystemUse: "Pressing Globe also {use}; set it to “Do Nothing” in System Settings › Keyboard",
    fnUses: { inputSource: "changes the input source", emoji: "shows Emoji & Symbols", dictation: "starts Dictation" },
    macOptionTyping:
      "Option with a typing key normally types a special character (Option-Space is a non-breaking space); bound, it no longer will",
    macOptionEnter:
      "In spreadsheets Option-Return adds a line break inside a cell; bound, it takes the Option key on the other side",
    altGr: "Some keyboard layouts (German, French…) use Right Alt as AltGr for typing; pressing it fires this too",
    winAltLetter: "Alt with a letter normally opens an app's menu (Alt+F for File); bound, it no longer will",
    prefix: "It's part of {action}'s combination {chord}: pressing that one fires this first",
  },

  themes: {
    ink: { name: "Ink", describe: "Black and white. Shape and motion show the state; color only for errors" },
    cinnabar: { name: "Cinnabar", describe: "A warm red on the wave and the main buttons" },
    indigo: { name: "Indigo", describe: "Color shows the stage: green listening, indigo refining, amber trouble" },
  },

  providers: {
    gemini: { name: "Google Gemini" },
    openai: { name: "OpenAI" },
    deepseek: { name: "DeepSeek" },
    custom: { name: "Custom service" },
    bailian: { name: "Alibaba Cloud Bailian" },
    moonshot: { name: "Kimi" },
    zhipu: { name: "Zhipu GLM" },
    minimax: { name: "MiniMax" },
  },

  language: {
    system: "System",
  },

  // Languages translation can target (src/languages.mjs)
  languages: {
    en: "English",
    "zh-CN": "Simplified Chinese",
    "zh-TW": "Traditional Chinese",
    ja: "Japanese",
    ko: "Korean",
    fr: "French",
    de: "German",
    es: "Spanish",
    pt: "Portuguese",
    it: "Italian",
    ru: "Russian",
    ar: "Arabic",
    vi: "Vietnamese",
    th: "Thai",
    id: "Indonesian",
    tr: "Turkish",
  },

  settings: {
    describe: {
      mode: "Recognition mode: native (Direct) sends the recording to a model that takes audio; local (Hybrid) turns speech into text first, then has any LLM refine it; private (Offline) only transcribes on this Mac and uploads nothing",
      model:
        "Which provider and model refines your words, as provider/model; a provider alone uses its default. Switch with speakmore model",
      thinking: "Gemini's thinking level; higher is slower. Other providers don't use it",
      transcriber:
        "In local (Hybrid) mode, which model turns speech into text; on-device models need downloading first (speakmore transcriber download)",
      privateTranscriber:
        "In private (Offline) mode, which on-device model transcribes; on-device models only, download it first",
      polish:
        "In local (Hybrid) mode, which provider and model refines the text, as provider/model; for a custom service write custom/<model>",
      customUrl: "Address of your custom service (OpenAI-compatible), e.g. https://api.example.com/v1",
      customParams:
        'Extra request parameters for the custom service, as one JSON object, e.g. {"reasoning_effort": "minimal"}; sent with checks and refining alike. model, messages, and stream can\'t be set',
      modelSource:
        "Where on-device models download from: cn is the mirror in China (ModelScope), original is Hugging Face. If the chosen one stalls, the other is tried, picking up where the download stopped",
      acceleration:
        "Whether on-device models use the GPU: auto uses it when there is one and falls back to the CPU if it fails; cpu uses only the CPU (for GPU driver trouble, or to leave the GPU to other programs)",
      localModelMemory:
        "Whether the on-device speech-to-text model stays in memory: resident keeps it loaded; 1m, 5m, 10m, or 30m releases it after that much idle time and loads it again when you next speak (the first sentence after a long pause takes a second or two longer)",
      barHint: "Whether the hint line above the voice bar (press … to finish · esc to cancel) shows: on or off",
      outputScript:
        "Whether dictated Chinese comes out simplified or traditional: English, numbers, and Cantonese-only characters stay as they are",
      livePreview:
        "Whether the voice bar shows provisional text while you speak, updated every few seconds: only on-device recognition has this, and the finished result still comes out the usual way",
      lookup: {
        to: "What selection translation translates into: one language; the card can switch to another for one go",
        model:
          "Which provider and model selection translation uses, as provider/model, separate from the voice models; for a custom service write custom/<model>",
        customUrl:
          "Address of the custom service for selection translation (OpenAI-compatible), separate from the voice one",
        customParams:
          "Extra request parameters for selection translation's custom service, as one JSON object; model, messages, and stream can't be set",
      },
      translate: {
        to: "What voice translation translates into: one or more languages (en, ja, comma-separated); the first is the default, and the voice bar can switch to the others for one go",
      },
      theme: "Which theme the windows use",
      language: "Interface language; system follows your Mac",
    },
    unknown: "There's no setting called {name}. You can change: {names}",
    notText: "must be text",
    oneOf: "must be one of {choices}",
    translateTargets: "must list 1 to {max} languages, like en or en,ja",
    invalid: "{where} is {value}: {reason}",
    whereEnv: "The {variable} env var",
    whereFile: "{name} in the settings file {file}",
    unreadable: "Can't read the settings file {file} ({reason}). Fix it, or delete it and set things again.",
    notObject:
      'The settings file {file} isn\'t a set of "name": value pairs. Fix it, or delete it and set things again.',
  },

  models: {
    empty: "is empty",
    unknownProvider: "unknown provider {name}; available: {providers}",
    badName: "model name {model} is invalid: only letters, digits, and . _ : - are allowed",
    issues: { jsonWrapped: "Occasionally wraps the text in JSON or returns HTTP 500" },
  },
  modes: {
    native: "Direct: the recording goes straight to the model",
    local: "Hybrid: speech to text first, then a model refines it",
    private: "Offline: on-device models only, nothing uploaded",
    privateOnlyLocal: "Offline mode only uses on-device models; {model} is a cloud model",
    notIn: "You're in {current} mode; {what} can only be changed in {mode} mode",
    notOfMode: "{name} isn't a {mode} setting; switching to {mode} can also set {names}",
    notDownloaded: "{model} isn't downloaded yet ({size}): download it first",
    what: {
      model: "the audio model",
      transcriber: "the speech-to-text model",
      polish: "the refining model",
      privateTranscriber: "the Offline mode's on-device model",
    },
  },
  local: {
    modelDownloading: "The local model is still downloading ({percent}%); it'll work once it's done",
    modelLoading: "The local model is loading; give it a few seconds",
    modelFailed: "The local model couldn't be set up: {reason}",
    modelMissing:
      "The local model {model} isn't downloaded: download it on the Engine page, or run speakmore transcriber download {id}",
    undecodable: "Couldn't read the recording: {reason}",
    transcribeFailed: "On-device transcription failed: {reason}",
  },
  modelSources: {
    cn: "ModelScope",
    original: "Hugging Face",
  },
  accelerations: {
    auto: "Automatic",
    cpu: "CPU only",
  },
  localModelMemories: {
    resident: "Keep in memory",
    "1m": "Release after 1 min idle",
    "5m": "Release after 5 min idle",
    "10m": "Release after 10 min idle",
    "30m": "Release after 30 min idle",
  },
  // 显示不显示的开关（悬浮条上的操作提示、录音时的预览）
  shown: {
    on: "Shown",
    off: "Hidden",
  },
  outputScripts: {
    simplified: "Simplified",
    "traditional-hk": "Traditional (Hong Kong)",
    "traditional-tw": "Traditional (Taiwan)",
  },
  localModels: {
    tags: {
      "apple-silicon": "suits Apple silicon",
      "windows-x64": "suits Windows",
      metal: "Metal-accelerated",
      vulkan: "GPU-accelerated (Vulkan)",
      cpu: "runs on CPU alone",
      "zh-en": "strong on mixed Chinese–English",
      fast: "fast",
      small: "small",
    },
    chips: {
      "apple-silicon": "Apple silicon",
      "intel-mac": "Intel Macs",
      "windows-x64": "Windows (x64)",
      "windows-arm64": "Windows (ARM)",
    },
    backends: { metal: "Metal", vulkan: "Vulkan", cpu: "CPU" },
    measured: "Measured on {chip} ({backend}): {score}/5 · {realtime}× real time · {memory} memory",
    figures: { score: "score", speed: "speed", memory: "memory" },
    measuredOn: "Measured on {chip} · {backend}",
    notMeasured: "Not yet measured on {chip}",
    unknownChip: "Not yet measured on this kind of machine",
    unknown: "There's no model called {id}",
    noSpace: "Not enough disk space: {model} needs {need} more, and only {free} is free",
    downloadFailed: "{model} didn't download: {reason}",
    inUse: "{model} is in use and can't be deleted: switch to another model or back to Direct first",
    checkNoSpeech: "Couldn't speak the test sentence (uses the system voice): {reason}",
    checkFailed: "{model} failed to transcribe: {reason}",
    checkEmpty: "{model} didn't transcribe a single word",
  },
  chat: {
    modelRequired: "{vendor} has no default model; write it as {vendor}/<model name>",
    badModelName: "model name {model} is invalid: only letters, digits, and . _ : / @ + - are allowed",
    urlEmpty: "the address is empty",
    urlNotHttp: "{url} isn't a web address; it should start with https:// or http://",
    urlCredentials: "don't put a username or password in the address; the key goes in separately",
    urlQuery: "the address can't contain ? or #",
    urlMissing: "no address set for the custom service (customUrl)",
    endpointNotFound:
      "{provider} has no chat API at this address (HTTP 404). Check the address is complete; most end in /v1",
    paramsNotJson:
      'the extra parameters aren\'t valid JSON: keys and strings need straight double quotes, e.g. {"reasoning_effort": "minimal"}',
    paramsNotObject: 'the extra parameters must be one JSON object in braces, e.g. {"reasoning_effort": "minimal"}',
    paramsReserved: "the extra parameters can't set {name}: SpeakMore sends {names} itself",
  },

  setup: {
    openSettings: "menu bar icon › Settings",
    missing: {
      key: "{provider} API key",
      check: "{provider} check",
      microphone: "microphone access",
      listen: "Input Monitoring access",
      helper: "key listener",
      localModel: "local model",
      localModelDownloading: "local model (downloading, {percent}%)",
    },
    blocker: {
      noKey: "No {provider} API key: {where}",
      checkFailed: "{provider} check failed: {problem}",
      keyRejected: "API key not working: {problem}",
      checking: "Checking the API key, one moment",
      noMicrophone: "No microphone access: {where}",
    },
    degraded: "No Accessibility access: text goes to the clipboard, press ⌘V",
  },

  key: {
    empty: "No key entered",
    routeChanged: "The recognition mode just changed, so this key wasn't saved. Save it again",
    tooLong: "This key is too long ({length} characters). Looks like a copy mistake",
    whitespace: "This key has spaces or line breaks. Looks like extra text got copied",
    badCharacters: "This key has characters that don't belong. Looks like a copy mistake",
    unreadable: "The saved key can't be read anymore. Enter it again",
    unreadableFor: "The saved {provider} key can't be read anymore. Enter it again",
    notSaved: "The key works but wasn't saved ({reason}). You'll need to enter it again after quitting",
    keychainUnavailable: "The system keychain isn't available, so the key can't be stored safely",
    external: "Connected to a separately started server (SPEAKMORE_SERVER_URL); set the key there",
    externalModel: "Connected to a separately started server (SPEAKMORE_SERVER_URL); the model is chosen there",
    noKeyFor: "No {provider} key",
    noKeyForCli: "No {provider} key yet: run speakmore key {id}",
    unknownProvider: "Unknown model provider: {id}",
    noKeyService:
      "No {provider} API key yet: run speakmore key in a terminal, or open Settings from the SpeakMore menu bar icon",
    noKeyServiceFor:
      "No {provider} API key yet: run speakmore key {id} in a terminal, or open Settings from the SpeakMore menu bar icon",
    failedFor: "{provider} key failed: {reason}",
    whichVendor: "Offline mode doesn't use a key; to save one, say which provider it's for",
  },

  model: {
    timeout: "{provider} took too long to reply. Try again later",
    unreachable: "Can't reach {provider}. Check your network",
    keyInvalid: "This key is invalid. Check it was copied in full",
    unavailable: "{provider} is unavailable right now ({said}). Try again later",
    rejected: "{provider} rejected the request: {said}",
    regionBlocked:
      "{provider} isn't available in your network's region ({said}). Check your proxy or switch networks; the key is fine",
    noQuota: "This key's account is out of credit. Top up or use another key",
    forbidden: "This key lacks permission: {said}",
    notFound: "{provider} doesn't have this model, or this key can't use it: {said}",
    blocked: "{provider} didn't process this recording: {reason}",
    notActivated: "This model isn't activated on {provider}. Activate it in the console, then try again",
    unfinished: "{provider} didn't finish normally: {reason}",
  },

  audio: {
    undecodable: "Couldn't decode the recording ({type}): {reason}",
    empty: "Couldn't decode the recording ({type}): it has no audio",
  },

  voice: {
    noAudio: "No audio received",
    connectTimeout: "Timed out connecting to the server",
    unreachable: "Can't reach the server at {url}",
    disconnected: "Lost the connection to the server",
    timeout: "No result after {seconds} seconds",
    serverError: "Server error {code}: {detail}",
    unsupported: "{feature} isn't available in {mode} mode",
  },

  // Selection translation (src/app/lookup)
  lookup: {
    noKey: "No key set for {provider}",
    customUrlMissing: "The custom service has no address yet",
    noSelection: "Select some text first",
    noAccessibility: "Selection translation needs Accessibility: System Settings › Privacy & Security › Accessibility",
    elevated: "That window runs as administrator, so its selection can't be read",
    selectionFailed: "Couldn't read the selection; press again",
    tooLong: "That's too long: {max} characters at a time",
    empty: "The model returned no translation; try again",
    card: {
      copy: "Copy",
      copied: "Copied",
      pin: "Pin",
      unpin: "Unpin",
      close: "Close",
      keys: "Add key",
      retry: "Retry",
      translating: "Translating",
    },
  },

  delivery: {
    silent: "Didn't hear anything",
    noAccessibility: "No Accessibility access: text copied, press ⌘V to paste",
    pasteFailed: "Couldn't paste: text copied, press ⌘V to paste",
    // 只有 Windows 有：系统不让模拟的按键进以管理员身份运行的窗口
    elevated: "That window runs as administrator, so text can't be pasted into it: text copied, press Ctrl+V to paste",
  },

  bar: {
    opening: "Opening microphone…",
    recording: "Press {key} to finish · {esc} to cancel",
    recordingNoEsc: "Press {key} to finish",
    finishing: "Refining",
    translating: "Translating",
    noHold: "No need to hold: press once to start, again to finish",
    noMicPermission: "No microphone access: System Settings › Privacy & Security › Microphone",
    noMicrophone: "No microphone found",
    noSignal: "The microphone isn't picking anything up: check the input device and mute",
    recordError: "Recording error: {reason}",
    helperStopped: "Key listener stopped; {hotkey} won't work. Try restarting SpeakMore",
    secureInput: "Secure input is on in another app, so some shortcuts won't work for now",
    // 只有 Windows 有：系统不把发给管理员窗口的按键交给我们
    elevatedForeground: "The window in front runs as administrator, so shortcuts won't work in it",
  },

  tray: {
    ready: "Ready · press {keycap} to talk",
    missing: "Missing: {items}",
    preparing: "Getting ready…",
    open: "Open SpeakMore",
    history: "History",
    settings: "Settings…",
    version: "Version {version}",
    updateAvailable: "Version {version} is available…",
    quit: "Quit SpeakMore",
    fallbackTitle: "Dictate",
  },

  notes: {
    settingNotSaved: "Switched, but couldn't save {name} to settings ({reason}) · next launch goes back",
    envNextLaunch: "The {variable} env var takes priority · next launch still uses it",
    envRemove: "The {variable} env var takes priority · remove it to apply",
  },

  hub: {
    pages: "Pages",
    home: "Home",
    models: "Engine",
    history: "History",
    vocabulary: "Dictionary",
    settings: "Settings",
    about: "About",
    missing: "Missing: {items}",
    fix: "Settings",
    switchWay: "Switch mode",
  },

  // The Engine page in the sidebar (renderer/hub/engine/)
  plaza: {
    title: "Engine",
    segments: { label: "Engine sections", voice: "Voice", lookup: "Selection" },
    lookup: {
      testedTip: "Evaluated on a batch of selection samples",
      customKey: "Custom service API key",
      customEnabled: "Custom service enabled",
      removeKey: "Remove key",
      keyRemoved: "Custom service key removed",
    },
    search: "Search models",
    modes: { native: "Direct", local: "Hybrid", private: "Offline" },
    // The tree's three steps, and what each one does (on hover)
    roles: { native: "Direct", transcribe: "Transcribe", polish: "Refine" },
    roleDesc: {
      native: "Recording straight to text",
      transcribe: "Recording to text",
      polish: "Text made readable",
    },
    // The small line above each column of the tree
    columns: { modes: "Mode", roles: "Step", makers: "Maker", models: "Model" },
    unchosen: "None selected",
    state: { notDownloaded: "Not downloaded", downloading: "Downloading", downloaded: "{done}/{total} downloaded" },
    legend: { standby: "Selected · another mode" },
    zoom: {
      in: "Zoom in",
      out: "Zoom out",
      reset: "Reset to 100%",
      fit: "Fit to canvas",
      hint: "Drag to pan · Pinch or ⌘-scroll to zoom",
    },
    // The details on the right after picking a model (renderer/hub/engine/detail.mjs)
    detail: {
      label: "{model} details",
      close: "Close details",
      switchTo: "Enabling switches to {mode}",
      price: "Price",
      perHour: "/ hour of audio",
      listPrice: "{platform} list price",
      listPriceTokens: "{platform} list price · per million tokens",
      best: "Best in group",
      license: "{license} license",
      audioLocal: "Audio stays on this device",
      audioTo: "Audio sent to {platform}",
      textTo: "Text sent to {platform}",
      textToCustom: "Text sent to your custom service",
      notOnChannel: "{platform} doesn't offer this model",
    },
    via: { local: "This Mac" },
    inUse: "In use",
    chosen: "Selected",
    chosenTip: "Used in {mode}",
    actionFailed: "Not completed",
    check: {
      run: "Check",
      running: "Checking",
      ok: "Passed",
      fail: "Failed",
      again: "Check again",
      okAgain: "Passed, check again",
      failAgain: "Failed, check again",
      modelTip: "Send a sample request",
      localTip: "Transcribe a spoken sample",
      keyTip: "Send a minimal request with this key",
    },
    cols: {
      input: "Input",
      inputTip: "Input price · per million tokens",
      output: "Output",
      outputTip: "Output price · per million tokens",
      hour: "Per hour",
      hourTip: "Cost to transcribe one hour of audio",
      hourApprox: "Cost to transcribe one hour of audio · Billed by token, estimated from a measured run",
      noPrice: "See the platform's pricing",
      zh: "Chinese",
      zhTip: "Chinese accuracy · 47 real recordings, out of 5",
      mix: "Mixed",
      mixTip: "Chinese–English accuracy · 45 real recordings, out of 5",
      minute: "1-min time",
      minuteTip: "Time to transcribe one minute of audio · From the measured real-time factor",
      memory: "Memory",
      memoryTip: "Peak memory while transcribing",
      size: "Size",
      sizeTip: "Download size",
    },
    units: { seconds: "s" },
    tags: {
      default: "Default",
      defaultTip: "Enabled after install",
      tested: "Evaluated",
      testedTip: "Evaluated on a batch of real recordings",
      issue: "Known issue",
      unverified: "Unverified",
      unverifiedTip: "Added from the official docs; not yet called",
    },
    build: "{backend}",
    buildTip: "Quantization {variant}",
    makers: {
      qwen: "Qwen",
      deepseek: "DeepSeek",
      kimi: "Kimi",
      zhipu: "Zhipu GLM",
      minimax: "MiniMax",
      gemini: "Gemini",
      openai: "OpenAI",
    },
    groups: {
      local: "On this Mac",
      custom: "Custom",
    },
    channel: {
      label: "Channel",
      official: "Official",
      officialOf: "{platform} official",
      keyed: "Key configured",
      noKey: "No key",
    },
    notice: { noKey: "No key configured", custom: "Not configured" },
    actions: {
      use: "Enable",
      download: "Download {size}",
      cancel: "Cancel",
      configure: "Configure",
      configureKey: "Add key",
      needKey: "Add a key first",
      remove: "Remove",
      removeModel: "Remove {model}",
    },
    custom: {
      name: "Custom service",
      desc: "OpenAI-compatible API",
      url: "API address",
      urlPlaceholder: "API address, e.g. https://api.example.com/v1",
      model: "Model name",
      modelPlaceholder: "Model name",
      params: "Extra parameters",
      paramsPlaceholder: "Extra parameters (JSON, optional)",
      paramsTip:
        'Extra request parameters for this service, e.g. {"reasoning_effort": "minimal"}; sent with checks and refining',
      keyKept: "Key configured; leave blank to keep it",
      modelMissing: "Enter a model name",
    },
    empty: { title: "No matching models" },
    // The keys panel on the right of the title row (renderer/hub/engine/keys.mjs)
    keys: {
      title: "Keys",
      meta: "{done}/{total} configured",
      local: "Keys stay on this device · {home}",
      coverage: "Covers",
      env: "Environment",
      envTip: "From the environment variable {variable}; takes precedence over a saved key",
      stored: "Configured",
      none: "Not configured",
      placeholder: "Paste your {platform} API key",
      label: "{platform} API key",
      save: "Save",
      cancel: "Cancel",
      remove: "Remove",
      collapse: "Collapse",
      replace: "Replace",
      get: "Get a key",
    },
    toast: {
      switchedWith: "Switched to {mode} · {model}",
      enabled: "{model} enabled",
      keySaved: { one: "Key saved · {count} model now available", other: "Key saved · {count} models now available" },
      keySavedOnly: "Key saved",
      customUpdated: "Custom service settings updated",
      customChecked: "Check passed · takes effect when enabled",
      keyRemoved: "{platform} key removed",
      canceled: "Download canceled",
      removed: "{model} removed",
    },
  },

  // Recommended setups next to the Engine page title (src/models/presets.mjs, renderer/hub/preset-picker.mjs). Monthly cost at 100 a day, 30 days
  presets: {
    title: "Recommended setups",
    perMonth: "/ mo",
    costTip: "{daily} a day · about {seconds} s each · weekday peak prices",
    costUnknown: "Price unknown",
    enable: "Enable",
    enabling: "Enabling",
    checkTip:
      "Checks the whole setup: the on-device model transcribes a sample, each cloud service gets a minimal request",
    enabled: "Enabled {name}",
    download: "Download {size}",
    downloading: "Downloading {model}",
    items: {
      "local-deepseek": { name: "On-device + DeepSeek" },
      "native-gemini": { name: "Gemini" },
      "bailian-cloud": { name: "Bailian Cloud" },
      "private-qwen": { name: "Fully On-device" },
      "local-deepseek-cpu": { name: "On-device + DeepSeek" },
      "private-sensevoice-cpu": { name: "Fully On-device" },
    },
  },

  home: {
    title: "Speak it written. Select to translate.",
    words: "Words",
    saved: "Time saved",
    speed: "Speed",
    time: "Dictation time",
    active: "Active",
    streak: "Streak",
    longest: "Longest",
    activity: "Dictations per day",
    earlier: "Earlier",
    later: "Later",
    less: "Less",
    more: "More",
    notStarted: "{day} · not started yet",
    dayCount: { one: "{day} · {count} dictation · {level}", other: "{day} · {count} dictations · {level}" },
    dayLevel: "{day} · {level}",
    levels: {
      none: "No activity",
      light: "Light usage",
      moderate: "Moderate usage",
      high: "High usage",
      power: "Power usage",
    },
    spend: { today: "Spent today", month: "Spent this month", total: "Spent in all" },
    spendPeriods: "Period",
    latencyIs: "{time} latency",
    local: "On-device",
    free: "Free",
    emptyPeriod: "Nothing used in this period",
    noCost: "On-device only · Nothing spent",
    unpricedOnly: "Cloud models unpriced · Cost not counted",
    range: "{from} – {to}",
    dictations: { one: "{count} dictation", other: "{count} dictations" },
    lookups: { one: "{count} selection translation", other: "{count} selection translations" },
    tokenTotal: "{count} tokens",
    checks: { one: "Includes {count} check", other: "Includes {count} checks" },
    cache: "Prompt cache {cost}",
    estimate: "Estimated at list prices",
    unpriced: "{models} unpriced; {count} not counted",
    // Recognition mode: shown next to the home title (renderer/hub/mode-chip.mjs), changed in the first column of the Engine page, also used by onboarding; mode names live in plaza.modes
    mode: {
      label: "Recognition",
      open: "Change it on the Engine page",
      desc: {
        native: "Recording straight to the model",
        local: "Speech to text, then a model refines it",
        private: "On-device models only · Nothing uploaded",
      },
      needs: {
        key: "No {platform} key",
        download: "{model} not downloaded",
        downloading: "Downloading {model} · {percent}%",
        url: "No custom service URL",
      },
      switching: "Switching",
      failed: "Not switched",
      switched: "Switched to {mode}",
      locked: "The mode is set by the separately started server and can't be changed here",
    },
  },

  history: {
    title: "History",
    filter: "Filter by feature",
    all: "All",
    empty: "Nothing yet",
    loadError: "Couldn't read history: {reason}",
    today: "Today",
    yesterday: "Yesterday",
    silent: "Audio is silent",
    failed: "Failed · ",
    copy: "Copy",
    copied: "Copied",
    copyFailed: "Copy failed",
    recording: "Recording {duration}",
    original: "Original: {text}",
    model: "Model {latency} · {cost}",
    tokens: "In {input} · out {output} tokens",
    tokensCalls: "In {input} · out {output} tokens · {calls} calls",
    unpriced: "price unknown",
    models: "Models {models}",
    notFound: "Entry not found",
    noRecording: "Recording not found",
    search: "Search",
    noResults: "No matching entries",
    play: "Play recording",
    stop: "Stop playback",
    playFailed: "Playback failed: {reason}",
    rerun: "Rerun",
    export: "Export",
    exportDone: { one: "Exported {count} entry", other: "Exported {count} entries" },
    exportFailed: "Export failed: {reason}",
  },

  rerun: {
    running: "Rerunning",
    done: "Rerun complete",
    failed: "Rerun failed: {reason}",
    optionsFailed: "Can't rerun: {reason}",
  },

  vocabulary: {
    title: "Dictionary",
    add: "New word",
    import: "Import",
    local: "Stored on this device only",
    localMeta: { device: "Never uploaded", cloud: "Sent with dictation requests" },
    localTip:
      "The dictionary is saved in {file} and is never uploaded or synced. When you dictate, the words your model can take are sent along with that request; in Offline mode they never leave this device",
    composer: { placeholder: "Type a new word", close: "Close" },
    supportTrigger: "Supported models",
    support: {
      title: "Supported models",
      all: "All models",
      roles: { native: "Direct", transcribe: "Transcribe", polish: "Refine" },
      limitTerms: "First {count} words",
      limitChars: "First {count} characters",
      limitAll: "All words",
      limits: {
        terms: { one: "Up to {count} word", other: "Up to {count} words" },
        chars: "Up to {count} characters in total",
        termChars: "Up to {count} characters per word",
        termWords: "Up to {count} English words per entry",
      },
    },
    kinds: { prompt: "Prompt", context: "Context", hotwords: "Hotwords", none: "Not supported" },
    kindTips: {
      prompt: "Written into the model's system prompt, so it spells words as in the dictionary",
      context: "Sent to the recognition model with the audio as background text",
      hotwords: "Sent to the recognition model with the audio as hotwords",
      none: "This model doesn't take a dictionary",
    },
    search: "Search",
    count: { one: "{count} word", other: "{count} words" },
    empty: { title: "No words yet" },
    noResults: "No matching words",
    loadError: "Couldn't read the dictionary: {reason}",
    editHint: "Enter to save · Esc to cancel",
    fixFileFirst: "Fix the dictionary file before making changes",
    edit: "Edit",
    delete: "Delete",
    select: "Select",
    selection: { count: "{count} selected", all: "Select all", clear: "Clear selection", delete: "Delete" },
    dialogs: {
      cancel: "Cancel",
      remove: {
        title: "Delete word?",
        description: "“{term}” will be removed from the dictionary for good",
        confirm: "Delete",
      },
      removeMany: {
        title: { one: "Delete {count} word?", other: "Delete {count} words?" },
        description: "The selected words will be removed from the dictionary for good",
        confirm: "Delete",
      },
      import: {
        title: "Import words",
        found: { one: "{count} new word in {file}", other: "{count} new words in {file}" },
        skipped: {
          existing: "{count} already in the dictionary",
          duplicates: "{count} repeated in the file",
          invalid: "{count} invalid",
        },
        none: "No new words to add in {file}",
        confirm: "Add {count}",
        more: "{count} more",
      },
    },
    toast: {
      added: "Added “{term}”",
      updated: "Updated “{term}”",
      removed: "Deleted “{term}”",
      removedMany: { one: "Deleted {count} word", other: "Deleted {count} words" },
      imported: { one: "Imported {count} word", other: "Imported {count} words" },
    },
    problems: {
      empty: "Enter a word",
      tooLong: "A word can have at most {max} characters",
    },
    duplicate: "“{term}” is already in the dictionary",
    full: "The dictionary is full ({max} words)",
    tooMany: "The dictionary holds {max} words; {room} more can be added, this adds {count}",
    notFound: "“{term}” isn't in the dictionary",
    fileTooLarge: "The file is too large; the limit is {max} MB",
    unreadable: "Couldn't read the dictionary file {file}: {reason}",
    unwritable: "Couldn't save the dictionary file {file}: {reason}",
    importUnreadable: "Couldn't read {file}: {reason}",
    notText: "{file} isn't a text file",
    fileErrors: {
      ENOENT: "the file doesn't exist",
      EACCES: "permission denied",
      EPERM: "permission denied",
      EISDIR: "it's a folder",
    },
    malformed: 'The dictionary file {file} isn\'t in the expected format: {"terms": ["word", …]}',
  },

  preferences: {
    title: "Settings",
    sections: "Settings sections",
    general: "General",
    permissions: "Permissions",
    about: "About",
    hotkey: "Shortcut",
    theme: "Theme",
    language: "Interface language",
    localModels: "On-device models",
    modelSource: "Download source",
    acceleration: "Acceleration",
    localModelMemory: "Memory",
    localModelMemoryFailed: "Memory setting not changed: {reason}",
    barHint: "Show key hints on the voice bar",
    outputScript: "Output script",
    livePreview: "Preview words on the voice bar while speaking",
    livePreviewFailed: "Preview setting not changed: {reason}",
    openAtLogin: "Launch at login",
    themeFailed: "Theme not changed: {reason}",
    languageFailed: "Language not changed: {reason}",
    loginFailed: "Couldn't set launch at login: {reason}",
    sourceFailed: "Download source not changed: {reason}",
    accelerationFailed: "Acceleration not changed: {reason}",
    barHintFailed: "Hint setting not changed: {reason}",
    outputScriptFailed: "Output script not changed: {reason}",
    translateTo: "Translate into",
    translateDefault: "Default",
    translateMakeDefault: "Make default",
    translateRemove: "Remove {language}",
    translateAdd: "Add",
    translateFailed: "Translation languages not changed: {reason}",
    lookupFailed: "Selection translation language not changed: {reason}",
    recheck: "Check again",
    version: "Version",
    source: "Source code",
    storage: {
      title: "Storage location",
      change: "Change…",
      pickTitle: "Choose a new storage location",
      pickMessage: "SpeakMore moves into .speakmore inside the folder you choose",
      pickButton: "Choose",
      confirm: "Move to {to}?",
      confirmDetail:
        "{size} ({count} files) will be copied, including the program, on-device models, recordings, and settings. SpeakMore quits while it moves and reopens when done; if the move fails, everything stays as it was.",
      unknown: "Files in the current location that aren't SpeakMore's are neither moved nor deleted: {items}",
      move: "Move",
      cancel: "Cancel",
      failed: "Couldn't change it: {reason}",
    },
    update: {
      title: "Software update",
      check: "Check for updates",
      checking: "Checking…",
      upToDate: "v{version} · Up to date",
      available: "v{latest} is available · You have v{current}",
      otherBehind: "{copy} is still v{current}; it can be updated to v{latest} too",
      updateTo: "Update to v{version}",
      downloading: "Downloading v{version}…",
      installing: "Installing; SpeakMore will reopen automatically…",
      cliRunning: "The command line is updating to v{version}…",
      updated: "Updated to v{version}",
      failed: "The update didn't finish: {problem}",
      checkFailed: "Couldn't check: {problem}",
      retry: "Try again",
      fromSource: "Running from source · Update with git pull",
      startFailed: "Couldn't start the update: {reason}",
    },
  },

  // Choosing the storage location the first time the app opens (src/app/first-run.mjs), in system dialogs
  firstRun: {
    title: "Choose a storage location",
    detail:
      "SpeakMore keeps its program data, on-device models, recordings, and settings in one folder.\n\nDefault location: {home}\n\nEach on-device model is about 0.2–1.6 GB. To keep them on another disk, choose a location now; you can also change it later in Settings › General › Storage location.",
    useDefault: "Use Default Location",
    choose: "Choose Another Location…",
    pickTitle: "Choose a storage location",
    pickMessage: "SpeakMore is saved in .speakmore inside the folder you choose",
    pickButton: "Choose",
    existing: "{home} already has SpeakMore data",
    existingDetail: "Its settings, history, and recordings will be used as they are.",
    reuse: "Use It",
    again: "Choose Again",
    unusable: "This location can't be used",
  },

  // The progress window while moving the storage location (src/app/move-window.mjs, src/renderer/move)
  moveWindow: {
    title: {
      preparing: "Moving the storage location",
      copying: "Moving the storage location",
      switching: "Moving the storage location",
      done: "Storage location changed",
      failed: "Storage location not changed",
    },
    from: "From",
    to: "To",
    step: {
      preparing: "Getting ready; SpeakMore quits for a moment…",
      switching: "Switching to the new location…",
      done: "All files are in the new location.",
    },
    copying: "Copying {done} / {total} ({percent}%) · keep the disk connected until it's done",
    removed: "The files in the old location were deleted.",
    later: "The files in the old location will be deleted after this window closes.",
    left: "Files in the old location that aren't SpeakMore's were left alone: {items}",
    unchanged: "SpeakMore is still in its old location; nothing changed.",
    done: "Done",
    close: "Close",
  },

  onboarding: {
    groups: { features: "Features", keys: "Shortcuts", permissions: "Permissions", engine: "Engine" },
    // 口号：开屏、功能两页的大标题，和首页的一样
    intro: { soft: "Speak it written. ", title: "Select to translate." },
    splash: {
      line: "Voice input, voice translation and selection translation, one shortcut away",
      start: "Get started",
    },
    keys: {
      soft: "Check the ",
      title: "shortcuts",
      press: "Press it",
      passed: "Passed",
      change: "Change",
      record: "Press a new shortcut",
    },
    permissions: {
      soft: "Turn on three ",
      title: "permissions",
      allow: "Allow",
      on: "On",
      press: "Press",
      history: "History stays on this Mac",
      audio: "Audio goes only to your model",
      key: "Keys encrypted on this Mac",
    },
    engine: {
      soft: "Last, ",
      title: "set up the engine",
      untested: "{count} untested",
      missing: "{count} off",
      ready: "Set up",
      unset: "Not set up",
      go: "Open Engine",
      later: "Later",
    },
    // 页底角落：这一步配的东西在主窗口哪里随时能改
    where: "Change anytime in {place}",
    back: "Back",
    next: "Continue",
    skip: "Skip",
    skipAll: "Skip setup",
    // 功能演示（onboarding/scene.mjs）：一个聊天窗口、一个文档窗口里的字
    scene: {
      spoken: "Spoken",
      today: "Today",
      message: "Message {name}",
      rail: { home: "Home", messages: "DMs", activity: "Activity", docs: "Docs" },
      dictate: {
        contact: "Chen",
        earlier: "Read through the proposal. Looks good.",
        incoming: "Is tomorrow's meeting still on?",
        said: "Um, so the meeting tomorrow, let's move it to, uh, to three p.m., and bring the, the proposal.",
        wrote: "Let's move tomorrow's meeting to 3 p.m. and bring the proposal.",
      },
      translate: {
        contact: "王芳",
        earlier: "方案收到了，谢谢！",
        incoming: "下周什么时候有空？",
        said: "Let's move the meeting to Thursday afternoon, and please send me the slides beforehand.",
        wrote: "我们把会议改到周四下午吧，请提前把幻灯片发给我。",
      },
      lookup: {
        site: "文档",
        title: "入门指南",
        toc: { intro: "简介", start: "入门指南", config: "配置", plugins: "插件", trouble: "故障排查" },
        before: "克隆仓库并安装依赖。",
        selected: "首次构建会下载工具链，可能需要几分钟。",
        after: "提交合并请求前请先运行测试。",
        more: "如果构建失败，请删除缓存目录后重试。常见错误及解决办法见故障排查指南。",
        wrote: "The first build downloads the toolchain, which may take a few minutes.",
      },
    },
  },

  // The SpeakMore running in this home (src/instance.mjs): what to say when it can't be stopped
  instance: {
    stuckNoPid:
      "SpeakMore is stuck and not answering, and its process can't be identified. Find the process named Electron or SpeakMore in Activity Monitor and quit it.",
    cantStop: "Can't stop SpeakMore (PID {pid}). Quit it in Activity Monitor.",
  },

  // Version checks and updates (src/update): both the command line and the app say these
  update: {
    fromSource: "This copy runs from source ({dir}): update it with git pull.",
    unreachable: "Couldn't reach {url}: {reason}",
    badVersion: "The download server returned a bad version number: {value}",
    badChannel: "The channel.json on the download server is invalid: {value}",
    reinstall:
      "{version} needs a fresh install to upgrade: run the install command again in a terminal, or download the new installer.",
    checksum:
      "Downloaded update data ({object}) doesn't match the release; it was probably damaged in transit. Update again.",
    badManifest:
      "The update manifest ({manifest}) on the download server is invalid. Try again later; if it keeps happening, please report it.",
    noTarget: "The {version} release has no update for this computer ({target}).",
    appWrongPackage: "What was put together isn't SpeakMore.app {version}, so nothing was installed.",
    appUnsigned: "The new SpeakMore.app isn't properly signed, so it wasn't installed: {reason}",
    appOtherDeveloper:
      "The new SpeakMore.app is signed by a different developer ({found}; the installed one is {installed}), so it wasn't installed.",
    appReplace: "Couldn't replace {path}: {reason}. You can download {url} and drag it into Applications yourself.",
    busy: "Another update is in progress (PID {pid}). Wait for it to finish.",
    installFailed: "The installation didn't finish (installer exit code {code}); see its output or the log for why.",
    recordFailed: "Couldn't write the update record to {file} ({reason}); the progress shown in Settings may be off.",
    exitedEarly: "The update process quit unexpectedly (exit code {code}); details are in {log}.",
    reopenUnknown: "The new version is installed, but SpeakMore.app's location is unknown. Open it from Applications.",
    reopenFailed:
      "The new version is installed, but SpeakMore.app couldn't be reopened ({reason}). Open it from Applications.",
    restartFailed:
      "The new version is installed, but SpeakMore couldn't be restarted (exit code {code}). Run speakmore in a terminal to start it; details are in {log}.",
    interrupted: "The last update was interrupted; details are in {log}. You can update again.",
    downloading: "Downloading the update: {percent}%",
    delta: "Downloaded {download}; the other {reused} came from files already on this computer.",
    prepareFailed: "Couldn't prepare the new version in {dir}: {reason}",
    updating: "Updating SpeakMore {current} → {latest}",
    updatingApp: "Updating SpeakMore.app {current} → {latest}",
    appDone: "SpeakMore.app is now {version}.",
    reopened: "Reopened SpeakMore.app.",
    leftover: "Couldn't remove the temporary files at {dir} ({reason}); you can delete them yourself.",
    copies: { home: "The terminal install of SpeakMore", bundle: "SpeakMore.app" },
  },

  paths: {
    homeNotAbsolute: "The SPEAKMORE_HOME env var must be an absolute path; it's {home}",
    homeTooLong:
      "The SpeakMore folder path is too long for the control socket: {home}\nMove this folder somewhere with a shorter path, then run the install command and choose the folder that holds it.",
    homeParentMissing:
      "Can't find the SpeakMore folder {home}: {parent} doesn't exist. If it's on an external or another drive, connect that drive first.",
    homeMoved:
      "SpeakMore has moved to {to}; this ({home}) is the old folder that hasn't been fully removed yet. Open SpeakMore from its new place.",
    homeMissing:
      "Can't find the SpeakMore folder {home} (the location file {file} says it's there).\nIf it's on an external or another drive, connect that drive. If you no longer use that place, delete the location file to use the default one.",
  },

  move: {
    notFull: "Use a full path, like {example}: {folder}",
    noFolder: "{folder} doesn't exist or isn't a folder. Create it first, then choose it again.",
    sameHome: "SpeakMore is already in {home}; nothing to move.",
    insideHome: "SpeakMore can't move into its own folder ({home}). Choose another folder.",
    notEmpty:
      "{home} isn't empty. SpeakMore only moves into an empty place: choose another folder, or empty that one first.",
    tooLongBytes: "That path is too long: {home}\nIt can be at most {max} bytes. Choose a shorter place.",
    tooLongChars: "That path is too long: {home}\nIt can be at most {max} characters. Choose a shorter place.",
    inProgress: "SpeakMore is moving from {home} to {to}; it will reopen when the move is done.",
    unfinishedCopy:
      "This folder ({home}) was copied by a move that didn't finish; SpeakMore is still in {from}. Open SpeakMore from there and it will clean up the unfinished move.",
    interrupted: "The move stopped halfway (the process quit unexpectedly)",
    notRecorded:
      "The folder in use, {home}, was set just for this run by SPEAKMORE_HOME; SpeakMore's recorded place is {recorded}. Only the recorded one can be moved.",
    homeTooOld:
      "The SpeakMore program in {home} is too old to move. Update it first (speakmore update, or run the install command again), then move.",
    appTooOld:
      "{app} is still version {version} and won't find the new place. Run speakmore update to update it too, then move.",
    noSpace: "Not enough space on the disk of {folder}: {need} needed, {free} free.",
    recovered: "The last move to {to} didn't finish and has been cleaned up: SpeakMore is still in {home}.",
    copying: "Copying to {to}…",
    switching: "Switching to the new place…",
    rehomeFailed: "The program in the new place couldn't be set up (installer exit code {code}).",
    restoreFailed: "Couldn't point SpeakMore back to {home} (installer exit code {code}).",
    putBack: "The move to {home} didn't finish; SpeakMore has been put back in {from}. Open SpeakMore again.",
    notOurCopy: "{to} doesn't hold this move's copy, so it was left alone.",
    copyBroken: "The copied files are incomplete: {reason}",
    cleanupProblem: "Something went wrong while putting things back: {problem}",
    recordFailed: "Couldn't write the move record ({reason}); SpeakMore works as usual.",
    leftover: "Couldn't fully delete {dir} ({reason}); you can delete it yourself.",
    clearedEnv: "Removed the SPEAKMORE_HOME environment variable that pointed to the old place.",
    reopened: "Reopened SpeakMore.",
    reopenFailed: "SpeakMore didn't reopen by itself ({reason}); please open it.",
    restartFailed: "the start command exited with code {code}",
    unsupportedDrive:
      "The disk of {home} can't hold SpeakMore: {what} ({reason}). exFAT and FAT32, common on USB sticks and external drives, aren't supported; choose a disk formatted as APFS or Mac OS Extended.",
    probe: {
      create: "can't create a folder",
      restrict: "can't make it private to you",
      symlink: "can't create symbolic links",
      socket: "can't create the local socket SpeakMore talks through",
    },
  },

  location: {
    invalid:
      "SpeakMore's location file is invalid: {file}\nIt should hold the full path of the SpeakMore folder. Deleting it makes SpeakMore use the default location.",
    unreadable: "Can't read SpeakMore's location file {file} ({reason})",
  },

  control: {
    notRunning: "SpeakMore isn't running",
    timeout: "SpeakMore didn't reply within {seconds} seconds (command {command})",
    unreadable: "Couldn't understand SpeakMore's reply (command {command})",
  },

  storage: {
    historyTooNew:
      "The history database is version {found}, newer than this program knows ({known}), so it won't touch it",
    historyTooOld:
      "The history database is version {found}, but this program expects {known}: start SpeakMore once, or update to the latest version",
    legacyRunning:
      "An old version of SpeakMore is still running, so its data can't be moved. Quit it first (menu bar → Quit), then run this again.",
    settingsMigrateFailed:
      "Can't update the old shortcut in the settings file {file} ({reason}). Make the file writable, then run this again.",
  },

  cli: {
    help: `SpeakMore: press a hotkey, speak, and refined text is pasted into the current text box.

  speakmore                     Start (just shows status if already running). First run asks for an API key (Gemini by default)
  speakmore start               Same as above
  speakmore stop                Stop
  speakmore restart             Restart
  speakmore status [--json]     Status: running or not, key, system permissions, how much you said today and in total
  speakmore update              Update to the latest version (on a Mac, SpeakMore.app too if you have it). Settings, keys, the dictionary, history, and recordings are kept

  speakmore history [-n count] [--json]
                                What you said and looked up, grouped by day, newest first (latest {limit} by default)
  speakmore dict [--json]       The dictionary: names, products and terms you say often, spelled as written. Stored on this device only
  speakmore dict add|remove <word>…
                                Add or delete words, several at once (quote words with spaces)
  speakmore dict import <file>  Import a one-column CSV or a one-word-per-line text file; existing words are skipped
  speakmore usage [--json]      What it cost: spend and tokens today, this month, and in total, model reply times, per model
  speakmore mode                The three recognition modes and what each uses: native (Direct) sends the recording to the model; local (Hybrid) transcribes, then a model refines it; private (Offline) transcribes with an on-device model and uploads nothing
  speakmore mode <native|local|private> [--model …] [--transcriber …] [--polish … --url … --params …]
                                Switch mode, live. Can bring that mode's own settings, e.g. a custom service on first entering local
  speakmore model               Native mode: available providers ({providers}), whether each has a key, which one is in use
  speakmore model <provider>[/<model>]
                                Switch provider or model in native mode, e.g. speakmore model openai. Asks for its key if missing
  speakmore transcriber [<model>]
                                Local mode, speech to text: list or switch the on-device model. Asks before downloading one you don't have
  speakmore transcriber download|cancel|delete <model> [--yes]
                                Download, stop downloading, or delete an on-device model (in any mode; the one in use can't be deleted)
  speakmore transcriber check [<model>]
                                Check an on-device model: the system voice reads a sentence and the model transcribes it. Defaults to the selected one
  speakmore polish [<provider>[/<model>] [--url <url>] [--params <JSON>]]
                                Local mode, refining: list or switch the refining model ({polishers}). custom is any OpenAI-compatible service;
                                --params adds request parameters for it, e.g. '{"reasoning_effort": "minimal"}'
  speakmore polish check [<provider>[/<model>] [--url <url>] [--params <JSON>]]
                                Check the refining step works
  speakmore model check [<provider>[/<model>]]
                                Check it works: sends that provider a minimal request with its key. Defaults to the current one
  speakmore key [<provider>]    Replace a key; defaults to the current provider (input is hidden; can also be piped in)
  speakmore key --forget [<provider>]
                                Delete the saved key
  speakmore config              Settings: hotkey, model, thinking level, theme, language, and where data and logs live
  speakmore config set <name> <value>
                                Change one directly, with no checks (the mode and model commands above check first)
  speakmore config unset <name> Reset to the default
  speakmore theme               List themes and the one in use
  speakmore theme <name>        Switch theme ({themes}); applies right away, no restart
  speakmore settings            Open Settings (to grant macOS permissions)
  speakmore logs [-n lines] [-f]
                                Show logs; -f keeps following
  speakmore move [<folder>] [--yes]
                                Move SpeakMore's folder (program, on-device models, recordings, settings) into .speakmore
                                inside that folder, e.g. on another disk. speakmore move ~ moves it back to the default
                                place. Without a folder, shows where it is now
  speakmore uninstall [--keep-data] [--yes]
                                Uninstall: stop it and delete the whole SpeakMore folder. --keep-data keeps settings, keys, the dictionary, history, and recordings

  speakmore help                This help
  speakmore --version           Version
`,
    macOnly:
      "SpeakMore only supports macOS and Windows for now: listening for the hotkey and pasting rely on each system's own APIs.",
    nodeVersion: "SpeakMore needs Node 22.13 or newer (23.4 or newer on the 23 line); this is {version}.",
    unknownCommand: "There's no command called {name}.",
    seeHelp: "Run speakmore help to see all commands.",
    stuck: "It may be stuck. Run speakmore stop to force it to stop, then run speakmore to start it again.",
    migrated: "Moved the old version's data to {home} ({items}).",
    badArgs: "Invalid arguments: {reason}",
    extraArgs: "Unexpected argument {args}. Usage: {usage}",
    positiveInteger: "{flag} needs a positive integer",
    starting: "Starting SpeakMore…",
    runRestart: "run speakmore restart",
    packagedRelaunch: "click the SpeakMore menu bar icon → Quit SpeakMore, then open SpeakMore.app again",
    syntax: {
      start: "speakmore start",
      stop: "speakmore stop",
      restart: "speakmore restart",
      status: "speakmore status [--json]",
      history: "speakmore history [-n count] [--json]",
      usage: "speakmore usage [--json]",
      logs: "speakmore logs [-n lines] [-f]",
      settings: "speakmore settings",
      uninstall: "speakmore uninstall [--keep-data] [--yes]",
      move: "speakmore move [<folder>] [--yes]",
      config: "Usage: speakmore config | speakmore config set <name> <value> | speakmore config unset <name>",
      theme: "Usage: speakmore theme | speakmore theme <name>",
      model:
        "Usage: speakmore model | speakmore model <provider>[/<model>] | speakmore model check [<provider>[/<model>]]",
      mode: "Usage: speakmore mode | speakmore mode <native|local|private> [--model …] [--transcriber …] [--polish … --url … --params …]",
      transcriber:
        "Usage: speakmore transcriber | speakmore transcriber <model> | speakmore transcriber download|cancel|delete <model> [--yes] | speakmore transcriber check [<model>]",
      polish:
        "Usage: speakmore polish | speakmore polish <provider>[/<model>] [--url <url>] [--params <JSON>] | speakmore polish check [<provider>[/<model>] [--url <url>] [--params <JSON>]]",
    },
    update: {
      upToDate: "Already up to date ({version}).",
      available: "SpeakMore {latest} is out (you have {current}): run speakmore update.",
      otherAvailable: "{copy} is still {current}; {latest} is out: run speakmore update.",
      startHint: "Updated to {version}. Run speakmore to start it.",
      inProgress: "Updating to {version}…",
      lastFailed: "The last update didn't finish: {problem}",
    },

    lifecycle: {
      openedOnboarding:
        "Opened the setup guide. Grant the missing permissions there, then run speakmore status to check.",
      openedSettings: "Opened Settings. Grant the missing permissions there, then run speakmore status to check.",
      notRunning: "SpeakMore wasn't running.",
      stopped: "SpeakMore stopped.",
      killed: "SpeakMore was stuck and has been force-quit.",
      packagedRestart:
        "The running SpeakMore is SpeakMore.app in Applications. Restarting it from the command line would swap in a terminal-launched copy with separate permissions and keys.",
      howToRestart: "To restart it: {relaunch}.",
    },
    key: {
      prompt: "Paste the key and press Enter (input is hidden): ",
      need: "SpeakMore needs a {provider} API key: recordings are sent to {provider} to become text.",
      getOne: "Don't have one? Get one here: {url}",
      storage: "It's encrypted with the system keychain and stays on this Mac.",
      skip: "Press Enter to skip for now.",
      legacyDaemon:
        "The running SpeakMore is an old version that doesn't know {provider} keys yet: {restart} first, then try again.",
      verifying: "Verifying…",
      saved: "Key saved and verified.",
      rejected: "This key didn't pass: {problem}",
      notInline:
        "Don't put the key after the command: it would stay in your shell history. Run speakmore key and paste it, or pipe it in: pbpaste | speakmore key. To set one for a specific provider, add its name: {providers}",
      forgotten: "Deleted the saved {provider} key.",
      whichVendor: "Offline mode doesn't use a key. To set one for a provider, add its name: {providers}",
      cancelled: "Cancelled; the key is unchanged.",
      nothingRead: "No key read; the old one is unchanged.",
      badShapeUnchanged: "{problem}. The old one is unchanged.",
      switchHint: "To use it: {command}",
      needText:
        "You need a {provider} API key: recordings are transcribed on this Mac, and only the text goes to {provider} for refining.",
      customWithModel:
        "A custom service's key goes in together with its model and address: speakmore polish custom/<model> --url <url> (not in local mode yet: speakmore mode local --polish custom/<model> --url <url>)",
    },
    config: {
      nextLaunch: "Takes effect next launch.",
      packaged: "The running SpeakMore is SpeakMore.app in Applications. To apply the new settings: {relaunch}.",
      restarting: "Restarting SpeakMore to apply…",
      restartedBroken: "Restarted, but it can't be used now: {problem}",
      undo: "To undo this change: {undo}",
      restartedKeyBad:
        "Restarted, but the {provider} key doesn't work: {problem}. Run speakmore key {id} to replace it",
      restartedNoKey: "Restarted, but there's no {provider} key yet, so it can't be used: run speakmore key {id}",
      restartedStarting: "Restarted, but not ready yet: run speakmore status to check.",
      restartedUnverified:
        "Restarted, but couldn't reach {provider}, so the new settings aren't verified yet: run speakmore status in a bit.",
      applied: "Applied.",
      oldDaemonLive: "The running SpeakMore is an old version and won't switch on the fly: run speakmore restart.",
      appliedLive: "Applied, no restart needed.",
      themeOverridden:
        "The running SpeakMore still uses {theme}: {variable} is set where it was started, and it overrides the settings file.",
      languageOverridden:
        "The running SpeakMore still uses {language}: {variable} is set where it was started, and it overrides the settings file.",
      modelSourceOverridden:
        "The running SpeakMore still uses {source}: {variable} is set where it was started, and it overrides the settings file.",
      hotkeyOverridden:
        "The running SpeakMore still uses {hotkey}: {variable} is set where it was started, and it overrides the settings file.",
      envWarning: "Note: the {variable} env var is set and overrides this value.",
      warning: "Note: {warning}",
      changed: "{name} set to {value}.",
      modeCommand:
        "This is usually changed with {command}, which checks it works first and leaves it alone if not. config set skips the checks and writes it straight in.",
      otherMode: "You're in {current} mode now; this takes effect when you switch to {mode} mode.",
      unset: "{name} reset to the default, {value}.",
      themeChanged: "Theme set to {theme}.",
      notRunning: "SpeakMore isn't running. Run speakmore to start it first.",
      settingsOpened: "Settings opened.",
      title: "Settings",
      choices: "{describe}. Options: {choices}",
      hintSet: "Change one: speakmore config set hotkey.dictate Fn+Space",
      hintUnset: "Reset one: speakmore config unset hotkey.dictate",
      hintKey: "Replace the key: speakmore key",
      hintTheme: "Switch theme: speakmore theme",
      folder: "Folder",
      settingsFile: "Settings file",
      log: "Log",
      oneFolder: "The program, settings, keys, dictionary, history, and recordings all live in this one folder.",
      uninstallHint: "Done with it? speakmore uninstall stops it and deletes the whole folder.",
    },
    source: {
      default: "default",
      file: "from the settings file",
      env: "from the {variable} env var this run",
    },
    themeTitle: "{name} ({id})",
    themes: {
      title: "Themes",
      current: "Using {theme} · {source}",
      switch: "Switch: speakmore theme {id} (applies right away, no restart)",
    },
    modes: {
      title: "Recognition modes",
      notIn: "You're in {current} mode; {what} can only be changed in {mode} mode: run speakmore mode {mode} first",
      notSwitched: "Not switched: {problem}",
      applied: "Switched, no restart needed.",
      notUsable: "But it doesn't work yet: {problem}",
      downloading:
        "The local model is downloading in the background ({percent}%); it'll work once it's done. Progress: speakmore status",
      loading: "The local model is loading; a few seconds.",
      switch: "Switch: speakmore mode {mode} (takes effect right away)",
      nativeModels: "Change the model in native: speakmore model",
      localHops: "The two steps of local: speakmore transcriber (speech to text) · speakmore polish (refining)",
      withSettings:
        "Use a custom service on first entering local: speakmore mode local --polish custom/<model> --url <url>",
      flagsFor: "{flag} isn't a {mode} setting; switching to {mode} can bring {flags}",
      already: "Already in {mode} mode: {route}.",
      switched: "Switched to {mode} mode: {route}.",
      localRoute: "{transcriber} → {polish}",
      privateRoute: "{transcriber} on this Mac; no refining, nothing uploaded",
      privateModel: "The on-device model in private: speakmore transcriber (on-device models only)",
    },
    local: {
      notInLocal: "You're in {current} mode, so these aren't in use: switch first (speakmore mode local or private)",
      cloudNoDownload: "{model} is a cloud model; there's nothing to download",
      cloudCheckOk: "{model} works; the request took {seconds}.",
      transcribersTitle: "On-device speech-to-text models (the first step of local, the model of private)",
      installed: "downloaded",
      notInstalled: "not downloaded",
      downloading: "downloading {percent}%",
      partial: "{percent}% downloaded",
      downloadFailed: "download failed",
      summary: "{count} of {all} downloaded on this Mac, {size} in total",
      freeSpace: "{size} free on disk",
      transcriberCurrent: "In use: {model}",
      transcriberSwitch: "Switch: speakmore transcriber {id}",
      transcriberManage: "Download: speakmore transcriber download {id} · stop: cancel · remove: delete · check: check",
      downloadStart: "Downloading {model} ({size}, from {source})…",
      downloadBackground:
        "SpeakMore is downloading it in the background: Ctrl-C only stops watching; to stop the download, run speakmore transcriber cancel {id}",
      downloadProgress: "Downloading {percent}% ({received} / {total})",
      downloadDone: "{model} is downloaded.",
      downloadAlready: "{model} is already downloaded.",
      downloadStopped:
        "The {model} download stopped (cancelled elsewhere). Finished files are kept; a half-done file starts over next time.",
      downloadInterrupted:
        "SpeakMore quit during the download. Finished files are kept; run speakmore transcriber download {id} to continue.",
      nothingToCancel: "{model} isn't downloading.",
      cancelled: "Stopped downloading {model}. Finished files are kept; a half-done file starts over next time.",
      notOnDisk: "{model} isn't downloaded, so there's nothing to delete.",
      deleteConfirm: "Delete {model} ({size})? You'll need to download it again to use it. Type y to confirm: ",
      deleteNeedsConfirm:
        "Deleting needs confirmation: run it in a terminal, or add --yes (speakmore transcriber delete {id} --yes)",
      deleteAborted: "Nothing deleted.",
      deleted: "Deleted {model}, freeing {size}.",
      oldDaemonDelete:
        "The running SpeakMore is an old version that can't tell which model is in use, so nothing was deleted: run speakmore restart, then try again.",
      checking: "Checking {model}: reading it a sentence…",
      checkOk: "{model} works. Read “{said}”, got “{text}”, transcribed in {seconds}.",
      checkLoaded: "It wasn't in use: loading it took {seconds}, and it's unloaded again.",
      oldDaemonCheck:
        "The running SpeakMore is an old version that can't check on-device models: run speakmore restart, then check again.",
      notDownloadedAsk: "{model} isn't downloaded yet ({size}, from {source}). Download it now? Type y to download: ",
      notDownloadedHint: "{model} isn't downloaded yet: run speakmore transcriber download {id} first",
      notDownloadedLater:
        "Nothing downloaded or switched. To download it later, run speakmore transcriber download {id}",
      transcriberSwitched: "Speech to text now uses {model}.",
      polishTitle: "Refining models (the second step of local mode)",
      customName: "Custom service",
      customModel: "your own model and address",
      alsoModels: "also: {models}",
      polishCurrent: "In use: {model}",
      polishSwitch: "Switch: speakmore polish deepseek/deepseek-v4-pro",
      polishCustom:
        "Custom service (OpenAI-compatible): speakmore polish custom/<model> --url <url> [--params '<JSON>']",
      polishParams: "Extra parameters: {params}",
      polishCheck: "Check it works: speakmore polish check",
      polishSwitched: "Refining now uses {model}.",
      urlNeeded: "A custom refining service needs its address: --url <url> (OpenAI-compatible; most end in /v1)",
      paramsCustomOnly: "--params is only for the custom service: use it when refining goes to custom/<model>",
      sourceCurrent: "Downloads from: {source}",
      sourceSwitch: "Change: speakmore config set modelSource {other} (falls back to the other if one stalls)",
    },
    choose: {
      question: "First, pick how recordings become text (change it later with speakmore mode or speakmore model):",
      native: "native (Direct) mode: the recording goes straight to the model",
      local:
        "local (Hybrid) mode: transcribed on this Mac, only the text goes to a model for refining (first use downloads a {size} local model)",
      private:
        "private (Offline) mode: transcribed on this Mac only; no refining, nothing uploaded (first use downloads a {size} local model)",
      privateOption: "Offline    no key needed",
      custom:
        "  To use another service (OpenAI-compatible): after setup, run speakmore mode local --polish custom/<model> --url <url>",
    },
    model: {
      textOnly:
        "{provider} only takes text; it refines in local mode: speakmore polish {id} (not in local mode yet? speakmore mode local first)",
      notInNative: "You're in {current} mode, so these models aren't in use: switch back first (speakmore mode native)",
      unknownProvider: "Unknown provider {name}; available: {providers}. To pick a model, write provider/model",
      invalid: "Model is {value}: {reason}",
      describe: "{provider} {model}",
      option: "default {model}",
      optionWithKey: "default {model}, key already set",
      choose: "First, pick whose model turns your recordings into text (change it later with speakmore model):",
      choosePrompt: "Enter a number and press Enter (just Enter picks {fallback}): ",
      choosePromptAgain: "Enter a number and press Enter: ",
      choiceItem: "{number} ({name})",
      noSuchChoice: "There's no option {answer}; choose {choices}.",
      noKeyNonInteractive: "No {provider} key yet, so nothing changed: run speakmore key {id} first, then switch.",
      notSwitched: "Not switched: no {provider} key yet.",
      switched: "Model switched to {model}.",
      checking: "Checking {model}…",
      oldDaemonCheck:
        "The running SpeakMore is an old version and can't check: run speakmore restart, then check again.",
      unusable: "Not usable: {problem}",
      usable: "Works: {model}, using {from}, round trip {seconds}s.",
      fromEnv: "the key in the {variable} env var",
      fromStored: "the saved key",
    },
    models: {
      title: "Models",
      default: "{model} (default)",
      keyStored: "key saved",
      keyEnv: "key from the {variable} env var",
      noKey: "no key yet",
      current: "Using {provider} {model} · {source}",
      switch: "Switch provider: speakmore model {id} (asks for its key if missing)",
      pick: "Pick a model: speakmore model {id}/{model}",
      check: "Check it works: speakmore model check (no argument checks the current one)",
    },
    status: {
      notRunning: "not running",
      runToStart: "Run {command} to start it.",
      starting: "starting",
      running: "running",
      missingCount: { one: "running, {count} thing missing", other: "running, {count} things missing" },
      preparing: "running, getting ready",
      ready:
        "Ready: click into any text box, press {hotkey} to start talking, press it again to finish, and the text gets pasted in.",
      missing: "Missing: {items}.",
      key: "Key",
      permissions: "Permissions",
      hotkey: "Hotkey",
      model: "Model",
      theme: "Theme",
      language: "Language",
      today: "Today",
      total: "All time",
      modelExternal: "decided by the separately started server",
      mode: "Mode",
      localModel: "Local model",
      localReady: "ready · {backend}",
      localDownloading: "downloading {percent}% ({received} / {total} MB)",
      localLoading: "loading",
      localIdle: "released while idle, loads when you speak",
      localMissing: "not downloaded: speakmore transcriber download {id}",
      modelInUse: "{provider} {model}",
      modelWithThinking: "{provider} {model} ({thinking})",
      keyEnv: "Using the one in the {variable} env var this run, not saved",
      keyEnvUnverified:
        "Using the one in the {variable} env var this run, not saved; couldn't reach {provider} at launch, so it isn't verified yet",
      keyExternal: "Connected to a separately started server; the key is set there",
      keyNone: "Not needed (Offline mode)",
      keySaved: "Saved and verified",
      keySavedUnverified: "Saved; couldn't reach {provider} at launch, so it isn't verified yet",
      keyChecking: "Verifying…",
      keyCheckFailed: "Check failed: {problem}. The key may be fine; check the {what} first: speakmore config",
      modelAndLevel: "model and thinking level",
      modelOnly: "model",
      keyEnvRejected:
        "The key in the {variable} env var doesn't work: {problem}. Fix it or remove the variable, then restart",
      keyRejected: "Not working: {problem}. Run speakmore key to replace it",
      keyUnreadable: "{problem}: run speakmore key",
      keyMissing: "Not set: run speakmore key",
      keyMissingFor: "{provider} key not set: run speakmore key {id}",
      dictations: { one: "{count} dictation", other: "{count} dictations" },
      characters: { one: "{count} character", other: "{count} characters" },
      pace: "{count} characters/min",
      atLeast: "at least {cost}",
      costUnknown: "cost unknown",
      pending: "Changed in settings but not applied yet ({names}): {relaunch}.",
      helperStopped:
        "The key-listening helper stopped, so the hotkey won't work: {relaunch}. If it keeps happening, see speakmore logs.",
      openSettings:
        "Run {command} to open the permissions page in Settings: each permission has a button to System Settings; after turning it on, click “Check again”.",
      ownerApp: "Permissions belong to the app itself; look for “SpeakMore” in the System Settings lists.",
      ownerTerminal:
        "Permissions belong to the terminal app that started SpeakMore (e.g. Terminal or iTerm); look for it in the System Settings lists.",
      footer: `speakmore history  what you said     speakmore config  view and change settings
speakmore usage    what it cost      speakmore stop    stop it
speakmore help     all commands`,
    },
    dict: {
      usage: "Usage: speakmore dict [--json] | speakmore dict add|remove <word>… | speakmore dict import <file>",
      empty: "The dictionary is empty. Add words: speakmore dict add <word>…",
      header: {
        one: "{count} word in the dictionary ({file}, stored on this device only):",
        other: "{count} words in the dictionary ({file}, stored on this device only):",
      },
      added: "Added: {term}",
      notAdded: "Didn't add {term}: {reason}",
      removed: { one: "Deleted {count} word.", other: "Deleted {count} words." },
      imported: {
        one: "Imported {count} word ({existing} already in the dictionary, {duplicates} repeated in the file, {invalid} invalid).",
        other:
          "Imported {count} words ({existing} already in the dictionary, {duplicates} repeated in the file, {invalid} invalid).",
      },
    },
    history: {
      empty: "No dictations yet. Run {command} to start, then press the hotkey and say something.",
      today: "Today · {date}",
      yesterday: "Yesterday · {date}",
      failed: "✗ Failed: {reason}",
      recording: "Recording {seconds}s, kept at {path}",
      notSaved: "(not saved)",
      source: "{label}: {text}",
      more: "Showing the latest {shown} of {total}. Run speakmore history -n {total} to see all.",
    },
    usage: {
      empty: "No usage yet. Say something first: every model call's cost, tokens, and reply time get recorded.",
      title: "Usage",
      cost: "Cost",
      tokens: "Tokens",
      dictations: "Dictations",
      latency: "Model reply",
      waiting: "usually {median}, slow {slow}",
      usually: "usually {median}",
      unpriced: "price unknown",
      localModel: "{name} (on-device)",
      free: "free",
      times: { one: "{count} use", other: "{count} uses" },
      byModel: "By model (all time)",
      tokensNote:
        "All-time tokens: input {input} (audio {audio}, cached {cached}), output {output} (thinking {thinking}).",
      lookupsNote: {
        one: "{count} selection translation: counted in cost and tokens, not in dictations or reply time.",
        other: "{count} selection translations: counted in cost and tokens, not in dictations or reply time.",
      },
      checksNote: { one: "Includes {count} key check.", other: "Includes {count} key checks." },
      cacheNote: "{cost} of the cost is prompt caching (creating and keeping it).",
      unpricedNote: "{models} aren't in the price list; those {count} calls aren't counted.",
      estimateNote:
        "Costs are USD estimates at each provider's standard price; Gemini use within the free tier is actually free.",
    },
    logs: {
      none: "No logs yet: SpeakMore writes them to {file} once it has started",
    },
    move: {
      where: "SpeakMore is in {home}.",
      how: "To move it elsewhere (another disk, say): speakmore move <folder>; it goes into .speakmore inside that folder. To move it back to the default place: speakmore move ~",
      needsConfirm: "Moving needs a confirmation. Add --yes when not running in a terminal.",
      plan: "About to move SpeakMore from {from} to {to}: {size} to copy ({count} files), with the program, on-device models, recordings and settings.\nSpeakMore stops while it moves and reopens when done; if the move fails, everything stays as it was.",
      unknown: "Things in the old folder that aren't SpeakMore's are neither moved nor deleted: {items}",
      confirm: "Move it? Type y and press Enter: ",
      aborted: "Nothing changed.",
      progress: "Copied {percent}% ({done} / {total})",
      done: "SpeakMore has moved to {to} ({count} files, {size}).",
      removed: "Deleted the old folder {dir}.",
      later: "The old folder {dir} is in use by this command; it will be deleted a few seconds after it exits.",
      left: "The old folder {dir} still has things that aren't SpeakMore's; they were left alone: {items}",
    },
    uninstall: {
      yours: "settings, keys, dictionary, history, and recordings",
      needsConfirm: "Uninstalling needs confirmation. Add --yes when not running in a terminal.",
      planKeep: "About to uninstall SpeakMore: delete the program and runtime in {home}, keeping your {yours}.",
      planAll:
        "About to uninstall SpeakMore: delete all of {home}, including the program, runtime, and your {yours}. This can't be undone.",
      confirm: "Are you sure? Type y and press Enter: ",
      aborted: "Nothing changed.",
      removedKeep: "the program, runtime, logs, and cache in {home}",
      keychainItem: "the keychain item used to encrypt keys",
      keychainFailed:
        "The keychain item used to encrypt keys wasn't deleted ({reason}): search for SpeakMore in Keychain Access and delete it by hand",
      pathEntry: "{entry} in your user Path",
      loginItem: "Open at login",
      afterExit: "The program files are in use by this command; they're removed a few seconds after it exits",
      removedAll: "{home} (the program, runtime, and your {yours})",
      locationFile: "SpeakMore's location file {file}",
      locationUnreadable:
        "The location file {file} couldn't be read ({reason}) and wasn't deleted; you can delete it yourself",
      halfCopy: "{dir} (a copy left by a move that didn't finish)",
      done: "SpeakMore uninstalled.",
      removed: "Deleted: {item}",
      kept: "Kept: your {yours} in {home}. Reinstall to pick up where you left off; delete the folder if you don't need them",
      leftovers: "Still on your system:",
      permissions:
        "Microphone, Input Monitoring, and Accessibility access for your terminal is untouched: it belongs to the terminal app and can be turned off in System Settings → Privacy & Security",
      sharedPrefs:
        "{file} is untouched: a small file where the runtime remembers things like window sizes, shared by every app built on stock Electron",
      sourceDir: "Source folder is untouched: {dir}",
    },
    daemon: {
      noElectron: "Can't find Electron: dependencies aren't fully installed. Run npm install in {dir} and try again.",
      downloading: "First launch: downloading the Electron runtime (about 100 MB)…",
      downloadFailed: "Electron didn't download ({reason}). Check your network and run this again.",
      emptyLog: "(the log is empty)",
      micPrompt: "macOS is asking for microphone access: click “Allow” (the dialog shows your terminal app's name).",
      verifying: "Verifying key…",
      building: "First launch: building the key-listening helper…",
      signal: "ended by signal {signal}",
      exitCode: "exit code {code}",
      exitedEarly: "exited midway",
      failed: "SpeakMore failed to start ({reason}). Last lines of the log {file}:\n{tail}",
      noAnswer: "SpeakMore didn't respond within {seconds} seconds of starting. Check the log: {file}",
      needXcode:
        "Building the key-listening helper needs the Xcode Command Line Tools. Run this first: xcode-select --install",
      buildFailed:
        "The key-listening helper didn't build (if the Xcode Command Line Tools aren't installed, run xcode-select --install first):\n{detail}",
      needGo:
        "Running from source on Windows, building the key-listening helper needs Go 1.27 or newer (https://go.dev/dl/). Install it, then start again.",
      buildFailedGo: "The Windows key-listening helper didn't build:\n{detail}",
    },
  },

  // Windows 上说法不同的那几句，名字照抄通用的（见 src/i18n/index.mjs 开头）
  windows: {
    // A combination is joined with a plus sign (Right Alt+Space)
    chord: { text: "{first}+{second}" },
    binding: {
      leftOnly:
        "Everyday shortcuts start with left-hand modifiers (Ctrl+C, Alt+Tab), so this would fire by accident all the time: use a right-hand modifier",
    },
    keys: {
      ControlLeft: { name: "Left Ctrl", short: "Left Ctrl", keycap: "Left Ctrl" },
      ControlRight: { name: "Right Ctrl", short: "Right Ctrl", keycap: "Right Ctrl" },
      ShiftLeft: { name: "Left Shift", short: "Left Shift", keycap: "Left Shift" },
      ShiftRight: { name: "Right Shift", short: "Right Shift", keycap: "Right Shift" },
      AltLeft: { name: "Left Alt", short: "Left Alt", keycap: "Left Alt" },
      AltRight: { name: "Right Alt", short: "Right Alt", keycap: "Right Alt" },
      MetaLeft: { name: "Left Win", short: "Left Win", keycap: "Left Win" },
      MetaRight: { name: "Right Win", short: "Right Win", keycap: "Right Win" },
      Enter: { name: "Enter", short: "Enter", keycap: "Enter" },
      Tab: { name: "Tab", short: "Tab", keycap: "Tab" },
      Backspace: { name: "Backspace", short: "Backspace", keycap: "Backspace" },
      Delete: { name: "Delete", short: "Delete", keycap: "Delete" },
      CapsLock: { name: "Caps Lock", short: "Caps Lock", keycap: "Caps Lock" },
    },
    instance: {
      stuckNoPid:
        "SpeakMore is stuck and not answering, and its process can't be identified. In Task Manager's Details tab, find electron.exe and end it.",
      cantStop: "Can't stop SpeakMore (PID {pid}). End it in Task Manager.",
    },
    update: {
      restartFailed:
        "The new version is installed, but SpeakMore couldn't be restarted (exit code {code}). Open SpeakMore from the Start menu; details are in {log}.",
    },
    move: {
      unsupportedDrive:
        "The disk of {home} can't hold SpeakMore: {what} ({reason}). exFAT and FAT32, common on USB sticks and external drives, aren't supported; choose a disk formatted as NTFS.",
    },
    cli: {
      key: { storage: "It's encrypted with Windows data protection and stays on this PC." },
      config: { hintSet: "Change one: speakmore config set hotkey.dictate ControlRight" },
    },
    permissions: { openSettings: "Settings" },
    // PowerShell strips double quotes from arguments it passes to speakmore.cmd; they need a backslash
    chat: {
      paramsNotJson:
        'the extra parameters aren\'t valid JSON: keys and strings need straight double quotes, e.g. {"reasoning_effort": "minimal"}. In PowerShell, put a backslash before each double quote in --params: \'{\\"reasoning_effort\\": \\"minimal\\"}\'',
    },
    settings: {
      describe: {
        mode: "Recognition mode: native (Direct) sends the recording to a model that takes audio; local (Hybrid) turns speech into text first, then has any LLM refine it; private (Offline) only transcribes on this PC and uploads nothing",
        language: "Interface language; system follows Windows",
      },
    },
    modes: {
      local: "Hybrid: speech to text first, then a model refines it",
      private: "Offline: on-device models only, nothing uploaded",
    },
    setup: { openSettings: "tray icon › Settings" },
    key: {
      keychainUnavailable: "Windows' encrypted storage isn't available, so the key can't be stored safely",
      noKeyService:
        "No {provider} API key yet: run speakmore key in a terminal, or open Settings from the SpeakMore icon in the taskbar tray",
      noKeyServiceFor:
        "No {provider} API key yet: run speakmore key {id} in a terminal, or open Settings from the SpeakMore icon in the taskbar tray",
    },
    delivery: { pasteFailed: "Couldn't paste: text copied, press Ctrl+V to paste" },
    bar: { noMicPermission: "No microphone access: Settings › Privacy & security › Microphone" },
    plaza: {
      via: { local: "This PC" },
      groups: { local: "On this PC" },
      zoom: { hint: "Drag to pan · Pinch or Ctrl-scroll to zoom" },
    },
  },
};
