import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULTS, describePlaza, loadPriceBook } from "../../../src/app/model-plaza.mjs";
import { clampZoom, fitView, wheelZoom, zoomAround } from "../../../src/renderer/hub/engine/canvas.mjs";
import {
  MODE_ORDER,
  MODE_ROLES,
  plazaView,
  ROLE_IDS,
  searchPlaza,
} from "../../../src/renderer/hub/engine/plaza-view.mjs";
import { curve } from "../../../src/renderer/hub/engine/tree.mjs";
import { patchSettings, resolveSettings, routeOf } from "../../../src/storage/settings.mjs";

// 引擎页（侧栏的"引擎"，路由名还是 models）里机器查得了的部分：树上每一项的状态怎么定、线连成什么样、
// 搜索、画布的缩放。画在页面上的样子要在真窗口里看（docs/desktop-ui-spec.md 的验收）。

const prices = await loadPriceBook();
const defaults = resolveSettings({ file: "/nonexistent/settings.json", env: {} });

/** 一份引擎页的数据，拼法同主进程（app/main.mjs 的 describePlazaNow）；改哪几项就传哪几项 */
function plaza({ mode = "local", changes = {}, keys = { deepseek: "stored" }, status = {} } = {}) {
  const settings = patchSettings(defaults, changes);
  const value = (name) => settings[name].value;
  return describePlaza({
    mode,
    chosen: {
      native: value("model"),
      transcriber: value("transcriber"),
      privateTranscriber: value("privateTranscriber"),
      polish: value("polish"),
      customUrl: value("customUrl"),
      customParams: value("customParams"),
    },
    keys,
    status,
    chip: "apple-silicon",
    freeBytes: 1e11,
    prices,
    routes: Object.fromEntries(MODE_ORDER.map((id) => [id, routeOf(settings, id)])),
    presets: [],
    at: new Date("2026-10-20T02:30:00Z"),
  });
}

const installed = (...ids) =>
  Object.fromEntries(ids.map((id) => [id, { installed: true, download: null, partial: 0, problem: null }]));

const groupOf = (data, role, id) => data.shelves[role].find((group) => group.id === id);
const itemNamed = (group, name) => group.items.find((item) => item.name === name);

test("识别方式一列按 原生、数据隐私、转写 + 润色 排，连到环节的线不交叉", () => {
  const edges = MODE_ORDER.flatMap((mode, from) =>
    MODE_ROLES[mode].map((role) => ({ from, to: ROLE_IDS.indexOf(role) })),
  );
  assert.equal(edges.length, 4);
  for (const a of edges)
    for (const b of edges) assert.ok(!(a.from < b.from && a.to > b.to), `${JSON.stringify(a)} × ${JSON.stringify(b)}`);
});

test("转写 + 润色方式：转写、润色两个环节在用，原生只是已选定", () => {
  const view = plazaView(plaza({ status: installed(DEFAULTS.transcribe) }));
  assert.equal(view.isLive("transcribe"), true);
  assert.equal(view.isLive("polish"), true);
  assert.equal(view.isLive("native"), false);
  const spot = view.chosenSpot("polish");
  assert.equal(spot.group.id, "deepseek");
  assert.equal(spot.item.name, "DeepSeek V4.1 Flash");
  assert.equal(view.lineOf("polish", spot.group, spot.item), "live");
  // 原生选的那一个在树上是虚线（已选定、方式没在用）
  const native = view.chosenSpot("native");
  assert.equal(view.lineOf("native", native.group, native.item), "standby");
  assert.equal(view.groupLine("native", native.group), "standby");
  // 没选的是淡线
  const pro = itemNamed(spot.group, "DeepSeek V4 Pro");
  assert.equal(view.lineOf("polish", spot.group, pro), "base");
});

