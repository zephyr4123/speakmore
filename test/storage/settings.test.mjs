import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, test } from "node:test";
import { createTranslator, LocalizedError } from "../../src/i18n/index.mjs";
import {
  lookupOf,
  MODE_SETTINGS,
  overridingEnv,
  patchSettings,
  resolveSettings,
  routeOf,
  SETTINGS,
  saveSetting,
  settingName,
  unsetSetting,
} from "../../src/storage/settings.mjs";

const zh = createTranslator("zh-CN");
const en = createTranslator("en");
/** 报错里给人看的那句，按中文翻出来对得上 */
const said = (pattern) => (error) => pattern.test(zh.text(error.problem ?? error.message));

let dir;
let file;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "speakmore-settings-"));
  file = join(dir, "settings.json");
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

/** 听写的默认键两个系统都是右 Option / 右 Alt；另挑一个两个系统都能绑的 */
const DEFAULT_HOTKEY = '["AltRight"]';
/** 热键的设置项按这台机器的系统生成（SETTINGS），键名、能不能绑也按它：Windows 上没有 fn，⌘ 叫 Win 而且不让绑 */
const WINDOWS = process.platform === "win32";
const OTHER_HOTKEY = '["ControlRight"]';

test("没有文件也没有环境变量时全用默认值", () => {
  assert.deepEqual(resolveSettings({ file, env: {} }), {
    "hotkey.dictate": { value: DEFAULT_HOTKEY, source: "default" },
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
  });
});

test("语音翻译译成什么：一个、逗号隔开的几个、JSON 数组都认，规整成去重的 id 列表、文件里存成数组；第一种是默认", () => {
  assert.equal(saveSetting(file, "translate.to", "ja").value, '["ja"]');
  assert.equal(saveSetting(file, "translate.to", "EN, ja ,en").value, '["en","ja"]');
  assert.equal(saveSetting(file, "translate.to", '["zh-tw","en"]').value, '["zh-TW","en"]');
  // PowerShell 去掉了引号
  assert.equal(saveSetting(file, "translate.to", "[ko,fr]").value, '["ko","fr"]');
  assert.deepEqual(JSON.parse(readFileSync(file, "utf8"))["translate.to"], ["ko", "fr"]);
  assert.equal(resolveSettings({ file, env: {} })["translate.to"].value, '["ko","fr"]');
  assert.equal(resolveSettings({ file, env: { SPEAKMORE_TRANSLATE_TO: "de" } })["translate.to"].value, '["de"]');
  // 手改文件写成数组也认
  writeFileSync(file, JSON.stringify({ "translate.to": ["vi"] }));
  assert.equal(resolveSettings({ file, env: {} })["translate.to"].value, '["vi"]');
  for (const bad of ["", "[]", "klingon", "en,xx", "en,ja,ko,fr,de,es,it", '{"en":1}']) {
    assert.throws(() => saveSetting(file, "translate.to", bad), LocalizedError, bad);
  }
});

test("划词翻译：译成一种语言（默认简体中文），模型写 厂商/模型（默认 DeepSeek V4.1 Flash）；自定义服务的地址、参数是它自己的，和整理那一步的分开", () => {
  assert.equal(saveSetting(file, "lookup.to", "JA").value, "ja");
  assert.throws(() => saveSetting(file, "lookup.to", "xx"), said(/要是 en \/ zh-CN/));
  assert.equal(saveSetting(file, "lookup.model", "bailian").value, "bailian/qwen3.8-flash");
  assert.equal(saveSetting(file, "lookup.model", "custom/qwen3:8b").value, "custom/qwen3:8b");
  assert.throws(() => saveSetting(file, "lookup.model", "custom"), LocalizedError);
  assert.equal(
    saveSetting(file, "lookup.customUrl", "https://llm.example.com/v1/chat/completions").value,
    "https://llm.example.com/v1",
  );
  assert.equal(saveSetting(file, "lookup.customParams", '{ "temperature": 0.2 }').value, '{"temperature":0.2}');
  const settings = resolveSettings({ file, env: {} });
  // 语音那边的自定义服务没动
  assert.equal(settings.customUrl.value, "");
  assert.deepEqual(lookupOf(settings), {
    to: "ja",
    choice: { vendor: "custom", model: "qwen3:8b" },
    customUrl: "https://llm.example.com/v1",
    customParams: { temperature: 0.2 },
  });
  assert.deepEqual(lookupOf(resolveSettings({ file: join(dir, "none.json"), env: {} })), {
    to: "zh-CN",
    choice: { vendor: "deepseek", model: "deepseek-flash" },
    customUrl: null,
    customParams: null,
  });
  assert.equal(resolveSettings({ file, env: { SPEAKMORE_LOOKUP_MODEL: "moonshot" } })["lookup.model"].source, "env");
});

