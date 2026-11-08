// README 和官网用的 App 截图：从源码起真 App（家目录是 /tmp 下的临时目录，造好历史、词典），经调试端口点到每一页截两倍图。
// 出的是 docs/development.md "README 的图"第 2 步要的 PNG：<en|zh>-<序号>-<名字>.png，01–09 是首次引导，settings- 开头的只截设置那一块。
// 接着交给 readme-media.mjs 加窗口外框。
// 另出 photos.json：官网只放局部（整扇窗口缩到一栏里字太小），桌面一份、手机一份更紧的，裁哪块按页面上元素的位置量，
// 交给 readme-scenes.mjs 加圆角和阴影。桌面那份的引导几步统一 16:10，宽 584–730（官网一栏 584 宽，显示在 80%–100%）。
//
//   ../scripts/dev/with-key.sh gemini ../scripts/dev/with-key.sh deepseek ../scripts/dev/with-key.sh bailian \
//     node scripts/readme-shots.mjs <输出目录>                    （在 website/ 下）
//
// 不碰 ~/.speakmore，只把里面已经下好的本机转写模型按 APFS 克隆拷一份进临时家目录（不占空间、不改原件），
// 主窗口才是"混合（本机转文字 + DeepSeek 整理）"、模型已下载的样子。没下过就是未下载的样子，截出来照实。
// 热键是出厂的那套（图上要是用户装好看到的样子）；截图时没人按键，和本机正在跑的 SpeakMore 同时听也不会误触。
// 程序坞图标关掉；动效全关。
import { spawn, spawnSync } from "node:child_process";
import { closeSync, existsSync, mkdirSync, mkdtempSync, openSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(import.meta.url), "../../..");
const out = resolve(process.argv[2] ?? "readme-shots");
const { openHistory } = await import(join(ROOT, "src/storage/history.mjs"));
const { requestControl } = await import(join(ROOT, "src/control.mjs"));
const { DEFAULT_TRANSCRIBER } = await import(join(ROOT, "src/models/catalog.mjs"));
const wait = (ms) => new Promise((done) => setTimeout(done, ms));
const PORT = 9333;
const NO_MOTION =
  "*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}";
const LOCALES = { zh: "zh-CN", en: "en" };
/** 主窗口、引导窗口的大小（CSS 像素），截图是它的两倍 */
const WINDOW = { width: 1080, height: 750 };
const photos = [];

// 历史里的话：像平时工作里说的，长短混着；隔几条是一句语音翻译（带原文和目标语言）
const TEXTS = {
  en: [
    "Let's meet next Wednesday at 2 p.m. Please send me the proposal beforehand.",
    "Sounds good. I'll send the draft tonight.",
    "Can you move the standup to ten? The design review runs long on Thursdays.",
    "Three things for tomorrow:\n1. Fix the README\n2. Ship the release\n3. Update the website",
    "Thanks for the feedback. We will follow up shortly.",
  ],
  "zh-CN": [
    "我们后天开会，记得把上个月的数据带上。",
    "好的，我今晚把初稿发你。",
    "明天的 standup 改到十点吧，周四的设计评审总是拖。",
    "明天要做三件事：\n1. 改 README\n2. 发版\n3. 更新官网",
    "谢谢，已经好了。",
  ],
};
const TRANSLATIONS = {
  en: { source: "下周三下午两点开会，请提前把方案发给我。", text: TEXTS.en[0], outputLanguage: "en" },
  "zh-CN": {
    source: "Let's meet next Wednesday at 2 p.m. Please send me the proposal beforehand.",
    text: "我们下周三下午两点开会，请提前把方案发给我。",
    outputLanguage: "zh-CN",
  },
};
// 词典里的词：人名、产品、术语
const WORDS = [
  "Claude Code",
  "SpeakMore",
  "DeepSeek",
  "Qwen3-ASR",
  "Kubernetes",
  "埋点",
  "灰度发布",
  "复盘",
  "飞书多维表格",
  "Figma",
  "PRD",
  "OKR",
];

