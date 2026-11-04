import { join } from "node:path";
import { floatAboveAll, floatingWindowOptions, showAboveAll } from "../on-top.mjs";
import { placeCard } from "./place.mjs";

// 划词卡片的窗口（主进程这一头）：做法同悬浮条——透明、不抢焦点、整个窗口点不到，卡片上按钮的点击由小帮手截下来
// （点击一旦落在我们的窗口上，系统会把我们切到前面，用户正在看、正在写的那个应用就丢了焦点和选区）。
// 页面（renderer/lookup/card.mjs）按交来的样子画卡片，量好大小和按钮的位置报回来；这里按选区摆窗口、把按钮交给小帮手截，
// 块外的按下另报 outside（点别处收起）。
// 坐标：Electron 用 DIP；小帮手在 Mac 上用点（和 DIP 一样），在 Windows 上用物理像素，进出都换算。

/** 卡片四周给阴影留的地方（页面 body 的内边距，card.css 的 --pad 同一个数）：留小了阴影被切成硬边 */
const PAD = 32;
/** 卡片的宽（card.css 的 .card 同一个数）；窗口还没量过时先按最高的开，免得页面排版被挤 */
const CARD_WIDTH = 384;
const INITIAL_HEIGHT = 640;
/** 小帮手截了 10 分钟没人说松开会自己松开（防父进程出岔子）。卡片固定着可以一直开着，隔一会儿再说一遍 */
const CAPTURE_REFRESH_MS = 5 * 60_000;

/**
 * @param {object} options
 * @param {typeof import("electron").BrowserWindow} options.BrowserWindow
 * @param {import("electron").Screen} options.screen
 * @param {import("electron").IpcMain} options.ipcMain
 * @param {string} options.sourceDir src 目录
 * @param {object} options.webPreferences
 * @param {boolean} options.windows 是不是 Windows（坐标换算）
 * @param {(regions: object[] | null) => void} options.capture 让小帮手截这几块（屏幕坐标、小帮手那一套）；null 是不截了
 * @param {(action: string) => void} options.onAct 卡片上点了什么（controller.mjs 的 act）
 * @param {() => void} options.onGone 页面崩了（开着的那一张该收起）
 * @param {{ info: Function, warn: Function, error: Function }} options.log
 */