test("存下来的值下次读得到，没动过的仍是默认值", () => {
  saveSetting(file, "hotkey.dictate", "ControlRight");
  saveSetting(file, "thinking", "low");
  const settings = resolveSettings({ file, env: {} });
  assert.deepEqual(settings["hotkey.dictate"], { value: OTHER_HOTKEY, source: "file" });
  assert.deepEqual(settings.thinking, { value: "LOW", source: "file" });
  assert.deepEqual(settings.model, { value: "gemini/gemini-3.6-flash", source: "default" });
  // 热键在文件里存成数组（store）
  assert.deepEqual(JSON.parse(readFileSync(file, "utf8")), { "hotkey.dictate": ["ControlRight"], thinking: "LOW" });
});

test("环境变量优先于文件", () => {
  saveSetting(file, "hotkey.dictate", "ControlRight");
  saveSetting(file, "model", "gemini-3.8-flash");
  const settings = resolveSettings({
    file,
    env: { SPEAKMORE_HOTKEY_DICTATE: "AltRight", SPEAKMORE_MODEL: "openai", GEMINI_THINKING_LEVEL: "high" },
  });
  assert.deepEqual(settings["hotkey.dictate"], { value: DEFAULT_HOTKEY, source: "env" });
  assert.deepEqual(settings.model, { value: "openai/gpt-audio-mini", source: "env" });
  assert.deepEqual(settings.thinking, { value: "HIGH", source: "env" });
});

test("本机模型的加速：auto（有显卡就用，出问题退回 CPU）或 cpu，大小写都认，别的不收", () => {
  saveSetting(file, "acceleration", "CPU");
  assert.deepEqual(resolveSettings({ file, env: {} }).acceleration, { value: "cpu", source: "file" });
  assert.deepEqual(resolveSettings({ file, env: { SPEAKMORE_ACCELERATION: "auto" } }).acceleration, {
    value: "auto",
    source: "env",
  });
  assert.throws(() => saveSetting(file, "acceleration", "gpu"), /auto \/ cpu/);
});

test("本机模型常驻内存，或空闲 1、5、10、30 分钟后释放：大小写都认，环境变量优先，别的不收", () => {
  assert.deepEqual(resolveSettings({ file, env: {} }).localModelMemory, { value: "resident", source: "default" });
  for (const value of ["1m", "5m", "10m", "30m", "resident"]) {
    saveSetting(file, "localModelMemory", value);
    assert.equal(resolveSettings({ file, env: {} }).localModelMemory.value, value);
  }
  saveSetting(file, "localModelMemory", " 5M ");
  assert.deepEqual(resolveSettings({ file, env: {} }).localModelMemory, { value: "5m", source: "file" });
  assert.deepEqual(resolveSettings({ file, env: { SPEAKMORE_LOCAL_MODEL_MEMORY: "resident" } }).localModelMemory, {
    value: "resident",
    source: "env",
  });
  for (const value of ["on-demand", "5", "2m", "0m"]) {
    assert.throws(() => saveSetting(file, "localModelMemory", value), /resident \/ 1m \/ 5m \/ 10m \/ 30m/);
  }
});

