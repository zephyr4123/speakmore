import assert from "node:assert/strict";
import { test } from "node:test";
import { floatAboveAll, floatingWindowOptions, showAboveAll } from "../../src/app/on-top.mjs";

/** 假窗口：记下调了哪些方法、带什么参数 */
function fakeWindow() {
  const calls = [];
  const record =
    (name) =>
    (...args) =>
      calls.push([name, ...args]);
  return {
    calls,
    setAlwaysOnTop: record("setAlwaysOnTop"),
    setVisibleOnAllWorkspaces: record("setVisibleOnAllWorkspaces"),
    setFullScreenable: record("setFullScreenable"),
    setHiddenInMissionControl: record("setHiddenInMissionControl"),
    showInactive: record("showInactive"),
    moveTop: record("moveTop"),
  };
}

test("浮在一切之上：最高一档（同原版的 screen-saver），每个桌面、全屏应用上都在，不能全屏；Mac 上不进调度中心", () => {
  const mac = fakeWindow();
  floatAboveAll(mac, { mac: true });
  assert.deepEqual(mac.calls, [
    ["setAlwaysOnTop", true, "screen-saver", 1],
    // 不带 skipTransformProcessType 的话，Electron 每调一次就把程序坞图标藏起来
    ["setVisibleOnAllWorkspaces", true, { visibleOnFullScreen: true, skipTransformProcessType: true }],
    ["setFullScreenable", false],
    ["setHiddenInMissionControl", true],
  ]);
  // Windows 上没有调度中心，这个方法也只在 Mac 上有
  const windows = fakeWindow();
  floatAboveAll(windows, { mac: false });
  assert.ok(!windows.calls.some(([name]) => name === "setHiddenInMissionControl"));
});

test("Mac 上建成面板：程序坞里有图标时我们是普通应用，普通窗口浮不到别家的全屏应用上面", () => {
  assert.deepEqual(floatingWindowOptions({ mac: true }), { type: "panel" });
  assert.deepEqual(floatingWindowOptions({ mac: false }), {});
});

test("每次露出来都再顶一次（issue #16：Windows 上后来的置顶窗口会盖住我们），不抢焦点", () => {
  const window = fakeWindow();
  showAboveAll(window);
  assert.deepEqual(window.calls, [["setAlwaysOnTop", true, "screen-saver", 1], ["showInactive"], ["moveTop"]]);
});
