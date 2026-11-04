// 悬浮条、划词卡片这类浮在一切之上的窗口怎么放在最上面。
// GitHub issue #16：Windows 上悬浮条被别的应用盖住了。置顶的窗口之间谁后被顶上来谁在上面，
// 别家开着的置顶小窗（10-23 在开发机上用一个置顶窗口复现过）后来居上，就盖住了我们。
// 做法照原版 Typeless（setAlwaysOnTop(true, "screen-saver", 1)、不进调度中心、不能全屏），再加一条：每次露出来都再顶一次。

/** 最高一档：Mac 上比别家的浮动面板、全屏应用都高；Windows 上置顶只有一档，这个参数不起作用 */
const LEVEL = "screen-saver";

/**
 * 建窗口时并进选项里：Mac 上建成面板。程序坞里有图标时我们是普通应用，普通应用的窗口浮不到别家的全屏应用上面，
 * 面板可以（原版 Typeless 也是这么做的）
 * @param {{ mac: boolean }} platform
 */
export const floatingWindowOptions = ({ mac }) => (mac ? { type: "panel" } : {});

/**
 * 建好窗口以后调一次
 * @param {import("electron").BrowserWindow} window
 * @param {{ mac: boolean }} platform setHiddenInMissionControl 只有 Mac 上有
 */
export function floatAboveAll(window, { mac }) {
  window.setAlwaysOnTop(true, LEVEL, 1);
  // 每个桌面、别家的全屏应用上都看得见。skipTransformProcessType：不带的话 Electron 每调一次就把程序坞图标藏起来
  window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true, skipTransformProcessType: true });
  window.setFullScreenable(false);
  // 不进调度中心、不进窗口切换：透明的窗口在那里只是一块黑的
  if (mac) window.setHiddenInMissionControl(true);
}

/**
 * 露出来（不抢焦点），再顶到所有置顶窗口的最上面
 * @param {import("electron").BrowserWindow} window
 */
export function showAboveAll(window) {
  window.setAlwaysOnTop(true, LEVEL, 1);
  window.showInactive();
  window.moveTop();
}