function seed(home, locale) {
  mkdirSync(join(home, "data"), { recursive: true });
  const history = openHistory(join(home, "data", "history.db"));
  const texts = TEXTS[locale];
  const today = new Date();
  today.setHours(18, 0, 0, 0);
  let n = 0;
  for (let day = 140; day >= 0; day--) {
    if (day > 14 && (day % 3 === 0 || day % 7 === 1)) continue;
    const count = day === 0 ? 6 : 4 + ((day * 7) % 19);
    for (let i = 0; i < count; i++) {
      const at = new Date(today.getTime() - day * 86_400_000 - i * 37 * 60_000).toISOString();
      const id = `demo-${n++}`;
      const translated = i % 4 === 1;
      history.addCall({
        purpose: "dictation",
        audioId: id,
        provider: "deepseek",
        model: "deepseek-flash",
        inputTokens: 1500,
        audioTokens: 0,
        cachedTokens: 1350,
        outputTokens: 18,
        thinkingTokens: 0,
        costUsd: 0.00004,
        latencyMs: 900 + (i % 4) * 160,
        createdAt: at,
      });
      const line = TRANSLATIONS[locale];
      history.add({
        id,
        status: "completed",
        ...(translated
          ? { kind: "translate", refinedText: line.text, sourceText: line.source, outputLanguage: line.outputLanguage }
          : { refinedText: texts[(day + i) % texts.length] }),
        error: null,
        duration: 3 + (i % 5) * 4.5,
        audioFile: null,
        createdAt: at,
      });
    }
  }
  history.close();
  writeFileSync(join(home, "vocabulary.json"), `${JSON.stringify({ terms: WORDS }, null, 2)}\n`);
}

/** 调试协议：一个页面一条连接 */
async function connect(match) {
  for (let i = 0; i < 60; i++) {
    try {
      const targets = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
      const target = targets.find((t) => t.type === "page" && t.url.includes(match));
      if (target) {
        const ws = new WebSocket(target.webSocketDebuggerUrl);
        await new Promise((ok, bad) => {
          ws.onopen = ok;
          ws.onerror = bad;
        });
        let id = 0;
        const pending = new Map();
        ws.onmessage = (event) => {
          const message = JSON.parse(event.data);
          if (message.id && pending.has(message.id)) {
            pending.get(message.id)(message);
            pending.delete(message.id);
          }
        };
        const send = (method, params = {}) =>
          new Promise((done) => {
            id += 1;
            pending.set(id, done);
            ws.send(JSON.stringify({ id, method, params }));
          });
        const evaluate = async (expression) => {
          const { result } = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
          if (result?.exceptionDetails) throw new Error(`${match}：${result.exceptionDetails.exception?.description}`);
          return result?.result?.value;
        };
        return { send, evaluate, close: () => ws.close() };
      }
    } catch (error) {
      if (error.message?.includes("：")) throw error;
      // 还没起来
    }
    await wait(500);
  }
  throw new Error(`没等到页面 ${match}`);
}

/** 截一张：clip 给了就只截那一块（设置对话框） */
async function shoot(page, file, clip) {
  await page.evaluate(
    `(() => { let s = document.getElementById("__no_motion"); if (!s) { s = document.createElement("style"); s.id = "__no_motion"; s.textContent = ${JSON.stringify(NO_MOTION)}; document.head.append(s); } document.activeElement?.blur?.(); })()`,
  );
  await wait(300);
  const { result } = await page.send("Page.captureScreenshot", {
    format: "png",
    ...(clip ? { clip: { ...clip, scale: 1 } } : {}),
  });
  if (!result?.data) throw new Error(`${file} 没截成`);
  writeFileSync(join(out, file), Buffer.from(result.data, "base64"));
  console.log(file);
}

const scheme = (page, value) =>
  page.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value }] });
const click = async (page, selector) => {
  const ok = await page.evaluate(
    // 引擎页语音、划词两段的树都在页面上，藏着的那段也找得到：只点看得见的
    `(() => { const el = [...document.querySelectorAll(${JSON.stringify(selector)})].find((e) => e.offsetParent !== null); if (!el) return false; el.click(); return true; })()`,
  );
  if (!ok) {
    // 找不到时把页面上现有的节点 key 列出来：多半是型号改了名
    const keys = await page.evaluate(
      `[...document.querySelectorAll("[data-key]")].map((el) => el.dataset.key).join(" ")`,
    );
    throw new Error(`页面上没有 ${selector}；现有的 data-key：${keys}`);
  }
};

