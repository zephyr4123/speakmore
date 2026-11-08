// README 三个功能的配图，都出 WebP 两倍图，浅色、深色各一张：
//   语音输入、语音翻译：字是直接写进别的应用的，App 里没有能截的画面，所以用代码画——口述的原话在左，写进输入框的字在右，
//     样式取 App 自己的（src/renderer/shared/tokens.css 和靛青主题）；下面的悬浮条是真的悬浮条页面离屏画出来的，不是照着画的。
//   截图的局部：划词翻译的实拍（在 Mac 上截的全屏）、官网用的 App 截图局部（readme-shots.mjs 记下的），裁一块加圆角和阴影。
//
//   ../node_modules/.bin/electron scripts/readme-scenes.mjs -- <photos.json> <输出目录>     （在 website/ 下）
//
// photos.json 是截图怎么裁：[{ "name": "lookup-web.zh-CN", "file": "<截图.png>", "crop": { "x", "y", "width", "height" }, "fade": 48 }]，
// 坐标是截图的像素（两倍图），fade 可省（见 photo）。输出目录里有 manifest.json，再用 upload-media.mjs 传到图片桶的 readme/ 下。
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { app, BrowserWindow, ipcMain, nativeImage, nativeTheme } from "electron";

const ROOT = resolve(fileURLToPath(import.meta.url), "../../..");
const { themeCss } = await import(join(ROOT, "src/themes/contract.mjs"));
const { findTheme } = await import(join(ROOT, "src/themes/index.mjs"));
const args = process.argv.slice(process.argv.indexOf("--") + 1);
const [photosFile, out] = args;
const manifest = {};
const THEME = findTheme("indigo");
const TOKENS = readFileSync(join(ROOT, "src/renderer/shared/tokens.css"), "utf8");
const wait = (ms) => new Promise((done) => setTimeout(done, ms));

// 悬浮条页面向主进程要的：主题、界面语言、配置
let locale = "zh-CN";
ipcMain.on("theme:get", (event) => {
  event.returnValue = themeCss(THEME);
});
ipcMain.on("locale:get", (event) => {
  event.returnValue = locale;
});
ipcMain.handle("config:get", () => ({ serverUrl: "ws://127.0.0.1:9/none", hotkeys: HOTKEYS, barControls: true }));
ipcMain.on("bar:set-visible", () => {});
ipcMain.on("bar:capture", () => {});

/** 出厂的热键，拼法同 app/main.mjs 的 hotkeys.chords（Mac） */
const HOTKEYS = {
  dictate: [["AltRight"]],
  translate: [["AltRight", "Space"]],
  lookup: [["AltRight", "Enter"]],
  cancel: [["Escape"]],
};
// 说话时的声波高度：中间高、两头低，一组固定值（同 screenshots.mjs）
const WAVE = [0.18, 0.26, 0.34, 0.46, 0.58, 0.72, 0.86, 1, 0.84, 0.7, 0.55, 0.44, 0.32, 0.24, 0.16];

/** 一个只有画布的离屏页：转码、给截图加外框都在它上面画 */
let canvasWindow;
async function canvasPage() {
  if (!canvasWindow) {
    canvasWindow = new BrowserWindow({ show: false, webPreferences: { offscreen: true } });
    await canvasWindow.loadURL("data:text/html,<canvas></canvas>");
  }
  return canvasWindow;
}

async function encode(png, quality = 0.9) {
  const page = await canvasPage();
  const dataUrl = await page.webContents.executeJavaScript(`(async () => {
    const image = new Image();
    image.src = "data:image/png;base64,${png.toString("base64")}";
    await image.decode();
    const canvas = document.querySelector("canvas");
    canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
    const c = canvas.getContext("2d"); c.clearRect(0, 0, canvas.width, canvas.height); c.drawImage(image, 0, 0);
    return canvas.toDataURL("image/webp", ${quality});
  })()`);
  return Buffer.from(dataUrl.slice(dataUrl.indexOf(",") + 1), "base64");
}

function save(name, body, width, height) {
  const file = `${name}.webp`;
  writeFileSync(join(out, file), body);
  manifest[name] = { file, width, height };
  console.log(file, `${width}×${height}`, `${Math.round(body.length / 1024)} KB`);
}

