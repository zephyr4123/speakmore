import { DEFAULT_TRANSCRIBER, downloadSize, findModel, MODELS, makerOf, measuredOn } from "../models/catalog.mjs";
import { nameParts } from "../models/describe.mjs";
import { CLOUD_TRANSCRIBERS, cloudTranscriberOf } from "../server/asr/cloud/vendors.mjs";
import { CHAT_VENDORS, formatChatChoice, parseChatChoice } from "../server/chat/vendors.mjs";
import { CNY_PER_USD } from "../server/currency.mjs";
import { DEFAULT_LOOKUP, LOOKUP_TESTED } from "../server/lookup/models.mjs";
import { DEFAULT_POLISH, keyVendorsOf, usesLocalModel } from "../server/modes.mjs";
import { DEFAULT_MODEL_CHOICE, formatModelChoice, PROVIDERS } from "../server/providers/index.mjs";
import { VENDORS } from "../server/vendors.mjs";
import { DAILY_DICTATIONS, monthlyCost, TYPICAL } from "../usage/estimate.mjs";

// 模型广场（主窗口侧栏的"模型"一页）要的数据。按角色分三排货架，加一张密钥表：
//   native      原生识别：收音频的模型（server/providers）
//   transcribe  转写：本机模型（models/catalog.mjs）和云端模型（server/asr/cloud）
//   polish      润色：纯文字模型（server/chat/vendors.mjs），最后是自定义服务
// 另有划词翻译那一排（lookup）：型号同润色，默认和评测是划词自己的（server/lookup/models.mjs），自定义服务也是它自己的。
// 云端的货架按"谁做的"（maker）分组，一组里的模型可能有好几个平台卖（DeepSeek 官方和百炼都有 V4.1 Flash）：
// 平台是这一组的渠道，同一个模型在各渠道的写法和价格各自记在 offers 里。用户一个平台只配一把 key。
// 另外给引擎页第一列的识别方式（renderer/hub/engine/）一份三种方式各自的样子：一路经过哪几个模型、切过去还差什么；
// 引擎页的推荐组合（models/presets.mjs）也是同样的样子，再加上每月多少钱（usage/estimate.mjs）。
// 模型信息只从各个登记处读，这里不另写；会变的（设置、key 在哪、本机模型的下载状态、价）由调用方给。

/** 平台在密钥表里的先后：覆盖最广的在前，自定义服务总在最后，没列到的排在它们中间 */
const PLATFORM_ORDER = ["bailian", "deepseek", "moonshot", "zhipu", "minimax", "gemini", "openai"];
/** 货架上各组的先后（按 maker），没列到的接在后面 */
const MAKER_ORDER = ["qwen", "deepseek", "kimi", "zhipu", "minimax", "gemini", "openai"];

const rank = (order, id) => {
  const at = order.indexOf(id);
  return at === -1 ? order.length : at;
};

/**
 * 三个角色在各平台上的清单：[{ vendor, models }]。润色那边的自定义服务单独成一组（没有清单可列）
 * @type {Record<"native" | "transcribe" | "polish", ReadonlyArray<{ id: string, models: ReadonlyArray<object> }>>}
 */
const REGISTRIES = {
  native: PROVIDERS,
  transcribe: CLOUD_TRANSCRIBERS,
  polish: CHAT_VENDORS.filter(({ id }) => id !== "custom"),
};

/** 各角色的出厂默认，写法同设置（厂商/模型；本机模型是 id） */
export const DEFAULTS = Object.freeze({
  native: formatModelChoice(DEFAULT_MODEL_CHOICE),
  transcribe: DEFAULT_TRANSCRIBER,
  polish: formatChatChoice(parseChatChoice(DEFAULT_POLISH)),
});