/** 起一份隔离的 App，做完 work 再退掉、删家目录 */
async function withApp({ locale, keyed }, work) {
  const home = mkdtempSync("/tmp/smreadme.");
  seed(home, locale);
  writeFileSync(join(home, "settings.json"), JSON.stringify({ theme: "indigo", mode: "local" }));
  const model = join(homedir(), ".speakmore", "models", DEFAULT_TRANSCRIBER);
  if (existsSync(model)) {
    mkdirSync(join(home, "models"), { recursive: true });
    spawnSync("cp", ["-cR", model, join(home, "models")]);
  }
  const env = {
    ...process.env,
    SPEAKMORE_HOME: home,
    SPEAKMORE_LANGUAGE: locale,
    SPEAKMORE_DOCK_ICON: "off",
    SPEAKMORE_APP: join(home, "noapp", "SpeakMore.app"),
    SPEAKMORE_BIN_DIR: join(home, "bin"),
  };
  if (!keyed) for (const name of ["GEMINI_API_KEY", "DEEPSEEK_API_KEY", "BAILIAN_API_KEY"]) delete env[name];
  // App 自己的日志写到输出目录里，起不来、截不对时看它
  const log = openSync(join(out, `app-${locale}-${keyed ? "hub" : "onboarding"}.log`), "w");
  const child = spawn(join(ROOT, "node_modules/.bin/electron"), [".", `--remote-debugging-port=${PORT}`], {
    cwd: ROOT,
    env,
    stdio: ["ignore", log, log],
  });
  const control = (cmd, params) => requestControl(join(home, "run", "control.sock"), cmd, params);
  try {
    await wait(4000);
    await work(control);
  } finally {
    const quit = await control("quit").then(
      () => true,
      () => false,
    );
    await wait(1500);
    child.kill();
    // node_modules/.bin/electron 只是个启动脚本：没退成的话按调试端口把真正的 Electron 收掉，不然它占着端口
    if (!quit) {
      const pids = spawnSync("lsof", ["-ti", `tcp:${PORT}`, "-sTCP:LISTEN"], { encoding: "utf8" }).stdout;
      for (const pid of pids.split("\n").filter(Boolean)) spawnSync("kill", [pid]);
      await wait(1500);
    }
    closeSync(log);
    rmSync(home, { recursive: true, force: true });
  }
}

/**
 * 记一块要给官网裁的局部：几组元素合起来的范围，四边留 pad；ratio 给了就补成那个宽高比，宽在 minWidth–maxWidth 之间，
 * 内容比这个比例高就照内容的高（宁可这一张高一些，也不裁掉内容）。top：往下补，不上下各补一半。
 * hide：裁出来的边上会切到半截的东西（标题、工具栏、底下的栏），先藏起来另拍一张到 crops/ 下，裁那一张。
 * 藏用透明度不用 visibility：推荐组合是挂在工具栏按钮上的弹层，锚点 visibility: hidden 时弹层也跟着不画
 * 坐标是 CSS 像素，记下来时换成两倍图的像素
 */
async function crop(
  page,
  { name, file, locale, selectors, hide = [], pad = 16, ratio = null, minWidth = 0, maxWidth = Infinity, top = false },
) {
  const box = await page.evaluate(`(() => {
    const rects = ${JSON.stringify(selectors)}.flatMap((s) => [...document.querySelectorAll(s)])
      .filter((el) => el.offsetParent !== null || getComputedStyle(el).position === "fixed")
      .map((el) => el.getBoundingClientRect()).filter((r) => r.width > 0 && r.height > 0);
    if (rects.length === 0) return null;
    const x = Math.min(...rects.map((r) => r.left)), y = Math.min(...rects.map((r) => r.top));
    return { x, y, width: Math.max(...rects.map((r) => r.right)) - x, height: Math.max(...rects.map((r) => r.bottom)) - y };
  })()`);
  if (!box) throw new Error(`${name}：页面上没找到 ${selectors.join("、")}`);
  let { x, y, width, height } = {
    x: box.x - pad,
    y: box.y - pad,
    width: box.width + pad * 2,
    height: box.height + pad * 2,
  };
  if (ratio) {
    const w = Math.max(width, Math.min(Math.max(height * ratio, minWidth), maxWidth));
    const h = Math.max(height, w / ratio);
    x -= (w - width) / 2;
    if (!top) y -= (h - height) / 2;
    [width, height] = [w, h];
  }
  // 不出窗口
  x = Math.max(0, Math.min(x, WINDOW.width - width));
  y = Math.max(0, Math.min(y, WINDOW.height - height));
  width = Math.min(width, WINDOW.width);
  height = Math.min(height, WINDOW.height);
  // 取整到 CSS 像素再乘 2：两倍图的宽高是偶数，官网按 CSS 像素算比例时不出半个像素
  const px = (v) => Math.round(v) * 2;
  let source = file;
  if (hide.length > 0) {
    const opacity = (value) =>
      page.evaluate(
        `${JSON.stringify(hide)}.forEach((s) => document.querySelectorAll(s).forEach((el) => { el.style.opacity = "${value}"; }))`,
      );
    source = join("crops", `${name}.${locale}.png`);
    await opacity("0");
    await shoot(page, source);
    await opacity("");
  }
  photos.push({
    name: `${name}.${locale}`,
    file: join(out, source),
    crop: { x: px(x), y: px(y), width: px(width), height: px(height) },
  });
}

