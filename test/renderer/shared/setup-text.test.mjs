import assert from "node:assert/strict";
import { test } from "node:test";
import { createTranslator } from "../../../src/i18n/index.mjs";
import { describeError, homeText, permissionGranted, permissionText } from "../../../src/renderer/shared/setup-text.mjs";

// 按 macOS 的说法查；Windows 那几句的说法在 i18n 的测试里查
const zh = createTranslator("zh-CN", "darwin");
const en = createTranslator("en", "darwin");

test("主进程的报错去掉 Electron 加的前缀，只留那句话", () => {
  const wrapped = new Error("Error invoking remote method 'setup:set-theme': Error: theme 要是 ink / cinnabar 之一");
  assert.equal(describeError(wrapped), "theme 要是 ink / cinnabar 之一");
  assert.equal(describeError(new Error("Error invoking remote method 'a': TypeError: 不认识的热键")), "不认识的热键");
  assert.equal(describeError(new Error("网断了")), "网断了");
  assert.equal(describeError("字符串也行"), "字符串也行");
});

test("权限给没给：麦克风看系统给的状态，另两项是小帮手报的真假，还没报上来是 null", () => {
  assert.equal(permissionGranted("microphone", "granted"), true);
  assert.equal(permissionGranted("microphone", "not-determined"), false);
  assert.equal(permissionGranted("listen", true), true);
  assert.equal(permissionGranted("trusted", null), null);
});

test('麦克风从没问过时按钮写"授权"：要先让系统弹框，系统设置的列表里才有这个应用', () => {
  assert.deepEqual(permissionText("microphone", "not-determined", zh), ["未授权", "problem", "授权"]);
  assert.deepEqual(permissionText("microphone", "denied", zh), ["未授权", "problem", "系统设置"]);
  assert.deepEqual(permissionText("listen", null, zh), ["检查中…", "pending", "系统设置"]);
  assert.deepEqual(permissionText("trusted", true, zh), ["已授权", "ok", "系统设置"]);
  assert.deepEqual(permissionText("microphone", "not-determined", en), ["Not granted", "problem", "Allow"]);
  assert.deepEqual(permissionText("trusted", true, en), ["Granted", "ok", "System Settings"]);
});

test("数据目录给人看：Mac 上家目录写成 ~，Windows 上（主进程不给 userHome）照写完整路径", () => {
  assert.equal(homeText({ home: "/Users/kim/.speakmore", userHome: "/Users/kim" }), "~/.speakmore");
  assert.equal(homeText({ home: "/Users/kim", userHome: "/Users/kim" }), "~");
  // 搬到别的盘、或者名字只是开头一样的目录：不缩写
  assert.equal(homeText({ home: "/Volumes/Data/.speakmore", userHome: "/Users/kim" }), "/Volumes/Data/.speakmore");
  assert.equal(homeText({ home: "/Users/kimberly/.speakmore", userHome: "/Users/kim" }), "/Users/kimberly/.speakmore");
  assert.equal(homeText({ home: "C:\\Users\\kim\\.speakmore", userHome: null }), "C:\\Users\\kim\\.speakmore");
});
