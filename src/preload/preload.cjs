// 页面能调用的全部主进程能力都列在这里。页面本身拿不到 Node 和 Electron 的接口。
// 沙箱里的预加载脚本只能用 CommonJS。
const { contextBridge, ipcRenderer, webFrame } = require("electron");

// 主题：页面的样式只用 var(--…) 引用颜色，值由主进程按现在的主题给（src/themes）。
// 同步取、马上注入，赶在页面画出第一帧之前。之后换主题时主进程会再发一份过来：先放上新的再撤掉旧的，
// 中间不会有哪一帧是没有颜色的。
let themeKey = webFrame.insertCSS(ipcRenderer.sendSync("theme:get"));
ipcRenderer.on("theme:changed", (_event, css) => {
  const previous = themeKey;
  themeKey = webFrame.insertCSS(css);
  webFrame.removeInsertedCSS(previous);
});

// 界面语言：同样同步取，页面一加载就按它写字（src/renderer/shared/i18n.mjs）。设置里换了语言，
// 主窗口和首次引导整页重新加载；悬浮条不重新加载（可能正在听写），收到新的语言换掉翻译
const locale = ipcRenderer.sendSync("locale:get");

contextBridge.exposeInMainWorld("speakmore", {
  locale,
  // 哪个系统：按系统说法不同的文案（src/i18n）、按系统摆的窗口元素（html 上的 data-platform）用它
  platform: process.platform,
  onLocaleChanged: (callback) => ipcRenderer.on("locale:changed", (_event, next) => callback(next)),
  config: () => ipcRenderer.invoke("config:get"),

  // 悬浮条
  onInput: (callback) => ipcRenderer.on("input", (_event, payload) => callback(payload)),
  onNotice: (callback) => ipcRenderer.on("notice", (_event, message) => callback(message)),
  onBarControls: (callback) => ipcRenderer.on("bar:controls", (_event, enabled) => callback(enabled)),
  setBarVisible: (visible) => ipcRenderer.send("bar:set-visible", visible),
  captureBarInput: (regions) => ipcRenderer.send("bar:capture", regions),
  // 每次开口时现读的设置（语音翻译译成哪几种）
  sessionConfig: () => ipcRenderer.invoke("bar:session-config"),
  deliver: (payload) => ipcRenderer.invoke("dictation:deliver", payload),
  reportFailure: (payload) => ipcRenderer.invoke("dictation:failed", payload),

  // 划词卡片（src/app/lookup/card-window.mjs）：主进程交来这一次的样子、截到的点击；页面报卡片多高、要截哪几块，
  // 点了什么，指针在不在要滚动的译文上
  onLookupView: (callback) => ipcRenderer.on("lookup:view", (_event, view) => callback(view)),
  onLookupClick: (callback) => ipcRenderer.on("lookup:click", (_event, id) => callback(id)),
  lookupLayout: (layout) => ipcRenderer.send("lookup:layout", layout),
  lookupAct: (action) => ipcRenderer.send("lookup:act", action),
  lookupScroll: (on) => ipcRenderer.send("lookup:scroll", on),

  onHotkeysChanged: (callback) => ipcRenderer.on("bar:hotkeys", (_event, hotkeys) => callback(hotkeys)),
  onBarHint: (callback) => ipcRenderer.on("bar:hint", (_event, value) => callback(value)),

  // 主窗口：首页、历史记录
  appInfo: () => ipcRenderer.invoke("app:info"),
  // 历史的筛选是可选的 { query, kinds }：搜索的字、只看哪几个功能。导出的是筛出来的全部，回 { count }，取消了是 null
  listHistory: (filter) => ipcRenderer.invoke("history:list", filter),
  exportHistory: (filter) => ipcRenderer.invoke("history:export", filter),
  // 回放：给一条历史记录的 id，回录音的字节
  historyAudio: (id) => ipcRenderer.invoke("history:audio", id),
  // 重跑：能选什么；按选的方式和设置再跑一次 { id, mode, settings }（app/rerun.mjs）
  rerunOptions: (id) => ipcRenderer.invoke("history:rerun-options", id),
  rerunHistory: (request) => ipcRenderer.invoke("history:rerun", request),
  usageReport: () => ipcRenderer.invoke("usage:report"),
  insights: () => ipcRenderer.invoke("insights:get"),
  copyText: (text) => ipcRenderer.invoke("clipboard:write", text),
  onHistoryChanged: (callback) => ipcRenderer.on("history:changed", () => callback()),
  onNavigate: (callback) => ipcRenderer.on("hub:navigate", (_event, target) => callback(target)),
  openHomepage: () => ipcRenderer.invoke("app:open-homepage"),
  // 设置 › 通用的软件更新：检查一次（真去问下载地址）、开始更新（另起进程，App 会退出再打开）
  checkForUpdate: () => ipcRenderer.invoke("update:check"),
  startUpdate: () => ipcRenderer.invoke("update:start"),
  // 设置 › 通用的存储位置：选文件夹、确认，起搬家的进度窗口（这个 App 随后退出，搬完从新位置打开）
  changeStorage: () => ipcRenderer.invoke("storage:change"),
  // 搬家的进度窗口（src/app/move-window.mjs）
  moveState: () => ipcRenderer.invoke("move:state"),
  onMoveState: (callback) => ipcRenderer.on("move:state", (_event, state) => callback(state)),
  closeMove: () => ipcRenderer.invoke("move:close"),

  // 主窗口：词典（只存在本机）。改完由页面自己重读
  getVocabulary: () => ipcRenderer.invoke("vocabulary:get"),
  addTerm: (term) => ipcRenderer.invoke("vocabulary:add", term),
  updateTerm: (previous, term) => ipcRenderer.invoke("vocabulary:update", previous, term),
  removeTerms: (terms) => ipcRenderer.invoke("vocabulary:remove", terms),
  // 导入：先选文件、预览（没选是 null），确认了再把预览里的词交回来
  previewImport: () => ipcRenderer.invoke("vocabulary:preview-import"),
  importTerms: (terms) => ipcRenderer.invoke("vocabulary:import", terms),

  // 主窗口：设置
  getSetup: () => ipcRenderer.invoke("setup:get"),
  onSetupChanged: (callback) => ipcRenderer.on("setup:changed", () => callback()),
  // provider 不写是正在用的那家；给别家存时 changes 是要一起换成的设置，拿它们验证
  saveKey: (key, provider, changes) => ipcRenderer.invoke("setup:save-key", key, provider, changes),
  forgetKey: (provider) => ipcRenderer.invoke("setup:forget-key", provider),
  // 某种模式按改后的设置能不能用：拿那家的 key 发一个最小的请求，不换掉正在用的
  checkModel: (mode, changes) => ipcRenderer.invoke("setup:check-model", mode, changes),
  // 模式这一层，和各模式里的模型（src/app/modes.mjs）
  setMode: (mode, changes) => ipcRenderer.invoke("setup:set-mode", mode, changes),
  setModel: (model) => ipcRenderer.invoke("setup:set-model", model),
  setTranscriber: (id) => ipcRenderer.invoke("setup:set-transcriber", id),
  // custom：自定义服务的 { customUrl, customParams }，和模型一起换
  setPolish: (polish, custom) => ipcRenderer.invoke("setup:set-polish", polish, custom),
  setModelSource: (id) => ipcRenderer.invoke("setup:set-model-source", id),
  setAcceleration: (id) => ipcRenderer.invoke("setup:set-acceleration", id),
  setLocalModelMemory: (id) => ipcRenderer.invoke("setup:set-local-model-memory", id),
  // 录音时在悬浮条上预览暂定文字：开 / 关
  setLivePreview: (on) => ipcRenderer.invoke("setup:set-live-preview", on),
  // 本机模型：用户点了才下载；取消、删除（正在用的删不了）
  downloadModel: (id) => ipcRenderer.invoke("setup:download-model", id),
  cancelDownload: (id) => ipcRenderer.invoke("setup:cancel-download", id),
  deleteModel: (id) => ipcRenderer.invoke("setup:delete-model", id),
  // 检查本机模型：念一句交给它转，看能不能正常出字
  checkTranscriber: (id) => ipcRenderer.invoke("setup:check-transcriber", id),
  openKeyPage: (provider) => ipcRenderer.invoke("setup:open-key-page", provider),
  openPrivacySettings: (permission) => ipcRenderer.invoke("setup:open-privacy", permission),
  recheckPermissions: () => ipcRenderer.invoke("setup:recheck"),
  setOpenAtLogin: (enabled) => ipcRenderer.invoke("setup:set-open-at-login", enabled),
  // 录键（docs/hotkey-research.md 5.6）：index 是换掉第几个组合，null 是加一个；结果经 onHotkeyRecording 报回来
  recordHotkey: (action, index, token) => ipcRenderer.invoke("hotkey:record", action, index, token),
  stopRecordingHotkey: (reason) => ipcRenderer.invoke("hotkey:record-stop", reason),
  onHotkeyRecording: (callback) => ipcRenderer.on("hotkey:recording", (_event, payload) => callback(payload)),
  removeHotkey: (action, index) => ipcRenderer.invoke("setup:remove-hotkey", action, index),
  resetHotkey: (action) => ipcRenderer.invoke("setup:reset-hotkey", action),
  setBarHint: (value) => ipcRenderer.invoke("setup:set-bar-hint", value),
  // 听写成品的中文字形：simplified、traditional-hk、traditional-tw
  setOutputScript: (value) => ipcRenderer.invoke("setup:set-output-script", value),
  // 语音翻译译成哪几种（语言 id 的列表，第一种是默认）
  setTranslateTo: (languages) => ipcRenderer.invoke("setup:set-translate-to", languages),
  setLookupTo: (language) => ipcRenderer.invoke("setup:set-lookup-to", language),
  setLookupModel: (choice) => ipcRenderer.invoke("setup:set-lookup-model", choice),
  checkLookup: (changes) => ipcRenderer.invoke("setup:check-lookup", changes),
  saveLookupCustom: (form) => ipcRenderer.invoke("setup:save-lookup-custom", form),
  forgetLookupCustomKey: () => ipcRenderer.invoke("setup:forget-lookup-custom-key"),

  // 首次引导：测快捷键时让主进程把三个功能的热键转到这里（{ action, event, down }），不去开悬浮条；
  // 走完了关掉引导、打开主窗口，target.engine 是去引擎页并弹出推荐组合
  captureHotkey: (capturing) => ipcRenderer.send("onboarding:capture-hotkey", capturing),
  onOnboardingHotkey: (callback) => ipcRenderer.on("onboarding:hotkey", (_event, key) => callback(key)),
  finishOnboarding: (target) => ipcRenderer.invoke("onboarding:finish", target),
  setTheme: (theme) => ipcRenderer.invoke("setup:set-theme", theme),
  setLanguage: (language) => ipcRenderer.invoke("setup:set-language", language),
});