/** 引擎页树上的节点：环节（role）、厂商（maker）按 key 开头找；型号是叶子，key 是型号的名字（本机模型是它的 id），含着就算 */
const node = (level, key) => `.node[data-level="${level}"][data-key^="${key}"]`;
const leaf = (key) => `.leaf[data-key*="${key}"]`;

/** 官网首次引导那一段的桌面版：几张并排，补成一样的 16:10、宽度差不多，字的大小才接近 */
const SETUP_DESKTOP = { pad: 32, ratio: 1.6, minWidth: 584, maxWidth: 730 };

/** 引导每一步给官网裁哪块（crop 的选项）：桌面带标题，手机只要那几行 */
const SETUP_CROPS = {
  // 功能：演示里的聊天窗口，往下补到 16:10 正好带上底下的悬浮条；标题靠左、离得远，带上就太宽了，藏起来免得露半截。
  // 手机只要聊天那一栏，悬浮条在它下边上会露半截，也藏起来
  features: {
    desktop: { selectors: [".scene .app"], top: true, hide: [".step-title"] },
    mobile: { selectors: [".scene .app .pane"], hide: [".demo-bar"] },
  },
  keys: { desktop: { selectors: ["#keys-title", "#key-rows"] }, mobile: { selectors: ["#key-rows"] } },
  permissions: {
    desktop: { selectors: ["#permissions-title", "#grants", ".privacy"] },
    mobile: { selectors: ["#grants"] },
  },
  engine: {
    desktop: { selectors: ["#engine-title", "#summary", ".engine-actions"] },
    mobile: { selectors: ["#summary", ".engine-actions"] },
  },
};

async function onboarding(control, tag) {
  await control("show-settings", { onboarding: true });
  const page = await connect("/onboarding/onboarding.html");
  await page.send("Page.enable");
  await scheme(page, "light");
  await wait(1500);
  // 主进程不让页面自己跳地址：点页面上的"开始""继续"一步步走
  const steps = await page.evaluate(`[...document.querySelectorAll(".step")].map((s) => s.dataset.step)`);
  for (const [index, step] of steps.entries()) {
    if (index === 1) await click(page, "#start");
    if (index > 1) await click(page, "#next");
    await wait(1500);
    // readme-media.mjs 按序号 01–09 认出是引导，名字前面自己加 onboarding-
    const file = `${tag}-0${index + 1}-${step}.png`;
    await shoot(page, file);
    const parts = SETUP_CROPS[step];
    if (!parts) continue;
    const locale = LOCALES[tag];
    await crop(page, { name: `setup-${step}`, file, locale, ...SETUP_DESKTOP, ...parts.desktop });
    await crop(page, { name: `setup-${step}-sm`, file, locale, pad: 16, ...parts.mobile });
  }
  page.close();
}