test("数据隐私方式：转写那一环看的是它自己那一项，润色不在用", () => {
  const data = plaza({
    mode: "private",
    changes: { privateTranscriber: "sensevoice-small-int8" },
    status: installed(DEFAULTS.transcribe, "sensevoice-small-int8"),
  });
  const view = plazaView(data);
  assert.equal(view.isLive("transcribe"), true);
  assert.equal(view.isLive("polish"), false);
  assert.equal(view.chosenSpot("transcribe").item.choice, "sensevoice-small-int8");
  // 启用本机模型还留在数据隐私方式里，启用云端转写要换成转写 + 润色
  const local = groupOf(data, "transcribe", "local");
  const cloud = groupOf(data, "transcribe", "qwen");
  assert.equal(view.modeFor("transcribe", local), "private");
  assert.equal(view.modeFor("transcribe", cloud), "local");
  assert.equal(view.settingFor("transcribe", local), "privateTranscriber");
});

test("渠道：选过的 → 正在用的 → 配了密钥的 → 第一个", () => {
  const data = plaza({ keys: { bailian: "stored" } });
  const deepseek = groupOf(data, "polish", "deepseek");
  // 正在用的是 DeepSeek 官方
  assert.equal(plazaView(data).viaOf("polish", deepseek), "deepseek");
  // 用户在详情里换到百炼看
  assert.equal(plazaView(data, { via: { deepseek: "bailian" } }).viaOf("polish", deepseek), "bailian");
  // 没在用这一组时，先看配了密钥的那一家
  const other = plaza({ changes: { polish: "zhipu/glm-4.5-air" }, keys: { bailian: "stored" } });
  assert.equal(plazaView(other).viaOf("polish", groupOf(other, "polish", "deepseek")), "bailian");
});

test("一项还差什么：没下载、下载中、缺密钥、自定义服务没配齐；都不差是 null", () => {
  const data = plaza({
    keys: { deepseek: "stored" },
    status: {
      ...installed(DEFAULTS.transcribe),
      "sensevoice-small-int8": {
        installed: false,
        download: { received: 10, total: 100 },
        partial: 10,
        problem: null,
      },
    },
  });
  const view = plazaView(data);
  const local = groupOf(data, "transcribe", "local");
  const pick = (choice) => local.items.find((item) => item.choice === choice);
  assert.equal(view.blocker("transcribe", local, pick(DEFAULTS.transcribe)), null);
  assert.equal(view.blocker("transcribe", local, pick("sensevoice-small-int8")), "downloading");
  const notYet = local.items.find((item) => !item.installed && !item.download);
  assert.equal(view.blocker("transcribe", local, notYet), "download");
  const kimi = groupOf(data, "polish", "kimi");
  assert.equal(view.blocker("polish", kimi, kimi.items[0]), "key");
  assert.equal(view.groupBlocker(kimi), "key");
  const custom = groupOf(data, "polish", "custom");
  assert.equal(view.blocker("polish", custom, custom.items[0]), "custom");
  assert.equal(view.groupBlocker(custom), "custom");
  const deepseek = groupOf(data, "polish", "deepseek");
  assert.equal(view.blocker("polish", deepseek, deepseek.items[0]), null);
});

test("自定义服务：验证过、还没换上的草稿不算选定，留着启用", () => {
  const data = plaza({
    changes: { polish: "custom/qwen-max", customUrl: "https://example.com/v1" },
    keys: { custom: "stored" },
  });
  const custom = groupOf(data, "polish", "custom");
  const item = custom.items[0];
  const view = plazaView(data);
  assert.equal(view.holds("polish", custom, item), true);
  assert.equal(view.isChosen("polish", custom, item), true);
  assert.equal(view.blocker("polish", custom, item), null);
  const draft = { url: "https://other.example.com/v1", model: "glm", params: "" };
  const drafted = plazaView(data, { custom: { form: null, draft } });
  assert.equal(drafted.isChosen("polish", custom, item), false);
  assert.equal(drafted.choiceOf("polish", custom, item), "custom/glm");
  assert.deepEqual(drafted.customExtra(), { customUrl: draft.url, customParams: "" });
});