test("悬浮条上方的操作提示能关掉（GitHub issue #3）：on 或 off，大小写都认，别的不收", () => {
  saveSetting(file, "barHint", "OFF");
  assert.deepEqual(resolveSettings({ file, env: {} }).barHint, { value: "off", source: "file" });
  assert.deepEqual(resolveSettings({ file, env: { SPEAKMORE_BAR_HINT: "on" } }).barHint, {
    value: "on",
    source: "env",
  });
  assert.throws(() => saveSetting(file, "barHint", "hide"), /on \/ off/);
});

test("听写的成品字形：简体，或者繁体（香港、台湾字形）；大小写都认，别的不收", () => {
  saveSetting(file, "outputScript", "Traditional-HK");
  assert.deepEqual(resolveSettings({ file, env: {} }).outputScript, { value: "traditional-hk", source: "file" });
  assert.deepEqual(resolveSettings({ file, env: { SPEAKMORE_OUTPUT_SCRIPT: "traditional-tw" } }).outputScript, {
    value: "traditional-tw",
    source: "env",
  });
  assert.throws(() => saveSetting(file, "outputScript", "zh-Hant"), /simplified \/ traditional-hk \/ traditional-tw/);
});

test("说话时在悬浮条上预览暂定文字：默认开，能关掉；大小写都认，别的不收", () => {
  assert.equal(resolveSettings({ file: join(dir, "none.json"), env: {} }).livePreview.value, "on");
  saveSetting(file, "livePreview", "OFF");
  assert.deepEqual(resolveSettings({ file, env: {} }).livePreview, { value: "off", source: "file" });
  assert.deepEqual(resolveSettings({ file, env: { SPEAKMORE_LIVE_PREVIEW: "on" } }).livePreview, {
    value: "on",
    source: "env",
  });
  assert.throws(() => saveSetting(file, "livePreview", "yes"), /on \/ off/);
});

test("Mac 程序坞里显示图标：默认显示，关掉就只待在菜单栏；环境变量 SPEAKMORE_DOCK_ICON 优先", () => {
  assert.equal(resolveSettings({ file: join(dir, "none.json"), env: {} }).dockIcon.value, "on");
  saveSetting(file, "dockIcon", "off");
  assert.deepEqual(resolveSettings({ file, env: {} }).dockIcon, { value: "off", source: "file" });
  assert.deepEqual(resolveSettings({ file, env: { SPEAKMORE_DOCK_ICON: "on" } }).dockIcon, {
    value: "on",
    source: "env",
  });
});

test("模型：写成 厂商/模型，只写厂商就用它的默认模型；存下来的都是 厂商/模型", () => {
  assert.equal(saveSetting(file, "model", "openai").value, "openai/gpt-audio-mini");
  assert.equal(saveSetting(file, "model", "OpenAI/gpt-audio-1.5").value, "openai/gpt-audio-1.5");
  assert.deepEqual(JSON.parse(readFileSync(file, "utf8")), { model: "openai/gpt-audio-1.5" });
  assert.throws(() => saveSetting(file, "model", "deepseek/deepseek-flash"), said(/不认识 deepseek.*gemini \/ openai/));
  assert.equal(zh.text(SETTINGS.model.label("openai/gpt-audio-1.5")), "OpenAI");
});

test("0.3 以前的写法照样认：设置文件里只写了 Gemini 的模型名，环境变量 GEMINI_MODEL", () => {
  writeFileSync(file, JSON.stringify({ model: "gemini-3.8-flash" }));
  assert.deepEqual(resolveSettings({ file, env: {} }).model, { value: "gemini/gemini-3.8-flash", source: "file" });
  // 用的是旧的环境变量时，说清是哪一个，换主题之类的提示才不会指错
  assert.deepEqual(resolveSettings({ file, env: { GEMINI_MODEL: "gemini-3.6-flash" } }).model, {
    value: "gemini/gemini-3.6-flash",
    source: "env",
    env: "GEMINI_MODEL",
  });
  // 新旧都设了：新的优先
  assert.equal(
    resolveSettings({ file, env: { GEMINI_MODEL: "gemini-3.6-flash", SPEAKMORE_MODEL: "openai" } }).model.value,
    "openai/gpt-audio-mini",
  );
});