/**
 * 把三个角色要标价的那几家的价目模块都加载好（主进程启动时调一次），交回两个查价的函数：
 *   priceOf  货架上标的价（各家的 listPrice）
 *   costOf   用了这么多花多少美元（各家的 costOf，和记账同一套），推荐组合的月成本用
 * 价目里没有的都是 null
 * @returns {Promise<{
 *   priceOf: (role: string, vendor: string, model: string) => object | null,
 *   costOf: (role: string, vendor: string, model: string, usage: object, at: Date) => number | null,
 * }>}
 */
export async function loadPriceBook() {
  const book = {};
  for (const [role, registry] of Object.entries(REGISTRIES)) {
    book[role] = {};
    for (const vendor of registry) {
      if (vendor.prices) book[role][vendor.id] = await vendor.prices();
    }
  }
  return {
    priceOf: (role, vendor, model) => book[role]?.[vendor]?.listPrice?.(model) ?? null,
    costOf: (role, vendor, model, usage, at) => book[role]?.[vendor]?.costOf?.(model, usage, at) ?? null,
  };
}

/**
 * 云端的一排货架：按 maker 分组，同名的模型并成一行，各平台是这一行的渠道
 * @param {{ defaultChoice?: string, tested?: (choice: string, model: object) => boolean }} [tags]
 *   打"默认""已评测"按谁的：不给就是这个角色自己的（DEFAULTS、清单里的 tested）
 */
function cloudShelf(
  role,
  { priceOf },
  { defaultChoice = DEFAULTS[role], tested = (_choice, model) => model.tested } = {},
) {
  const groups = new Map();
  for (const vendor of REGISTRIES[role]) {
    for (const model of vendor.models) {
      if (!groups.has(model.maker))
        groups.set(model.maker, { id: model.maker, kind: "cloud", channels: [], rows: new Map() });
      const group = groups.get(model.maker);
      if (!group.channels.includes(vendor.id)) group.channels.push(vendor.id);
      if (!group.rows.has(model.name))
        group.rows.set(model.name, { name: model.name, tested: false, issue: null, offers: {} });
      const row = group.rows.get(model.name);
      row.tested ||= Boolean(tested(`${vendor.id}/${model.id}`, model));
      row.issue ??= model.issue ?? null;
      // 未验证（照文档接入、没拿真 key 调过）跟着渠道走：同一个模型换一家卖，可能就验过了
      row.offers[vendor.id] = {
        choice: `${vendor.id}/${model.id}`,
        price: priceOf(role, vendor.id, model.id),
        unverified: Boolean(model.unverified),
      };
    }
  }
  return [...groups.values()]
    .sort((a, b) => rank(MAKER_ORDER, a.id) - rank(MAKER_ORDER, b.id))
    .map(({ rows, ...group }) => ({
      ...group,
      items: [...rows.values()].map(({ tested, issue, ...row }) => ({
        ...row,
        tags: tagsOf({
          isDefault: Object.values(row.offers).some(({ choice }) => choice === defaultChoice),
          tested,
          issue,
        }),
      })),
    }));
}

/** 自定义服务那一组：没有清单可列，只有一项 */
const customGroup = () => ({
  id: "custom",
  kind: "custom",
  channels: ["custom"],
  items: [{ name: null, tags: [], offers: {} }],
});

/** 标签只有三种：出厂默认、跑过成批评测、已知问题（文案 models.issues.<issue>） */
function tagsOf({ isDefault, tested, issue }) {
  return [
    ...(isDefault ? [{ kind: "default" }] : []),
    ...(tested ? [{ kind: "tested" }] : []),
    ...(issue ? [{ kind: "issue", issue }] : []),
  ];
}

/**
 * 本机模型那一组：名字拆成型号和量化档，规格取这类芯片上跑得最快的那次实测
 * @param {Record<string, object>} status models/library.mjs 的 status，按 id
 */
