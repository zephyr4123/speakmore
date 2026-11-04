import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { hotkeySettings } from "../hotkeys/settings.mjs";
import { alternatives, findLocale, LOCALES, LocalizedError, msg, problemOf, SYSTEM_LOCALE } from "../i18n/index.mjs";
import { languageName, parseLanguage, LANGUAGES as TARGET_LANGUAGES } from "../languages.mjs";
import { DEFAULT_SOURCE, DEFAULT_TRANSCRIBER, MODELS, SOURCES } from "../models/catalog.mjs";
import { CLOUD_TRANSCRIBERS, cloudTranscriberOf } from "../server/asr/cloud/vendors.mjs";
import {
  formatChatChoice,
  formatCustomParams,
  normalizeBaseUrl,
  parseChatChoice,
  parseCustomParams,
} from "../server/chat/vendors.mjs";
import { DEFAULT_LOOKUP } from "../server/lookup/models.mjs";
import { DEFAULT_MODE, DEFAULT_POLISH, MODES, parseMode } from "../server/modes.mjs";
import {
  DEFAULT_MODEL_CHOICE,
  DEFAULT_THINKING_LEVEL,
  findProvider,
  formatModelChoice,
  parseModelChoice,
} from "../server/providers/index.mjs";
import { OUTPUT_SCRIPTS } from "../server/tasks/dictate/index.mjs";
import { DEFAULT_THEME, findTheme, THEMES } from "../themes/index.mjs";

// 用户能改的几项设置，存在数据目录的 settings.json 里。
// 取值的顺序：环境变量（只管这一次运行）优先于文件，文件优先于默认值。key 不在这里，它单独加密保存。

const THEME_IDS = THEMES.map((theme) => theme.id);
const MODE_IDS = MODES.map((mode) => mode.id);
const TRANSCRIBER_IDS = MODELS.map((model) => model.id);
/** 第一跳能填的：本机模型的 id，和云端清单里的 厂商/模型（清单外的云端模型名也认，见 transcriber.parse） */
const TRANSCRIBER_CHOICES = [
  ...TRANSCRIBER_IDS,
  ...CLOUD_TRANSCRIBERS.flatMap((vendor) => vendor.models.map((model) => `${vendor.id}/${model.id}`)),
];
/** 云端模型名里只出现这些字符（qwen3-asr-flash、fun-asr-flash-2026-06-15） */
const CLOUD_MODEL_NAME = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$/;
const SOURCE_IDS = SOURCES.map((source) => source.id);
/** 本机模型用不用显卡：auto 有显卡就用、在显卡上没装起来就退回 CPU（asr/start.mjs）；cpu 只用 CPU */
export const ACCELERATIONS = Object.freeze(["auto", "cpu"]);
/** 本机模型常驻内存，还是开口时装载、空闲这么久后释放（app/service.mjs）。内存紧的电脑选后几种，代价是隔久了第一句慢一两秒 */
export const LOCAL_MODEL_MEMORY = Object.freeze(["resident", "1m", "5m", "10m", "30m"]);
/** 显示不显示的开关：on 显示，off 不显示 */
export const SHOWN = Object.freeze(["on", "off"]);
const THINKING_LEVELS = findProvider("gemini").thinkingLevels;
/** 语音翻译最多列几种目标语言：悬浮条上的语言选单一种一行，再多放不下，也挑不过来 */
export const MAX_TRANSLATE_TARGETS = 6;
const LANGUAGES = [SYSTEM_LOCALE, ...LOCALES.map(({ id }) => id)];

const oneOf = (choices) => new LocalizedError(msg("settings.oneOf", { choices: choices.join(" / ") }));