test("设置文件开头带 BOM（Windows PowerShell 5.1 的 Set-Content -Encoding utf8、老版记事本存的）：照样读，改一项后存成不带 BOM 的", () => {
  writeFileSync(file, '\uFEFF{"theme":"indigo","localModelMemory":"5m"}\n');
  const settings = resolveSettings({ file, env: {} });
  assert.deepEqual(settings.theme, { value: "indigo", source: "file" });
  assert.deepEqual(settings.localModelMemory, { value: "5m", source: "file" });
  saveSetting(file, "barHint", "off");
  const text = readFileSync(file, "utf8");
  assert.equal(text.startsWith("\uFEFF"), false);
  assert.deepEqual(JSON.parse(text), { theme: "indigo", localModelMemory: "5m", barHint: "off" });
});

test("热键写坏了也能用 config set 改回来：写入前的检查不读正要被换掉的那个旧值", () => {
  writeFileSync(file, JSON.stringify({ "hotkey.dictate": ["AltRigth"], theme: "ink" }));
  assert.equal(saveSetting(file, "hotkey.dictate", "ControlRight").value, OTHER_HOTKEY);
  assert.deepEqual(JSON.parse(readFileSync(file, "utf8")), { "hotkey.dictate": ["ControlRight"], theme: "ink" });
});

test("overridingEnv：这一项现在被哪个环境变量盖着；没有就是 null", () => {
  assert.equal(overridingEnv("model", {}), null);
  assert.equal(overridingEnv("model", { GEMINI_MODEL: "x" }), "GEMINI_MODEL");
  assert.equal(overridingEnv("model", { GEMINI_MODEL: "x", SPEAKMORE_MODEL: "openai" }), "SPEAKMORE_MODEL");
  assert.equal(overridingEnv("theme", { SPEAKMORE_THEME: "ink" }), "SPEAKMORE_THEME");
});

test("不认识的设置项、不认识的热键、不认识的思考档位都拒绝保存，并列出能填什么", () => {
  assert.throws(() => saveSetting(file, "volume", "11"), said(/hotkey\.dictate.*hotkey\.cancel.*model.*thinking/));
  assert.throws(() => saveSetting(file, "hotkey.dictate", "caps_lock"), said(/不认识的键 "caps_lock"/));
  assert.throws(() => saveSetting(file, "thinking", "none"), said(/MINIMAL.*LOW.*MEDIUM.*HIGH/));
  assert.throws(() => saveSetting(file, "model", "  "), said(/model/));
});

test("主题：写 id 或写名字都行，存下来的是 id；没有的那一套拒绝，并列出有哪几套", () => {
  assert.equal(saveSetting(file, "theme", "cinnabar").value, "cinnabar");
  assert.equal(saveSetting(file, "theme", "靛青").value, "indigo");
  assert.deepEqual(JSON.parse(readFileSync(file, "utf8")), { theme: "indigo" });
  assert.deepEqual(resolveSettings({ file, env: {} }).theme, { value: "indigo", source: "file" });
  assert.deepEqual(resolveSettings({ file, env: { SPEAKMORE_THEME: "朱砂" } }).theme, {
    value: "cinnabar",
    source: "env",
  });
  assert.throws(() => saveSetting(file, "theme", "neon"), said(/ink \/ cinnabar \/ indigo/));
  assert.deepEqual(SETTINGS.theme.choices, ["ink", "cinnabar", "indigo"]);
});

test("带说明的设置项：热键给出键帽，主题给出主题的名字，按界面语言写；语言的名字用它自己的语言写", () => {
  assert.equal(zh.text(SETTINGS["hotkey.dictate"].label('["Fn","MetaRight"]')), WINDOWS ? "fn、右 Win" : "fn、右⌘");
  assert.equal(zh.text(SETTINGS.theme.label("cinnabar")), "朱砂");
  assert.equal(en.text(SETTINGS.theme.label("cinnabar")), "Cinnabar");
  assert.equal(en.text(SETTINGS.language.label("zh-CN")), "简体中文");
  assert.equal(zh.text(SETTINGS.language.label("zh-TW")), "繁體中文");
  assert.equal(zh.text(SETTINGS.language.label("system")), "跟随系统");
});