function localGroup({ status, chip, freeBytes }) {
  return {
    id: "local",
    kind: "local",
    channels: ["local"],
    freeBytes,
    chip,
    items: MODELS.map((model) => {
      const [best] = measuredOn(model, chip);
      const { base, variant } = nameParts(model.name);
      return {
        name: base,
        variant,
        maker: makerOf(model),
        choice: model.id,
        backend: best?.backend ?? null,
        bytes: downloadSize(model),
        license: model.license.name,
        ...(status[model.id] ?? { installed: false, download: null, partial: 0, problem: null }),
        specs: best
          ? {
              zh: best.zh ?? null,
              mix: best.mix ?? null,
              minuteSeconds: 60 / best.realtime,
              memoryGB: best.peakMB / 1000,
              sizeMB: downloadSize(model) / 1_000_000,
            }
          : null,
        tags: tagsOf({ isDefault: model.id === DEFAULTS.transcribe, tested: false, issue: null }),
      };
    }),
  };
}

/** 一个平台在各排货架上各有几个模型（密钥表里写"可用 直出 4 · 转文字 4 · 整理 6 · 划词 6"） */
function coverageOf(id) {
  const count = (registry) => registry.find((vendor) => vendor.id === id)?.models.length ?? 0;
  // 划词翻译那一排的型号同润色（各家的同一把 key 两边都能用）
  return {
    ...Object.fromEntries(Object.entries(REGISTRIES).map(([role, registry]) => [role, count(registry)])),
    lookup: count(REGISTRIES.polish),
  };
}

/** 一路上的一个云端模型：名字取清单里的，清单外的照写进设置的型号 */
function cloudHop(role, registry, vendor, model) {
  const listed = registry.find(({ id }) => id === vendor)?.models.find(({ id }) => id === model);
  return { role, platform: vendor, maker: listed?.maker ?? vendor, name: listed?.name ?? model };
}

/** 一路上的转写：云端的按厂商/模型，否则是本机模型 */
function transcribeHop(transcriber) {
  const cloud = cloudTranscriberOf(transcriber);
  if (cloud) return cloudHop("transcribe", CLOUD_TRANSCRIBERS, cloud.vendor, cloud.model);
  const model = findModel(transcriber);
  return {
    role: "transcribe",
    platform: "local",
    maker: model ? makerOf(model) : null,
    name: model?.name ?? transcriber,
  };
}

/** 每种方式一路经过哪几个模型，按先后 */
const HOPS = Object.freeze({
  native: (route) => [cloudHop("native", PROVIDERS, route.model.provider, route.model.model)],
  local: (route) => [
    transcribeHop(route.transcriber),
    route.polish.vendor === "custom"
      ? { role: "polish", platform: "custom", maker: null, name: route.polish.model }
      : cloudHop("polish", CHAT_VENDORS, route.polish.vendor, route.polish.model),
  ],
  private: (route) => [transcribeHop(route.transcriber)],
});

/**
 * 一条路线一路经过的模型，按先后：{ role, platform, maker, name }。词典页说每一跳收不收词表也按它（app/vocabulary.mjs）
 * @param {object} route storage/settings.mjs 的 routeOf 拼出来的
 */
export const hopsOf = (route) => HOPS[route.mode](route);

/**
 * 一条路线还差什么。只列看得见的：本机模型没下载好、要的那家没有 key、自定义服务没写地址；
 * key 对不对、服务够不够得着，切过去以后由 key 管理去验，结果在 key 的状态里（app/modes.mjs）。历史里重跑也按它（app/rerun.mjs）
 * @param {object} route
 * @param {{ keys: Record<string, string | null>, status: Record<string, object> }} state 每家的 key 在哪、本机模型的状态
 */
export function needsOf(route, { keys, status }) {
  const needs = [];
  if (usesLocalModel(route) && !status[route.transcriber]?.installed) {
    needs.push({ kind: "download", model: route.transcriber });
  }
  if (route.mode === "local" && route.polish.vendor === "custom" && !route.customUrl) needs.push({ kind: "url" });
  for (const { id } of keyVendorsOf(route)) if (!keys[id]) needs.push({ kind: "key", platform: id });
  return needs;
}

/**
 * 一种识别方式的样子：一路经过哪几个模型、还差什么
 * @param {object | { problem: object }} route 那种方式按设置走的路线；拼不出来时是拼不出来的原因
 */