/** 透明图里不全透明的那一块，四边再留一点（同 screenshots.mjs） */
function cropToContent(image, margin) {
  const { width, height } = image.getSize();
  const bitmap = image.toBitmap();
  let [minX, minY, maxX, maxY] = [width, height, 0, 0];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (bitmap[(y * width + x) * 4 + 3] === 0) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  const x = Math.max(0, minX - margin) & ~1;
  const y = Math.max(0, minY - margin) & ~1;
  return image.crop({
    x,
    y,
    width: (Math.min(width, maxX + margin + 1) - x) & ~1,
    height: (Math.min(height, maxY + margin + 1) - y) & ~1,
  });
}

/**
 * 真的悬浮条页面，说话中的样子：提示行照 bar-view 的 hintFor 算；语音翻译带语言胶囊，open 时展开选单
 * @returns {Promise<Electron.NativeImage>} 两倍图
 */
async function barImage({ action, chip = null }) {
  const win = new BrowserWindow({
    // 英文的提示行加上胶囊比中文长得多：窗口给宽一些，免得被切
    width: 900,
    height: chip ? 420 : 320,
    show: false,
    transparent: true,
    backgroundColor: "#00000000",
    webPreferences: {
      offscreen: true,
      preload: join(ROOT, "src/preload/preload.cjs"),
      sandbox: true,
      contextIsolation: true,
    },
  });
  await win.loadFile(join(ROOT, "src/renderer/bar/bar.html"));
  // 离屏窗口不认 force-device-scale-factor：放大两倍画
  win.webContents.setZoomFactor(2);
  await win.webContents.insertCSS("body { padding-bottom: 40px !important; }");
  await wait(500);
  await win.webContents.executeJavaScript(`(async () => {
    const { hintFor } = await import("./bar-view.mjs");
    const { createTranslator } = await import("../../i18n/index.mjs");
    const { chordKeycaps } = await import("../../hotkeys/chord.mjs");
    const { languageName } = await import("../../languages.mjs");
    const t = createTranslator(${JSON.stringify(locale)});
    const b = document.body;
    b.dataset.view = "recording";
    b.dataset.shown = "true";
    b.dataset.controls = "true";
    const group = (keys) => {
      const span = Object.assign(document.createElement("span"), { className: "keys" });
      span.append(...keys.map((key) => Object.assign(document.createElement("kbd"), { textContent: key })));
      return span;
    };
    const keycapsOf = (codes) => chordKeycaps(codes).map((cap) => t.text(cap));
    const keys = keycapsOf(${JSON.stringify(HOTKEYS[action][0])});
    const escKeys = keycapsOf(${JSON.stringify(HOTKEYS.cancel[0])});
    const parts = hintFor("recording", { keys, escKeys, cancellable: true }, t);
    document.getElementById("hint").replaceChildren(...parts.map((p) => (typeof p === "string" ? p : group(p.keys))));
    [...document.querySelectorAll("#wave i")].forEach((i, n) => i.style.setProperty("--h", ${JSON.stringify(WAVE)}[n]));
    const chip = ${JSON.stringify(chip)};
    if (chip) {
      // 画法同 bar-ui.mjs 的 drawChip
      const host = document.getElementById("chip");
      host.hidden = false;
      host.toggleAttribute("data-open", chip.open);
      const button = Object.assign(document.createElement("span"), { className: "chip" });
      button.append(Object.assign(document.createElement("span"), { textContent: t.text(languageName(chip.language)) }));
      button.append(Object.assign(document.createElement("span"), { className: "caret", textContent: "⌄" }));
      const menu = Object.assign(document.createElement("div"), { className: "menu" });
      for (const id of chip.targets) {
        const item = Object.assign(document.createElement("span"), { className: "option" });
        item.setAttribute("aria-selected", String(id === chip.language));
        item.append(Object.assign(document.createElement("span"), { textContent: t.text(languageName(id)) }));
        if (id === chip.language) item.insertAdjacentHTML("beforeend", '<svg class="tick-mark" viewBox="0 0 14 14" aria-hidden="true"><path d="M2.5 7.5l3 3 6-7" /></svg>');
        menu.append(item);
      }
      host.replaceChildren(menu, button);
    }
  })()`);
  await wait(1200);
  // 四边多留一点，阴影淡完再裁，不切出硬边
  const image = cropToContent(await win.webContents.capturePage(), 28);
  win.destroy();
  return image;
}