test("改名前的名字（legacyName）：命令行 config set/unset hotkey 照样认，存的、删的都是新名字；别的入口不认", () => {
  assert.equal(settingName("hotkey"), "hotkey.dictate");
  assert.equal(settingName("theme"), "theme");
  assert.throws(() => settingName("volume"), said(/没有 "volume" 这项设置/));
  assert.equal(saveSetting(file, "hotkey", "right_control").value, '["ControlRight"]');
  assert.deepEqual(JSON.parse(readFileSync(file, "utf8")), { "hotkey.dictate": ["ControlRight"] });
  assert.equal(overridingEnv("hotkey", { SPEAKMORE_HOTKEY: "fn" }), "SPEAKMORE_HOTKEY");
  unsetSetting(file, "hotkey");
  assert.deepEqual(JSON.parse(readFileSync(file, "utf8")), {});
  // 列出来的、读出来的都只有新名字
  assert.equal(Object.hasOwn(SETTINGS, "hotkey"), false);
  assert.equal(Object.hasOwn(resolveSettings({ file, env: {} }), "hotkey"), false);
});

test("热键的环境变量：每个动作一个；听写另认 0.13 以前的 SPEAKMORE_HOTKEY，旧 id 和新写法都收，新的优先", () => {
  const dictate = (env) => resolveSettings({ file, env })["hotkey.dictate"];
  assert.deepEqual(dictate({ SPEAKMORE_HOTKEY: "right_command" }), {
    value: '["MetaRight"]',
    source: "env",
    env: "SPEAKMORE_HOTKEY",
  });
  assert.equal(dictate({ SPEAKMORE_HOTKEY: "ControlRight+Space" }).value, '["ControlRight+Space"]');
  assert.equal(
    dictate({ SPEAKMORE_HOTKEY: "fn", SPEAKMORE_HOTKEY_DICTATE: '["Fn","MetaRight"]' }).value,
    '["Fn","MetaRight"]',
  );
  assert.deepEqual(resolveSettings({ file, env: { SPEAKMORE_HOTKEY_CANCEL: "F13" } })["hotkey.cancel"], {
    value: '["F13"]',
    source: "env",
  });
  // 文件里写成数组、写成一个字符串都认
  writeFileSync(file, JSON.stringify({ "hotkey.dictate": ["Fn", "MetaRight"], "hotkey.cancel": "F13" }));
  assert.equal(dictate({}).value, '["Fn","MetaRight"]');
  assert.equal(resolveSettings({ file, env: {} })["hotkey.cancel"].value, '["F13"]');
});

test("写入前的检查（check）：不让存的照实说并且不写文件；只有提醒时照存，带回提醒；读文件、环境变量时不查", () => {
  assert.throws(() => saveSetting(file, "hotkey.dictate", "ControlRight+KeyC"), said(/hotkey\.dictate.*加打字的键/));
  assert.equal(existsSync(file), false);
  saveSetting(file, "hotkey.cancel", "F13");
  // 和文件里另一个动作的撞了：要改的这个让位
  assert.throws(() => saveSetting(file, "hotkey.dictate", "F13"), said(/已经给了「取消」/));
  // 只有提醒的：Mac 上单按 fn（地球仪键有系统功能），Windows 上右 Alt（AltGr 布局）
  const warned = WINDOWS ? "AltRight" : "Fn";
  const { value, warnings } = saveSetting(file, "hotkey.dictate", warned);
  assert.equal(value, `["${warned}"]`);
  assert.equal(warnings.length, 1);
  assert.deepEqual(saveSetting(file, "theme", "ink").warnings, []);
  // 读的时候只查写法：系统保留的组合写在文件里也读得出来，由下发前那道兜住（bindings.mjs）
  writeFileSync(file, JSON.stringify({ "hotkey.dictate": ["MetaRight+KeyC"] }));
  assert.equal(resolveSettings({ file, env: {} })["hotkey.dictate"].value, '["MetaRight+KeyC"]');
  // patchSettings 也查：先看改了之后走哪条路线的那些地方同样不能拼出存不下的设置
  const settings = resolveSettings({ file: join(dir, "none.json"), env: {} });
  assert.throws(() => patchSettings(settings, { "hotkey.dictate": "ControlRight+KeyC" }), said(/加打字的键/));
  assert.equal(patchSettings(settings, { hotkey: "right_control" })["hotkey.dictate"].value, '["ControlRight"]');
});