function wayOf(route, state) {
  if (route.problem) return { problem: route.problem, hops: [], needs: [] };
  return { hops: hopsOf(route), needs: needsOf(route, state) };
}

/** 每天 100 次的月成本，美元和折成的人民币（界面按语言挑一种）；算不出来是 null */
function monthlyOf(route, { costOf }, at) {
  const usd = route.problem ? null : monthlyCost(route, costOf, at);
  return usd === null ? null : { usd, cny: usd * CNY_PER_USD };
}

/**
 * @param {object} options
 * @param {"native" | "local" | "private"} options.mode 正在用哪种识别方式
 * @param {{ native: string, transcriber: string, privateTranscriber: string, polish: string, customUrl: string, customParams: string }} options.chosen
 *   设置里各角色选的（转写在 local、private 两种方式里各选各的）
 * @param {Record<string, "env" | "stored" | null>} options.keys 每家的 key 在哪（key-manager 的 sources）
 * @param {Record<string, object>} options.status 本机模型的状态，按 id（models/library.mjs 的 status）
 * @param {string | null} options.chip catalog.mjs 的 chipOf
 * @param {number | null} options.freeBytes 模型目录那块磁盘还剩多少；查不了是 null
 * @param {Awaited<ReturnType<typeof loadPriceBook>>} options.prices 查价（loadPriceBook 给的）
 * @param {Record<"native" | "local" | "private", object>} options.routes 三种方式各按设置走哪条路线
 *   （storage/settings.mjs 的 routeOf）；拼不出来的写成 { problem }
 * @param {Array<{ preset: object, route: object }>} options.presets 适合这台机器的推荐组合（models/presets.mjs 的 presetsFor），
 *   各带着按设置换上它那几项之后的路线；拼不出来的写成 { problem }
 * @param {Date} options.at 估月成本按哪一刻的价（usage/estimate.mjs 的 estimateTime）
 */
export function describePlaza({ mode, chosen, keys, status, chip, freeBytes, prices, routes, presets, at }) {
  const platforms = VENDORS.map(({ id, name, keyEnv, keyPage }) => ({
    id,
    name,
    keyEnv,
    hasKeyPage: Boolean(keyPage),
    key: keys[id] ?? null,
    coverage: coverageOf(id),
  })).sort((a, b) => {
    if (a.id === "custom" || b.id === "custom") return a.id === "custom" ? 1 : -1;
    return rank(PLATFORM_ORDER, a.id) - rank(PLATFORM_ORDER, b.id);
  });
  return {
    mode,
    chosen,
    ways: Object.fromEntries(Object.entries(routes).map(([id, route]) => [id, wayOf(route, { keys, status })])),
    presets: presets.map(({ preset, route }) => ({
      id: preset.id,
      mode: preset.mode,
      settings: preset.settings,
      ...wayOf(route, { keys, status }),
      // 正在用：方式就是它，按设置走的路线也和它的一样
      active: mode === preset.mode && JSON.stringify(route) === JSON.stringify(routes[preset.mode]),
      monthly: monthlyOf(route, prices, at),
    })),
    // 月成本的口径，界面上写出来
    typical: { daily: DAILY_DICTATIONS, seconds: Math.round(TYPICAL.seconds) },
    defaults: DEFAULTS,
    platforms,
    shelves: {
      native: cloudShelf("native", prices),
      transcribe: [localGroup({ status, chip, freeBytes }), ...cloudShelf("transcribe", prices)],
      polish: [...cloudShelf("polish", prices), customGroup()],
      // 划词翻译（引擎页"划词"那一段）：型号同润色，标签按划词自己的；自定义服务那一组也是划词自己的
      lookup: [
        ...cloudShelf("polish", prices, {
          defaultChoice: formatChatChoice(parseChatChoice(DEFAULT_LOOKUP)),
          tested: (choice) => LOOKUP_TESTED.includes(choice),
        }),
        customGroup(),
      ],
    },
  };
}
