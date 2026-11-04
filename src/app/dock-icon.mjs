// Mac 程序坞里的图标跟着设置（dockIcon）亮出来、藏起来。
// Electron 在 dock.show() 之后 1 秒内调 dock.hide() 什么都不做（防系统留下几个图标，见它的 browser_mac.mm），
// 开关打开后马上又关，图标就留着、跟设置对不上了：藏之前等够 1 秒，等完再看一眼设置

/** Electron 在 show 之后多久内不理 hide */
const HIDE_AFTER_SHOW_MS = 1000;

/**
 * @param {object} options
 * @param {{ show: () => Promise<void>, hide: () => void } | undefined} options.dock app.dock，只有 Mac 有
 * @param {() => boolean} options.wanted 设置里现在要不要显示
 * @param {() => number} [options.now]
 * @param {(ms: number) => Promise<void>} [options.sleep]
 * @returns {() => Promise<void>} 设置变了调一次
 */
export function createDockIcon({
  dock,
  wanted,
  now = Date.now,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
}) {
  let shownAt = Number.NEGATIVE_INFINITY;
  return async function sync() {
    if (!dock) return;
    if (wanted()) {
      shownAt = now();
      await dock.show();
      return;
    }
    const wait = shownAt + HIDE_AFTER_SHOW_MS - now();
    if (wait > 0) await sleep(wait);
    if (!wanted()) dock.hide();
  };
}