test("界面语言：默认跟随系统；写哪种都认（大小写、_ 不论），存下来是规整的 id；写了没有的说能填什么", () => {
  assert.deepEqual(resolveSettings({ file, env: {} }).language, { value: "system", source: "default" });
  assert.equal(saveSetting(file, "language", "zh_cn").value, "zh-CN");
  assert.deepEqual(JSON.parse(readFileSync(file, "utf8")), { language: "zh-CN" });
  assert.equal(saveSetting(file, "language", "EN").value, "en");
  assert.equal(saveSetting(file, "language", "System").value, "system");
  assert.deepEqual(resolveSettings({ file, env: { SPEAKMORE_LANGUAGE: "zh-CN" } }).language, {
    value: "zh-CN",
    source: "env",
  });
  assert.throws(() => saveSetting(file, "language", "ja"), said(/system \/ en \/ zh-CN \/ zh-TW/));
  assert.deepEqual(SETTINGS.language.choices, ["system", "en", "zh-CN", "zh-TW"]);
});

test("写错时的说法也跟着语言换", () => {
  assert.throws(
    () => saveSetting(file, "hotkey.dictate", "caps_lock"),
    (error) => en.text(error.problem) === 'hotkey.dictate is "caps_lock": Unknown key "caps_lock"',
  );
  assert.throws(
    () => resolveSettings({ file, env: { SPEAKMORE_THEME: "neon" } }),
    (error) =>
      en.text(error.problem) === 'The SPEAKMORE_THEME env var is "neon": must be one of ink / cinnabar / indigo',
  );
});

test("环境变量或文件里的值写错时报错，不悄悄换成默认值", () => {
  assert.throws(() => resolveSettings({ file, env: { SPEAKMORE_HOTKEY: "caps_lock" } }), said(/SPEAKMORE_HOTKEY/));
  writeFileSync(file, JSON.stringify({ "hotkey.dictate": ["caps_lock"] }));
  assert.throws(() => resolveSettings({ file, env: {} }), said(/settings\.json/));
  writeFileSync(file, "{ 不是 JSON");
  assert.throws(() => resolveSettings({ file, env: {} }), said(/settings\.json/));
});

test("取消一项设置后回到默认值，其余的不动", () => {
  saveSetting(file, "hotkey.dictate", "ControlRight");
  saveSetting(file, "model", "gemini-3.8-flash");
  unsetSetting(file, "hotkey.dictate");
  const settings = resolveSettings({ file, env: {} });
  assert.deepEqual(settings["hotkey.dictate"], { value: DEFAULT_HOTKEY, source: "default" });
  assert.deepEqual(settings.model, { value: "gemini/gemini-3.8-flash", source: "file" });
  assert.throws(() => unsetSetting(file, "volume"), said(/hotkey\.dictate/));
});

test("数据目录还不存在时也能保存", () => {
  const nested = join(dir, "not-yet", "settings.json");
  saveSetting(nested, "hotkey.dictate", "ControlRight");
  assert.equal(resolveSettings({ file: nested, env: {} })["hotkey.dictate"].value, OTHER_HOTKEY);
});