/**
 * 每一项：对应的环境变量、默认值、能填的值（不限时为 null）、把写法规整并校验的函数。
 * 这一项是做什么的写在文案里（settings.describe.<名字>），按界面语言写；describe 可有可无：设置项自带的说明（一句 msg），
 *   按别的表生成的项（热键，src/hotkeys/settings.mjs）用它。
 * label 可有可无：值本身不好懂时（["AltRight"]、cinnabar）给出它叫什么，是一句话（msg）或者一个名字。
 * legacyEnv 可有可无：改名之前的环境变量，env 没设时照样认（README 里写过，用的人可能还在用）。
 * legacyName 可有可无：改名之前这一项叫什么，命令行 config set/unset 照样认；写进文件的总是新名字。
 * check 可有可无：check(值, 整份设置) 写入前看这一项和别的项合不合，saveSetting、patchSettings 调它，读的时候不调。
 *   不合就抛出原因；合的话返回要提醒的话（几句 msg，没有是空的）。
 * store 可有可无：规整后的值写进文件时换成什么样子（默认原样）。
 * json 可有可无：值本身是一段 JSON，设置文件里直接写成对象、数组也认（先变回字符串再规整）。
 * ofMode 可有可无：这一项属于哪种识别模式（server/modes.mjs），只在那种模式里能换（app/modes.mjs）。
 *   local 的两跳各有各的：transcriber 是第一跳（本机模型或云端模型），polish、customUrl、customParams 是第二跳。
 *   private（数据隐私）只有一跳：privateTranscriber，只能是本机模型；和 local 的第一跳分开存，各换各的。
 */
/** 显示不显示的一项（SHOWN），默认显示 */
const shownSetting = (env) => ({
  env,
  default: "on",
  choices: SHOWN,
  parse(value) {
    const id = value.trim().toLowerCase();
    if (!SHOWN.includes(id)) throw oneOf(SHOWN);
    return id;
  },
  label: (value) => msg(`shown.${value}`),
});