const TEXT = {
  "zh-CN": {
    spoken: "口述",
    written: "写入光标处",
    dictate: {
      said: "嗯……明天那个会，改到，呃，改到下午三点吧，然后那个方案也记得带上。",
      wrote: "明天的会改到下午三点，记得带上方案。",
    },
    translate: {
      saidLabel: "口述 · 中文",
      wroteLabel: "写入光标处 · 英文",
      said: "下周三下午两点开会，请提前把方案发给我。",
      wrote: "Let's meet next Wednesday at 2 p.m. Please send me the proposal beforehand.",
      chip: { language: "en", targets: ["en", "ja"] },
    },
  },
  en: {
    spoken: "Spoken",
    written: "Written at the cursor",
    dictate: {
      said: "Um, so the meeting tomorrow, let's move it to, uh, to three p.m., and bring the, the proposal.",
      wrote: "Let's move tomorrow's meeting to 3 p.m. and bring the proposal.",
    },
    translate: {
      saidLabel: "Spoken · English",
      wroteLabel: "Written at the cursor · Chinese",
      said: "Let's move the meeting to Thursday afternoon, and please send me the slides beforehand.",
      wrote: "我们把会议改到周四下午吧，请提前把幻灯片发给我。",
      chip: { language: "zh-CN", targets: ["zh-CN", "ja"] },
    },
  },
};

const ICON = {
  mic: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>',
  arrow: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  cursor: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7V5h16v2M9 19h6M12 5v14"/></svg>',
};

