// 几个画面的测试共用的：固定的时区和"现在"、一个就绪的状态、默认设置。
// 画面按中文画（原来的断言都是中文的）；要看英文的另给 english。

import { createTranslator, msg } from "../../../src/i18n/index.mjs";

export const zh = createTranslator("zh-CN");
export const en = createTranslator("en");

/** 听写的默认热键（两个系统都是这个位置：Mac 叫右 Option，Windows 叫右 Alt），和它的中文名字 */
export const hotkey = '["AltRight"]';
export const hotkeyZh = process.platform === "win32" ? "右 Alt 键" : "右 Option 键";
/** 几个键在这个系统上的中文键帽、名字（Windows 上右⌘ 叫右 Win），几个连起来用顿号 */
export const keycapsZh = (...codes) => codes.map((code) => zh.text(msg(`keys.${code}.keycap`))).join("、");
export const namesZh = (...codes) => codes.map((code) => zh.text(msg(`keys.${code}.name`))).join("、");

export const timeZone = "Asia/Shanghai";
// 上海时间 2026-10-13 15:00
export const now = new Date("2026-10-13T07:00:00.000Z");
export const plain = { color: false, timeZone, now, t: zh, platform: "darwin" };
export const english = { ...plain, t: en };

export const ready = {
  pid: 4321,
  version: "0.1.0",
  starting: false,
  "hotkey.dictate": hotkey,
  "hotkey.translate": '["AltRight+Space"]',
  "hotkey.lookup": '["AltRight+Enter"]',
  "hotkey.cancel": '["Escape"]',
  provider: "gemini",
  model: "gemini/gemini-3.6-flash",
  thinking: "MINIMAL",
  packaged: false,
  helper: "running",
  key: { state: "ready", source: "stored", problem: null, verified: true },
  permissions: { microphone: "granted", listen: true, trusted: true },
  summary: { ready: true, missing: [], blocker: null, degraded: null },
};
export const settings = {
  "hotkey.dictate": { value: hotkey, source: "default" },
  "hotkey.translate": { value: '["AltRight+Space"]', source: "default" },
  "hotkey.lookup": { value: '["AltRight+Enter"]', source: "default" },
  "hotkey.cancel": { value: '["Escape"]', source: "default" },
  mode: { value: "native", source: "default" },
  model: { value: "gemini/gemini-3.6-flash", source: "default" },
  thinking: { value: "MINIMAL", source: "default" },
  transcriber: { value: "qwen3-asr-0.6b-q8", source: "default" },
  privateTranscriber: { value: "qwen3-asr-0.6b-q8", source: "default" },
  polish: { value: "deepseek/deepseek-flash", source: "default" },
  customUrl: { value: "", source: "default" },
  customParams: { value: "", source: "default" },
  modelSource: { value: "cn", source: "default" },
  acceleration: { value: "auto", source: "default" },
  localModelMemory: { value: "resident", source: "default" },
  "translate.to": { value: '["en"]', source: "default" },
  "lookup.to": { value: "zh-CN", source: "default" },
  "lookup.model": { value: "deepseek/deepseek-flash", source: "default" },
  "lookup.customUrl": { value: "", source: "default" },
  "lookup.customParams": { value: "", source: "default" },
  barHint: { value: "on", source: "default" },
  outputScript: { value: "simplified", source: "default" },
  livePreview: { value: "on", source: "default" },
  dockIcon: { value: "on", source: "default" },
  theme: { value: "ink", source: "default" },
  language: { value: "system", source: "default" },
};
export const noStats = { today: null, total: null };