export const SETTINGS = {
  // 每个动作一项 hotkey.<动作>：hotkey.dictate、hotkey.cancel（docs/hotkey-research.md 5.2）
  ...hotkeySettings(process.platform),
  mode: {
    env: "SPEAKMORE_MODE",
    // 两条链路平级（server/modes.mjs）。原生是 0.6 以前唯一的一条，没选过的人照旧
    default: DEFAULT_MODE,
    choices: MODE_IDS,
    parse: parseMode,
    label: (value) => msg(`modes.${value}`),
  },
  model: {
    ofMode: "native",
    env: "SPEAKMORE_MODEL",
    // 0.3 以前只有 Gemini，这个环境变量只写模型名
    legacyEnv: "GEMINI_MODEL",
    default: formatModelChoice(DEFAULT_MODEL_CHOICE),
    choices: null,
    parse(value) {
      // 存下来的统一是 厂商/模型。0.3 以前文件里只写 Gemini 的模型名，读的时候照样认（见 parseModelChoice）
      return formatModelChoice(parseModelChoice(value));
    },
    label: (value) => findProvider(parseModelChoice(value).provider).name,
    // Gemini 的照 0.3 的写法只存模型名：退回 0.3 时它把整个值当 Gemini 的模型名用，gemini/… 会让每次请求都失败
    store(value) {
      const { provider, model } = parseModelChoice(value);
      return provider === "gemini" ? model : value;
    },
  },
  thinking: {
    ofMode: "native",
    env: "GEMINI_THINKING_LEVEL",
    default: DEFAULT_THINKING_LEVEL,
    choices: THINKING_LEVELS,
    parse(value) {
      const level = value.toUpperCase();
      if (!THINKING_LEVELS.includes(level)) throw oneOf(THINKING_LEVELS);
      return level;
    },
  },
  transcriber: {
    ofMode: "local",
    env: "SPEAKMORE_TRANSCRIBER",
    default: DEFAULT_TRANSCRIBER,
    choices: TRANSCRIBER_CHOICES,
    // 本机模型写 id；云端模型写 厂商/模型（只写厂商用它的默认模型），存下来的统一是 厂商/模型
    parse(value) {
      const id = value.trim();
      const cloud = cloudTranscriberOf(id);
      if (cloud) {
        if (!CLOUD_MODEL_NAME.test(cloud.model))
          throw new LocalizedError(msg("chat.badModelName", { model: JSON.stringify(cloud.model) }));
        return `${cloud.vendor}/${cloud.model}`;
      }
      if (!TRANSCRIBER_IDS.includes(id)) throw oneOf(TRANSCRIBER_CHOICES);
      return id;
    },
  },
  privateTranscriber: {
    ofMode: "private",
    env: "SPEAKMORE_PRIVATE_TRANSCRIBER",
    default: DEFAULT_TRANSCRIBER,
    // 数据隐私模式什么都不上传：只认本机模型
    choices: TRANSCRIBER_IDS,
    parse(value) {
      const id = value.trim();
      if (!TRANSCRIBER_IDS.includes(id)) throw oneOf(TRANSCRIBER_IDS);
      return id;
    },
  },
  polish: {
    ofMode: "local",
    env: "SPEAKMORE_POLISH",
    default: formatChatChoice(parseChatChoice(DEFAULT_POLISH)),
    choices: null,
    // 存下来的统一是 厂商/模型
    parse: (value) => formatChatChoice(parseChatChoice(value)),
  },
  customUrl: {
    ofMode: "local",
    env: "SPEAKMORE_CUSTOM_URL",
    // 空的是没填：只有润色交给自定义服务时才要
    default: "",
    choices: null,
    parse: (value) => (value.trim() === "" ? "" : normalizeBaseUrl(value)),
  },
  customParams: {
    ofMode: "local",
    env: "SPEAKMORE_CUSTOM_PARAMS",
    // 发给自定义服务的额外参数，一段 JSON 对象（GitHub issue #8）。设置都存成字符串，存的是去掉空白的那一行；空的是没填。
    // 手改 settings.json 的人多半直接写成对象，也认（json）：不认的话 App 一启动就因为设置读不出来退出
    json: true,
    default: "",
    choices: null,
    parse: (value) => formatCustomParams(parseCustomParams(value)),
  },
  modelSource: {
    // 本地模型没下载过时先从哪下，哪种模式里都能改（切到 local 之前先选好）。选的那个下不动会换另一个，只影响快慢
    env: "SPEAKMORE_MODEL_SOURCE",
    default: DEFAULT_SOURCE,
    choices: SOURCE_IDS,
    parse(value) {
      const id = value.trim().toLowerCase();
      if (!SOURCE_IDS.includes(id)) throw oneOf(SOURCE_IDS);
      return id;
    },
    label: (value) => msg(`modelSources.${value}`),
  },
  acceleration: {
    // 显卡驱动有问题、或者想把显卡让给游戏时选 cpu。换了要重新装一次模型，App 里当场换
    env: "SPEAKMORE_ACCELERATION",
    default: "auto",
    choices: ACCELERATIONS,
    parse(value) {
      const id = value.trim().toLowerCase();
      if (!ACCELERATIONS.includes(id)) throw oneOf(ACCELERATIONS);
      return id;
    },
    label: (value) => msg(`accelerations.${value}`),
  },
  localModelMemory: {
    // 哪种模式里都能改，和 acceleration 一样管的是本机模型。App 里当场换
    env: "SPEAKMORE_LOCAL_MODEL_MEMORY",
    default: "resident",
    choices: LOCAL_MODEL_MEMORY,
    parse(value) {
      const id = value.trim().toLowerCase();
      if (!LOCAL_MODEL_MEMORY.includes(id)) throw oneOf(LOCAL_MODEL_MEMORY);
      return id;
    },
    label: (value) => msg(`localModelMemories.${value}`),
  },
  "translate.to": {
    // 语音翻译译成什么：一种或几种，第一种是默认，悬浮条上能临时换成别的几种（只管那一次）。
    // 值是规整过的 id 列表写成 JSON（["en","ja"]），文件里存成数组；也认一个 id、逗号隔开的几个
    env: "SPEAKMORE_TRANSLATE_TO",
    default: JSON.stringify(["en"]),
    choices: null,
    json: true,
    parse: parseTranslateTargets,
    store: (value) => JSON.parse(value),
    label: (value) => alternatives(JSON.parse(value).map(languageName)),
  },
  // 划词翻译自己的几项，和语音那边毫不相干（他定的）：译成哪种、交给哪个模型；选自定义服务时，地址和参数也是它自己的，
  // 不和整理那一步的 customUrl、customParams 共用，key 也另存一把（app/lookup/engine.mjs）
  "lookup.to": {
    // 一种：卡片上能临时换成别的（只管那一次）
    env: "SPEAKMORE_LOOKUP_TO",
    default: "zh-CN",
    choices: TARGET_LANGUAGES.map(({ id }) => id),
    parse: parseLanguage,
    label: languageName,
  },
  "lookup.model": {
    env: "SPEAKMORE_LOOKUP_MODEL",
    default: formatChatChoice(parseChatChoice(DEFAULT_LOOKUP)),
    choices: null,
    // 写法同 polish：厂商/模型，只写厂商用它的默认模型，自定义服务写 custom/模型名
    parse: (value) => formatChatChoice(parseChatChoice(value)),
  },
  "lookup.customUrl": {
    env: "SPEAKMORE_LOOKUP_CUSTOM_URL",
    default: "",
    choices: null,
    parse: (value) => (value.trim() === "" ? "" : normalizeBaseUrl(value)),
  },
  "lookup.customParams": {
    env: "SPEAKMORE_LOOKUP_CUSTOM_PARAMS",
    json: true,
    default: "",
    choices: null,
    parse: (value) => formatCustomParams(parseCustomParams(value)),
  },
  // 悬浮条上方的操作提示（"再按一下 右⌥ 完成 · esc 取消"）：熟练了的人嫌它一直挂着（GitHub issue #3）
  barHint: shownSetting("SPEAKMORE_BAR_HINT"),
  theme: {
    env: "SPEAKMORE_THEME",
    default: DEFAULT_THEME,
    choices: THEME_IDS,
    parse(value) {
      // 写 id 或写名字都认（cinnabar、朱砂、Cinnabar），存下来的统一是 id
      const theme = findTheme(value.trim());
      if (theme === null) throw oneOf(THEME_IDS);
      return theme.id;
    },
    label: (value) => msg(`themes.${value}.name`),
  },
  language: {
    env: "SPEAKMORE_LANGUAGE",
    // 跟随系统，认不出系统的语言时用英文（src/i18n）
    default: SYSTEM_LOCALE,
    choices: LANGUAGES,
    parse(value) {
      const wanted = value.trim();
      if (wanted.toLowerCase() === SYSTEM_LOCALE) return SYSTEM_LOCALE;
      const locale = findLocale(wanted);
      if (locale === null) throw oneOf(LANGUAGES);
      return locale.id;
    },
    // 语言的名字用它自己的语言写（English、简体中文），不翻
    label: (value) => (value === SYSTEM_LOCALE ? msg("language.system") : findLocale(value).name),
  },
  outputScript: {
    // 听写成品的中文字形。本机模型只会写简体，要繁体的人在这里选；悬浮条每次开口现读，下一次听写就按新的（server/tasks/dictate）
    env: "SPEAKMORE_OUTPUT_SCRIPT",
    default: "simplified",
    choices: OUTPUT_SCRIPTS,
    parse(value) {
      const id = value.trim().toLowerCase();
      if (!OUTPUT_SCRIPTS.includes(id)) throw oneOf(OUTPUT_SCRIPTS);
      return id;
    },
    label: (value) => msg(`outputScripts.${value}`),
  },
  // 录音时在悬浮条上显示暂定的听写文字（服务端每来一块跑一次本机转写）。只有本机识别能预览，云端没有
  livePreview: shownSetting("SPEAKMORE_LIVE_PREVIEW"),
  // Mac 的程序坞里显示不显示：显示时和别的应用一样，有启动动画、运行中的小点，⌘Tab 切得过去；关掉就只待在菜单栏。
  // 别的系统没有程序坞，这项不起作用
  dockIcon: shownSetting("SPEAKMORE_DOCK_ICON"),
};