test("Gemini 的模型存成 0.3 也读得懂的写法（只写模型名），退回旧版本时设置照样能用；读出来统一是 厂商/模型", () => {
  assert.equal(saveSetting(file, "model", "gemini").value, "gemini/gemini-3.6-flash");
  assert.deepEqual(JSON.parse(readFileSync(file, "utf8")), { model: "gemini-3.6-flash" });
  assert.equal(resolveSettings({ file, env: {} }).model.value, "gemini/gemini-3.6-flash");
  // 别家的 0.3 本来就不认，照常存 厂商/模型
  saveSetting(file, "model", "openai");
  assert.deepEqual(JSON.parse(readFileSync(file, "utf8")), { model: "openai/gpt-audio-mini" });
});

test("识别链路：默认是原生的；改成 local 后，路线里是本地模型、润色的那家和自定义地址", () => {
  assert.deepEqual(routeOf(resolveSettings({ file, env: {} })), {
    mode: "native",
    model: { provider: "gemini", model: "gemini-3.6-flash" },
    thinkingLevel: "MINIMAL",
  });
  saveSetting(file, "mode", "Local");
  saveSetting(file, "polish", "custom/Qwen/Qwen3-8B");
  saveSetting(file, "customUrl", "https://api.siliconflow.cn/v1/chat/completions");
  const settings = resolveSettings({ file, env: {} });
  assert.deepEqual(settings.customUrl, { value: "https://api.siliconflow.cn/v1", source: "file" });
  assert.deepEqual(routeOf(settings), {
    mode: "local",
    transcriber: "qwen3-asr-0.6b-q8",
    polish: { vendor: "custom", model: "Qwen/Qwen3-8B" },
    customUrl: "https://api.siliconflow.cn/v1",
    customParams: null,
  });
  // 环境变量也能换，和单独启动服务端时同名
  const env = {
    SPEAKMORE_MODE: "native",
    SPEAKMORE_POLISH: "deepseek",
    SPEAKMORE_TRANSCRIBER: "sensevoice-small-q8",
  };
  const overridden = resolveSettings({ file, env });
  assert.equal(overridden.mode.value, "native");
  assert.equal(overridden.polish.value, "deepseek/deepseek-flash");
  assert.equal(overridden.transcriber.value, "sensevoice-small-q8");
});

test("每种模式的路线只看它自己那几项：可以拼出不是正在用的那种模式的路线", () => {
  saveSetting(file, "model", "openai");
  saveSetting(file, "polish", "deepseek/deepseek-v4-pro");
  const settings = resolveSettings({ file, env: {} });
  assert.equal(settings.mode.value, "native");
  assert.deepEqual(routeOf(settings, "local"), {
    mode: "local",
    transcriber: "qwen3-asr-0.6b-q8",
    polish: { vendor: "deepseek", model: "deepseek-v4-pro" },
    customUrl: null,
    customParams: null,
  });
  assert.deepEqual(routeOf(settings, "native").model, { provider: "openai", model: "gpt-audio-mini" });
});

test("每种模式自己的那几项：native 是模型和思考档位，local 是两跳的，private 是它自己的本机模型", () => {
  assert.deepEqual(MODE_SETTINGS, {
    native: ["model", "thinking"],
    local: ["transcriber", "polish", "customUrl", "customParams"],
    private: ["privateTranscriber"],
  });
});

test("自定义服务的额外参数：存成紧凑的 JSON，路线里是对象；没填、{} 是 null；写错了拒绝保存，说哪里不对", () => {
  saveSetting(file, "mode", "local");
  saveSetting(file, "polish", "custom/gpt-5-mini");
  saveSetting(file, "customUrl", "https://router.example/v1");
  assert.equal(
    saveSetting(file, "customParams", ' {\n  "max_completion_tokens": 1024,\n  "reasoning_effort": "minimal"\n} ')
      .value,
    '{"max_completion_tokens":1024,"reasoning_effort":"minimal"}',
  );
  const settings = resolveSettings({ file, env: {} });
  assert.deepEqual(settings.customParams, {
    value: '{"max_completion_tokens":1024,"reasoning_effort":"minimal"}',
    source: "file",
  });
  assert.deepEqual(routeOf(settings).customParams, { max_completion_tokens: 1024, reasoning_effort: "minimal" });
  // 环境变量也能写，和单独启动服务端时同名
  const fromEnv = resolveSettings({ file, env: { SPEAKMORE_CUSTOM_PARAMS: '{"temperature": 0.2}' } });
  assert.deepEqual(routeOf(fromEnv).customParams, { temperature: 0.2 });
  assert.equal(saveSetting(file, "customParams", "{}").value, "");
  assert.equal(routeOf(resolveSettings({ file, env: {} })).customParams, null);
  assert.throws(() => saveSetting(file, "customParams", "{max_tokens: 1}"), said(/customParams.*JSON/));
  assert.throws(() => saveSetting(file, "customParams", '{"model": "x"}'), said(/model/));
});