export function createCardWindow({
  BrowserWindow,
  screen,
  ipcMain,
  sourceDir,
  webPreferences,
  windows,
  capture,
  onAct,
  onGone,
  log,
}) {
  const window = new BrowserWindow({
    width: CARD_WIDTH + 2 * PAD,
    height: INITIAL_HEIGHT,
    show: false,
    frame: false,
    transparent: true,
    hasShadow: false,
    resizable: false,
    skipTaskbar: true,
    // 不抢焦点：用户正在用的那个应用留着焦点和选区，看完接着用
    focusable: false,
    webPreferences,
    ...floatingWindowOptions({ mac: !windows }),
  });
  // 点击由小帮手截；鼠标移动照样转给页面（悬停的样子、译文太长时滚动要它）
  window.setIgnoreMouseEvents(true, { forward: true });
  // 同悬浮条：浮在一切之上，露出来时再顶一次（app/on-top.mjs）
  floatAboveAll(window, { mac: !windows });
  window.loadFile(join(sourceDir, "renderer", "lookup", "card.html"));

  /** 这一张卡片摆在哪：选区的框（DIP），不知道选区时是按下那一刻的鼠标位置；没开着是 null */
  let anchor = null;
  /** 卡片现在多大：页面量好报上来的；还没报是 null */
  let size = null;
  let refreshTimer = null;
  /** 最近一次交给小帮手的几块（屏幕坐标），隔一会儿重说一遍用 */
  let captured = null;

  const send = (channel, payload) => {
    if (!window.isDestroyed()) window.webContents.send(channel, payload);
  };

  /** 小帮手给的选区框 → DIP：Windows 上是物理像素 */
  const toDip = (rect) => (windows ? screen.screenToDipRect(null, rect) : rect);
  /** 窗口里的一块 → 小帮手的屏幕坐标 */
  function toScreen({ id, x, y, width, height }) {
    const origin = window.getBounds();
    const rect = { x: origin.x + x, y: origin.y + y, width, height };
    return { id, ...(windows ? screen.dipToScreenRect(window, rect) : rect) };
  }

  /** 按选区和卡片的大小摆窗口；第一次摆好才露出来（免得先在旧位置闪一下） */
  function place() {
    if (!anchor || !size) return;
    const display = anchor.selection
      ? screen.getDisplayMatching(anchor.selection)
      : screen.getDisplayNearestPoint(anchor.pointer);
    const spot = placeCard({ selection: anchor.selection, pointer: anchor.pointer, size, workArea: display.workArea });
    window.setBounds({
      x: Math.round(spot.x - PAD),
      y: Math.round(spot.y - PAD),
      width: CARD_WIDTH + 2 * PAD,
      height: Math.ceil(size.height + 2 * PAD),
    });
    if (!window.isVisible()) showAboveAll(window);
  }

  function stopRefresh() {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }

  ipcMain.on("lookup:layout", (event, layout) => {
    if (event.sender !== window.webContents || !anchor) return;
    if (!Number.isFinite(layout?.height) || !Array.isArray(layout.regions)) {
      log.error("lookup_layout_invalid", { type: typeof layout });
      return;
    }
    size = { width: CARD_WIDTH, height: layout.height };
    place();
    // 摆好以后按新的位置换算按钮；"点别处收起"要小帮手报块外的按下
    captured = layout.regions.map(toScreen);
    capture(captured);
    if (!refreshTimer) refreshTimer = setInterval(() => captured && capture(captured), CAPTURE_REFRESH_MS);
  });
  ipcMain.on("lookup:act", (event, action) => {
    if (event.sender !== window.webContents || typeof action !== "string") return;
    onAct(action);
  });
  // 译文长、指针停在译文上：让窗口收鼠标，滚轮才滚得动（按下照样被小帮手截着，不会抢焦点）
  ipcMain.on("lookup:scroll", (event, on) => {
    if (event.sender !== window.webContents || window.isDestroyed()) return;
    window.setIgnoreMouseEvents(!on, { forward: true });
  });
  // 页面崩了不重新加载的话，之后每次划词都等不到它报位置，卡片永远出不来，模型却照调、历史照记
  window.webContents.on("render-process-gone", (_event, details) => {
    log.error("lookup_card_gone", { reason: details.reason });
    capture(null);
    onGone();
    if (!window.isDestroyed()) window.webContents.reload();
  });

  return {
    /**
     * 开一张卡片
     * @param {object} view controller.mjs 的样子
     * @param {{ rect: { x: number, y: number, width: number, height: number } | null }} where 选区的框（小帮手的屏幕坐标）
     */
    show(view, { rect }) {
      anchor = { selection: rect ? toDip(rect) : null, pointer: screen.getCursorScreenPoint() };
      size = null;
      window.setIgnoreMouseEvents(true, { forward: true });
      send("lookup:view", view);
    },
    update(view) {
      send("lookup:view", view);
    },
    hide() {
      anchor = null;
      size = null;
      captured = null;
      stopRefresh();
      capture(null);
      if (!window.isDestroyed()) {
        window.hide();
        window.setIgnoreMouseEvents(true, { forward: true });
      }
      send("lookup:view", null);
    },
    /** 设置里换了界面语言：卡片不重新加载，换掉翻译 */
    localeChanged(locale) {
      send("locale:changed", locale);
    },
    /** 小帮手截到卡片上的一下点击：交给页面（展开语言、选一项这类只在页面里的事它自己办，别的再报 lookup:act） */
    click(id) {
      send("lookup:click", id);
    },
    destroy() {
      stopRefresh();
      if (!window.isDestroyed()) window.destroy();
    },
  };
}