/** 语音翻译的目标语言：一个、逗号隔开的几个，或者 JSON 数组；规整成去重后的 id 列表。至少一种，最多 MAX_TRANSLATE_TARGETS 种 */
function parseTranslateTargets(text) {
  const trimmed = text.trim();
  let items = trimmed.split(",");
  if (trimmed.startsWith("[")) {
    try {
      items = JSON.parse(trimmed);
    } catch {
      // PowerShell 调 speakmore.cmd 时会去掉参数里的双引号（[en,ja]）。语言 id 里没有逗号和引号，照样拆得开
      items = trimmed.slice(1, -1).split(",");
    }
    if (!Array.isArray(items) || items.some((item) => typeof item !== "string")) {
      throw new LocalizedError(msg("settings.translateTargets", { max: MAX_TRANSLATE_TARGETS }));
    }
  }
  const ids = [
    ...new Set(
      items
        .map((item) => item.trim())
        .filter(Boolean)
        .map(parseLanguage),
    ),
  ];
  if (ids.length === 0 || ids.length > MAX_TRANSLATE_TARGETS) {
    throw new LocalizedError(msg("settings.translateTargets", { max: MAX_TRANSLATE_TARGETS }));
  }
  return JSON.stringify(ids);
}

/**
 * 命令行写的设置名 → 这一项现在的名字：改名之前的（legacyName）换成新的。不认识的抛错并列出能改的
 */