test("自定义服务的额外参数：手改 settings.json 直接写成对象也认，读出来是同一行 JSON；写成数组照样拒绝", () => {
  writeFileSync(file, JSON.stringify({ customParams: { reasoning_effort: "minimal" } }));
  const settings = resolveSettings({ file, env: {} });
  assert.deepEqual(settings.customParams, { value: '{"reasoning_effort":"minimal"}', source: "file" });
  assert.deepEqual(routeOf(settings, "local").customParams, { reasoning_effort: "minimal" });
  writeFileSync(file, JSON.stringify({ customParams: [1] }));
  assert.throws(() => resolveSettings({ file, env: {} }), said(/customParams.*对象/));
});

test("数据隐私模式的本机模型：和 local 的第一跳分开存，只认本机模型的 id，云端的拒绝", () => {
  const settings = resolveSettings({ file, env: {} });
  assert.deepEqual(routeOf(settings, "private"), { mode: "private", transcriber: "qwen3-asr-0.6b-q8" });
  saveSetting(file, "transcriber", "bailian/qwen3-asr-flash");
  saveSetting(file, "privateTranscriber", "sensevoice-small-q8");
  const saved = resolveSettings({ file, env: {} });
  assert.equal(routeOf(saved, "private").transcriber, "sensevoice-small-q8");
  assert.equal(routeOf(saved, "local").transcriber, "bailian/qwen3-asr-flash");
  assert.throws(() => saveSetting(file, "privateTranscriber", "bailian/qwen3-asr-flash"), /qwen3-asr-0\.6b-q8/);
  const fromEnv = resolveSettings({ file, env: { SPEAKMORE_PRIVATE_TRANSCRIBER: "qwen3-asr-0.6b-q8" } });
  assert.equal(fromEnv.privateTranscriber.value, "qwen3-asr-0.6b-q8");
  assert.equal(patchSettings(saved, { mode: "PRIVATE" }).mode.value, "private");
});

test("patchSettings：按要改的几项拼出改后的设置（不写文件），写错了照保存时的规矩报错", () => {
  const settings = resolveSettings({ file, env: {} });
  const patched = patchSettings(settings, { mode: "LOCAL", polish: "deepseek" });
  assert.equal(patched.mode.value, "local");
  assert.equal(patched.polish.value, "deepseek/deepseek-flash");
  assert.equal(patched.model, settings.model);
  assert.equal(existsSync(file), false);
  assert.throws(() => patchSettings(settings, { polish: "nobody/x" }), said(/polish.*deepseek/));
  assert.throws(() => patchSettings(settings, { colour: "red" }), said(/colour/));
});

test("识别链路的几项写错了拒绝保存，说能填什么；自定义地址可以清空", () => {
  assert.throws(() => saveSetting(file, "mode", "cloud"), said(/native \/ local/));
  assert.throws(() => saveSetting(file, "transcriber", "whisper-9"), said(/qwen3-asr-0\.6b-q8/));
  assert.throws(() => saveSetting(file, "polish", "nobody/x"), said(/deepseek/));
  assert.throws(() => saveSetting(file, "customUrl", "api.example.com"), said(/https:\/\//));
  saveSetting(file, "customUrl", "https://x.example/v1");
  assert.equal(saveSetting(file, "customUrl", "").value, "");
});