/** 一张示意图：左边口述的原话，下面是说话时的悬浮条（真的）；右边写进输入框的字 */
function sceneHtml({ saidLabel, wroteLabel, said, wrote, bar, scheme }) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    ${TOKENS}
    ${themeCss(THEME)}
    :root { color-scheme: ${scheme}; }
    html, body { margin: 0; background: transparent; -webkit-font-smoothing: antialiased; }
    main {
      width: 880px; box-sizing: border-box; padding: 34px 36px 22px; border-radius: 20px;
      font: var(--text-body) / 1.6 var(--font); color: var(--ink);
      background:
        radial-gradient(120% 90% at 0% 0%, color-mix(in oklch, var(--aura) 60%, transparent), transparent 60%),
        radial-gradient(90% 80% at 100% 100%, color-mix(in oklch, var(--aura-2) 55%, transparent), transparent 60%),
        var(--bg);
      border: 1px solid var(--border);
    }
    .row { display: grid; grid-template-columns: 1fr 40px 1.1fr; align-items: center; gap: 14px; }
    .side { display: flex; flex-direction: column; gap: 4px; }
    .card { border-radius: var(--radius-card); border: 1px solid var(--border); background: var(--bg); padding: 18px 20px 20px; box-shadow: 0 1px 2px oklch(0 0 0 / 0.05); }
    .label { display: flex; align-items: center; gap: 6px; font-size: var(--text-body); font-weight: var(--weight-semibold); color: var(--ink-2); margin-bottom: 10px; }
    .label svg { width: 15px; height: 15px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
    .said { color: var(--ink-2); font-size: 15px; }
    .arrow { display: grid; place-items: center; color: var(--primary); }
    .arrow svg { width: 26px; height: 26px; fill: none; stroke: currentColor; stroke-width: 2.2; stroke-linecap: round; stroke-linejoin: round; }
    .window { padding: 0; overflow: hidden; }
    .chrome { display: flex; gap: 7px; padding: 12px 14px; border-bottom: 1px solid var(--border); background: var(--raised); }
    .chrome i { width: 10px; height: 10px; border-radius: 50%; background: color-mix(in oklch, var(--ink-2) 35%, transparent); }
    .field { padding: 16px 20px 22px; }
    .wrote { font-size: 17px; font-weight: var(--weight-medium); color: var(--ink); }
    .caret { display: inline-block; width: 2px; height: 1.15em; margin-left: 2px; vertical-align: -0.2em; background: var(--primary); border-radius: 1px; }
    .bar { display: flex; justify-content: center; }
    .bar img { display: block; }
  </style></head><body><main>
    <div class="row">
      <div class="side">
        <div class="card"><div class="label">${ICON.mic}${saidLabel}</div><div class="said">${said}</div></div>
        <div class="bar"><img src="${bar.src}" width="${bar.width}" height="${bar.height}" alt=""></div>
      </div>
      <div class="arrow">${ICON.arrow}</div>
      <div class="card window"><div class="chrome"><i></i><i></i><i></i></div>
        <div class="field"><div class="label">${ICON.cursor}${wroteLabel}</div><div class="wrote">${wrote}<span class="caret"></span></div></div>
      </div>
    </div>
  </main></body></html>`;
}

/** 一段 HTML 离屏画出来，裁到 main 那一块，两倍图 */
async function render(html, width) {
  const win = new BrowserWindow({
    width: width * 2,
    height: 1600,
    show: false,
    transparent: true,
    backgroundColor: "#00000000",
    webPreferences: { offscreen: true },
  });
  await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  win.webContents.setZoomFactor(2);
  await wait(900);
  const height = await win.webContents.executeJavaScript(
    "Math.ceil(document.querySelector('main').getBoundingClientRect().height)",
  );
  const image = (await win.webContents.capturePage()).crop({ x: 0, y: 0, width: width * 2, height: height * 2 });
  win.destroy();
  return { body: await encode(image.toPNG()), width, height };
}

/**
 * 真截图裁一块，加圆角、细边和阴影。fade：右边这么宽（CSS 像素）渐隐成透明，连同细边和阴影一起淡掉，
 * 读起来是"画面外还有"而不是硬切一刀（划词实拍里比裁切还长的那几行）；改的是透明度，深浅底色上都不露馅
 */
async function photo({ file, crop, fade = 0 }) {
  const image = nativeImage.createFromPath(file).crop(crop);
  const png = image.toPNG();
  const page = await canvasPage();
  const result = await page.webContents.executeJavaScript(`(async () => {
    const image = new Image();
    image.src = "data:image/png;base64,${png.toString("base64")}";
    await image.decode();
    const s = 2, pad = 28 * s, r = 12 * s;
    const w = image.naturalWidth, h = image.naturalHeight;
    const canvas = document.querySelector("canvas");
    canvas.width = w + pad * 2; canvas.height = h + pad * 2;
    const c = canvas.getContext("2d");
    c.clearRect(0, 0, canvas.width, canvas.height);
    c.save(); c.shadowColor = "rgba(15, 20, 40, 0.26)"; c.shadowBlur = 24 * s; c.shadowOffsetY = 10 * s;
    c.beginPath(); c.roundRect(pad, pad, w, h, r); c.fillStyle = "#fff"; c.fill(); c.restore();
    c.save(); c.beginPath(); c.roundRect(pad, pad, w, h, r); c.clip(); c.drawImage(image, pad, pad); c.restore();
    c.beginPath(); c.roundRect(pad + 0.5 * s, pad + 0.5 * s, w - s, h - s, r); c.lineWidth = s; c.strokeStyle = "rgba(0, 0, 0, 0.14)"; c.stroke();
    if (${fade} > 0) {
      const mask = c.createLinearGradient(pad + w - ${fade} * s, 0, pad + w, 0);
      mask.addColorStop(0, "#000"); mask.addColorStop(1, "transparent");
      c.globalCompositeOperation = "destination-in"; c.fillStyle = mask; c.fillRect(0, 0, canvas.width, canvas.height);
      c.globalCompositeOperation = "source-over";
    }
    return { url: canvas.toDataURL("image/webp", 0.9), width: canvas.width / s, height: canvas.height / s };
  })()`);
  return {
    body: Buffer.from(result.url.slice(result.url.indexOf(",") + 1), "base64"),
    width: result.width,
    height: result.height,
  };
}

app.commandLine.appendSwitch("force-device-scale-factor", "2");
app.dock?.hide();
app.on("window-all-closed", () => {});
app.whenReady().then(async () => {
  mkdirSync(out, { recursive: true });
  for (const lang of ["zh-CN", "en"]) {
    locale = lang;
    const words = TEXT[lang];
    for (const scheme of ["light", "dark"]) {
      nativeTheme.themeSource = scheme;
      for (const action of ["dictate", "translate"]) {
        const { said, wrote, chip, saidLabel = words.spoken, wroteLabel = words.written } = words[action];
        const image = await barImage({ action, chip: chip ? { ...chip, open: true } : null });
        const { width, height } = image.getSize();
        const bar = { src: image.toDataURL(), width: width / 2, height: height / 2 };
        const scene = await render(sceneHtml({ saidLabel, wroteLabel, said, wrote, bar, scheme }), 880);
        save(`${action}-${scheme}.${lang}`, scene.body, scene.width, scene.height);
      }
    }
  }
  const photos = photosFile && photosFile !== "-" ? JSON.parse(readFileSync(photosFile, "utf8")) : [];
  for (const entry of photos) {
    const shot = await photo(entry);
    save(entry.name, shot.body, shot.width, shot.height);
  }
  writeFileSync(join(out, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`共 ${Object.keys(manifest).length} 张：${out}`);
  app.quit();
});