test("搜索：名字、厂商、型号的写法都算，大小写不论；一个结果带着它在哪一环、哪一家", () => {
  const data = plaza();
  const hits = searchPlaza(data, "FLASH");
  assert.ok(
    hits.some(
      ({ role, group, item }) => role === "polish" && group.id === "deepseek" && item.name === "DeepSeek V4.1 Flash",
    ),
  );
  assert.ok(searchPlaza(data, "deepseek-flash").some(({ item }) => item.name === "DeepSeek V4.1 Flash"));
  assert.ok(searchPlaza(data, "sensevoice").every(({ role, group }) => role === "transcribe" && group.id === "local"));
  assert.deepEqual(searchPlaza(data, "   "), []);
  assert.deepEqual(searchPlaza(data, "没有这个模型"), []);
});

test("适应画布：横向居中、贴顶放下整棵树，倍数不超过用户调过的（没调过不超过 100%），也不小于下限", () => {
  const box = { cw: 800, ch: 600 };
  const big = fitView({ w: 2000, h: 600, ...box, userK: null });
  assert.ok(big.k < 1 && big.k >= 0.4);
  // 横向居中
  assert.ok(Math.abs(big.x + 2000 * big.k - (800 - big.x)) < 1e-6);
  const small = fitView({ w: 300, h: 200, ...box, userK: null });
  assert.equal(small.k, 1);
  // 画布比树高：树贴着顶上那条边，多出来的高度都留在底下（不上下平分，标题和树之间不空出一大块）
  assert.equal(small.y, 24);
  assert.equal(big.y, 24);
  assert.equal(fitView({ w: 300, h: 200, ...box, userK: 0.8 }).k, 0.8);
  assert.equal(fitView({ w: 90000, h: 200, ...box, userK: null }).k, 0.4);
  assert.equal(clampZoom(9), 1.6);
});

test("以一点为中心缩放：那一点在画布上的位置不动", () => {
  const view = { x: 40, y: 30, k: 1 };
  const next = zoomAround(view, 1.5, 300, 200);
  // 缩放前后，画布上 (300, 200) 对着的是树上同一点
  const before = { x: (300 - view.x) / view.k, y: (200 - view.y) / view.k };
  const after = { x: (300 - next.x) / next.k, y: (200 - next.y) / next.k };
  assert.ok(Math.abs(before.x - after.x) < 1e-9 && Math.abs(before.y - after.y) < 1e-9);
  assert.equal(next.k, 1.5);
});

test("按住 ⌘ / Ctrl 滚动缩放：触控板捏合照原样连续缩；鼠标滚一格只走一档（同缩放按钮的 1.2 倍），按行报的也一样", () => {
  const near = (a, b) => Math.abs(a - b) < 1e-9;
  // 触控板捏合每次只报几个像素
  assert.ok(near(wheelZoom(4), Math.exp(-0.04)));
  assert.ok(near(wheelZoom(-4), Math.exp(0.04)));
  // Windows 上鼠标一格 100 左右、Mac 上 120 左右：一格一档，不是一下跳到头
  assert.ok(near(wheelZoom(100), 1 / 1.2));
  assert.ok(near(wheelZoom(-120), 1.2));
  // 按行报的（deltaMode 1）先换成像素
  assert.ok(near(wheelZoom(3, 1), 1 / 1.2));
  assert.equal(wheelZoom(0), 1);
});

test("连线是两头水平的三次曲线：分叉自然往右上、右、右下走", () => {
  const d = curve(0, 10, 100, 50);
  assert.match(d, /^M0\.0,10\.0 C50\.0,10\.0 50\.0,50\.0 100\.0,50\.0$/);
  // 两头挨得很近时，控制点也至少拉开一点，不画成折线
  assert.match(curve(0, 0, 10, 40), /C16\.0,0\.0 -6\.0,40\.0/);
});