export function settingName(name) {
  if (Object.hasOwn(SETTINGS, name)) return name;
  const renamed = Object.keys(SETTINGS).find((current) => SETTINGS[current].legacyName === name);
  if (renamed !== undefined) return renamed;
  throw new LocalizedError(
    msg("settings.unknown", { name: JSON.stringify(name), names: Object.keys(SETTINGS).join(" / ") }),
  );
}

/** @param {string | object} where 哪里写的：设置的名字，或者一句话（msg） */
function parseValue(name, value, where) {
  try {
    const text = SETTINGS[name].json && value !== null && typeof value === "object" ? JSON.stringify(value) : value;
    if (typeof text !== "string") throw new LocalizedError(msg("settings.notText"));
    return SETTINGS[name].parse(text);
  } catch (error) {
    throw new LocalizedError(
      msg("settings.invalid", { where, value: JSON.stringify(value), reason: problemOf(error) }),
      {
        cause: error,
      },
    );
  }
}

function readFile(file) {
  if (!existsSync(file)) return {};
  let stored;
  try {
    // 开头的 BOM 去掉再读：Windows PowerShell 5.1 的 Set-Content -Encoding utf8、老版记事本存出来的都带，JSON.parse 不认
    stored = JSON.parse(readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
  } catch (error) {
    throw new LocalizedError(msg("settings.unreadable", { file, reason: error.message }), { cause: error });
  }
  if (stored === null || typeof stored !== "object" || Array.isArray(stored)) {
    throw new LocalizedError(msg("settings.notObject", { file }));
  }
  return stored;
}

function writeFile(file, stored) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(stored, null, 2)}\n`);
}

/** 这一项现在被哪个环境变量盖着（新名字优先于改名前的）；没有就是 null */
export function overridingEnv(name, env) {
  const setting = SETTINGS[settingName(name)];
  for (const variable of [setting.env, setting.legacyEnv]) {
    if (variable && env[variable] !== undefined) return variable;
  }
  return null;
}

/**
 * 现在生效的设置，以及每一项是从哪来的。
 * @returns {Record<keyof typeof SETTINGS, { value: string, source: "env" | "file" | "default", env?: string }>}
 *   来自改名前的环境变量时，env 写着是哪一个
 */
export function resolveSettings({ file, env }) {
  return resolveFrom(readFile(file), { file, env });
}

/** 按读出来的设置文件内容（stored）算，file 只用在报错里 */
function resolveFrom(stored, { file, env }) {
  const resolved = {};
  for (const [name, setting] of Object.entries(SETTINGS)) {
    const variable = overridingEnv(name, env);
    if (variable !== null) {
      const value = parseValue(name, env[variable], msg("settings.whereEnv", { variable }));
      resolved[name] = variable === setting.env ? { value, source: "env" } : { value, source: "env", env: variable };
    } else if (stored[name] !== undefined) {
      resolved[name] = {
        value: parseValue(name, stored[name], msg("settings.whereFile", { file, name })),
        source: "file",
      };
    } else {
      resolved[name] = { value: setting.default, source: "default" };
    }
  }
  return resolved;
}

/** 写入前的检查（check）。不合的照 parse 的规矩报错，说是哪一项、写的什么 */
function checkValue(name, value, settings) {
  const { check } = SETTINGS[name];
  if (!check) return [];
  try {
    return check(value, settings);
  } catch (error) {
    throw new LocalizedError(
      msg("settings.invalid", { where: name, value: JSON.stringify(value), reason: problemOf(error) }),
      {
        cause: error,
      },
    );
  }
}

/**
 * 校验并保存一项设置。name 可以是改名之前的（legacyName）。和别的项合不合（check）按文件里存的比，不看环境变量：
 * 环境变量只管这一次运行
 * @returns {{ value: string, warnings: object[] }} 规整后的值，和能存但要提醒的话
 */
export function saveSetting(file, name, value) {
  const current = settingName(name);
  const parsed = parseValue(current, value, current);
  // 和别的项比的那份设置是换上新值以后的：文件里这一项原来写坏了，正是要用这一下改回来
  const next = { ...readFile(file), [current]: SETTINGS[current].store?.(parsed) ?? parsed };
  const warnings = SETTINGS[current].check ? checkValue(current, parsed, resolveFrom(next, { file, env: {} })) : [];
  writeFile(file, next);
  return { value: parsed, warnings };
}

/** 取消一项设置，让它回到默认值。name 可以是改名之前的 */
export function unsetSetting(file, name) {
  const current = settingName(name);
  const { [current]: _removed, ...rest } = readFile(file);
  writeFile(file, rest);
}

/**
 * 按要改的几项拼出改后的设置，不写文件：先看改了之后走哪条路线、验证过了再存的时候用。
 * 写错了照 saveSetting 的规矩报错
 * @param {ReturnType<typeof resolveSettings>} settings
 * @param {Record<string, string>} changes
 */
export function patchSettings(settings, changes) {
  const patched = { ...settings };
  for (const [name, value] of Object.entries(changes)) {
    const current = settingName(name);
    const parsed = parseValue(current, value, current);
    checkValue(current, parsed, patched);
    patched[current] = { value: parsed, source: "file" };
  }
  return patched;
}

/** 每种模式自己的那几项设置（ofMode） */
export const MODE_SETTINGS = Object.freeze(
  Object.fromEntries(
    MODE_IDS.map((mode) => [mode, Object.keys(SETTINGS).filter((name) => SETTINGS[name].ofMode === mode)]),
  ),
);

/**
 * 每种模式由哪几项设置拼成路线（server/modes.mjs）。各看各的：改了 local 的润色，native 的路线不变
 */
const ROUTES = {
  native: (settings) => ({
    mode: "native",
    model: parseModelChoice(settings.model.value),
    thinkingLevel: settings.thinking.value,
  }),
  local: (settings) => ({
    mode: "local",
    transcriber: settings.transcriber.value,
    polish: parseChatChoice(settings.polish.value),
    customUrl: settings.customUrl.value || null,
    customParams: settings.customParams.value ? parseCustomParams(settings.customParams.value) : null,
  }),
  private: (settings) => ({ mode: "private", transcriber: settings.privateTranscriber.value }),
};

/**
 * 划词翻译按现在的设置交给谁、译成什么（app/lookup/engine.mjs）：choice 是 { vendor, model }，customUrl、customParams 是划词自己的
 * 自定义服务（没填是 null），to 是语言 id
 * @param {ReturnType<typeof resolveSettings>} settings
 */
export function lookupOf(settings) {
  return {
    to: settings["lookup.to"].value,
    choice: parseChatChoice(settings["lookup.model"].value),
    customUrl: settings["lookup.customUrl"].value || null,
    customParams: settings["lookup.customParams"].value
      ? parseCustomParams(settings["lookup.customParams"].value)
      : null,
  };
}

/**
 * 某种模式按现在的设置走哪条路线，不写就是设置里选的那种模式
 * @param {ReturnType<typeof resolveSettings>} settings
 * @param {string} [mode]
 */
export function routeOf(settings, mode = settings.mode.value) {
  return ROUTES[mode](settings);
}