async function hub(control, tag) {
  await control("show-history");
  const page = await connect("/hub/hub.html");
  await page.send("Page.enable");
  await scheme(page, "light");
  // 权限、密钥的检查是陆续回来的：等顶上的提示条定下来再拍
  await wait(8000);
  let n = 10;
  const next = (name) => `${tag}-${n++}-${name}.png`;
  const go = async (route) => {
    await click(page, `[data-route="${route}"].nav-item`);
    await wait(1000);
  };

  await go("home");
  await shoot(page, next("home"));
  await scheme(page, "dark");
  await wait(500);
  await shoot(page, next("home-dark"));
  await scheme(page, "light");
  await page.evaluate(`document.getElementById("spend").scrollIntoView({ block: "end" })`);
  await wait(500);
  await shoot(page, next("spend"));
  await page.evaluate(`document.querySelector(".content").scrollTop = 0`);

  await go("history");
  await shoot(page, next("history"));
  await go("vocabulary");
  await shoot(page, next("vocabulary"));

  await go("models");
  await shoot(page, next("engine"));
  // 整理这一环：厂商 DeepSeek，型号 V4.1 Flash 的详情
  await click(page, node("role", "polish"));
  await wait(600);
  await click(page, node("maker", "deepseek"));
  await wait(600);
  await click(page, leaf("DeepSeek V4.1 Flash"));
  await wait(900);
  const polish = next("polish");
  await shoot(page, polish);
  // 官网：厂商一列 → 型号 → 详情卡这一条，带上两列的列名；底下的图例、缩放条会露半截，藏起来。手机只要详情卡
  await crop(page, {
    name: "polish-crop",
    file: polish,
    locale: LOCALES[tag],
    selectors: ['#engine-tree .col-label[data-col="3"]', '.node[data-level="maker"]', ".leaf", "#engine-detail > *"],
    hide: ["#engine-legend", ".zoom"],
    pad: 20,
  });
  await crop(page, {
    name: "polish-card",
    file: polish,
    locale: LOCALES[tag],
    selectors: ["#engine-detail > *"],
    hide: ["#engine-canvas-links", "#engine-legend", ".zoom"],
    pad: 16,
  });
  // 转文字这一环：本机的 Qwen3-ASR
  await click(page, node("role", "transcribe"));
  await wait(600);
  await click(page, node("maker", "local"));
  await wait(600);
  await click(page, leaf(DEFAULT_TRANSCRIBER));
  await wait(900);
  await shoot(page, next("transcribe"));
  await click(page, "#preset-trigger");
  await wait(700);
  const presets = next("presets");
  await shoot(page, presets);
  // 官网只要弹出来的那张推荐组合：后面的工具栏、引擎树、侧栏（英文的弹层靠左，压着侧栏的边）都会露半截，藏起来
  const backdrop = [".sidebar", '.page[data-route="models"] > .page-head', "#engine-canvas"];
  await crop(page, {
    name: "setup-presets",
    file: presets,
    locale: LOCALES[tag],
    selectors: ["#preset-picker"],
    hide: backdrop,
    ...SETUP_DESKTOP,
  });
  await crop(page, {
    name: "setup-presets-sm",
    file: presets,
    locale: LOCALES[tag],
    selectors: ["#preset-picker"],
    hide: backdrop,
    pad: 16,
  });
  await page.evaluate(`document.getElementById("preset-picker")?.hidePopover?.()`);
  await wait(400);
  await click(page, "#keys-trigger");
  await wait(800);
  // 底下那行写着密钥存在哪：临时家目录的路径换成用户默认看到的那个
  await page.evaluate(
    `(() => { const el = document.getElementById("keys-home"); el.textContent = el.textContent.replace(/\\/tmp\\/smreadme\\.\\S+/, "~/.speakmore"); })()`,
  );
  await shoot(page, next("keys"));
  await page.evaluate(`document.getElementById("keys-sheet")?.close()`);
  await wait(400);
  // 划词那一段：DeepSeek V4.1 Flash 的详情
  await click(page, '#engine-segments [data-segment="lookup"]');
  await wait(800);
  await click(page, node("maker", "deepseek"));
  await wait(600);
  await click(page, leaf("DeepSeek V4.1 Flash"));
  await wait(900);
  await shoot(page, next("engine-lookup"));
  await click(page, '#engine-segments [data-segment="voice"]');

  // 设置：只截对话框那一块
  await click(page, "#open-settings");
  await wait(700);
  for (const [pane, name] of [
    ["hotkeys", "settings-hotkeys"],
    ["translation", "settings-translate"],
  ]) {
    await click(page, `.settings-menu [data-pane="${pane}"]`);
    await wait(600);
    const clip = await page.evaluate(
      `(() => { const r = document.getElementById("settings").getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; })()`,
    );
    await shoot(page, next(name), clip);
  }
  page.close();
}

mkdirSync(join(out, "crops"), { recursive: true });
for (const [tag, locale] of Object.entries(LOCALES)) {
  // 首次引导照新装的人看到的：没配 key；主窗口配了 key
  await withApp({ locale, keyed: false }, (control) => onboarding(control, tag));
  await withApp({ locale, keyed: true }, (control) => hub(control, tag));
}
writeFileSync(join(out, "photos.json"), `${JSON.stringify(photos, null, 2)}\n`);
console.log(`官网的局部 ${photos.length} 块：${join(out, "photos.json")}`);
